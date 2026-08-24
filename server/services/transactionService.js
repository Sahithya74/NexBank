'use strict';

const { query, queryOne } = require('../config/db');
const { notFound, forbidden } = require('../utils/AppError');
const { parsePagination, parseSort } = require('../utils/validate');
const { hasPermission } = require('../middleware/auth');

const SORTABLE = ['created_at', 'amount', 'status', 'type'];

const TYPES = [
  'transfer_in', 'transfer_out', 'self_transfer', 'conversion', 'bill_payment',
  'card_payment', 'loan_disbursement', 'loan_repayment', 'deposit', 'withdrawal', 'fee',
];
const STATUSES = ['completed', 'pending', 'failed', 'cancelled'];

function toDTO(row) {
  return {
    id: row.id,
    reference: row.reference,
    date: row.created_at,
    description: row.description,
    counterparty: row.counterparty_name,
    counterpartyRef: row.counterparty_ref,
    type: row.type,
    direction: row.direction,
    amount: String(row.amount),
    currency: row.currency_code,
    balanceAfter: row.balance_after === null ? null : String(row.balance_after),
    status: row.status,
    accountLastFour: row.account_number ? String(row.account_number).slice(-4) : null,
    customer: row.customer_name,
    customerEmail: row.customer_email,
  };
}

const SELECT_TRANSACTION = `
  SELECT t.*, a.account_number, u.full_name AS customer_name, u.email AS customer_email,
         u.managed_by
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    JOIN users u ON u.id = t.user_id`;

/**
 * Resolve the visibility scope from the caller's permissions.
 *  - transaction.view.all      -> every transaction
 *  - transaction.view.assigned -> transactions of customers assigned to this employee
 *  - transaction.view.own      -> the caller's own transactions
 */
function scopeFor(user) {
  if (hasPermission(user, 'transaction.view.all')) return { clause: null, params: [] };
  if (hasPermission(user, 'transaction.view.assigned')) {
    return { clause: '(u.managed_by = ? OR t.user_id = ?)', params: [user.id, user.id] };
  }
  if (hasPermission(user, 'transaction.view.own')) {
    return { clause: 't.user_id = ?', params: [user.id] };
  }
  throw forbidden('You do not have permission to view transactions.');
}

async function list(user, filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 10 });
  const { column, direction } = parseSort(filters, SORTABLE, 'created_at');
  const scope = scopeFor(user);

  const where = [];
  const params = [];

  if (scope.clause) {
    where.push(scope.clause);
    params.push(...scope.params);
  }
  if (filters.q) {
    where.push('(t.reference LIKE ? OR t.description LIKE ? OR t.counterparty_name LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  if (filters.type && TYPES.includes(filters.type)) {
    where.push('t.type = ?');
    params.push(filters.type);
  }
  if (filters.status && STATUSES.includes(filters.status)) {
    where.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.direction === 'credit' || filters.direction === 'debit') {
    where.push('t.direction = ?');
    params.push(filters.direction);
  }
  if (filters.currency) {
    where.push('t.currency_code = ?');
    params.push(filters.currency);
  }
  if (filters.accountId) {
    where.push('t.account_id = ?');
    params.push(filters.accountId);
  }
  if (filters.userId) {
    where.push('t.user_id = ?');
    params.push(filters.userId);
  }
  if (filters.from) {
    where.push('t.created_at >= ?');
    params.push(`${filters.from} 00:00:00`);
  }
  if (filters.to) {
    where.push('t.created_at <= ?');
    params.push(`${filters.to} 23:59:59`);
  }
  if (filters.minAmount) {
    where.push('t.amount >= ?');
    params.push(filters.minAmount);
  }
  if (filters.maxAmount) {
    where.push('t.amount <= ?');
    params.push(filters.maxAmount);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `${SELECT_TRANSACTION} ${whereSql} ORDER BY t.${column} ${direction} LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM transactions t JOIN users u ON u.id = t.user_id ${whereSql}`,
    params,
  );

  return { items: rows.map(toDTO), pagination: { page, limit, total: Number(total) } };
}

async function getByReference(user, reference) {
  const row = await queryOne(`${SELECT_TRANSACTION} WHERE t.reference = ?`, [reference]);
  if (!row) throw notFound('That transaction could not be found.');

  const canSeeAll = hasPermission(user, 'transaction.view.all');
  const isOwn = String(row.user_id) === String(user.id);
  const isAssigned = hasPermission(user, 'transaction.view.assigned')
    && String(row.managed_by || '') === String(user.id);

  if (!canSeeAll && !isOwn && !isAssigned) {
    throw forbidden('You do not have access to that transaction.');
  }
  return toDTO(row);
}

/** Headline figures for the dashboard cards. */
async function summaryForUser(userId, { days = 30 } = {}) {
  const [totals] = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'credit' AND status = 'completed' THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN direction = 'debit'  AND status = 'completed' THEN amount END), 0) AS spending,
       COUNT(*) AS total,
       SUM(status = 'pending') AS pending,
       SUM(status = 'failed')  AS failed
     FROM transactions
     WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [userId, String(days)],
  );

  return {
    windowDays: days,
    income: String(totals.income),
    spending: String(totals.spending),
    total: Number(totals.total),
    pending: Number(totals.pending || 0),
    failed: Number(totals.failed || 0),
  };
}

/** Monthly credit/debit series for the dashboard chart. */
async function monthlySeries(userId, { months = 6 } = {}) {
  const rows = await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS period,
            COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount END), 0) AS income,
            COALESCE(SUM(CASE WHEN direction = 'debit'  THEN amount END), 0) AS spending
       FROM transactions
      WHERE user_id = ? AND status = 'completed'
        AND created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL ? MONTH)
      GROUP BY period ORDER BY period ASC`,
    [userId, String(months - 1)],
  );
  return rows.map((row) => ({
    period: row.period,
    income: Number(row.income),
    spending: Number(row.spending),
  }));
}

/** Spending split by transaction type, for the dashboard breakdown. */
async function spendingByCategory(userId, { days = 30 } = {}) {
  const rows = await query(
    `SELECT type, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
       FROM transactions
      WHERE user_id = ? AND direction = 'debit' AND status = 'completed'
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY type ORDER BY total DESC`,
    [userId, String(days)],
  );
  return rows.map((row) => ({ type: row.type, total: Number(row.total), count: Number(row.count) }));
}

module.exports = {
  TYPES,
  STATUSES,
  toDTO,
  list,
  getByReference,
  summaryForUser,
  monthlySeries,
  spendingByCategory,
};
