// server/lib/AppError.js
// Canonical operational error for all thrown errors in route handlers (§6.6).
// The errorHandler middleware reads statusCode/code/field off this to build the
// standard error envelope (§6.4).

/**
 * Operational application error carrying an HTTP status, a machine-readable
 * code, and an optional field name for field-level validation errors.
 *
 * Usage:
 *   throw new AppError('Todo not found.', 404, 'NOT_FOUND');
 *   throw new AppError('Title is required.', 400, 'VALIDATION_ERROR', 'title');
 */
export class AppError extends Error {
  /**
   * @param {string} message    Human-readable message (safe to show clients for 4xx).
   * @param {number} [statusCode=500] HTTP status code.
   * @param {string} [code='ERROR']   Machine-readable error code.
   * @param {string|null} [field=null] Field name for VALIDATION_ERROR responses.
   */
  constructor(message, statusCode = 500, code = 'ERROR', field = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    if (field) this.field = field;
  }
}
