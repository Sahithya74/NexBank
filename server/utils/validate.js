'use strict';

const { validation } = require('./AppError');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const AMOUNT_PATTERN = /^\d{1,18}(\.\d{1,8})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function checkField(name, rawValue, rules) {
  const label = rules.label || name;
  const isMissing = rawValue === undefined || rawValue === null || rawValue === '';

  if (isMissing) {
    if (rules.required) return { error: `${label} is required.` };
    return { value: rules.default !== undefined ? rules.default : undefined };
  }

  switch (rules.type) {
    case 'string': {
      const value = String(rawValue).trim();
      if (rules.minLength && value.length < rules.minLength) {
        return { error: `${label} must be at least ${rules.minLength} characters.` };
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        return { error: `${label} must be ${rules.maxLength} characters or fewer.` };
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        return { error: rules.patternMessage || `${label} is not in the expected format.` };
      }
      return { value };
    }
    case 'email': {
      const value = String(rawValue).trim().toLowerCase();
      if (!EMAIL_PATTERN.test(value) || value.length > 160) {
        return { error: 'Enter a valid email address.' };
      }
      return { value };
    }
    case 'password': {
      const value = String(rawValue);
      if (value.length < 8) return { error: 'Password must be at least 8 characters.' };
      if (value.length > 128) return { error: 'Password must be 128 characters or fewer.' };
      if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
        return { error: 'Password must contain both letters and numbers.' };
      }
      return { value };
    }
    case 'int': {
      const value = Number(rawValue);
      if (!Number.isInteger(value)) return { error: `${label} must be a whole number.` };
      if (rules.min !== undefined && value < rules.min) {
        return { error: `${label} must be at least ${rules.min}.` };
      }
      if (rules.max !== undefined && value > rules.max) {
        return { error: `${label} must not exceed ${rules.max}.` };
      }
      return { value };
    }
    case 'id': {
      const value = Number(rawValue);
      if (!Number.isInteger(value) || value <= 0) {
        return { error: `${label} is not a valid identifier.` };
      }
      return { value };
    }
    case 'amount': {
      const value = String(rawValue).trim();
      if (!AMOUNT_PATTERN.test(value)) {
        return { error: `${label} must be a positive amount.` };
      }
      return { value };
    }
    case 'boolean': {
      if (typeof rawValue === 'boolean') return { value: rawValue };
      if (rawValue === 'true' || rawValue === 1 || rawValue === '1') return { value: true };
      if (rawValue === 'false' || rawValue === 0 || rawValue === '0') return { value: false };
      return { error: `${label} must be true or false.` };
    }
    case 'enum': {
      const value = String(rawValue).trim();
      if (!rules.values.includes(value)) {
        return { error: `${label} must be one of: ${rules.values.join(', ')}.` };
      }
      return { value };
    }
    case 'date': {
      const value = String(rawValue).trim().slice(0, 10);
      if (!DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
        return { error: `${label} must be a valid date (YYYY-MM-DD).` };
      }
      return { value };
    }
    case 'currency': {
      const value = String(rawValue).trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(value)) {
        return { error: `${label} must be a three-letter currency code.` };
      }
      return { value };
    }
    default:
      return { value: rawValue };
  }
}

/** Validate an object against a schema. Throws a 422 AppError listing every bad field. */
function validateObject(source, schema) {
  const result = {};
  const fieldErrors = {};

  for (const [name, rules] of Object.entries(schema)) {
    const { value, error } = checkField(name, source ? source[name] : undefined, rules);
    if (error) {
      fieldErrors[name] = error;
    } else if (value !== undefined) {
      result[name] = value;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw validation('Please correct the highlighted fields.', fieldErrors);
  }
  return result;
}

/** Express middleware: validates req.body and stores the clean object on req.validated. */
function validateBody(schema) {
  return (req, _res, next) => {
    try {
      req.validated = validateObject(req.body, schema);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Express middleware: validates req.query into req.validatedQuery. */
function validateQuery(schema) {
  return (req, _res, next) => {
    try {
      req.validatedQuery = validateObject(req.query, schema);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Shared pagination/sorting parser with safe bounds and an allowlisted sort column. */
function parsePagination(query, { defaultLimit = 10, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, requested), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

/** Only ever returns a column name from `allowed`, so it is safe to interpolate. */
function parseSort(query, allowed, fallback) {
  const column = allowed.includes(query.sortBy) ? query.sortBy : fallback;
  const direction = String(query.sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return { column, direction };
}

module.exports = {
  validateObject,
  validateBody,
  validateQuery,
  parsePagination,
  parseSort,
};
