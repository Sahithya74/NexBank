'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { query, queryOne } = require('../config/db');
const { unauthorized, forbidden } = require('../utils/AppError');

/**
 * Permissions are read from the database, never from the token, so a role change
 * takes effect on the next request instead of the next sign-in. A short cache keeps
 * that from costing a query per request.
 */
const PERMISSION_CACHE_TTL_MS = 30_000;
const permissionCache = new Map();

async function getRolePermissions(roleId) {
  const cached = permissionCache.get(roleId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.codes;
  }

  const rows = await query(
    `SELECT p.code
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = ?`,
    [roleId],
  );

  const codes = rows.map((row) => row.code);
  permissionCache.set(roleId, { codes, expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS });
  return codes;
}

/** Called after any role/permission change so the next request sees it immediately. */
function invalidatePermissionCache(roleId = null) {
  if (roleId === null) permissionCache.clear();
  else permissionCache.delete(Number(roleId));
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Verifies the bearer token and loads the live user record. */
async function authenticate(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized('Please sign in to continue.');

    let payload;
    try {
      payload = jwt.verify(token, config.auth.jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw unauthorized('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
      }
      throw unauthorized('Your session is no longer valid. Please sign in again.');
    }

    const user = await queryOne(
      `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.role_id, u.managed_by,
              r.name AS role_name, r.label AS role_label
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.id = ?`,
      [payload.sub],
    );

    if (!user) throw unauthorized('Your account is no longer available.');
    if (user.status === 'suspended') {
      throw forbidden('Your account has been suspended. Please contact support.', 'ACCOUNT_SUSPENDED');
    }

    user.permissions = await getRolePermissions(user.role_id);
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** True when the authenticated user holds the permission. */
function hasPermission(user, code) {
  return Boolean(user && user.permissions && user.permissions.includes(code));
}

/**
 * Route guard: the user must hold at least one of the listed permissions.
 * Every protected route declares what it needs - hiding UI is never the control.
 */
function authorize(...codes) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    const allowed = codes.some((code) => hasPermission(req.user, code));
    if (!allowed) {
      return next(forbidden('You do not have permission to perform this action.'));
    }
    return next();
  };
}

/** Route guard requiring every listed permission. */
function authorizeAll(...codes) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    const allowed = codes.every((code) => hasPermission(req.user, code));
    if (!allowed) {
      return next(forbidden('You do not have permission to perform this action.'));
    }
    return next();
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role_name, email: user.email },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn },
  );
}

module.exports = {
  authenticate,
  authorize,
  authorizeAll,
  hasPermission,
  signToken,
  getRolePermissions,
  invalidatePermissionCache,
};
