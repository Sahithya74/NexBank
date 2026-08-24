'use strict';

const { pool, query, queryOne } = require('../config/db');
const { notFound, badRequest } = require('../utils/AppError');
const { maskCardNumber, maskAccountNumber } = require('../utils/mask');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

/** Cards are only ever serialised masked - the PAN is never stored or returned. */
function toDTO(row) {
  return {
    id: row.id,
    cardType: row.card_type,
    network: row.network,
    numberMasked: maskCardNumber(row.last_four),
    lastFour: row.last_four,
    cardHolder: row.card_holder,
    expiry: `${String(row.expiry_month).padStart(2, '0')}/${String(row.expiry_year).slice(-2)}`,
    status: row.status,
    dailyLimit: String(row.daily_limit),
    creditLimit: row.credit_limit === null ? null : String(row.credit_limit),
    controls: {
      online: Boolean(row.online_enabled),
      international: Boolean(row.intl_enabled),
      contactless: Boolean(row.contactless),
    },
    linkedAccount: row.account_number ? maskAccountNumber(row.account_number) : null,
    accountId: row.account_id,
    createdAt: row.created_at,
  };
}

const SELECT_CARD = `
  SELECT c.*, a.account_number
    FROM cards c
    LEFT JOIN accounts a ON a.id = c.account_id`;

async function listForUser(userId) {
  const rows = await query(
    `${SELECT_CARD} WHERE c.user_id = ? ORDER BY c.card_type ASC, c.created_at ASC`,
    [userId],
  );
  return rows.map(toDTO);
}

async function getOwned(userId, cardId) {
  const row = await queryOne(`${SELECT_CARD} WHERE c.id = ? AND c.user_id = ?`, [cardId, userId]);
  if (!row) throw notFound('That card could not be found.');
  return row;
}

async function getForUser(userId, cardId) {
  return toDTO(await getOwned(userId, cardId));
}

/** Block or unblock a card. An expired card can never be reactivated. */
async function setStatus(user, cardId, status, req) {
  const card = await getOwned(user.id, cardId);

  if (card.status === 'expired') {
    throw badRequest('This card has expired and cannot be changed.', 'CARD_EXPIRED');
  }
  if (card.status === status) {
    throw badRequest(`This card is already ${status}.`, 'CARD_STATUS_UNCHANGED');
  }

  await pool.execute('UPDATE cards SET status = ? WHERE id = ? AND user_id = ?', [status, cardId, user.id]);

  const verb = status === 'blocked' ? 'blocked' : 'unblocked';
  await notificationService.create({
    userId: user.id,
    title: `Card ${verb}`,
    message: `Your ${card.card_type} card ending ${card.last_four} has been ${verb}.`,
    type: 'security',
  });
  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'card.status.update',
    entityType: 'card',
    entityId: cardId,
    description: `Card ending ${card.last_four} ${verb}`,
    req,
  });

  return getForUser(user.id, cardId);
}

/** Update usage controls and the daily spend limit. */
async function updateControls(user, cardId, payload, req) {
  const card = await getOwned(user.id, cardId);
  if (card.status !== 'active') {
    throw badRequest('Unblock this card before changing its controls.', 'CARD_NOT_ACTIVE');
  }

  const online = payload.online === undefined ? Boolean(card.online_enabled) : payload.online;
  const international = payload.international === undefined ? Boolean(card.intl_enabled) : payload.international;
  const contactless = payload.contactless === undefined ? Boolean(card.contactless) : payload.contactless;
  const dailyLimit = payload.dailyLimit === undefined ? String(card.daily_limit) : payload.dailyLimit;

  await pool.execute(
    `UPDATE cards SET online_enabled = ?, intl_enabled = ?, contactless = ?, daily_limit = ?
      WHERE id = ? AND user_id = ?`,
    [online ? 1 : 0, international ? 1 : 0, contactless ? 1 : 0, dailyLimit, cardId, user.id],
  );

  await auditService.record({
    userId: user.id,
    actorEmail: user.email,
    action: 'card.controls.update',
    entityType: 'card',
    entityId: cardId,
    description: `Updated controls for card ending ${card.last_four}`,
    req,
  });

  return getForUser(user.id, cardId);
}

/** Card spending history, drawn from the ledger of the linked account. */
async function cardTransactions(userId, cardId, { limit = 10 } = {}) {
  const card = await getOwned(userId, cardId);
  if (!card.account_id) return [];

  const rows = await query(
    `SELECT id, reference, description, counterparty_name, amount, currency_code, status, created_at
       FROM transactions
      WHERE user_id = ? AND account_id = ? AND type = 'card_payment'
      ORDER BY created_at DESC LIMIT ?`,
    [userId, card.account_id, String(Math.min(Number(limit) || 10, 50))],
  );
  return rows.map((row) => ({ ...row, amount: String(row.amount) }));
}

/** Staff view of every issued card. */
async function listAll(filters = {}) {
  const where = [];
  const params = [];
  if (filters.status) {
    where.push('c.status = ?');
    params.push(filters.status);
  }
  if (filters.q) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ? OR c.last_four LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `SELECT c.*, a.account_number, u.full_name AS customer, u.email
       FROM cards c
       LEFT JOIN accounts a ON a.id = c.account_id
       JOIN users u ON u.id = c.user_id
       ${whereSql}
      ORDER BY c.created_at DESC LIMIT 100`,
    params,
  );
  return rows.map((row) => ({ ...toDTO(row), customer: row.customer, email: row.email }));
}

module.exports = { toDTO, listForUser, getForUser, setStatus, updateControls, cardTransactions, listAll };
