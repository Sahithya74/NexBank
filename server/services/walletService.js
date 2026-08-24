'use strict';

const { query, queryOne, withTransaction } = require('../config/db');
const { badRequest, notFound, conflict } = require('../utils/AppError');
const { generateReference } = require('../utils/reference');
const { parsePagination } = require('../utils/validate');
const money = require('../utils/money');
const currencyService = require('./currencyService');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

/** Fetch the user's wallet, creating it (with a base-currency balance) on first use. */
async function ensureWallet(userId, connection = null) {
  const exec = connection
    ? (sql, params) => connection.execute(sql, params).then(([rows]) => rows)
    : query;

  const existing = await exec('SELECT id, user_id, status FROM wallets WHERE user_id = ?', [userId]);
  if (existing.length) return existing[0];

  if (connection) {
    const [result] = await connection.execute('INSERT INTO wallets (user_id) VALUES (?)', [userId]);
    await connection.execute(
      'INSERT INTO wallet_balances (wallet_id, currency_code, balance) VALUES (?, ?, 0)',
      [result.insertId, 'INR'],
    );
    return { id: result.insertId, user_id: userId, status: 'active' };
  }

  return withTransaction(async (conn) => ensureWallet(userId, conn));
}

async function getWalletOrFail(userId) {
  const wallet = await ensureWallet(userId);
  if (wallet.status === 'frozen') {
    throw badRequest('Your wallet is currently frozen. Please contact support.', 'WALLET_FROZEN');
  }
  return wallet;
}

/**
 * Full wallet dashboard payload: per-currency balances, each converted into the
 * requested base currency, the portfolio total, live rates and recent conversions.
 */
async function overview(userId, base) {
  const wallet = await ensureWallet(userId);
  const baseCurrency = await currencyService.get(base);

  const rows = await query(
    `SELECT wb.currency_code, wb.balance, c.name, c.symbol, c.decimals
       FROM wallet_balances wb
       JOIN currencies c ON c.code = wb.currency_code
      WHERE wb.wallet_id = ?
      ORDER BY wb.currency_code = ? DESC, wb.balance DESC`,
    [wallet.id, base],
  );

  let totalScaled = 0n;
  const balances = [];

  for (const row of rows) {
    const rate = await currencyService.getRate(row.currency_code, base);
    const convertedValue = money.convert(String(row.balance), rate, baseCurrency.decimals);
    totalScaled += money.toScaled(convertedValue);
    balances.push({
      currency: row.currency_code,
      name: row.name,
      symbol: row.symbol,
      decimals: row.decimals,
      balance: String(row.balance),
      rateToBase: rate,
      convertedValue,
    });
  }

  const totalValue = money.fromScaled(totalScaled, baseCurrency.decimals);

  const conversions = await query(
    `SELECT reference, from_currency, to_currency, from_amount, to_amount, rate, created_at
       FROM conversions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 5`,
    [wallet.id],
  );

  const rates = await currencyService.rateTable(base);
  const available = await currencyService.list({ activeOnly: true });
  const held = new Set(balances.map((entry) => entry.currency));

  return {
    walletId: wallet.id,
    status: wallet.status,
    base,
    baseSymbol: baseCurrency.symbol,
    totalValue,
    balances,
    recentConversions: conversions.map((row) => ({
      ...row,
      from_amount: String(row.from_amount),
      to_amount: String(row.to_amount),
      rate: String(row.rate),
    })),
    rates,
    availableCurrencies: available.filter((currency) => !held.has(currency.code)),
    // share of portfolio, for the wallet distribution chart
    distribution: balances.map((entry) => ({
      currency: entry.currency,
      symbol: entry.symbol,
      value: entry.convertedValue,
      share: money.compare(totalValue, '0') > 0
        ? Number(((Number(entry.convertedValue) / Number(totalValue)) * 100).toFixed(2))
        : 0,
    })),
  };
}

/** Open a balance in a new currency. */
async function addCurrency(user, code, req) {
  const currency = await currencyService.requireActive(code);
  const wallet = await getWalletOrFail(user.id);

  const existing = await queryOne(
    'SELECT id FROM wallet_balances WHERE wallet_id = ? AND currency_code = ?',
    [wallet.id, currency.code],
  );
  if (existing) throw conflict(`Your wallet already holds ${currency.code}.`, 'CURRENCY_ALREADY_HELD');

  await withTransaction(async (conn) => {
    await conn.execute(
      'INSERT INTO wallet_balances (wallet_id, currency_code, balance) VALUES (?, ?, 0)',
      [wallet.id, currency.code],
    );
    await auditService.record({
      connection: conn,
      userId: user.id,
      actorEmail: user.email,
      action: 'wallet.currency.add',
      entityType: 'wallet',
      entityId: wallet.id,
      description: `Added ${currency.code} to wallet`,
      req,
    });
  });

  return { currency: currency.code, balance: '0.0000' };
}

/** Close an empty balance. A currency holding funds cannot be removed. */
async function removeCurrency(user, code, req) {
  const wallet = await getWalletOrFail(user.id);
  const row = await queryOne(
    'SELECT id, balance FROM wallet_balances WHERE wallet_id = ? AND currency_code = ?',
    [wallet.id, code],
  );
  if (!row) throw notFound(`Your wallet does not hold ${code}.`);
  if (money.compare(String(row.balance), '0') > 0) {
    throw badRequest(
      `Convert or transfer your ${code} balance before removing it.`,
      'CURRENCY_NOT_EMPTY',
    );
  }
  if (code === 'INR') {
    throw badRequest('The base currency balance cannot be removed.', 'BASE_CURRENCY_REQUIRED');
  }

  await withTransaction(async (conn) => {
    await conn.execute('DELETE FROM wallet_balances WHERE id = ?', [row.id]);
    await auditService.record({
      connection: conn,
      userId: user.id,
      actorEmail: user.email,
      action: 'wallet.currency.remove',
      entityType: 'wallet',
      entityId: wallet.id,
      description: `Removed ${code} from wallet`,
      req,
    });
  });

  return { currency: code };
}

/**
 * Convert between two wallet currencies.
 *
 * The rate is resolved before the transaction opens (so no pool connection is
 * acquired while locks are held); the debit, credit, conversion record, ledger
 * entries and audit entry then all commit or roll back together.
 */
async function convertCurrency(user, { from, to, amount }, req) {
  if (from === to) {
    throw badRequest('Choose two different currencies to convert between.', 'SAME_CURRENCY');
  }

  const source = await currencyService.requireActive(from);
  const target = await currencyService.requireActive(to);
  const wallet = await getWalletOrFail(user.id);

  const debitAmount = money.normaliseAmount(amount, {
    decimals: source.decimals,
    label: 'Amount',
  });
  const rate = await currencyService.getRate(from, to);
  const creditAmount = money.convert(debitAmount, rate, target.decimals);

  if (money.compare(creditAmount, '0') <= 0) {
    throw badRequest('That amount is too small to convert.', 'AMOUNT_TOO_SMALL');
  }

  return withTransaction(async (conn) => {
    // Lock both balance rows in a stable order to avoid deadlocks.
    const [locked] = await conn.execute(
      `SELECT currency_code, balance FROM wallet_balances
        WHERE wallet_id = ? AND currency_code IN (?, ?)
        ORDER BY currency_code
        FOR UPDATE`,
      [wallet.id, from, to],
    );

    const sourceRow = locked.find((row) => row.currency_code === from);
    if (!sourceRow) throw badRequest(`Your wallet does not hold ${from}.`, 'CURRENCY_NOT_HELD');
    if (money.compare(String(sourceRow.balance), debitAmount) < 0) {
      throw badRequest(
        `Insufficient ${from} balance. Available: ${sourceRow.balance}.`,
        'INSUFFICIENT_FUNDS',
      );
    }

    const [debit] = await conn.execute(
      `UPDATE wallet_balances SET balance = balance - ?
        WHERE wallet_id = ? AND currency_code = ? AND balance >= ?`,
      [debitAmount, wallet.id, from, debitAmount],
    );
    if (debit.affectedRows !== 1) {
      throw badRequest('Insufficient balance for this conversion.', 'INSUFFICIENT_FUNDS');
    }

    await conn.execute(
      `INSERT INTO wallet_balances (wallet_id, currency_code, balance)
            VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)`,
      [wallet.id, to, creditAmount],
    );

    const [after] = await conn.execute(
      `SELECT currency_code, balance FROM wallet_balances
        WHERE wallet_id = ? AND currency_code IN (?, ?)`,
      [wallet.id, from, to],
    );
    const balanceAfter = Object.fromEntries(after.map((row) => [row.currency_code, String(row.balance)]));

    const reference = generateReference('CNV');
    await conn.execute(
      `INSERT INTO conversions (reference, wallet_id, user_id, from_currency, to_currency, from_amount, to_amount, rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [reference, wallet.id, user.id, from, to, debitAmount, creditAmount, rate],
    );

    await conn.execute(
      `INSERT INTO transactions
         (reference, user_id, wallet_id, type, direction, description, amount, currency_code, balance_after, status)
       VALUES (?, ?, ?, 'conversion', 'debit', ?, ?, ?, ?, 'completed')`,
      [
        `${reference}D`,
        user.id,
        wallet.id,
        `Converted ${from} to ${to}`,
        debitAmount,
        from,
        balanceAfter[from],
      ],
    );
    await conn.execute(
      `INSERT INTO transactions
         (reference, user_id, wallet_id, type, direction, description, amount, currency_code, balance_after, status)
       VALUES (?, ?, ?, 'conversion', 'credit', ?, ?, ?, ?, 'completed')`,
      [
        `${reference}C`,
        user.id,
        wallet.id,
        `Converted ${from} to ${to}`,
        creditAmount,
        to,
        balanceAfter[to],
      ],
    );

    await notificationService.create({
      connection: conn,
      userId: user.id,
      title: 'Currency converted',
      message: `${source.symbol}${debitAmount} ${from} converted to ${target.symbol}${creditAmount} ${to} at ${rate}.`,
      type: 'transaction',
    });

    await auditService.record({
      connection: conn,
      userId: user.id,
      actorEmail: user.email,
      action: 'wallet.convert',
      entityType: 'conversion',
      entityId: reference,
      description: `Converted ${debitAmount} ${from} to ${creditAmount} ${to} at rate ${rate}`,
      req,
    });

    return {
      reference,
      from,
      to,
      rate,
      fromAmount: debitAmount,
      toAmount: creditAmount,
      balances: balanceAfter,
    };
  });
}

/** Wallet-to-wallet transfer to another NexBank customer, in any held currency. */
async function transferToWallet(user, { recipientEmail, currency, amount, note = null }, req) {
  const currencyMeta = await currencyService.requireActive(currency);
  const recipient = await queryOne(
    'SELECT id, full_name, email, status FROM users WHERE email = ?',
    [recipientEmail],
  );
  if (!recipient) throw notFound('No NexBank customer was found with that email address.');
  if (String(recipient.id) === String(user.id)) {
    throw badRequest('You cannot send funds to your own wallet.', 'SAME_WALLET');
  }
  if (recipient.status !== 'active') {
    throw badRequest('That customer cannot receive funds at the moment.', 'RECIPIENT_UNAVAILABLE');
  }

  const senderWallet = await getWalletOrFail(user.id);
  const transferAmount = money.normaliseAmount(amount, {
    decimals: currencyMeta.decimals,
    label: 'Amount',
  });

  return withTransaction(async (conn) => {
    const recipientWallet = await ensureWallet(recipient.id, conn);

    await conn.execute(
      `SELECT id FROM wallet_balances
        WHERE wallet_id IN (?, ?) AND currency_code = ?
        ORDER BY wallet_id FOR UPDATE`,
      [senderWallet.id, recipientWallet.id, currency],
    );

    const [debit] = await conn.execute(
      `UPDATE wallet_balances SET balance = balance - ?
        WHERE wallet_id = ? AND currency_code = ? AND balance >= ?`,
      [transferAmount, senderWallet.id, currency, transferAmount],
    );
    if (debit.affectedRows !== 1) {
      throw badRequest(`Insufficient ${currency} balance in your wallet.`, 'INSUFFICIENT_FUNDS');
    }

    await conn.execute(
      `INSERT INTO wallet_balances (wallet_id, currency_code, balance)
            VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance)`,
      [recipientWallet.id, currency, transferAmount],
    );

    const reference = generateReference('WTR');
    const description = note || `Wallet transfer ${currency}`;

    await conn.execute(
      `INSERT INTO transactions
         (reference, user_id, wallet_id, type, direction, description, counterparty_name, amount, currency_code, status)
       VALUES (?, ?, ?, 'transfer_out', 'debit', ?, ?, ?, ?, 'completed')`,
      [`${reference}D`, user.id, senderWallet.id, description, recipient.full_name, transferAmount, currency],
    );
    await conn.execute(
      `INSERT INTO transactions
         (reference, user_id, wallet_id, type, direction, description, counterparty_name, amount, currency_code, status)
       VALUES (?, ?, ?, 'transfer_in', 'credit', ?, ?, ?, ?, 'completed')`,
      [`${reference}C`, recipient.id, recipientWallet.id, description, user.full_name, transferAmount, currency],
    );

    await notificationService.create({
      connection: conn,
      userId: recipient.id,
      title: 'Wallet funds received',
      message: `${currencyMeta.symbol}${transferAmount} ${currency} received from ${user.full_name}.`,
      type: 'transfer',
    });
    await notificationService.create({
      connection: conn,
      userId: user.id,
      title: 'Wallet transfer sent',
      message: `${currencyMeta.symbol}${transferAmount} ${currency} sent to ${recipient.full_name}.`,
      type: 'transfer',
    });

    await auditService.record({
      connection: conn,
      userId: user.id,
      actorEmail: user.email,
      action: 'wallet.transfer',
      entityType: 'wallet',
      entityId: senderWallet.id,
      description: `Sent ${transferAmount} ${currency} to ${recipient.email}`,
      req,
    });

    return { reference, currency, amount: transferAmount, recipient: recipient.full_name };
  });
}

/** Conversion history with pagination. */
async function conversionHistory(userId, filters = {}) {
  const wallet = await ensureWallet(userId);
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 10 });

  const items = await query(
    `SELECT reference, from_currency, to_currency, from_amount, to_amount, rate, created_at
       FROM conversions WHERE wallet_id = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [wallet.id, String(limit), String(offset)],
  );
  const [{ total }] = await query('SELECT COUNT(*) AS total FROM conversions WHERE wallet_id = ?', [wallet.id]);

  return {
    items: items.map((row) => ({
      ...row,
      from_amount: String(row.from_amount),
      to_amount: String(row.to_amount),
      rate: String(row.rate),
    })),
    pagination: { page, limit, total: Number(total) },
  };
}

/** Wallet-only transaction history, optionally filtered to one currency. */
async function walletTransactions(userId, filters = {}) {
  const wallet = await ensureWallet(userId);
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 10 });

  const where = ['wallet_id = ?'];
  const params = [wallet.id];
  if (filters.currency) {
    where.push('currency_code = ?');
    params.push(filters.currency);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const items = await query(
    `SELECT id, reference, type, direction, description, counterparty_name, amount,
            currency_code, balance_after, status, created_at
       FROM transactions ${whereSql}
      ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM transactions ${whereSql}`, params);

  return {
    items: items.map((row) => ({ ...row, amount: String(row.amount) })),
    pagination: { page, limit, total: Number(total) },
  };
}

/** Staff monitoring: every wallet with its holdings valued in the base currency. */
async function listAllWallets(filters = {}, base) {
  const { page, limit, offset } = parsePagination(filters, { defaultLimit: 20 });

  const where = [];
  const params = [];
  if (filters.q) {
    where.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.status) {
    where.push('w.status = ?');
    params.push(filters.status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const wallets = await query(
    `SELECT w.id, w.status, w.created_at, u.id AS user_id, u.full_name, u.email
       FROM wallets w JOIN users u ON u.id = w.user_id
       ${whereSql}
      ORDER BY w.created_at DESC LIMIT ? OFFSET ?`,
    [...params, String(limit), String(offset)],
  );

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM wallets w JOIN users u ON u.id = w.user_id ${whereSql}`,
    params,
  );

  const baseCurrency = await currencyService.get(base);
  const items = [];

  for (const wallet of wallets) {
    const balances = await query(
      'SELECT currency_code, balance FROM wallet_balances WHERE wallet_id = ?',
      [wallet.id],
    );
    let totalScaled = 0n;
    for (const balance of balances) {
      const rate = await currencyService.getRate(balance.currency_code, base);
      totalScaled += money.toScaled(money.convert(String(balance.balance), rate, baseCurrency.decimals));
    }
    items.push({
      id: wallet.id,
      userId: wallet.user_id,
      customer: wallet.full_name,
      email: wallet.email,
      status: wallet.status,
      currencies: balances.length,
      totalValue: money.fromScaled(totalScaled, baseCurrency.decimals),
      createdAt: wallet.created_at,
    });
  }

  return { base, baseSymbol: baseCurrency.symbol, items, pagination: { page, limit, total: Number(total) } };
}

module.exports = {
  ensureWallet,
  overview,
  addCurrency,
  removeCurrency,
  convertCurrency,
  transferToWallet,
  conversionHistory,
  walletTransactions,
  listAllWallets,
};
