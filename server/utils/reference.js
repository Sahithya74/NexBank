'use strict';

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Random uppercase suffix that avoids visually ambiguous characters. */
function randomSuffix(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Human-readable reference, e.g. TRF20260825K7QM2X.
 * Prefixes: TXN transaction, TRF transfer, CNV conversion, BPY bill payment,
 * LON loan, LPY loan payment.
 */
function generateReference(prefix) {
  const now = new Date();
  const date = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('');
  return `${prefix}${date}${randomSuffix(6)}`;
}

/** 13-character NexBank account number: NEX + 10 digits. */
function generateAccountNumber() {
  let digits = '';
  while (digits.length < 10) {
    digits += crypto.randomInt(0, 10).toString();
  }
  return `NEX${digits}`;
}

module.exports = { generateReference, generateAccountNumber, randomSuffix };
