// Phase 10: cross-user isolation — user A's model calls cannot read user B's rows.
// Skips cleanly when DATABASE_URL is not set.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hasDb, setupDb, teardownDb, makeUser, cleanupUsers } from './db.setup.js';

// Conditional import: avoids loading db.js (which throws without DATABASE_URL)
// when no DB is configured. The describe.skipIf guard ensures the test bodies
// never run when hasDb is false, so the undefined functions are never called.
const { ensureDefaults, createTransaction, getTransactionById } = hasDb
  ? await import('../../models/finance.model.js')
  : {};

describe.skipIf(!hasDb)('cross-user isolation (real DB)', () => {
  let pool, userA, userB;

  beforeAll(async () => {
    pool = await setupDb();
    userA = await makeUser(pool, `a_${Date.now()}@t.com`);
    userB = await makeUser(pool, `b_${Date.now()}@t.com`);
    // Seed default accounts and categories for B so createTransaction can resolve ownership
    await ensureDefaults(userB);
  }, 120_000);

  afterAll(async () => {
    await cleanupUsers(pool, [userA, userB]);
    await teardownDb();
  });

  it("user A cannot read user B's transaction", async () => {
    // Get a dest account that belongs to B (seeded by ensureDefaults)
    const { rows: bAccts } = await pool.query(
      `SELECT id FROM accounts WHERE user_id = $1 AND type = 'CASH' LIMIT 1`, [userB]
    );
    const destAccountId = bAccts[0].id;

    // Create an Income transaction owned by user B
    const bTx = await createTransaction(userB, {
      type: 'Income',
      amount: 250,
      date: '2026-06-01',
      dest_account_id: destAccountId,
    });
    expect(bTx).toBeTruthy();
    expect(bTx.id).toBeTruthy();

    // User A queries that transaction by ID — must return null (WHERE t.user_id = userA)
    const seenByA = await getTransactionById(bTx.id, userA);
    expect(seenByA).toBeNull();
  });
});
