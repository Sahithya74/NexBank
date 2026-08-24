'use strict';

const { pool, query, queryOne, withTransaction } = require('../config/db');
const { notFound, badRequest, forbidden } = require('../utils/AppError');
const { generateReference } = require('../utils/reference');
const { parsePagination } = require('../utils/validate');
const money = require('../utils/money');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

const CATEGORIES = ['electricity', 'water', 'internet', 'mobile', 'dth', 'gas', 'insurance', 'other'];

function toDTO(row) {
  return {
    id: row.id,
    billerId: row.biller_id,
    billerName: row.biller_name,
    category: row.category,
    consumerNumber: row.consumer_number,
    label: row.label,
    amount: String(row.amount),
    currency: row.currency_code,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

const SELECT_BILL = `
  SELECT b.*, bl.name AS biller_name, bl.category
    FROM bills b JOIN billers bl ON bl.id = b.biller_id`;

async function listBillers(category = null) {
  const rows = category
    ? await query('SELECT id, name, category FROM billers WHERE is_active = 1 AND category = ? ORDER BY name', [category])
    : await query('SELECT id, name, category FROM billers WHERE is_active = 1 ORDER BY category, name');
  return rows;
}

/** Bills for a customer, with overdue status derived from the due date. */
async function listForUser(userId, filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20 });

  const where = ['b.user_id = ?'];
  const params = [userId];

  if (filters.status) {
    where.push('b.status = ?');
    params.push(filters.status);
  }
  if (filters.category) {
    where.push('bl.category = ?');
    params.push(filters.category);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  // Keep derived state honest before reading.
  await pool.execute(
    "UPDATE bills SET status = 'overdue' WHERE user_id = ? AND status = 'pending' AND due_date < CURDATE()",
    [userId],
  );

  const rows = await query(
    `${SELECT_BILL} ${whereSql} ORDER BY b.due_date ASC LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM bills b JOIN billers bl ON bl.id = b.biller_id ${whereSql}`,
    params,
  );
  const [summary] = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN status IN ('pending','overdue') THEN amount END), 0) AS due,
       SUM(status = 'pending') AS pending,
       SUM(status = 'overdue') AS overdue
     FROM bills WHERE user_id = ?`,
    [userId],
  );

  return {
    items: rows.map(toDTO),
    summary: {
      totalDue: String(summary.due),
      pending: Number(summary.pending || 0),
      overdue: Number(summary.overdue || 0),
    },
    pagination: { page, limit, total: Number(total) },
  };
}

async function addBill(user, payload, req) {
  const biller = await queryOne('SELECT id, name FROM billers WHERE id = ? AND is_active = 1', [payload.billerId]);
  if (!biller) throw notFound('That biller is not available.');

  const amount = money.normaliseAmount(payload.amount, { decimals: 2, label: 'Bill amount' });

  const [result] = await pool.execute(
    `INSERT INTO bills (user_id, biller_id, consumer_number, label, amount, currency_code, due_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [user.id, payload.billerId, payload.consumerNumber, payload.label || null, amount, payload.currency || 'INR', payload.dueDate],
  );

  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'bill.add',
    entityType: 'bill',
    entityId: result.insertId,
    description: `Added ${biller.name} bill for ${amount}`,
    req,
  });

  const row = await queryOne(`${SELECT_BILL} WHERE b.id = ?`, [result.insertId]);
  return toDTO(row);
}

async function removeBill(user, billId, req) {
  const bill = await queryOne('SELECT id, status FROM bills WHERE id = ? AND user_id = ?', [billId, user.id]);
  if (!bill) throw notFound('That bill could not be found.');
  if (bill.status === 'paid') {
    throw badRequest('A paid bill cannot be removed - it is part of your payment history.', 'BILL_ALREADY_PAID');
  }
  await pool.execute('DELETE FROM bills WHERE id = ? AND user_id = ?', [billId, user.id]);
  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'bill.remove',
    entityType: 'bill',
    entityId: billId,
    description: 'Removed a pending bill',
    req,
  });
  return { id: billId };
}

/**
 * Pay a bill from a bank account. The debit, payment record, bill status change,
 * ledger entry, notification and audit entry all commit together.
 */
async function payBill(user, { billId, accountId }, req) {
  const bill = await queryOne(`${SELECT_BILL} WHERE b.id = ? AND b.user_id = ?`, [billId, user.id]);
  if (!bill) throw notFound('That bill could not be found.');
  if (bill.status === 'paid') throw badRequest('This bill has already been paid.', 'BILL_ALREADY_PAID');
  if (bill.status === 'cancelled') throw badRequest('This bill has been cancelled.', 'BILL_CANCELLED');

  const account = await queryOne(
    'SELECT id, user_id, currency_code, status FROM accounts WHERE id = ?',
    [accountId],
  );
  if (!account) throw notFound('That account could not be found.');
  if (String(account.user_id) !== String(user.id)) throw forbidden('You do not have access to that account.');
  if (account.status !== 'active') throw badRequest('That account is not active.', 'ACCOUNT_INACTIVE');
  if (account.currency_code !== bill.currency_code) {
    throw badRequest(
      `This bill is in ${bill.currency_code}. Choose a ${bill.currency_code} account.`,
      'CURRENCY_MISMATCH',
    );
  }

  const amount = String(bill.amount);

  return withTransaction(async (conn) => {
    const [locked] = await conn.execute(
      'SELECT id, balance FROM accounts WHERE id = ? FOR UPDATE',
      [accountId],
    );
    if (!locked.length) throw notFound('That account could not be found.');
    if (money.compare(String(locked[0].balance), amount) < 0) {
      throw badRequest(
        `Insufficient balance. Available: ${locked[0].balance} ${account.currency_code}.`,
        'INSUFFICIENT_FUNDS',
      );
    }

    const [debit] = await conn.execute(
      'UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?',
      [amount, accountId, amount],
    );
    if (debit.affectedRows !== 1) {
      throw badRequest('Insufficient balance for this payment.', 'INSUFFICIENT_FUNDS');
    }

    const [statusUpdate] = await conn.execute(
      "UPDATE bills SET status = 'paid' WHERE id = ? AND status <> 'paid'",
      [billId],
    );
    if (statusUpdate.affectedRows !== 1) {
      throw badRequest('This bill has already been paid.', 'BILL_ALREADY_PAID');
    }

    const [[balanceRow]] = await conn.execute('SELECT balance FROM accounts WHERE id = ?', [accountId]);
    const reference = generateReference('BPY');

    await conn.execute(
      `INSERT INTO bill_payments (reference, bill_id, user_id, account_id, amount, currency_code, status)
       VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
      [reference, billId, user.id, accountId, amount, bill.currency_code],
    );

    await conn.execute(
      `INSERT INTO transactions
         (reference, user_id, account_id, type, direction, description, counterparty_name,
          amount, currency_code, balance_after, status)
       VALUES (?, ?, ?, 'bill_payment', 'debit', ?, ?, ?, ?, ?, 'completed')`,
      [
        `${reference}D`,
        user.id,
        accountId,
        `${bill.biller_name} bill payment`,
        bill.biller_name,
        amount,
        bill.currency_code,
        String(balanceRow.balance),
      ],
    );

    await notificationService.create({
      connection: conn,
      userId: user.id,
      title: 'Bill paid',
      message: `${bill.biller_name} bill of ${amount} ${bill.currency_code} paid. Reference ${reference}.`,
      type: 'payment',
    });

    await auditService.record({
      connection: conn,
      userId: user.id,
      actorEmail: user.email,
      action: 'bill.pay',
      entityType: 'bill_payment',
      entityId: reference,
      description: `Paid ${bill.biller_name} bill of ${amount} ${bill.currency_code}`,
      req,
    });

    return {
      reference,
      biller: bill.biller_name,
      amount,
      currency: bill.currency_code,
      status: 'completed',
      balanceAfter: String(balanceRow.balance),
      paidAt: new Date().toISOString(),
    };
  });
}

async function paymentHistory(userId, filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 10 });

  const items = await query(
    `SELECT bp.reference, bp.amount, bp.currency_code, bp.status, bp.paid_at,
            bl.name AS biller_name, bl.category, b.consumer_number
       FROM bill_payments bp
       JOIN bills b   ON b.id = bp.bill_id
       JOIN billers bl ON bl.id = b.biller_id
      WHERE bp.user_id = ?
      ORDER BY bp.paid_at DESC LIMIT ? OFFSET ?`,
    [userId, String(limit), String(offset)],
  );
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM bill_payments WHERE user_id = ?', [userId]);

  return {
    items: items.map((row) => ({ ...row, amount: String(row.amount) })),
    pagination: { page, limit, total: Number(total) },
  };
}

module.exports = { CATEGORIES, listBillers, listForUser, addBill, removeBill, payBill, paymentHistory };
