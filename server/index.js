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
import * as Sentry from '@sentry/node'; // Phase 5: error reporting — no-op when SENTRY_DSN is unset
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet'; // Phase 1: security headers
import rateLimit from 'express-rate-limit'; // Phase 1: brute-force / abuse protection
import pinoHttp from 'pino-http'; // Phase 3: per-request logging + auto request IDs
import { logger } from './lib/logger.js'; // Phase 3: shared pino instance
import { register, httpRequestDuration, httpRequestTotal } from './lib/metrics.js';
import { startPoolMetrics, stopPoolMetrics } from './lib/poolMetrics.js';

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
import { linksRouter } from './routes/links.js';

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

// ─── Sentry init (Phase 5) ────────────────────────────────────────────────────
// Phase 5: report to Sentry only when DSN configured; dev/CI run unaffected
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: NODE_ENV });
}

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();
const isProd = NODE_ENV === 'production';

// ─── Structured request logging ──────────────────────────────────────────────
// Phase 3: assigns a unique reqId to every request; echoed in error responses
app.use(pinoHttp({ logger }));

// ─── CORS ─────────────────────────────────────────────────────────────────────
// credentials: true is required so the browser sends the session cookie.
// The axios client sets withCredentials: true (§6.7) to match.
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// ─── Rate limiters ────────────────────────────────────────────────────────────
// Phase 1: stop credential-stuffing on auth endpoints and cap general API abuse.
// Defined here so generalLimiter can be mounted globally before body parsers.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again in 15 minutes.' },
  }),
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
  }),
});

// ─── Global rate limiter ──────────────────────────────────────────────────────
// Phase 12: apply before body parsers so flood payloads are dropped before the
// JSON parser allocates memory. authLimiter stays per-route on login/register.
app.use(generalLimiter);

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

// ─── Security headers (Helmet) ────────────────────────────────────────────────
// Phase 1: emit X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.
// CSP is strict (API-only; SPA lives on a separate nginx origin).
// HSTS is enabled in production only.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: isProd
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
}));

// ─── Uploads dir ──────────────────────────────────────────────────────────────
// Ensure the uploads directory exists; no longer served statically — all
// attachment downloads now go through the authenticated route in research.js.
// Phase 1: public static mount removed to gate downloads behind auth + ownership.
fs.mkdirSync(uploadsDir, { recursive: true });

// ─── HTTP metrics middleware ──────────────────────────────────────────────────
// Records duration and count for every request. Placed after pino-http so
// req.log is available, and before routes so all paths are instrumented.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path ?? req.path ?? 'unknown';
    const statusCode = res.statusCode.toString();
    httpRequestDuration.observe({ method: req.method, route, status_code: statusCode }, duration);
    httpRequestTotal.inc({ method: req.method, route, status_code: statusCode });
  });
  next();
});

// ─── Metrics endpoint (unauthenticated — restrict via nginx/Cloudflare in prod)
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch {
    res.status(500).end();
  }
});

// ─── Health check (no auth) ───────────────────────────────────────────────────
// Phase 12: verify DB connectivity so Docker healthcheck and nginx depends_on
// reflect real availability, not just process liveness.
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});

// ─── Auth routes (public, no requireAuth) ────────────────────────────────────
// Phase 6: apply the strict brute-force limiter ONLY to the credential-guessable
// verbs. /me and /logout ride the global generalLimiter (100/min) — they must
// NOT share the 5-req/15-min authLimiter budget or a normal refresh pattern
// self-DoSes the user for 15 minutes (§3-N1).
app.use('/api/auth/login',    authLimiter); // Phase 6: brute-force guard, credentials only
app.use('/api/auth/register', authLimiter); // Phase 6: brute-force guard, credentials only
app.use('/api/auth', authRouter);

// ─── Protected resource routes ────────────────────────────────────────────────
// requireAuth middleware (§6.6a) attaches req.user = { id } and returns 401
// for any request with no valid session cookie.
app.use('/api/todos',    requireAuth, todosRouter);
app.use('/api/finances', requireAuth, financesRouter);
app.use('/api/learning', requireAuth, learningRouter);
app.use('/api/research', requireAuth, researchRouter);
app.use('/api/engineer', requireAuth, engineerRouter);
app.use('/api/links',    requireAuth, linksRouter); // Roadmap Wave 1: cross-module links

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
// Phase 2: capture server handle for graceful shutdown
const server = app.listen(parseInt(PORT, 10), () => {
  logger.info({ port: PORT, env: NODE_ENV }, 'Server started'); // Phase 3: structured startup log
  startPoolMetrics();
});

// Phase 2: drain in-flight requests then close the pg pool on SIGTERM/SIGINT
function shutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown initiated'); // Phase 3: structured shutdown log
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref(); // don't keep the event loop alive just for the timer

  server.close(() => {
    logger.info('HTTP server closed');
    stopPoolMetrics();
    pool.end(() => {
      logger.info('pg pool drained — bye');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
