// server/middleware/validate.js
// Request-body validation via zod (§6.6b). Runs before the handler and converts
// the first schema failure into the standard VALIDATION_ERROR envelope (§6.4).

import { AppError } from '../lib/AppError.js';

/**
 * Build an Express middleware that validates `req.body` against a zod schema.
 * On success, `req.body` is replaced with the parsed (coerced) data.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const first = result.error.issues[0];
    return next(
      new AppError(first.message, 400, 'VALIDATION_ERROR', first.path.join('.') || undefined)
    );
  }
  req.body = result.data; // parsed + coerced
  next();
};
