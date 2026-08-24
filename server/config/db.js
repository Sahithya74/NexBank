'use strict';

const mysql = require('mysql2/promise');
const config = require('./env');

/**
 * Shared connection pool.
 *
 * `decimalNumbers` is deliberately left false: MySQL DECIMAL columns come back as
 * strings so money never passes through a JavaScript float. All balance arithmetic
 * happens either in SQL or through utils/money.js (fixed-point BigInt).
 */
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  dateStrings: ['DATE'],
  timezone: 'Z',
  charset: 'utf8mb4_unicode_ci',
});

/** Run a parameterised query. Never build SQL by string concatenation. */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Run a parameterised query and return the first row, or null. */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * Execute `handler` inside a MySQL transaction.
 * Every multi-row balance mutation in NexBank goes through this.
 */
async function withTransaction(handler) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      /* rollback failures must not mask the original error */
    }
    throw error;
  } finally {
    connection.release();
  }
}

/** Verify the database is reachable; used at boot. */
async function verifyConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

module.exports = { pool, query, queryOne, withTransaction, verifyConnection };
