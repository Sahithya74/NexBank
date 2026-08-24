'use strict';

const { pool, query } = require('../config/db');
const { parsePagination, parseSort } = require('../utils/validate');

const SORTABLE = ['created_at', 'action', 'status'];

/** Pull the request context that belongs on an audit row. */
function requestContext(req) {
  if (!req) return { ip: null, userAgent: null };
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim()
    || req.ip
    || null;
  const userAgent = (req.headers['user-agent'] || '').slice(0, 255) || null;
  return { ip, userAgent };
}

/**
 * Write an audit row. Pass `connection` to make the entry part of the surrounding
 * financial transaction; otherwise it is written on the shared pool and a failure
 * is logged rather than propagated, so auditing can never break a completed action.
 */
async function record({
  connection = null,
  userId = null,
  actorEmail = null,
  action,
  entityType = null,
  entityId = null,
  description = null,
  status = 'success',
  req = null,
}) {
  const { ip, userAgent } = requestContext(req);
  const sql = `INSERT INTO audit_logs
      (user_id, actor_email, action, entity_type, entity_id, description, status, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    userId,
    actorEmail,
    action,
    entityType,
    entityId === null ? null : String(entityId),
    description ? String(description).slice(0, 500) : null,
    status,
    ip,
    userAgent,
  ];

  if (connection) {
    await connection.execute(sql, params);
    return;
  }

  try {
    await pool.execute(sql, params);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[nexbank] failed to write audit log:', error.message);
  }
}

/** Admin/manager audit log listing with filters. */
async function list(filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20 });
  const { column, direction } = parseSort(filters, SORTABLE, 'created_at');

  const where = [];
  const params = [];

  if (filters.q) {
    where.push('(a.action LIKE ? OR a.description LIKE ? OR a.actor_email LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  if (filters.action) {
    where.push('a.action = ?');
    params.push(filters.action);
  }
  if (filters.status) {
    where.push('a.status = ?');
    params.push(filters.status);
  }
  if (filters.userId) {
    where.push('a.user_id = ?');
    params.push(filters.userId);
  }
  if (filters.from) {
    where.push('a.created_at >= ?');
    params.push(`${filters.from} 00:00:00`);
  }
  if (filters.to) {
    where.push('a.created_at <= ?');
    params.push(`${filters.to} 23:59:59`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT a.id, a.user_id, a.actor_email, a.action, a.entity_type, a.entity_id,
            a.description, a.status, a.ip_address, a.created_at,
            u.full_name AS actor_name, r.label AS actor_role
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN roles r ON r.id = u.role_id
       ${whereSql}
      ORDER BY a.${column} ${direction}
      LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM audit_logs a ${whereSql}`,
    params,
  );

  return { items: rows, pagination: { page, limit, total: Number(total) } };
}

/** Distinct action names, for the audit log filter dropdown. */
async function actions() {
  const rows = await query('SELECT DISTINCT action FROM audit_logs ORDER BY action ASC');
  return rows.map((row) => row.action);
}

module.exports = { record, list, actions, requestContext };
