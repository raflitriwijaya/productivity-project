// server/routes/auth.js
// Endpoints: POST /register  POST /login  POST /logout  GET /me
// Passwords hashed with bcrypt (cost factor 12 — high enough for security, fast enough for dev).
// Session is set/destroyed here; requireAuth (§6.6a) reads req.session.userId downstream.

import { Router } from 'express';
import bcrypt from 'bcryptjs'; // Phase 3: switched from bcrypt to drop tar/node-pre-gyp high-severity vulns
import { z } from 'zod';
import { findByEmail, createUser, findById } from '../models/user.model.js';
import { pool } from '../lib/db.js'; // Change-password reads/writes password_hash directly (findById omits it).
import { AppError } from '../lib/AppError.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js'; // Per-route guard — the auth router itself is mounted publicly.
import { logger } from '../lib/logger.js';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const registerSchema = z.object({
  name:     z.string().min(1, 'Name is required.').max(255),
  email:    z.string().email('A valid email is required.').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

const loginSchema = z.object({
  email:    z.string().email('A valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required.'),
  new_password:     z.string().min(8, 'New password must be at least 8 characters.'),
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, password } = req.body;
    // Phase 2: normalize before the duplicate check (mirrors login path)
    const email = req.body.email.toLowerCase().trim();

    const existing = await findByEmail(email);
    if (existing) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_CONFLICT', 'email');
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await createUser({ email, password_hash, name: name.trim() });

    // Establish session immediately after registration (auto-login).
    req.session.userId = user.id;

    (req.log ?? logger).info({ event: 'REGISTER_SUCCESS', userId: user.id, reqId: req.id }, `New user registered: ${user.id}`);

    return res.status(201).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await findByEmail(email.toLowerCase().trim());
    if (!user) {
      // Identical message for both "no account" and "wrong password" — prevents user enumeration.
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      (req.log ?? logger).info({ event: 'LOGIN_FAILURE', email: email.toLowerCase().trim(), reason: 'invalid_password', reqId: req.id }, `Failed login attempt for ${email}`);
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Regenerate session id on privilege escalation to prevent session fixation.
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;

      (req.log ?? logger).info({ event: 'LOGIN_SUCCESS', userId: user.id, reqId: req.id }, `User ${user.id} logged in`);

      // Strip password_hash before sending response.
      const { password_hash: _omit, ...safeUser } = user;

      return res.json({
        success: true,
        data: safeUser,
      });
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

authRouter.post('/logout', (req, res, next) => {
  const userId = req.session?.userId;
  req.session.destroy((err) => {
    if (err) return next(err);
    (req.log ?? logger).info({ event: 'LOGOUT', userId, reqId: req.id }, `User ${userId} logged out`);
    res.clearCookie('sid'); // 'sid' must match the cookie name set in express-session config (see index.js).
    return res.json({ success: true, data: null });
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

authRouter.get('/me', async (req, res, next) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      throw new AppError('Not authenticated.', 401, 'AUTH_REQUIRED');
    }

    const user = await findById(userId);
    if (!user) {
      // Session points to a deleted user — destroy the stale session.
      req.session.destroy(() => {});
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    return res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/auth/password ───────────────────────────────────────────────────
// Change the signed-in user's password (current password required). requireAuth
// is applied per-route because this router is mounted publicly (login/register
// must stay open). Session is intentionally NOT regenerated — per spec the user
// stays logged in after changing their password.

authRouter.put('/password', requireAuth, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    // findById() deliberately omits password_hash, so read the hash directly.
    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    const user = rows[0];
    if (!user) {
      throw new AppError('User not found.', 404, 'NOT_FOUND');
    }

    const passwordMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!passwordMatch) {
      (req.log ?? logger).info({ event: 'PASSWORD_CHANGE_FAILURE', userId, reason: 'invalid_current_password', reqId: req.id }, `Failed password change for user ${userId}`);
      throw new AppError('Current password is incorrect.', 400, 'VALIDATION_ERROR', 'current_password');
    }

    const password_hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [password_hash, userId]
    );

    (req.log ?? logger).info({ event: 'PASSWORD_CHANGE', userId, reqId: req.id }, `User ${userId} changed their password`);

    return res.json({ success: true, data: { message: 'Password changed successfully.' } });
  } catch (err) {
    next(err);
  }
});
