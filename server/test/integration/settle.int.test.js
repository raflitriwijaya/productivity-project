// Phase 10: settle atomicity against a real transaction — a failed settle leaves
// the ledger row unchanged (outcome-based, no positional mock assumptions).
// Skips cleanly when DATABASE_URL is not set.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hasDb, setupDb, teardownDb, makeUser, cleanupUsers } from './db.setup.js';

const { createLedger, settleLedger, getLedgerById } = hasDb
  ? await import('../../models/finance.model.js')
  : {};

describe.skipIf(!hasDb)('settle atomicity (real transaction)', () => {
  let pool, user;

  beforeAll(async () => {
    pool = await setupDb();
    user = await makeUser(pool, `s_${Date.now()}@t.com`);
  }, 120_000);

  afterAll(async () => {
    await cleanupUsers(pool, [user]);
    await teardownDb();
  });

  it('rolls back the receivable when settle is given a non-owned account', async () => {
    // Create a receivable with no linked account (account_id defaults to null)
    const r = await createLedger('receivables', user, { person: 'Alice', amount: 500 });
    expect(r).toBeTruthy();
    expect(r.status).toBe('outstanding');

    // Settle into account 999999 — does not belong to this user → must fail and roll back
    await expect(
      settleLedger('receivables', r.id, user, { account_id: 999999 })
    ).rejects.toBeTruthy();

    // The ledger row must still be outstanding — no partial state persisted
    const after = await getLedgerById('receivables', r.id, user);
    expect(after.status).toBe('outstanding');
    expect(after.settled_at).toBeNull();
  });
});
