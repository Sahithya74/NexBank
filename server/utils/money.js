'use strict';

const { badRequest } = require('./AppError');

/**
 * Fixed-point decimal helpers.
 *
 * Money never touches a JavaScript float. Values are carried as strings and, when
 * arithmetic is unavoidable outside SQL (currency conversion), scaled to BigInt at
 * SCALE decimal places. Balance mutations themselves are always done in SQL.
 */
const SCALE = 8;
const SCALE_FACTOR = 10n ** BigInt(SCALE);
const AMOUNT_PATTERN = /^-?\d{1,18}(\.\d{1,8})?$/;

/** Parse a decimal string/number into a BigInt scaled by 10^SCALE. */
function toScaled(value) {
  const text = String(value ?? '').trim();
  if (!AMOUNT_PATTERN.test(text)) {
    throw badRequest('Amount is not a valid decimal number.', 'INVALID_AMOUNT');
  }
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const paddedFraction = (fraction + '0'.repeat(SCALE)).slice(0, SCALE);
  const scaled = BigInt(whole + paddedFraction);
  return negative ? -scaled : scaled;
}

/** Render a scaled BigInt back to a decimal string with `decimals` places (half-up). */
function fromScaled(scaled, decimals = 2) {
  const negative = scaled < 0n;
  const magnitude = negative ? -scaled : scaled;
  const divisor = 10n ** BigInt(SCALE - decimals);
  const quotient = magnitude / divisor;
  const remainder = magnitude % divisor;
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;

  const digits = rounded.toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals) || '0';
  const fraction = decimals > 0 ? `.${digits.slice(digits.length - decimals)}` : '';
  return `${negative && rounded !== 0n ? '-' : ''}${whole}${fraction}`;
}

/** Multiply two scaled values, returning a scaled value (half-up rounding). */
function multiplyScaled(a, b) {
  const product = a * b;
  const negative = product < 0n;
  const magnitude = negative ? -product : product;
  const quotient = magnitude / SCALE_FACTOR;
  const remainder = magnitude % SCALE_FACTOR;
  const rounded = remainder * 2n >= SCALE_FACTOR ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/** Divide two scaled values, returning a scaled value (half-up rounding). */
function divideScaled(a, b) {
  if (b === 0n) {
    throw badRequest('Cannot divide by a zero exchange rate.', 'INVALID_RATE');
  }
  const numerator = a * SCALE_FACTOR;
  const negative = numerator < 0n !== b < 0n;
  const magnitude = (numerator < 0n ? -numerator : numerator) * 2n;
  const divisor = (b < 0n ? -b : b) * 2n;
  const quotient = magnitude / divisor;
  const remainder = magnitude % divisor;
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/**
 * Validate a user-supplied amount and normalise it to `decimals` places.
 * Returns the normalised decimal string, ready to hand to MySQL.
 */
function normaliseAmount(value, { decimals = 2, min = '0.01', max = null, label = 'Amount' } = {}) {
  const scaled = toScaled(value);
  if (scaled <= 0n) {
    throw badRequest(`${label} must be greater than zero.`, 'INVALID_AMOUNT');
  }
  if (min !== null && scaled < toScaled(min)) {
    throw badRequest(`${label} must be at least ${min}.`, 'AMOUNT_TOO_SMALL');
  }
  if (max !== null && scaled > toScaled(max)) {
    throw badRequest(`${label} must not exceed ${max}.`, 'AMOUNT_TOO_LARGE');
  }
  return fromScaled(scaled, decimals);
}

/** Compare two decimal strings. Returns -1, 0 or 1. */
function compare(a, b) {
  const left = toScaled(a);
  const right = toScaled(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Sum an array of decimal strings into a decimal string. */
function sum(values, decimals = 2) {
  const total = values.reduce((acc, value) => acc + toScaled(value ?? '0'), 0n);
  return fromScaled(total, decimals);
}

/** Convert an amount using a rate, both given as decimal strings. */
function convert(amount, rate, decimals = 2) {
  return fromScaled(multiplyScaled(toScaled(amount), toScaled(rate)), decimals);
}

module.exports = {
  SCALE,
  toScaled,
  fromScaled,
  multiplyScaled,
  divideScaled,
  normaliseAmount,
  compare,
  sum,
  convert,
};
