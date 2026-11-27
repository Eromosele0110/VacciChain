const logger = require('../logger');
const { errorBody } = require('../errors');

/**
 * Global error handler middleware (#42 — see docs/api-errors.md).
 *
 * Operational errors (statusCode 4xx set on the error object) are returned
 * with their message and stable `code`. Unexpected errors (5xx) log the full
 * stack but only return a generic message, so internals are never exposed.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
function errorHandler(err, req, res, _next) {
  // express.json() parse failures and body-limit errors carry `status`.
  const raw = Number.isInteger(err.statusCode) ? err.statusCode : err.status;
  const statusCode = Number.isInteger(raw) && raw >= 400 && raw < 600 ? raw : 500;

  logger.error('unhandled error', {
    requestId: req.requestId,
    message: err.message,
    stack: err.stack,
    statusCode,
  });

  const code = typeof err.code === 'string' && /^[A-Z_]+$/.test(err.code) ? err.code : undefined;
  res.status(statusCode).json(errorBody(req, statusCode, code, err.message, err.details));
}

module.exports = errorHandler;
