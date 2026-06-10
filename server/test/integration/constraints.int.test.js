// Phase 10: DB-level constraints from 005_idempotency_guards.sql.
// Proves the migration actually fires: zero-amount CHECK (23514) and
// duplicate Transfer UNIQUE index (23505 idx_transactions_transfer_dedup).
// Skips cleanly when DATABASE_URL is not set.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hasDb, setupDb, teardownDb, makeUser, cleanupUsers } from './db.setup.js';

describe.skipIf(!hasDb)('DB constraints (real DB)', () => {
  let pool, user, acct1, acct2;

  beforeAll(async () => {
    pool = await setupDb();
    user = await makeUser(pool, `c_${Date.now()}@t.com`);

    // Two accounts are required so source_account_id and dest_account_id are
    // non-NULL — PostgreSQL treats NULLs as distinct in UNIQUE indexes, so the
    // dedup constraint only fires when both columns carry real values.
    await pool.query(
      `INSERT INTO accounts (user_id, name, type) VALUES ($1,'Cash','CASH'),($1,'ATM','ATM')
       ON CONFLICT (user_id, type) DO NOTHING`,
      [user]
    );
    const { rows } = await pool.query(
      `SELECT id FROM accounts WHERE user_id = $1 ORDER BY type`, [user]
    );
    acct1 = rows[0].id; // ATM (sorts before CASH alphabetically)
    acct2 = rows[1].id; // CASH
  }, 120_000);

  afterAll(async () => {
    await cleanupUsers(pool, [user]);
    await teardownDb();
  });

  it('rejects a zero-amount transaction (transactions_amount_nonzero CHECK)', async () => {
    await expect(
      pool.query(
        `INSERT INTO transactions (user_id, type, amount) VALUES ($1, 'Income', 0)`,
        [user]
      )
    ).rejects.toMatchObject({ code: '23514' }); // check_violation
  });

  it('rejects a duplicate Transfer (idx_transactions_transfer_dedup UNIQUE index)', async () => {
    const ins = () => pool.query(
      `INSERT INTO transactions
         (user_id, type, amount, date, source_account_id, dest_account_id, description)
       VALUES ($1, 'Transfer', 100, '2026-06-01', $2, $3, 'dup')`,
      [user, acct1, acct2]
    );
    await ins(); // first insert succeeds
    await expect(ins()).rejects.toMatchObject({
      code: '23505',
      constraint: 'idx_transactions_transfer_dedup',
    });
  });
});
