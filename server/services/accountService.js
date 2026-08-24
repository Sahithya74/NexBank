'use strict';

const { pool, query, queryOne, withTransaction } = require('../config/db');
const { notFound, forbidden, badRequest } = require('../utils/AppError');
const { maskAccountNumber } = require('../utils/mask');
const { generateAccountNumber } = require('../utils/reference');
const { parsePagination, parseSort } = require('../utils/validate');
const money = require('../utils/money');
const currencyService = require('./currencyService');
const auditService = require('./auditService');

const SORTABLE = ['created_at', 'balance', 'account_type', 'status'];

/** Account rows only ever leave the server masked. */
function toDTO(row) {
  return {
    id: row.id,
    userId: row.user_id,
    accountNumberMasked: maskAccountNumber(row.account_number),
    lastFour: String(row.account_number).slice(-4),
    accountType: row.account_type,
    currency: row.currency_code,
    currencySymbol: row.symbol || '',
    balance: String(row.balance),
    status: row.status,
    ifscCode: row.ifsc_code,
    branch: row.branch,
    openedAt: row.opened_at,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
  };
}

const SELECT_ACCOUNT = `
  SELECT a.*, c.symbol, u.full_name AS owner_name, u.email AS owner_email
    FROM accounts a
    JOIN currencies c ON c.code = a.currency_code
    JOIN users u      ON u.id = a.user_id`;

async function listForUser(userId) {
  const rows = await query(`${SELECT_ACCOUNT} WHERE a.user_id = ? ORDER BY a.created_at ASC`, [userId]);
  return rows.map(toDTO);
}

/** Load an account and assert the caller owns it. */
async function getOwned(userId, accountId) {
  const row = await queryOne(`${SELECT_ACCOUNT} WHERE a.id = ?`, [accountId]);
  if (!row) throw notFound('That account could not be found.');
  if (String(row.user_id) !== String(userId)) {
    throw forbidden('You do not have access to that account.');
  }
  return row;
}

async function getForUser(userId, accountId) {
  return toDTO(await getOwned(userId, accountId));
}

/**
 * Reveal the full account number to its owner only. Customers need this to receive
 * money; every reveal is audited.
 */
async function revealAccountNumber(user, accountId, req) {
  const row = await getOwned(user.id, accountId);
  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'account.number.reveal',
    entityType: 'account',
    entityId: accountId,
    description: `Revealed full number for account ending ${String(row.account_number).slice(-4)}`,
    req,
  });
  return { id: row.id, accountNumber: row.account_number, ifscCode: row.ifsc_code };
}

/** Totals per currency plus the portfolio value in one base currency. */
async function summaryForUser(userId, base) {
  const rows = await query(
    `SELECT a.currency_code, c.symbol, COUNT(*) AS accounts, SUM(a.balance) AS total
       FROM accounts a
       JOIN currencies c ON c.code = a.currency_code
      WHERE a.user_id = ? AND a.status <> 'closed'
      GROUP BY a.currency_code, c.symbol`,
    [userId],
  );

  const baseCurrency = await currencyService.get(base);
  let totalScaled = 0n;
  const byCurrency = [];

  for (const row of rows) {
    const rate = await currencyService.getRate(row.currency_code, base);
    const converted = money.convert(String(row.total), rate, baseCurrency.decimals);
    totalScaled += money.toScaled(converted);
    byCurrency.push({
      currency: row.currency_code,
      symbol: row.symbol,
      accounts: Number(row.accounts),
      total: String(row.total),
      convertedTotal: converted,
    });
  }

  return {
    base,
    baseSymbol: baseCurrency.symbol,
    totalBalance: money.fromScaled(totalScaled, baseCurrency.decimals),
    byCurrency,
  };
}

/** Account statement: transactions on one account, optionally date-bounded. */
async function statement(userId, accountId, filters = {}) {
  const account = await getOwned(userId, accountId);
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20 });

  const where = ['t.account_id = ?'];
  const params = [accountId];

  if (filters.from) {
    where.push('t.created_at >= ?');
    params.push(`${filters.from} 00:00:00`);
  }
  if (filters.to) {
    where.push('t.created_at <= ?');
    params.push(`${filters.to} 23:59:59`);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const items = await query(
    `SELECT t.id, t.reference, t.type, t.direction, t.description, t.counterparty_name,
            t.amount, t.currency_code, t.balance_after, t.status, t.created_at
       FROM transactions t ${whereSql}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM transactions t ${whereSql}`, params);
  const [totals] = await query(
    `SELECT
        COALESCE(SUM(CASE WHEN t.direction = 'credit' AND t.status = 'completed' THEN t.amount END), 0) AS credits,
        COALESCE(SUM(CASE WHEN t.direction = 'debit'  AND t.status = 'completed' THEN t.amount END), 0) AS debits
       FROM transactions t ${whereSql}`,
    params,
  );

  return {
    account: toDTO(account),
    items: items.map((row) => ({ ...row, amount: String(row.amount) })),
    totals: { credits: String(totals.credits), debits: String(totals.debits) },
    pagination: { page, limit, total: Number(total) },
  };
}

/** Staff view: all accounts, or only those belonging to assigned customers. */
async function listAll(filters = {}, { assignedTo = null } = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20 });
  const { column, direction } = parseSort(filters, SORTABLE, 'created_at');

  const where = [];
  const params = [];

  if (assignedTo) {
    where.push('u.managed_by = ?');
    params.push(assignedTo);
  }
  if (filters.q) {
    where.push('(a.account_number LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  if (filters.status) {
    where.push('a.status = ?');
    params.push(filters.status);
  }
  if (filters.currency) {
    where.push('a.currency_code = ?');
    params.push(filters.currency);
  }
  if (filters.userId) {
    where.push('a.user_id = ?');
    params.push(filters.userId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `${SELECT_ACCOUNT} ${whereSql} ORDER BY a.${column} ${direction} LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM accounts a JOIN users u ON u.id = a.user_id ${whereSql}`,
    params,
  );

  return { items: rows.map(toDTO), pagination: { page, limit, total: Number(total) } };
}

/** Allocate a unique account number, retrying on the (very unlikely) collision. */
async function allocateAccountNumber(connection) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateAccountNumber();
    const [rows] = await connection.execute(
      'SELECT id FROM accounts WHERE account_number = ? LIMIT 1',
      [candidate],
    );
    if (rows.length === 0) return candidate;
  }
  throw badRequest('Could not allocate an account number. Please try again.', 'ACCOUNT_NUMBER_UNAVAILABLE');
}

/** Open an account (used at registration and by admins). */
async function openAccount(
  { userId, accountType = 'savings', currency = 'INR', branch = 'Anna Nagar, Chennai', ifscCode = 'NEXB0001234', initialBalance = '0.00' },
  { connection = null, actor = null, req = null } = {},
) {
  await currencyService.requireActive(currency);

  const run = async (conn) => {
    const accountNumber = await allocateAccountNumber(conn);
    const [result] = await conn.execute(
      `INSERT INTO accounts (user_id, account_number, account_type, currency_code, balance, status, ifsc_code, branch, opened_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, CURDATE())`,
      [userId, accountNumber, accountType, currency, initialBalance, ifscCode, branch],
    );
    await auditService.record({
      connection: conn,
      userId: actor ? actor.id : userId,
      actorEmail: actor ? actor.email : null,
      action: 'account.open',
      entityType: 'account',
      entityId: result.insertId,
      description: `Opened ${accountType} account ending ${accountNumber.slice(-4)} in ${currency}`,
      req,
    });
    return { id: result.insertId, accountNumber };
  };

  // When a caller supplies its own transaction the new row is not visible on the
  // pool until that transaction commits, so read it back on the same connection.
  if (connection) {
    const created = await run(connection);
    const [rows] = await connection.execute(`${SELECT_ACCOUNT} WHERE a.id = ?`, [created.id]);
    return toDTO(rows[0]);
  }

  const created = await withTransaction(run);
  const row = await queryOne(`${SELECT_ACCOUNT} WHERE a.id = ?`, [created.id]);
  return toDTO(row);
}

/** Admin/manager: freeze, reactivate or close an account. */
async function setStatus(accountId, status, actor, req) {
  const row = await queryOne(`${SELECT_ACCOUNT} WHERE a.id = ?`, [accountId]);
  if (!row) throw notFound('That account could not be found.');

  if (status === 'closed' && money.compare(String(row.balance), '0') > 0) {
    throw badRequest('An account with a remaining balance cannot be closed.', 'ACCOUNT_NOT_EMPTY');
  }

  await pool.execute('UPDATE accounts SET status = ? WHERE id = ?', [status, accountId]);
  await auditService.record({
    userId: actor.id,
    actorEmail: actor.email,
    action: 'account.status.update',
    entityType: 'account',
    entityId: accountId,
    description: `Account ending ${String(row.account_number).slice(-4)} set to ${status}`,
    req,
  });

  const updated = await queryOne(`${SELECT_ACCOUNT} WHERE a.id = ?`, [accountId]);
  return toDTO(updated);
}

module.exports = {
  toDTO,
  listForUser,
  getForUser,
  getOwned,
  revealAccountNumber,
  summaryForUser,
  statement,
  listAll,
  openAccount,
  setStatus,
};
