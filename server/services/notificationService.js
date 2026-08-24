'use strict';

const { pool, query, queryOne } = require('../config/db');
const { parsePagination } = require('../utils/validate');
const { notFound } = require('../utils/AppError');

const TYPES = ['transaction', 'transfer', 'security', 'payment', 'system'];

/**
 * Create a notification. Pass `connection` to make it part of a financial
 * transaction; outside one, a failure is logged and swallowed so a completed
 * transfer is never rolled back because a notification could not be stored.
 */
async function create({ connection = null, userId, title, message, type = 'system' }) {
  const sql = 'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)';
  const params = [userId, title.slice(0, 160), message.slice(0, 500), TYPES.includes(type) ? type : 'system'];

  if (connection) {
    await connection.execute(sql, params);
    return;
  }
  try {
    await pool.execute(sql, params);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[nexbank] failed to create notification:', error.message);
  }
}

async function list(userId, filters = {}) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20 });

  const where = ['user_id = ?'];
  const params = [userId];

  if (filters.type) {
    where.push('type = ?');
    params.push(filters.type);
  }
  if (filters.status === 'unread') where.push('is_read = 0');
  if (filters.status === 'read') where.push('is_read = 1');

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const items = await query(
    `SELECT id, title, message, type, is_read, created_at
       FROM notifications ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM notifications ${whereSql}`, params);
  const [{ unread }] = await query(
    'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId],
  );

  return {
    items: items.map((row) => ({ ...row, is_read: Boolean(row.is_read) })),
    unreadCount: Number(unread),
    pagination: { page, limit, total: Number(total) },
  };
}

async function unreadCount(userId) {
  const row = await queryOne(
    'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId],
  );
  return Number(row.unread);
}

async function markRead(userId, notificationId) {
  const result = await pool.execute(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [notificationId, userId],
  );
  if (result[0].affectedRows === 0) {
    throw notFound('That notification could not be found.');
  }
  return { id: notificationId, is_read: true };
}

async function markAllRead(userId) {
  const [result] = await pool.execute(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [userId],
  );
  return { updated: result.affectedRows };
}

async function remove(userId, notificationId) {
  const [result] = await pool.execute(
    'DELETE FROM notifications WHERE id = ? AND user_id = ?',
    [notificationId, userId],
  );
  if (result.affectedRows === 0) {
    throw notFound('That notification could not be found.');
  }
  return { id: notificationId };
}

module.exports = { create, list, unreadCount, markRead, markAllRead, remove, TYPES };
