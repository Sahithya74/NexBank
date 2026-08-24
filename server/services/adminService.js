'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { pool, query, queryOne, withTransaction } = require('../config/db');
const { notFound, badRequest, conflict } = require('../utils/AppError');
const { parsePagination, parseSort } = require('../utils/validate');
const { maskPhone } = require('../utils/mask');
const money = require('../utils/money');
const auditService = require('./auditService');
const currencyService = require('./currencyService');
const walletService = require('./walletService');
const accountService = require('./accountService');
const { invalidatePermissionCache } = require('../middleware/auth');

const USER_SORTABLE = ['created_at', 'full_name', 'email', 'status'];

function toUserDTO(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ? maskPhone(row.phone) : null,
    role: row.role_name,
    roleLabel: row.role_label,
    roleId: row.role_id,
    status: row.status,
    managedBy: row.managed_by,
    managerName: row.manager_name,
    accounts: row.account_count === undefined ? undefined : Number(row.account_count),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Everything the admin dashboard needs, in one round trip. */
async function dashboard(base) {
  const [counts] = await query(
    `SELECT
       (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'customer') AS customers,
       (SELECT COUNT(*) FROM users WHERE status = 'active')            AS active_users,
       (SELECT COUNT(*) FROM accounts WHERE status = 'active')         AS active_accounts,
       (SELECT COUNT(*) FROM wallets WHERE status = 'active')          AS active_wallets,
       (SELECT COUNT(*) FROM transactions)                             AS total_transactions,
       (SELECT COUNT(*) FROM transactions WHERE status = 'failed')     AS failed_transactions,
       (SELECT COUNT(*) FROM transactions WHERE status = 'pending')    AS pending_transactions,
       (SELECT COUNT(*) FROM loans WHERE status IN ('applied','under_review')) AS pending_loans,
       (SELECT COUNT(*) FROM loans WHERE status = 'active')            AS active_loans`,
  );

  const [volume] = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN amount END), 0) AS last30,
       COALESCE(SUM(amount), 0) AS all_time
     FROM transactions WHERE status = 'completed'`,
  );

  const monthly = await query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS period,
            COUNT(*) AS count,
            COALESCE(SUM(amount), 0) AS volume
       FROM transactions
      WHERE status = 'completed' AND created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
      GROUP BY period ORDER BY period ASC`,
  );

  const statusSplit = await query(
    'SELECT status, COUNT(*) AS count FROM transactions GROUP BY status',
  );

  const typeSplit = await query(
    `SELECT type, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS volume
       FROM transactions WHERE status = 'completed'
      GROUP BY type ORDER BY volume DESC LIMIT 6`,
  );

  // Currency distribution across every wallet, valued in the base currency.
  const currencyRows = await query(
    `SELECT currency_code, COUNT(*) AS holders, COALESCE(SUM(balance), 0) AS total
       FROM wallet_balances GROUP BY currency_code`,
  );
  const baseCurrency = await currencyService.get(base);
  let walletTotalScaled = 0n;
  const currencyDistribution = [];
  for (const row of currencyRows) {
    const rate = await currencyService.getRate(row.currency_code, base);
    const value = money.convert(String(row.total), rate, baseCurrency.decimals);
    walletTotalScaled += money.toScaled(value);
    currencyDistribution.push({
      currency: row.currency_code,
      holders: Number(row.holders),
      total: String(row.total),
      convertedValue: value,
    });
  }
  const walletTotal = money.fromScaled(walletTotalScaled, baseCurrency.decimals);

  const recentActivity = await query(
    `SELECT a.id, a.action, a.description, a.status, a.created_at, a.actor_email,
            u.full_name AS actor_name
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT 8`,
  );

  const [deposits] = await query(
    "SELECT COALESCE(SUM(balance), 0) AS total FROM accounts WHERE status <> 'closed'",
  );

  return {
    base,
    baseSymbol: baseCurrency.symbol,
    stats: {
      customers: Number(counts.customers),
      activeUsers: Number(counts.active_users),
      activeAccounts: Number(counts.active_accounts),
      activeWallets: Number(counts.active_wallets),
      totalTransactions: Number(counts.total_transactions),
      failedTransactions: Number(counts.failed_transactions),
      pendingTransactions: Number(counts.pending_transactions),
      pendingApprovals: Number(counts.pending_loans),
      activeLoans: Number(counts.active_loans),
      transactionVolume30d: String(volume.last30),
      transactionVolumeAllTime: String(volume.all_time),
      totalDeposits: String(deposits.total),
      walletPortfolioValue: walletTotal,
    },
    monthlyVolume: monthly.map((row) => ({
      period: row.period,
      count: Number(row.count),
      volume: Number(row.volume),
    })),
    statusSplit: statusSplit.map((row) => ({ status: row.status, count: Number(row.count) })),
    typeSplit: typeSplit.map((row) => ({
      type: row.type,
      count: Number(row.count),
      volume: Number(row.volume),
    })),
    currencyDistribution,
    recentActivity,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function listUsers(filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20 });
  const { column, direction } = parseSort(filters, USER_SORTABLE, 'created_at');

  const where = [];
  const params = [];
  if (filters.q) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.role) {
    where.push('r.name = ?');
    params.push(filters.role);
  }
  if (filters.status) {
    where.push('u.status = ?');
    params.push(filters.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT u.*, r.name AS role_name, r.label AS role_label, m.full_name AS manager_name,
            (SELECT COUNT(*) FROM accounts a WHERE a.user_id = u.id) AS account_count
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN users m ON m.id = u.managed_by
       ${whereSql}
      ORDER BY u.${column} ${direction} LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM users u JOIN roles r ON r.id = u.role_id ${whereSql}`,
    params,
  );

  return { items: rows.map(toUserDTO), pagination: { page, limit, total: Number(total) } };
}

async function getUser(userId) {
  const row = await queryOne(
    `SELECT u.*, r.name AS role_name, r.label AS role_label, m.full_name AS manager_name
       FROM users u JOIN roles r ON r.id = u.role_id
       LEFT JOIN users m ON m.id = u.managed_by
      WHERE u.id = ?`,
    [userId],
  );
  if (!row) throw notFound('That user could not be found.');

  const accounts = await accountService.listAll({ userId, limit: 20 });
  const [loanCount] = await query('SELECT COUNT(*) AS total FROM loans WHERE user_id = ?', [userId]);
  const [txnCount] = await query('SELECT COUNT(*) AS total FROM transactions WHERE user_id = ?', [userId]);

  return {
    ...toUserDTO(row),
    accounts: accounts.items,
    loanCount: Number(loanCount.total),
    transactionCount: Number(txnCount.total),
  };
}

/** Create a staff or customer user. Customers also get a wallet and first account. */
async function createUser(actor, payload, req) {
  const email = payload.email.toLowerCase();
  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) throw conflict('A user with that email address already exists.', 'EMAIL_TAKEN');

  const role = await queryOne('SELECT id, name FROM roles WHERE id = ?', [payload.roleId]);
  if (!role) throw badRequest('Select a valid role.', 'INVALID_ROLE');

  const passwordHash = await bcrypt.hash(payload.password, config.auth.bcryptRounds);

  const userId = await withTransaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO users (full_name, email, phone, password_hash, role_id, status, address, managed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.fullName, email, payload.phone || null, passwordHash, role.id,
        payload.status || 'active', payload.address || null, payload.managedBy || null],
    );
    const newId = result.insertId;

    if (role.name === 'customer') {
      await walletService.ensureWallet(newId, conn);
      await accountService.openAccount(
        { userId: newId, accountType: 'savings', currency: 'INR' },
        { connection: conn, actor, req },
      );
    }

    await auditService.record({
      connection: conn,
      userId: actor.id,
      actorEmail: actor.email,
      action: 'user.create',
      entityType: 'user',
      entityId: newId,
      description: `Created ${role.name} ${email}`,
      req,
    });
    return newId;
  });

  return getUser(userId);
}

async function updateUser(actor, userId, payload, req) {
  const user = await queryOne('SELECT id, email, role_id FROM users WHERE id = ?', [userId]);
  if (!user) throw notFound('That user could not be found.');

  if (payload.roleId && Number(payload.roleId) !== Number(user.role_id)) {
    const role = await queryOne('SELECT id FROM roles WHERE id = ?', [payload.roleId]);
    if (!role) throw badRequest('Select a valid role.', 'INVALID_ROLE');
  }

  await pool.execute(
    `UPDATE users SET full_name = ?, phone = ?, address = ?, role_id = ?, managed_by = ?
      WHERE id = ?`,
    [
      payload.fullName,
      payload.phone || null,
      payload.address || null,
      payload.roleId || user.role_id,
      payload.managedBy || null,
      userId,
    ],
  );

  if (payload.roleId && Number(payload.roleId) !== Number(user.role_id)) {
    await auditService.record({
      userId: actor.id,
      actorEmail: actor.email,
      action: 'user.role.update',
      entityType: 'user',
      entityId: userId,
      description: `Changed role of ${user.email}`,
      req,
    });
  }

  await auditService.record({
    userId: actor.id,
    actorEmail: actor.email,
    action: 'user.update',
    entityType: 'user',
    entityId: userId,
    description: `Updated user ${user.email}`,
    req,
  });

  return getUser(userId);
}

/** Suspend or reactivate. An administrator can never suspend their own account. */
async function setUserStatus(actor, userId, status, req) {
  if (String(actor.id) === String(userId)) {
    throw badRequest('You cannot change the status of your own account.', 'SELF_STATUS_CHANGE');
  }
  const user = await queryOne('SELECT id, email FROM users WHERE id = ?', [userId]);
  if (!user) throw notFound('That user could not be found.');

  await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
  await auditService.record({
    userId: actor.id,
    actorEmail: actor.email,
    action: 'user.status.update',
    entityType: 'user',
    entityId: userId,
    description: `Set ${user.email} to ${status}`,
    req,
  });
  return getUser(userId);
}

/** Administrative password reset. */
async function resetUserPassword(actor, userId, newPassword, req) {
  const user = await queryOne('SELECT id, email FROM users WHERE id = ?', [userId]);
  if (!user) throw notFound('That user could not be found.');

  const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

  await auditService.record({
    userId: actor.id,
    actorEmail: actor.email,
    action: 'user.password.reset',
    entityType: 'user',
    entityId: userId,
    description: `Reset password for ${user.email}`,
    req,
  });
  return { message: `Password reset for ${user.email}.` };
}

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------

async function listRoles() {
  const roles = await query(
    `SELECT r.id, r.name, r.label, r.description,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
       FROM roles r ORDER BY r.id ASC`,
  );
  const mappings = await query('SELECT role_id, permission_id FROM role_permissions');
  const permissions = await query(
    'SELECT id, code, module, description FROM permissions ORDER BY module, code',
  );

  return {
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      label: role.label,
      description: role.description,
      userCount: Number(role.user_count),
      permissionIds: mappings
        .filter((mapping) => mapping.role_id === role.id)
        .map((mapping) => mapping.permission_id),
    })),
    permissions,
  };
}

/** Replace a role's permission set. Cached permissions are invalidated immediately. */
async function updateRolePermissions(actor, roleId, permissionIds, req) {
  const role = await queryOne('SELECT id, name FROM roles WHERE id = ?', [roleId]);
  if (!role) throw notFound('That role could not be found.');

  if (role.name === 'admin') {
    throw badRequest('The administrator role always holds every permission.', 'ROLE_IMMUTABLE');
  }

  const valid = await query('SELECT id FROM permissions');
  const validIds = new Set(valid.map((row) => row.id));
  const requested = [...new Set(permissionIds.map(Number))].filter((id) => validIds.has(id));

  await withTransaction(async (conn) => {
    await conn.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    for (const permissionId of requested) {
      await conn.execute(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [roleId, permissionId],
      );
    }
    await auditService.record({
      connection: conn,
      userId: actor.id,
      actorEmail: actor.email,
      action: 'role.permission.update',
      entityType: 'role',
      entityId: roleId,
      description: `Set ${requested.length} permissions on role ${role.name}`,
      req,
    });
  });

  invalidatePermissionCache(roleId);
  return listRoles();
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

async function reports({ from, to }) {
  const params = [];
  const where = ["t.status = 'completed'"];
  if (from) {
    where.push('t.created_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    where.push('t.created_at <= ?');
    params.push(`${to} 23:59:59`);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const byType = await query(
    `SELECT t.type, COUNT(*) AS count, COALESCE(SUM(t.amount), 0) AS volume
       FROM transactions t ${whereSql} GROUP BY t.type ORDER BY volume DESC`,
    params,
  );
  const byCurrency = await query(
    `SELECT t.currency_code, COUNT(*) AS count, COALESCE(SUM(t.amount), 0) AS volume
       FROM transactions t ${whereSql} GROUP BY t.currency_code ORDER BY volume DESC`,
    params,
  );
  const daily = await query(
    `SELECT DATE(t.created_at) AS day, COUNT(*) AS count, COALESCE(SUM(t.amount), 0) AS volume
       FROM transactions t ${whereSql} GROUP BY day ORDER BY day ASC LIMIT 90`,
    params,
  );
  const topCustomers = await query(
    `SELECT u.id, u.full_name, u.email, COUNT(*) AS transactions,
            COALESCE(SUM(t.amount), 0) AS volume
       FROM transactions t JOIN users u ON u.id = t.user_id
       ${whereSql} GROUP BY u.id, u.full_name, u.email
      ORDER BY volume DESC LIMIT 10`,
    params,
  );
  const loanSummary = await query(
    'SELECT status, COUNT(*) AS count, COALESCE(SUM(principal), 0) AS principal FROM loans GROUP BY status',
  );

  return {
    range: { from: from || null, to: to || null },
    byType: byType.map((row) => ({ ...row, count: Number(row.count), volume: Number(row.volume) })),
    byCurrency: byCurrency.map((row) => ({ ...row, count: Number(row.count), volume: Number(row.volume) })),
    daily: daily.map((row) => ({ day: row.day, count: Number(row.count), volume: Number(row.volume) })),
    topCustomers: topCustomers.map((row) => ({
      ...row,
      transactions: Number(row.transactions),
      volume: Number(row.volume),
    })),
    loanSummary: loanSummary.map((row) => ({
      status: row.status,
      count: Number(row.count),
      principal: Number(row.principal),
    })),
  };
}

/** Staff list used to populate the "assigned employee" picker. */
async function listStaff() {
  const rows = await query(
    `SELECT u.id, u.full_name, u.email, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.name IN ('employee','manager','admin') AND u.status = 'active'
      ORDER BY u.full_name`,
  );
  return rows;
}

module.exports = {
  dashboard,
  listUsers,
  getUser,
  createUser,
  updateUser,
  setUserStatus,
  resetUserPassword,
  listRoles,
  updateRolePermissions,
  reports,
  listStaff,
};
