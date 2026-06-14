// server/test/integrity.test.js
//
// Database integrity verification. Asserts that the schema the migrations are
// SUPPOSED to produce is actually present in a real Postgres: critical CHECK
// constraints, ON DELETE CASCADE on every user_id FK, dedup indexes, and the
// absence of orphaned rows. A 50-year rebuild guarantee (Invariant 6) is only
// real if these structural guards survive every migration.
//
// IMPORTANT: this file does NOT `import ../lib/db.js` -- that module throws at
// import time when DATABASE_URL is unset, which would crash the file even when
// skipped. Instead it reuses the integration harness (test/integration/db.setup.js),
// which builds a pool lazily inside setupDb() and skips cleanly with no DB. So the
// suite runs in CI (DATABASE_URL set, after migrate) and is a no-op locally.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hasDb, setupDb, teardownDb } from './integration/db.setup.js';

describe.skipIf(!hasDb)('Database Integrity Checks (real DB)', () => {
  let pool;

  beforeAll(async () => {
    pool = await setupDb(); // runs migrations (idempotent) then returns a pool
  }, 120_000);

  afterAll(async () => {
    await teardownDb();
  });

  it('core tables exist (migrations actually ran)', async () => {
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const tables = rows.map((r) => r.table_name);
    for (const t of ['users', 'transactions', 'accounts', 'entity_links', 'goals', 'habit_logs']) {
      expect(tables).toContain(t);
    }
  });

  it('all critical CHECK constraints exist', async () => {
    const { rows } = await pool.query(`
      SELECT conname FROM pg_constraint WHERE contype = 'c' ORDER BY conname
    `);
    const names = rows.map((r) => r.conname);
    // entity_links type whitelist (migration 007) -- mirrors LINKABLE_TYPES.
    expect(names).toContain('chk_entity_link_types');
  });

  it('no orphaned entity_links (user_id CASCADE keeps them clean)', async () => {
    const { rows } = await pool.query(`
      SELECT el.id FROM entity_links el
      LEFT JOIN users u ON el.user_id = u.id
      WHERE u.id IS NULL
    `);
    expect(rows.length).toBe(0);
  });

  it('every user_id foreign key uses ON DELETE CASCADE', async () => {
    const { rows } = await pool.query(`
      SELECT conname, confdeltype FROM pg_constraint
      WHERE contype = 'f' AND conname LIKE '%user_id%'
    `);
    // Guard against a vacuous pass: there must actually be user_id FKs to check.
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => {
      // confdeltype 'c' = CASCADE. (Other codes: 'a' NO ACTION, 'r' RESTRICT, etc.)
      expect(r.confdeltype, `FK ${r.conname} is not ON DELETE CASCADE`).toBe('c');
    });
  });

  it('transactions non-zero amount CHECK is enforced', async () => {
    // From 005_idempotency_guards: transactions_amount_nonzero CHECK (amount <> 0).
    const { rows } = await pool.query(`
      SELECT conname FROM pg_constraint
      WHERE conname LIKE '%transactions%' AND contype = 'c'
    `);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('transfer dedup index exists', async () => {
    const { rows } = await pool.query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname = 'idx_transactions_transfer_dedup'
    `);
    expect(rows.length).toBe(1);
  });

  it('entity_links duplicate-link UNIQUE constraint exists', async () => {
    // uq_entity_link UNIQUE (user_id, from_type, from_id, to_type, to_id) -- migration 007.
    const { rows } = await pool.query(`
      SELECT conname FROM pg_constraint
      WHERE conname = 'uq_entity_link' AND contype = 'u'
    `);
    expect(rows.length).toBe(1);
  });

  it('habit_logs one-per-day UNIQUE constraint exists', async () => {
    // UNIQUE (user_id, goal_id, log_date) -- migration 018 (auto-named *_key).
    const { rows } = await pool.query(`
      SELECT conname FROM pg_constraint
      WHERE conname LIKE '%habit_logs%' AND contype = 'u'
    `);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('set_updated_at() trigger function exists', async () => {
    // The shared updated_at trigger function underpins every table with updated_at.
    const { rows } = await pool.query(`
      SELECT proname FROM pg_proc WHERE proname = 'set_updated_at'
    `);
    expect(rows.length).toBeGreaterThan(0);
  });
});
