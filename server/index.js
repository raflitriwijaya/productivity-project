// server/index.js
// Production-ready Express entry point for Rafli's Productivity Suite.
//
// Required env vars (see §6.0):
//   DATABASE_URL   — postgres connection string
//   CLIENT_ORIGIN  — e.g. http://localhost:5173
//   SESSION_SECRET — random 32+ char string
//   PORT           — defaults to 3000
//   NODE_ENV       — 'development' | 'production'

import 'dotenv/config';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

// ── Internal modules ──────────────────────────────────────────────────────────
import { pool } from './lib/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';

// ── Route modules (existing — do not re-implement, per PROJECT_STATE.md) ─────
import { authRouter }     from './routes/auth.js';
import { todosRouter }    from './routes/todos.js';
import { financesRouter } from './routes/finances.js';
import { learningRouter } from './routes/learning.js';
import { researchRouter, uploadsDir } from './routes/research.js';
import { engineerRouter } from './routes/engineer.js';

// ─── Env validation ───────────────────────────────────────────────────────────
const {
  DATABASE_URL,
  CLIENT_ORIGIN,
  SESSION_SECRET,
  PORT = '3000',
  NODE_ENV = 'development',
} = process.env;

if (!DATABASE_URL)   throw new Error('Missing env var: DATABASE_URL');
if (!CLIENT_ORIGIN)  throw new Error('Missing env var: CLIENT_ORIGIN');
if (!SESSION_SECRET) throw new Error('Missing env var: SESSION_SECRET');

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();
const isProd = NODE_ENV === 'production';

// ─── CORS ─────────────────────────────────────────────────────────────────────
// credentials: true is required so the browser sends the session cookie.
// The axios client sets withCredentials: true (§6.7) to match.
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ─── Session ──────────────────────────────────────────────────────────────────
// Sessions are stored in PostgreSQL via connect-pg-simple so they survive
// server restarts without a separate Redis dependency.
// The session table is auto-created on first connect (createTableIfMissing: true).
const PgSession = connectPgSimple(session);

app.use(session({
  name: 'sid', // Must match the cookie name cleared in POST /api/auth/logout.
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new PgSession({
    pool,                          // Reuse the shared pg pool from lib/db.js.
    tableName: 'user_sessions',    // Explicit name avoids collision with app tables.
    createTableIfMissing: true,    // No separate migration needed for the session table.
    ttl: 60 * 60 * 24 * 7,        // 7 days in seconds — matches cookie maxAge below.
  }),
  cookie: {
    httpOnly: true,                // Not accessible via document.cookie — mitigates XSS.
    secure: isProd,                // HTTPS only in production; allow HTTP in dev.
    sameSite: 'lax',              // §2F — 'lax' lets the session cookie ride top-level navigations.
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days in ms.
  },
}));

// ─── Trust proxy ──────────────────────────────────────────────────────────────
// Required in production so Express sees the real client IP and protocol
// (for secure cookies to work behind a reverse proxy like nginx/Render/Railway).
if (isProd) {
  app.set('trust proxy', 1);
}

// ─── Uploads ──────────────────────────────────────────────────────────────────
// Research attachments are written to server/uploads/ by multer (configured in
// routes/research.js, which exports the resolved `uploadsDir`). Ensure the
// directory exists at startup, then serve it statically. Files are served by
// their random (obscure) filenames, so this is left public for simple <img>/
// <a href> access; no auth gate is applied here.
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ─── Health check (no auth) ───────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── Auth routes (public — no requireAuth) ────────────────────────────────────
app.use('/api/auth', authRouter);

// ─── Protected resource routes ────────────────────────────────────────────────
// requireAuth middleware (§6.6a) attaches req.user = { id } and returns 401
// for any request with no valid session cookie.
app.use('/api/todos',    requireAuth, todosRouter);
app.use('/api/finances', requireAuth, financesRouter);
app.use('/api/learning', requireAuth, learningRouter);
app.use('/api/research', requireAuth, researchRouter);
app.use('/api/engineer', requireAuth, engineerRouter);

// ─── 404 for unmatched API routes ────────────────────────────────────────────
app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'API endpoint not found.' },
  });
});

// ─── Global error handler — MUST be last middleware (§6.6) ───────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(parseInt(PORT, 10), () => {
  console.log(`[server] Running on port ${PORT} (${NODE_ENV})`);
});

export default app;
