// server/middleware/auth.js
// Reads req.session.userId (written by /api/auth/login and /api/auth/register).
// Attaches req.user = { id } for all downstream route handlers.
// Per §6.6a: missing/invalid session → 401 AUTH_REQUIRED.

import { AppError } from '../lib/AppError.js';

/**
 * Express middleware that enforces an authenticated session.
 * Mount in front of any resource router that requires authentication:
 *   app.use('/api/todos', requireAuth, todosRouter)
 *
 * Downstream handlers access the owner via req.user.id and MUST scope
 * all DB queries with WHERE user_id = $1 (see §6.6a).
 */
export function requireAuth(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return next(new AppError('Authentication required.', 401, 'AUTH_REQUIRED'));
  }
  req.user = { id: userId };
  next();
}
