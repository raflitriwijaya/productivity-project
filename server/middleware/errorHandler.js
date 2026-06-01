// server/middleware/errorHandler.js
// Global error handler — MUST be the LAST middleware registered (§6.6).
// Converts any error (AppError or otherwise) into the standard error envelope
// from §6.4. 500-level details are never leaked to the client.

/**
 * Express error-handling middleware.
 * @param {Error & { statusCode?: number, code?: string, field?: string }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${err.stack || err}`);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'An unexpected error occurred.' : err.message,
      // `field` is only present on field-level validation errors (matches §6.4).
      ...(err.field ? { field: err.field } : {}),
    },
  });
}
