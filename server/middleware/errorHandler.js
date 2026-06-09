// server/middleware/errorHandler.js
// Global error handler — MUST be the LAST middleware registered (§6.6).
// Converts any error (AppError or otherwise) into the standard error envelope
// from §6.4. 500-level details are never leaked to the client.
import * as Sentry from '@sentry/node'; // Phase 5: capture unhandled errors
import { logger } from '../lib/logger.js'; // Phase 3: use pino instead of console.error

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Phase 2: map pg unique-violation (23505) to a clean 409 for any unique constraint
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'A record with this value already exists.' },
    });
  }

  // Phase 5: report to Sentry (no-op when DSN not set); attach request ID as context
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      scope.setTag('reqId', req.id);
      Sentry.captureException(err);
    });
  }

  // Phase 3: structured error log; req.id is injected by pino-http
  const log = req.log ?? logger;
  log.error({ err, reqId: req.id }, 'Unhandled error');

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'An unexpected error occurred.' : err.message,
      reqId: req.id, // Phase 3: surface request ID so users can quote it in bug reports
      ...(err.field ? { field: err.field } : {}),
    },
  });
}
