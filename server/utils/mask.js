'use strict';

/**
 * Masking helpers. Full account and card numbers never leave the server, so every
 * serialiser runs identifiers through here before they reach a response body.
 */

const BULLET = '•';

/** NEX1000000001 -> ****** 0001 */
function maskAccountNumber(accountNumber) {
  if (!accountNumber) return '';
  const value = String(accountNumber);
  const visible = value.slice(-4);
  return `${BULLET.repeat(6)} ${visible}`;
}

/** 4821 -> **** **** **** 4821 */
function maskCardNumber(lastFour) {
  if (!lastFour) return '';
  const group = BULLET.repeat(4);
  return `${group} ${group} ${group} ${lastFour}`;
}

/** meera@nexbank.com -> me***@nexbank.com */
function maskEmail(email) {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

/** +91 98400 22001 -> +91 ***** 2001 */
function maskPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

module.exports = { maskAccountNumber, maskCardNumber, maskEmail, maskPhone };
