'use strict';

const { pool, query, queryOne } = require('../config/db');
const { notFound, conflict, badRequest } = require('../utils/AppError');
const { maskAccountNumber } = require('../utils/mask');
const auditService = require('./auditService');

function toDTO(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    holderName: row.holder_name,
    accountNumberMasked: maskAccountNumber(row.account_number),
    lastFour: String(row.account_number).slice(-4),
    bankName: row.bank_name,
    ifscCode: row.ifsc_code,
    currency: row.currency_code,
    isInternal: Boolean(row.is_internal),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

async function listForUser(userId) {
  const rows = await query(
    'SELECT * FROM beneficiaries WHERE user_id = ? AND is_active = 1 ORDER BY nickname ASC',
    [userId],
  );
  return rows.map(toDTO);
}

async function getOwned(userId, beneficiaryId) {
  const row = await queryOne(
    'SELECT * FROM beneficiaries WHERE id = ? AND user_id = ?',
    [beneficiaryId, userId],
  );
  if (!row) throw notFound('That beneficiary could not be found.');
  return row;
}

/**
 * Add a beneficiary. Internal beneficiaries are verified against a live NexBank
 * account so a transfer can never be attempted against an account that does not exist.
 */
async function create(user, payload, req) {
  const accountNumber = payload.accountNumber.trim().toUpperCase();

  const ownAccount = await queryOne(
    'SELECT id FROM accounts WHERE account_number = ? AND user_id = ?',
    [accountNumber, user.id],
  );
  if (ownAccount) {
    throw badRequest('This is your own account - use "Between my accounts" instead.', 'OWN_ACCOUNT');
  }

  const existing = await queryOne(
    'SELECT id FROM beneficiaries WHERE user_id = ? AND account_number = ?',
    [user.id, accountNumber],
  );
  if (existing) throw conflict('That account is already saved as a beneficiary.');

  const internalAccount = await queryOne(
    `SELECT a.id, a.currency_code, a.status, u.full_name
       FROM accounts a JOIN users u ON u.id = a.user_id
      WHERE a.account_number = ?`,
    [accountNumber],
  );

  const isInternal = Boolean(internalAccount);
  if (isInternal && internalAccount.status !== 'active') {
    throw badRequest('That NexBank account is not active.', 'ACCOUNT_INACTIVE');
  }
  if (!isInternal && payload.bankName === 'NexBank') {
    throw badRequest('No NexBank account matches that number.', 'ACCOUNT_NOT_FOUND');
  }

  const [result] = await pool.execute(
    `INSERT INTO beneficiaries
       (user_id, nickname, account_number, holder_name, bank_name, ifsc_code, currency_code, is_internal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      payload.nickname,
      accountNumber,
      isInternal ? internalAccount.full_name : payload.holderName,
      payload.bankName || 'NexBank',
      payload.ifscCode || null,
      isInternal ? internalAccount.currency_code : payload.currency || 'INR',
      isInternal ? 1 : 0,
    ],
  );

  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'beneficiary.create',
    entityType: 'beneficiary',
    entityId: result.insertId,
    description: `Added beneficiary ${payload.nickname} (${maskAccountNumber(accountNumber)})`,
    req,
  });

  const row = await queryOne('SELECT * FROM beneficiaries WHERE id = ?', [result.insertId]);
  return toDTO(row);
}

async function update(user, beneficiaryId, payload, req) {
  await getOwned(user.id, beneficiaryId);
  await pool.execute(
    'UPDATE beneficiaries SET nickname = ?, ifsc_code = ? WHERE id = ? AND user_id = ?',
    [payload.nickname, payload.ifscCode || null, beneficiaryId, user.id],
  );
  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'beneficiary.update',
    entityType: 'beneficiary',
    entityId: beneficiaryId,
    description: `Updated beneficiary ${payload.nickname}`,
    req,
  });
  const row = await queryOne('SELECT * FROM beneficiaries WHERE id = ?', [beneficiaryId]);
  return toDTO(row);
}

/** Soft delete: transfer history keeps its reference to the beneficiary. */
async function remove(user, beneficiaryId, req) {
  const row = await getOwned(user.id, beneficiaryId);
  await pool.execute('UPDATE beneficiaries SET is_active = 0 WHERE id = ?', [beneficiaryId]);
  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'beneficiary.remove',
    entityType: 'beneficiary',
    entityId: beneficiaryId,
    description: `Removed beneficiary ${row.nickname}`,
    req,
  });
  return { id: beneficiaryId };
}

/** Look up a NexBank account holder before saving them, so names can be confirmed. */
async function verifyAccount(accountNumber) {
  const row = await queryOne(
    `SELECT a.account_number, a.currency_code, a.status, u.full_name
       FROM accounts a JOIN users u ON u.id = a.user_id
      WHERE a.account_number = ?`,
    [accountNumber.trim().toUpperCase()],
  );
  if (!row) throw notFound('No NexBank account matches that number.');
  if (row.status !== 'active') throw badRequest('That account is not active.', 'ACCOUNT_INACTIVE');
  return {
    holderName: row.full_name,
    accountNumberMasked: maskAccountNumber(row.account_number),
    currency: row.currency_code,
  };
}

module.exports = { toDTO, listForUser, getOwned, create, update, remove, verifyAccount };
