'use strict';

/**
 * Application error carrying a stable machine code plus a user-safe message.
 * Anything thrown that is not an AppError is treated as an internal fault and
 * reported to the client as a generic message.
 */
class AppError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.isOperational = true;
  }
}

const badRequest = (message, code = 'BAD_REQUEST', details = null) =>
  new AppError(code, message, 400, details);

const unauthorized = (message = 'Please sign in to continue.', code = 'UNAUTHENTICATED') =>
  new AppError(code, message, 401);

const forbidden = (message = 'You do not have permission to perform this action.', code = 'FORBIDDEN') =>
  new AppError(code, message, 403);

const notFound = (message = 'The requested resource was not found.', code = 'NOT_FOUND') =>
  new AppError(code, message, 404);

const conflict = (message, code = 'CONFLICT') => new AppError(code, message, 409);

const validation = (message = 'Please correct the highlighted fields.', details = null) =>
  new AppError('VALIDATION_ERROR', message, 422, details);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, validation };
