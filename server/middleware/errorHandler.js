'use strict';

const config = require('../config/env');
const { AppError } = require('../utils/AppError');

/** 404 handler for unmatched API routes. */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `No API route matches ${req.method} ${req.originalUrl}.`,
    },
  });
}

/** Translate a MySQL driver error into a user-safe message. */
function translateDatabaseError(error) {
  switch (error.code) {
    case 'ER_DUP_ENTRY':
      return { status: 409, code: 'DUPLICATE_ENTRY', message: 'That record already exists.' };
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return { status: 400, code: 'INVALID_REFERENCE', message: 'A referenced record does not exist.' };
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return { status: 409, code: 'RECORD_IN_USE', message: 'This record is in use and cannot be removed.' };
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return { status: 400, code: 'BALANCE_CONSTRAINT', message: 'This operation would leave a negative balance.' };
    case 'ER_LOCK_DEADLOCK':
      return { status: 409, code: 'CONCURRENT_UPDATE', message: 'Another operation is in progress. Please try again.' };
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ER_ACCESS_DENIED_ERROR':
      return { status: 503, code: 'SERVICE_UNAVAILABLE', message: 'The banking service is temporarily unavailable.' };
    default:
      return null;
  }
}

/**
 * Central error handler. Raw SQL text, driver codes and stack traces never reach
 * the client; unexpected faults are logged server-side and reported generically.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'The request body could not be read.' },
    });
  }

  const translated = error && error.code ? translateDatabaseError(error) : null;
  if (translated) {
    // eslint-disable-next-line no-console
    console.error('[nexbank] database error:', error.code, error.sqlMessage || error.message);
    return res.status(translated.status).json({
      success: false,
      error: { code: translated.code, message: translated.message },
    });
  }

  // eslint-disable-next-line no-console
  console.error('[nexbank] unhandled error:', error);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      ...(config.isProduction ? {} : { debug: error.message }),
    },
  });
}

module.exports = { errorHandler, notFoundHandler };
