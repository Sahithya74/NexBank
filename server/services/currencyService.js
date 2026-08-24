'use strict';

const { query, queryOne, pool } = require('../config/db');
const { badRequest, notFound } = require('../utils/AppError');
const money = require('../utils/money');

/**
 * Rates are stored quoted against USD. Any pair is derived as
 *   from -> to  =  (USD->to) / (USD->from)
 * so adding a currency means adding one row, never a schema change.
 */
const PIVOT = 'USD';

async function list({ activeOnly = true } = {}) {
  const rows = await query(
    `SELECT code, name, symbol, decimals, is_active
       FROM currencies
      ${activeOnly ? 'WHERE is_active = 1' : ''}
      ORDER BY code = 'INR' DESC, code ASC`,
  );
  return rows.map((row) => ({ ...row, is_active: Boolean(row.is_active) }));
}

async function get(code) {
  const currency = await queryOne(
    'SELECT code, name, symbol, decimals, is_active FROM currencies WHERE code = ?',
    [code],
  );
  if (!currency) throw notFound(`Currency ${code} is not supported.`, 'UNSUPPORTED_CURRENCY');
  return { ...currency, is_active: Boolean(currency.is_active) };
}

async function requireActive(code) {
  const currency = await get(code);
  if (!currency.is_active) {
    throw badRequest(`Currency ${code} is not currently available.`, 'CURRENCY_INACTIVE');
  }
  return currency;
}

/** Map of currency code -> USD-quoted rate, as decimal strings. */
async function pivotRates() {
  const rows = await query(
    'SELECT quote_currency, rate FROM exchange_rates WHERE base_currency = ?',
    [PIVOT],
  );
  const map = new Map(rows.map((row) => [row.quote_currency, String(row.rate)]));
  map.set(PIVOT, '1');
  return map;
}

/** Exchange rate from one currency to another, as an 8-decimal string. */
async function getRate(from, to) {
  if (from === to) return '1.00000000';

  const direct = await queryOne(
    'SELECT rate FROM exchange_rates WHERE base_currency = ? AND quote_currency = ?',
    [from, to],
  );
  if (direct) return money.fromScaled(money.toScaled(direct.rate), 8);

  const rates = await pivotRates();
  const fromRate = rates.get(from);
  const toRate = rates.get(to);
  if (!fromRate || !toRate) {
    throw badRequest(`No exchange rate is available for ${from} to ${to}.`, 'RATE_UNAVAILABLE');
  }
  return money.fromScaled(
    money.divideScaled(money.toScaled(toRate), money.toScaled(fromRate)),
    8,
  );
}

/** Rate table for the wallet UI: every active currency quoted against `base`. */
async function rateTable(base) {
  const currencies = await list({ activeOnly: true });
  const rates = await pivotRates();
  const baseRate = rates.get(base);
  if (!baseRate) throw badRequest(`No exchange rate is available for ${base}.`, 'RATE_UNAVAILABLE');

  return currencies.map((currency) => {
    const quoteRate = rates.get(currency.code);
    const rate = quoteRate
      ? money.fromScaled(money.divideScaled(money.toScaled(quoteRate), money.toScaled(baseRate)), 8)
      : null;
    return { ...currency, base, rate };
  });
}

/** Preview a conversion without touching any balance. */
async function quote(from, to, amount) {
  const source = await requireActive(from);
  const target = await requireActive(to);
  const normalised = money.normaliseAmount(amount, { decimals: source.decimals, label: 'Amount' });
  const rate = await getRate(from, to);
  const converted = money.convert(normalised, rate, target.decimals);
  return {
    from,
    to,
    rate,
    amount: normalised,
    convertedAmount: converted,
    fromSymbol: source.symbol,
    toSymbol: target.symbol,
  };
}

/** Admin: create or update a USD-quoted rate. */
async function upsertRate(quoteCurrency, rate) {
  await requireActive(quoteCurrency);
  const normalised = money.normaliseAmount(rate, { decimals: 8, min: '0.00000001', label: 'Rate' });
  await pool.execute(
    `INSERT INTO exchange_rates (base_currency, quote_currency, rate)
          VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rate = VALUES(rate), effective_at = CURRENT_TIMESTAMP`,
    [PIVOT, quoteCurrency, normalised],
  );
  return { base: PIVOT, quote: quoteCurrency, rate: normalised };
}

/** Admin: add a currency. No schema change required. */
async function createCurrency({ code, name, symbol, decimals, rate }) {
  await pool.execute(
    `INSERT INTO currencies (code, name, symbol, decimals, is_active)
          VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE name = VALUES(name), symbol = VALUES(symbol),
                             decimals = VALUES(decimals), is_active = 1`,
    [code, name, symbol, decimals],
  );
  if (rate) await upsertRate(code, rate);
  return get(code);
}

async function setActive(code, isActive) {
  await get(code);
  await pool.execute('UPDATE currencies SET is_active = ? WHERE code = ?', [isActive ? 1 : 0, code]);
  return get(code);
}

module.exports = {
  PIVOT,
  list,
  get,
  requireActive,
  getRate,
  rateTable,
  quote,
  upsertRate,
  createCurrency,
  setActive,
};
