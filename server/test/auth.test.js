// Phase 4: auth flow integration tests — register, login, session, duplicate-email, wrong password
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ── Mock the db pool before importing app so no real DB is required ──────────
vi.mock('../lib/db.js', () => {
  const pool = {
    query: vi.fn(),
    connect: vi.fn(),
    on: vi.fn(),
    end: vi.fn(),
  };
  return { pool, default: pool };
});

// Mock pino-http so the logger doesn't blow up without a real transport
vi.mock('pino-http', () => ({
  default: () => (_req, _res, next) => next(),
}));
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock connect-pg-simple session store
vi.mock('connect-pg-simple', () => ({
  default: () => class MockStore {
    on() {}
    get(_sid, cb) { cb(null, null); }
    set(_sid, _session, cb) { cb(null); }
    destroy(_sid, cb) { cb(null); }
    touch(_sid, _session, cb) { cb(null); }
  },
}));

// ── Build a fresh minimal Express app to avoid rate-limit state between tests ─
// We import authRouter directly and mount it without rate limiting so tests
// aren't rejected by the 5-req/15-min auth limiter from index.js.
import express from 'express';
import session from 'express-session';
import { errorHandler } from '../middleware/errorHandler.js';
import { authRouter } from '../routes/auth.js';

const { pool } = await import('../lib/db.js');

import bcrypt from 'bcryptjs';

// Build a lightweight test app each describe block can use without state pollution
function makeApp() {
  const app = express();
  app.use(express.json());

  // Simple memory session store for tests
  app.use(session({
    name: 'sid',
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  }));

  app.use('/api/auth', authRouter);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('Auth flow', () => {
  it('POST /api/auth/register → 201 with user data (duplicate-free)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })                              // findByEmail → no conflict
      .mockResolvedValueOnce({                                          // createUser
        rows: [{ id: 1, email: 'alice@test.com', name: 'Alice', created_at: new Date(), updated_at: new Date() }],
      });

    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('alice@test.com');
  });

  it('POST /api/auth/register → 409 when email already exists', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'alice@test.com' }],
    });

    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMAIL_CONFLICT');
  });

  it('POST /api/auth/register normalises email to lowercase before duplicate check', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })   // findByEmail (normalised)
      .mockResolvedValueOnce({
        rows: [{ id: 2, email: 'bob@test.com', name: 'Bob', created_at: new Date(), updated_at: new Date() }],
      });

    const res = await request(makeApp())
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'BOB@TEST.COM', password: 'securepass1' });

    expect(res.status).toBe(201);
    // findByEmail must receive the lowercased form
    expect(pool.query.mock.calls[0][1][0]).toBe('bob@test.com');
  });

  it('POST /api/auth/login → 200 on correct credentials (password_hash stripped)', async () => {
    const hash = await bcrypt.hash('correctPass', 10);
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'alice@test.com', name: 'Alice', password_hash: hash }],
    });

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'correctPass' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  it('POST /api/auth/login → 401 when user does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // findByEmail → not found

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'ghost@test.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/auth/login → 401 with wrong password, identical message (no enumeration)', async () => {
    const hash = await bcrypt.hash('realPass', 10);
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'alice@test.com', name: 'Alice', password_hash: hash }],
    });

    const res = await request(makeApp())
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'wrongPass' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  it('GET /api/auth/me → 401 when no session', async () => {
    const res = await request(makeApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/auth/password', () => {
  // Log in via an agent so the session cookie rides along to the password change.
  // Returns the agent and the bcrypt hash of `currentPass` for the seeded user.
  async function loginAgent(currentPass = 'currentPass') {
    const agent = request.agent(makeApp());
    const hash = await bcrypt.hash(currentPass, 10);
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'alice@test.com', name: 'Alice', password_hash: hash }],
    }); // login → findByEmail
    await agent.post('/api/auth/login').send({ email: 'alice@test.com', password: currentPass });
    return { agent, hash };
  }

  it('→ 401 AUTH_REQUIRED when there is no session', async () => {
    const res = await request(makeApp())
      .put('/api/auth/password')
      .send({ current_password: 'whatever', new_password: 'newpassword123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('→ 200 and re-hashes the password on correct current password', async () => {
    const { agent, hash } = await loginAgent();
    pool.query
      .mockResolvedValueOnce({ rows: [{ password_hash: hash }] }) // SELECT password_hash
      .mockResolvedValueOnce({ rowCount: 1 });                    // UPDATE

    const res = await agent
      .put('/api/auth/password')
      .send({ current_password: 'currentPass', new_password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The UPDATE must store a bcrypt hash of the NEW password, never the plaintext.
    const updateCall = pool.query.mock.calls.at(-1);
    expect(updateCall[0]).toMatch(/UPDATE users SET password_hash/i);
    const storedHash = updateCall[1][0];
    expect(storedHash).not.toBe('newpassword123');
    expect(await bcrypt.compare('newpassword123', storedHash)).toBe(true);
  });

  it('→ 400 VALIDATION_ERROR on incorrect current password (field=current_password)', async () => {
    const { agent, hash } = await loginAgent();
    pool.query.mockResolvedValueOnce({ rows: [{ password_hash: hash }] }); // SELECT password_hash

    const res = await agent
      .put('/api/auth/password')
      .send({ current_password: 'wrongPass', new_password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('current_password');
  });

  it('→ 400 VALIDATION_ERROR when the new password is shorter than 8 chars', async () => {
    const { agent } = await loginAgent();

    const res = await agent
      .put('/api/auth/password')
      .send({ current_password: 'currentPass', new_password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.field).toBe('new_password');
  });
});
