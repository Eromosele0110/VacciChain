const logger = require('../logger');
const { AppError } = require('./errors');

/**
 * Standardized error codes.
 */
const CODES = {
  INTERNAL: 'internal_server_error',
  NOT_FOUND: 'not_found',
  VALIDATION_FAILED: 'validation_failed',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  RATE_LIMITED: 'rate_limited',
  CONFLICT: 'conflict',
  RPC_ERROR: 'rpc_error',
};

/**
 * Map an arbitrary error to a standardized client-safe code.
 */
function codeFor(err) {
  if (err instanceof AppError) return err.code;
  if (err.name === 'ValidationError') return CODES.VALIDATION_FAILED;
  if (err.name === 'JsonWebTokenError') return CODES.UNAUTHORIZED;
  if (err.name === 'TokenExpiredError') return CODES.UNAUTHORIZED;
  return CODES.INTERNAL;
}

/**
 * Global error handler middleware.
 *
 * Response body shape (always):
 *   { code: string, message: string, requestId: string }
 *
 * Operational errors (4xx) return their safe message. Unexpected errors
 * (5xx) return a generic message; the full stack is logged server-side and
 * never leaked to the client.
 */
function errorHandler(err, req, res, _next) {
  const statusCode =
    Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;

  const isOperational = statusCode >= 400 && statusCode < 500;
  const code = codeFor(err);
  const message = isOperational && err.message ? err.message : 'Internal Server Error';

  logger.error('unhandled error', {
    requestId: req.requestId,
    code,
    message: err.message,
    stack: err.stack,
    statusCode,
  });

  const body = {
    code,
    message,
    requestId: req.requestId,
  };

  res.status(statusCode).json(body);
}

module.exports = errorHandler;
module.exports.CODES = CODES;
module.exports.AppError = AppError;
