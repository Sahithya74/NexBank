'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { pool, queryOne, withTransaction } = require('../config/db');
const { badRequest, unauthorized, conflict, forbidden } = require('../utils/AppError');
const { signToken, getRolePermissions } = require('../middleware/auth');
const auditService = require('./auditService');
const notificationService = require('./notificationService');
const accountService = require('./accountService');
const walletService = require('./walletService');

const CUSTOMER_ROLE = 'customer';

function toSessionUser(user, permissions) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role_name,
    roleLabel: user.role_label,
    status: user.status,
    permissions,
  };
}

async function loadUserWithRole(where, param) {
  return queryOne(
    `SELECT u.*, r.name AS role_name, r.label AS role_label
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE ${where} LIMIT 1`,
    [param],
  );
}

/**
 * Register a customer.
 *
 * The user, their wallet (with a base-currency balance) and their first savings
 * account are created in one transaction - a half-registered customer is never left
 * behind if any step fails.
 */
async function register(payload, req) {
  const email = payload.email.toLowerCase();

  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    throw conflict('An account with that email address already exists.', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(payload.password, config.auth.bcryptRounds);

  const userId = await withTransaction(async (conn) => {
    const [roleRow] = await conn.execute('SELECT id FROM roles WHERE name = ?', [CUSTOMER_ROLE]);
    if (!roleRow.length) throw badRequest('Customer role is not configured.', 'ROLE_MISSING');

    const [result] = await conn.execute(
      `INSERT INTO users (full_name, email, phone, password_hash, role_id, status, address)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [payload.fullName, email, payload.phone || null, passwordHash, roleRow[0].id, payload.address || null],
    );
    const newUserId = result.insertId;

    await walletService.ensureWallet(newUserId, conn);
    await accountService.openAccount(
      { userId: newUserId, accountType: 'savings', currency: 'INR' },
      { connection: conn, req },
    );

    await notificationService.create({
      connection: conn,
      userId: newUserId,
      title: 'Welcome to NexBank',
      message: 'Your account is ready. Open your wallet to add currencies and start transacting.',
      type: 'system',
    });

    await auditService.record({
      connection: conn,
      userId: newUserId,
      actorEmail: email,
      action: 'auth.register',
      entityType: 'user',
      entityId: newUserId,
      description: `Registered customer ${email}`,
      req,
    });

    return newUserId;
  });

  const user = await loadUserWithRole('u.id = ?', userId);
  const permissions = await getRolePermissions(user.role_id);
  return { token: signToken(user), user: toSessionUser(user, permissions) };
}

/** Authenticate. Failed attempts are audited; the reason is never disclosed. */
async function login({ email, password }, req) {
  const normalisedEmail = email.toLowerCase();
  const user = await loadUserWithRole('u.email = ?', normalisedEmail);

  const genericFailure = unauthorized('The email address or password is incorrect.', 'INVALID_CREDENTIALS');

  if (!user) {
    await auditService.record({
      actorEmail: normalisedEmail,
      action: 'auth.login.failed',
      entityType: 'user',
      description: `Failed sign-in attempt for ${normalisedEmail}`,
      status: 'failure',
      req,
    });
    throw genericFailure;
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    await auditService.record({
      userId: user.id,
      actorEmail: normalisedEmail,
      action: 'auth.login.failed',
      entityType: 'user',
      entityId: user.id,
      description: 'Incorrect password',
      status: 'failure',
      req,
    });
    throw genericFailure;
  }

  if (user.status === 'suspended') {
    await auditService.record({
      userId: user.id,
      actorEmail: normalisedEmail,
      action: 'auth.login.blocked',
      entityType: 'user',
      entityId: user.id,
      description: 'Sign-in blocked: account suspended',
      status: 'failure',
      req,
    });
    throw forbidden('Your account has been suspended. Please contact support.', 'ACCOUNT_SUSPENDED');
  }

  await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    description: `${user.role_label} signed in`,
    req,
  });

  const { ip } = auditService.requestContext(req);
  await notificationService.create({
    userId: user.id,
    title: 'New sign-in detected',
    message: `A new sign-in to your NexBank account was detected${ip ? ` from ${ip}` : ''}.`,
    type: 'security',
  });

  const permissions = await getRolePermissions(user.role_id);
  return { token: signToken(user), user: toSessionUser(user, permissions) };
}

async function logout(user, req) {
  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'auth.logout',
    entityType: 'user',
    entityId: user.id,
    description: 'Signed out',
    req,
  });
  return { message: 'Signed out.' };
}

/** The session payload used by the client to rebuild auth state on reload. */
async function profile(userId) {
  const user = await loadUserWithRole('u.id = ?', userId);
  if (!user) throw unauthorized('Your account is no longer available.');
  const permissions = await getRolePermissions(user.role_id);
  return {
    ...toSessionUser(user, permissions),
    address: user.address,
    lastLoginAt: user.last_login_at,
    memberSince: user.created_at,
  };
}

async function updateProfile(user, payload, req) {
  await pool.execute(
    'UPDATE users SET full_name = ?, phone = ?, address = ? WHERE id = ?',
    [payload.fullName, payload.phone || null, payload.address || null, user.id],
  );
  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'profile.update',
    entityType: 'user',
    entityId: user.id,
    description: 'Updated profile details',
    req,
  });
  return profile(user.id);
}

async function changePassword(user, { currentPassword, newPassword }, req) {
  const record = await queryOne('SELECT password_hash FROM users WHERE id = ?', [user.id]);
  const matches = await bcrypt.compare(currentPassword, record.password_hash);

  if (!matches) {
    await auditService.record({
      userId: user.id,
      actorEmail: user.email,
      action: 'auth.password.change',
      entityType: 'user',
      entityId: user.id,
      description: 'Password change rejected: current password incorrect',
      status: 'failure',
      req,
    });
    throw badRequest('Your current password is incorrect.', 'INVALID_PASSWORD');
  }

  if (currentPassword === newPassword) {
    throw badRequest('Choose a password you have not used before.', 'PASSWORD_REUSED');
  }

  const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
  await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);

  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'auth.password.change',
    entityType: 'user',
    entityId: user.id,
    description: 'Password changed',
    req,
  });
  await notificationService.create({
    userId: user.id,
    title: 'Password changed',
    message: 'Your NexBank password was changed. If this was not you, contact support immediately.',
    type: 'security',
  });

  return { message: 'Your password has been updated.' };
}

module.exports = { register, login, logout, profile, updateProfile, changePassword };
