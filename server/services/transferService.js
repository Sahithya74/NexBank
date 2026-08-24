'use strict';

const { query, queryOne, withTransaction } = require('../config/db');
const { badRequest, notFound, forbidden } = require('../utils/AppError');
const { generateReference } = require('../utils/reference');
const { maskAccountNumber } = require('../utils/mask');
const { parsePagination } = require('../utils/validate');
const money = require('../utils/money');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

/** Row lock helper: always lock accounts in ascending id order to avoid deadlocks. */
async function lockAccounts(conn, ids) {
  const ordered = [...new Set(ids.map(Number))].sort((a, b) => a - b);
  const placeholders = ordered.map(() => '?').join(', ');
  const [rows] = await conn.execute(
    `SELECT id, user_id, account_number, currency_code, balance, status
       FROM accounts WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,
    ordered,
  );
  return new Map(rows.map((row) => [String(row.id), row]));
}

/** Resolve the destination account for the requested transfer mode. */
async function resolveDestination(payload, user) {
  if (payload.mode === 'own') {
    const account = await queryOne(
      'SELECT id, user_id, account_number, currency_code, status FROM accounts WHERE id = ?',
      [payload.toAccountId],
    );
    if (!account) throw notFound('The destination account could not be found.');
    if (String(account.user_id) !== String(user.id)) {
      throw forbidden('You can only transfer between your own accounts in this mode.');
    }
    return { account, beneficiaryId: null, counterpartyName: 'Own account' };
  }

  const beneficiary = await queryOne(
    'SELECT * FROM beneficiaries WHERE id = ? AND user_id = ? AND is_active = 1',
    [payload.beneficiaryId, user.id],
  );
  if (!beneficiary) throw notFound('That beneficiary could not be found.');
  if (!beneficiary.is_internal) {
    throw badRequest(
      'Transfers to accounts outside NexBank are not supported yet.',
      'EXTERNAL_TRANSFER_UNSUPPORTED',
    );
  }

  const account = await queryOne(
    'SELECT id, user_id, account_number, currency_code, status FROM accounts WHERE account_number = ?',
    [beneficiary.account_number],
  );
  if (!account) throw notFound('The beneficiary account could not be found.');

  return { account, beneficiaryId: beneficiary.id, counterpartyName: beneficiary.holder_name };
}

/**
 * Execute a fund transfer.
 *
 * Everything below - the balance checks, both balance updates, the transfer record,
 * both ledger entries, notifications and the audit entry - commits or rolls back as
 * a single MySQL transaction. Nothing is reported to the caller until it commits.
 */
async function createTransfer(user, payload, req) {
  const idempotencyKey = payload.idempotencyKey || null;

  if (idempotencyKey) {
    const existing = await queryOne(
      'SELECT * FROM transfers WHERE sender_user_id = ? AND idempotency_key = ?',
      [user.id, idempotencyKey],
    );
    if (existing) {
      return {
        reference: existing.reference,
        amount: String(existing.amount),
        currency: existing.currency_code,
        status: existing.status,
        duplicate: true,
      };
    }
  }

  const destination = await resolveDestination(payload, user);

  const sender = await queryOne(
    'SELECT id, user_id, account_number, currency_code, status FROM accounts WHERE id = ?',
    [payload.fromAccountId],
  );
  if (!sender) throw notFound('The source account could not be found.');
  if (String(sender.user_id) !== String(user.id)) {
    throw forbidden('You do not have access to that account.');
  }
  if (sender.status !== 'active') {
    throw badRequest('The source account is not active.', 'ACCOUNT_INACTIVE');
  }
  if (destination.account.status !== 'active') {
    throw badRequest('The destination account is not active.', 'ACCOUNT_INACTIVE');
  }
  if (String(sender.id) === String(destination.account.id)) {
    throw badRequest('Choose two different accounts.', 'SAME_ACCOUNT');
  }
  if (sender.currency_code !== destination.account.currency_code) {
    throw badRequest(
      `Cross-currency transfers are not supported. Both accounts must be in ${sender.currency_code}.`,
      'CURRENCY_MISMATCH',
    );
  }

  const amount = money.normaliseAmount(payload.amount, { decimals: 2, label: 'Transfer amount' });

  try {
    return await runTransfer({ user, sender, destination, amount, payload, idempotencyKey, req });
  } catch (error) {
    // A rejected transfer still belongs in the customer's history, but it cannot be
    // written inside the transaction that is being rolled back - so it is recorded here.
    if (error && error.code === 'INSUFFICIENT_FUNDS') {
      await recordFailedTransfer({
        user,
        senderAccountId: sender.id,
        receiverAccountId: destination.account.id,
        beneficiaryId: destination.beneficiaryId,
        counterpartyName: destination.counterpartyName,
        amount,
        currency: sender.currency_code,
        remarks: payload.remarks || null,
        reason: 'Insufficient balance',
        req,
      });
    }
    throw error;
  }
}

/** Persist a failed transfer attempt on its own connection, outside the rolled-back work. */
async function recordFailedTransfer({
  user, senderAccountId, receiverAccountId, beneficiaryId, counterpartyName,
  amount, currency, remarks, reason, req,
}) {
  const reference = generateReference('TRF');
  try {
    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO transfers
           (reference, sender_user_id, sender_account_id, receiver_account_id,
            beneficiary_id, amount, currency_code, remarks, status, failure_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?)`,
        [reference, user.id, senderAccountId, receiverAccountId, beneficiaryId,
          amount, currency, remarks, reason],
      );
      await conn.execute(
        `INSERT INTO transactions
           (reference, user_id, account_id, type, direction, description, counterparty_name,
            amount, currency_code, status)
         VALUES (?, ?, ?, 'transfer_out', 'debit', ?, ?, ?, ?, 'failed')`,
        [`${reference}D`, user.id, senderAccountId,
          remarks || `Transfer to ${counterpartyName}`, counterpartyName, amount, currency],
      );
      await notificationService.create({
        connection: conn,
        userId: user.id,
        title: 'Transfer failed',
        message: `Your transfer of ${amount} ${currency} to ${counterpartyName} could not be completed: ${reason.toLowerCase()}.`,
        type: 'transfer',
      });
      await auditService.record({
        connection: conn,
        userId: user.id,
        actorEmail: user.email,
        action: 'transfer.create',
        entityType: 'transfer',
        entityId: reference,
        description: `Transfer of ${amount} ${currency} failed: ${reason}`,
        status: 'failure',
        req,
      });
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[nexbank] could not record failed transfer:', error.message);
  }
}

/** The money-moving transaction itself. */
async function runTransfer({ user, sender, destination, amount, payload, idempotencyKey, req }) {
  return withTransaction(async (conn) => {
    const locked = await lockAccounts(conn, [sender.id, destination.account.id]);
    const senderRow = locked.get(String(sender.id));
    const receiverRow = locked.get(String(destination.account.id));

    if (!senderRow || !receiverRow) {
      throw notFound('One of the accounts is no longer available.');
    }
    if (money.compare(String(senderRow.balance), amount) < 0) {
      throw badRequest(
        `Insufficient balance. Available: ${senderRow.balance} ${senderRow.currency_code}.`,
        'INSUFFICIENT_FUNDS',
      );
    }

    const [debit] = await conn.execute(
      'UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?',
      [amount, senderRow.id, amount],
    );
    if (debit.affectedRows !== 1) {
      throw badRequest('Insufficient balance for this transfer.', 'INSUFFICIENT_FUNDS');
    }

    await conn.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, receiverRow.id]);

    const [balances] = await conn.execute(
      'SELECT id, balance FROM accounts WHERE id IN (?, ?)',
      [senderRow.id, receiverRow.id],
    );
    const balanceById = Object.fromEntries(balances.map((row) => [String(row.id), String(row.balance)]));

    const reference = generateReference('TRF');
    const isOwnTransfer = payload.mode === 'own';
    const description = payload.remarks || (isOwnTransfer
      ? 'Transfer between own accounts'
      : `Transfer to ${destination.counterpartyName}`);

    await conn.execute(
      `INSERT INTO transfers
         (reference, idempotency_key, sender_user_id, sender_account_id, receiver_account_id,
          beneficiary_id, amount, currency_code, remarks, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [
        reference,
        idempotencyKey,
        user.id,
        senderRow.id,
        receiverRow.id,
        destination.beneficiaryId,
        amount,
        senderRow.currency_code,
        payload.remarks || null,
      ],
    );

    await conn.execute(
      `INSERT INTO transactions
         (reference, user_id, account_id, type, direction, description, counterparty_name,
          counterparty_ref, amount, currency_code, balance_after, status)
       VALUES (?, ?, ?, ?, 'debit', ?, ?, ?, ?, ?, ?, 'completed')`,
      [
        `${reference}D`,
        user.id,
        senderRow.id,
        isOwnTransfer ? 'self_transfer' : 'transfer_out',
        description,
        destination.counterpartyName,
        maskAccountNumber(receiverRow.account_number),
        amount,
        senderRow.currency_code,
        balanceById[String(senderRow.id)],
      ],
    );

    await conn.execute(
      `INSERT INTO transactions
         (reference, user_id, account_id, type, direction, description, counterparty_name,
          counterparty_ref, amount, currency_code, balance_after, status)
       VALUES (?, ?, ?, ?, 'credit', ?, ?, ?, ?, ?, ?, 'completed')`,
      [
        `${reference}C`,
        receiverRow.user_id,
        receiverRow.id,
        isOwnTransfer ? 'self_transfer' : 'transfer_in',
        isOwnTransfer ? description : `Transfer from ${user.full_name}`,
        isOwnTransfer ? 'Own account' : user.full_name,
        maskAccountNumber(senderRow.account_number),
        amount,
        senderRow.currency_code,
        balanceById[String(receiverRow.id)],
      ],
    );

    await notificationService.create({
      connection: conn,
      userId: user.id,
      title: 'Transfer completed',
      message: `${amount} ${senderRow.currency_code} sent to ${destination.counterpartyName}. Reference ${reference}.`,
      type: 'transfer',
    });

    if (String(receiverRow.user_id) !== String(user.id)) {
      await notificationService.create({
        connection: conn,
        userId: receiverRow.user_id,
        title: 'Funds received',
        message: `${amount} ${senderRow.currency_code} received from ${user.full_name}.`,
        type: 'transfer',
      });
    }

    await auditService.record({
      connection: conn,
      userId: user.id,
      actorEmail: user.email,
      action: 'transfer.create',
      entityType: 'transfer',
      entityId: reference,
      description: `Transferred ${amount} ${senderRow.currency_code} to ${maskAccountNumber(receiverRow.account_number)}`,
      req,
    });

    return {
      reference,
      amount,
      currency: senderRow.currency_code,
      status: 'completed',
      counterparty: destination.counterpartyName,
      fromAccount: maskAccountNumber(senderRow.account_number),
      toAccount: maskAccountNumber(receiverRow.account_number),
      balanceAfter: balanceById[String(senderRow.id)],
      completedAt: new Date().toISOString(),
      duplicate: false,
    };
  });
}

function toDTO(row) {
  return {
    id: row.id,
    reference: row.reference,
    amount: String(row.amount),
    currency: row.currency_code,
    remarks: row.remarks,
    status: row.status,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    senderName: row.sender_name,
    fromAccount: maskAccountNumber(row.from_account_number),
    toAccount: row.to_account_number ? maskAccountNumber(row.to_account_number) : null,
    beneficiaryName: row.beneficiary_name,
  };
}

const SELECT_TRANSFER = `
  SELECT t.*, su.full_name AS sender_name,
         fa.account_number AS from_account_number,
         ta.account_number AS to_account_number,
         b.holder_name AS beneficiary_name
    FROM transfers t
    JOIN users su    ON su.id = t.sender_user_id
    JOIN accounts fa ON fa.id = t.sender_account_id
    LEFT JOIN accounts ta      ON ta.id = t.receiver_account_id
    LEFT JOIN beneficiaries b  ON b.id = t.beneficiary_id`;

/** Transfer history. Pass `scopeUserId` for a customer, omit it for staff-wide views. */
async function list(filters = {}, { scopeUserId = null } = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 10 });

  const where = [];
  const params = [];
  if (scopeUserId) {
    where.push('t.sender_user_id = ?');
    params.push(scopeUserId);
  }
  if (filters.status) {
    where.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.q) {
    where.push('(t.reference LIKE ? OR t.remarks LIKE ? OR su.full_name LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  if (filters.from) {
    where.push('t.created_at >= ?');
    params.push(`${filters.from} 00:00:00`);
  }
  if (filters.to) {
    where.push('t.created_at <= ?');
    params.push(`${filters.to} 23:59:59`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `${SELECT_TRANSFER} ${whereSql} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM transfers t JOIN users su ON su.id = t.sender_user_id ${whereSql}`,
    params,
  );

  return { items: rows.map(toDTO), pagination: { page, limit, total: Number(total) } };
}

async function getByReference(reference, { scopeUserId = null } = {}) {
  const row = await queryOne(`${SELECT_TRANSFER} WHERE t.reference = ?`, [reference]);
  if (!row) throw notFound('That transfer could not be found.');
  if (scopeUserId && String(row.sender_user_id) !== String(scopeUserId)) {
    throw forbidden('You do not have access to that transfer.');
  }
  return toDTO(row);
}

module.exports = { createTransfer, list, getByReference, toDTO };
