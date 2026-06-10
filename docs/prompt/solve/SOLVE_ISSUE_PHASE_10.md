# Phase 10: Integration Test Suite (Real Database) — Rafli's Productivity Suite

**Status:** Pending
**Priority:** Medium
**Estimated Effort:** L (>90 min)
**Audit References:** AUDIT_REPORT_V2.md §7
**Date Generated:** 2026-06-10

---

## Objective

The 24 server tests are green but every one of them mocks `pool.query`/`connect` — no test ever proves the SQL is correct, that CHECK constraints fire, that `FOR UPDATE` serializes settle, or that ownership holds *at the database*. Add a real-Postgres integration suite that boots a live DB, runs the migrations, and exercises the riskiest guarantees; make `upload.filter.test.js` import the **real** multer filter instead of a copy; and replace the brittle positional-mock assertions in `settle.atomicity.test.js` with outcome-based assertions.

> **Prerequisite:** Phase 9 Fix 4 adds a `postgres:16` service + `DATABASE_URL` to the server CI job. Do Phase 9 Fix 4 first (or together) so this suite runs in CI. Locally, a Docker Postgres or any reachable `DATABASE_URL` works.

---

## Pre-Flight Checklist

- [ ] Read `PROJECT_STATE.md` ("Existing Backend Routes & Models", "Existing DB Migrations")
- [ ] Read `server/test/*.js` (all five existing tests), `server/routes/research.js` (multer config), `server/models/finance.model.js` (`settleLedger`, ownership), `server/db/migrate.js`
- [ ] Confirm the existing tests still mock `../lib/db.js` (they do)
- [ ] Have a reachable Postgres for local runs (e.g. `docker run --rm -d -p 5433:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_USER=productivity -e POSTGRES_DB=productivity_test postgres:16-alpine`)
- [ ] Ensure you are on the latest `main` branch with a clean working tree

---

## Fix 1: Add a real-Postgres integration test suite

### Criticality
🟡 **MEDIUM — §7 Code Quality & Maintainability**

### What the Audit Found

> Every server test mocks `pool.query`/`connect` — there is not one real-database integration test. … They assert that the model passes the right parameters to a *mock*, not that the SQL is correct, that constraints fire, that `FOR UPDATE` actually serializes, or that ownership holds at the DB. … Add a `testcontainers`/`pg` integration suite that boots a real Postgres, runs the migrations, and exercises: user-A-cannot-read-user-B, settle rollback on injected failure, `amount <> 0` rejection, and the transfer-dedup index. — *Priority: Medium*

### Current Behavior

All five files in `server/test/` begin with `vi.mock('../lib/db.js', …)`:
- [auth.test.js:6](../server/test/auth.test.js#L6), [ownership.test.js:4](../server/test/ownership.test.js#L4), [finance.math.test.js:5](../server/test/finance.math.test.js#L5), [settle.atomicity.test.js:10](../server/test/settle.atomicity.test.js#L10), [upload.filter.test.js](../server/test/upload.filter.test.js) (re-implements config, no DB).

No test connects to Postgres. The CHECK constraints from `005_idempotency_guards.sql`, the `FOR UPDATE` in `settleLedger`, and DB-enforced ownership are unverified against a real engine.

### Desired Behavior

A new integration suite (`server/test/integration/`) that:
- Connects to a **real** Postgres via `process.env.DATABASE_URL` (skips cleanly when unset, so the default fast suite still runs locally without a DB).
- Runs the migrations once before all tests.
- Creates two users (A and B) and exercises:
  1. **Cross-user isolation** — user A's model calls cannot read/modify user B's rows.
  2. **Settle atomicity** — an injected failure mid-settle leaves the ledger row unchanged (no partial state), against a real transaction.
  3. **CHECK constraint** — inserting a `transactions` row with `amount = 0` is rejected by the DB (`transactions_amount_nonzero`).
  4. **Transfer-dedup index** — a second identical Transfer raises `23505` on `idx_transactions_transfer_dedup`.
- Cleans up its data (truncate or drop the test schema) after the run.

### Files to Modify

- `server/package.json` — add `pg` is already a dependency; add a `test:integration` script and (optionally) `@testcontainers/postgresql` as a devDependency for fully self-contained local runs.
- `server/test/integration/db.setup.js` (new) — shared connect + migrate + teardown helpers, with a skip-guard.
- `server/test/integration/isolation.int.test.js` (new) — cross-user isolation.
- `server/test/integration/settle.int.test.js` (new) — real-transaction settle rollback.
- `server/test/integration/constraints.int.test.js` (new) — CHECK + transfer-dedup.
- `vitest.config.js` (new or existing) — separate integration project/glob if desired.

### Implementation

#### Step 1: Decide the DB source (env-driven, with optional testcontainers)

The lightest reliable approach reuses the CI Postgres (Phase 9 Fix 4) and a local Docker Postgres via `DATABASE_URL`. For a fully self-contained local run, optionally add testcontainers:

```bash
cd server && npm install -D @testcontainers/postgresql
```

The setup helper prefers `DATABASE_URL`; if absent and testcontainers is available, it boots one; otherwise it **skips** the integration suite so `npm test` never fails for lack of a DB.

#### Step 2: Shared setup with a skip-guard

Create `server/test/integration/db.setup.js`:

```js
// Phase 10: real-Postgres integration harness. Uses DATABASE_URL when present
// (CI service / local docker). Skips cleanly when no DB is configured so the
// default fast suite still passes on a machine with no Postgres.
import { execFileSync } from 'node:child_process';
import pg from 'pg';

export const hasDb = !!process.env.DATABASE_URL;

let pool;

export async function setupDb() {
  if (!hasDb) return null;
  // Run migrations against the target DB (idempotent; runner records applied files).
  execFileSync('node', ['db/migrate.js'], { stdio: 'inherit' });
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  return pool;
}

export async function teardownDb() {
  if (pool) await pool.end();
}

// Create a throwaway user and return its id.
export async function makeUser(p, email) {
  const { rows } = await p.query(
    `INSERT INTO users (email, password_hash, name) VALUES ($1, 'x', $2) RETURNING id`,
    [email, email.split('@')[0]]
  );
  return rows[0].id;
}

// Remove all rows a test created, keyed by the two test users.
export async function cleanupUsers(p, ids) {
  // ON DELETE CASCADE on user_id FKs removes child rows (transactions, etc.).
  await p.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
}
```

#### Step 3: Cross-user isolation test

Create `server/test/integration/isolation.int.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDb, teardownDb, makeUser, cleanupUsers, hasDb } from './db.setup.js';

// Unmock db for integration: import the model AFTER ensuring no vi.mock is active.
const { getTransactionById, createTransaction } = await import('../../models/finance.model.js');

describe.skipIf(!hasDb)('cross-user isolation (real DB)', () => {
  let pool, userA, userB;

  beforeAll(async () => {
    pool = await setupDb();
    userA = await makeUser(pool, `a_${Date.now()}@t.com`);
    userB = await makeUser(pool, `b_${Date.now()}@t.com`);
  });
  afterAll(async () => {
    await cleanupUsers(pool, [userA, userB]);
    await teardownDb();
  });

  it("user A cannot read user B's transaction", async () => {
    // ensureDefaults seeds accounts/categories for B; create a B-owned Income.
    const bTx = await createTransaction(userB, {
      type: 'Income', amount: 250, date: '2026-06-01',
      // dest_account_id resolved from B's seeded accounts inside the model/test as needed
    }).catch(() => null);
    // If the model requires an explicit account, fetch one of B's accounts first.
    // (Adjust to the model's createTransaction contract — see finance.model.js.)
    expect(bTx).toBeTruthy();

    const seenByA = await getTransactionById(bTx.id, userA);
    expect(seenByA).toBeNull(); // ownership is enforced by the WHERE user_id = $2 clause
  });
});
```

> Adjust `createTransaction` arguments to its real contract (it validates per-type account ownership — see `assertAccountsOwned` in `finance.model.js`). The point of the test is the final assertion: `getTransactionById(bTx.id, userA)` returns `null` against a **real** DB.

#### Step 4: Real-transaction settle rollback test

Create `server/test/integration/settle.int.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDb, teardownDb, makeUser, cleanupUsers, hasDb } from './db.setup.js';

const { createLedger, settleLedger, getLedgerById } = await import('../../models/finance.model.js');

describe.skipIf(!hasDb)('settle atomicity (real transaction)', () => {
  let pool, user;
  beforeAll(async () => { pool = await setupDb(); user = await makeUser(pool, `s_${Date.now()}@t.com`); });
  afterAll(async () => { await cleanupUsers(pool, [user]); await teardownDb(); });

  it('rolls back the receivable when settle is given a non-owned account', async () => {
    const r = await createLedger('receivables', user, { person: 'Alice', amount: 500 });
    // Settle into an account id that does not belong to this user → must fail and roll back.
    await expect(settleLedger('receivables', r.id, user, { account_id: 999999 }))
      .rejects.toBeTruthy();

    const after = await getLedgerById('receivables', r.id, user);
    expect(after.status).toBe('outstanding'); // unchanged — no partial settle persisted
  });
});
```

This proves the **outcome** against a real transaction: a failed settle leaves the row `outstanding`, with no orphaned Income transaction.

#### Step 5: CHECK + transfer-dedup constraint test

Create `server/test/integration/constraints.int.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupDb, teardownDb, makeUser, cleanupUsers, hasDb } from './db.setup.js';

describe.skipIf(!hasDb)('DB constraints (real DB)', () => {
  let pool, user;
  beforeAll(async () => { pool = await setupDb(); user = await makeUser(pool, `c_${Date.now()}@t.com`); });
  afterAll(async () => { await cleanupUsers(pool, [user]); await teardownDb(); });

  it('rejects a zero-amount transaction (transactions_amount_nonzero)', async () => {
    await expect(
      pool.query(`INSERT INTO transactions (user_id, type, amount) VALUES ($1, 'Income', 0)`, [user])
    ).rejects.toMatchObject({ code: '23514' }); // 23514 = check_violation
  });

  it('rejects a duplicate Transfer (idx_transactions_transfer_dedup)', async () => {
    const ins = () => pool.query(
      `INSERT INTO transactions (user_id, type, amount, date, source_account_id, dest_account_id, description)
       VALUES ($1, 'Transfer', 100, '2026-06-01', NULL, NULL, 'dup')`, [user]);
    await ins(); // first succeeds
    await expect(ins()).rejects.toMatchObject({ code: '23505', constraint: 'idx_transactions_transfer_dedup' });
  });
});
```

This is the most direct proof the V2 migrations actually do what they claim — a zero amount is a `23514` check violation and a duplicate Transfer is a `23505` on the named index.

#### Step 6: Wire the scripts

In `server/package.json`, add:

```json
    "test:integration": "vitest run test/integration",
```

Keep `"test": "vitest run"` for the fast suite. In CI (Phase 9 Fix 4), `DATABASE_URL` is set, so `npm test` runs **both** the mocked unit tests and the integration tests (the `describe.skipIf(!hasDb)` guard activates them only when a DB is present). Locally without a DB, the integration blocks skip and `npm test` stays green.

### Verification

1. **No DB:** `cd server && npm test` with `DATABASE_URL` unset → integration suites report `skipped`, all unit tests pass.
2. **With DB:** start a local Postgres, `DATABASE_URL=… npm test` → integration suites run; isolation returns `null`, settle stays `outstanding`, zero-amount → `23514`, duplicate Transfer → `23505 idx_transactions_transfer_dedup`.
3. CI (after Phase 9 Fix 4): the server job runs migrations then both suites against the service Postgres.

### Risk / Regression Notes

⚠️ The mocked unit tests `vi.mock('../lib/db.js')`. The integration tests must **not** be in a file that mocks the DB — keep them in `test/integration/` and never call `vi.mock('../lib/db.js')` there. If vitest hoists a mock across files, isolate via the separate glob/project.
⚠️ Each integration test must clean up after itself (`cleanupUsers`) so reruns don't collide on the unique email or the transfer-dedup index. Use timestamped emails.
⚠️ `createTransaction`/`createLedger`/`settleLedger` have real contracts (per-type account ownership, required fields). Read the model and adapt the test inputs — the assertions (final outcomes) are the durable part; the setup details follow the model's signatures.

---

## Fix 2: Make `upload.filter.test.js` import the real multer filter

### Criticality
🟡 **MEDIUM — §7 Code Quality & Maintainability**

### What the Audit Found

> `upload.filter.test.js` re-implements the multer config instead of importing it — it copies `ALLOWED_EXT`/`ALLOWED_MIME` and a fresh `multer({...})` into the test. It therefore tests a *copy*; if the real filter in `research.js` regresses, this test stays green. False confidence. … Export the `fileFilter` (or the configured `upload`) from `research.js` and import it in the test. — *Priority: Medium*

### Current Behavior

[server/test/upload.filter.test.js:14-36](../server/test/upload.filter.test.js#L14) re-declares `ALLOWED_EXT`, `ALLOWED_MIME`, and a fresh `multer({...})` — a copy of the logic in [research.js:60-90](../server/routes/research.js#L60). A regression in the real filter would not fail this test.

### Desired Behavior

The test imports and exercises the **actual** filter (or `upload` instance) from `research.js`, so any drift in the shipped allowlist breaks the test.

### Files to Modify

- `server/routes/research.js` — export the `fileFilter` function (and/or the configured `upload`).
- `server/test/upload.filter.test.js` — import the real filter; delete the re-implemented copy.

### Implementation

#### Step 1: Export the filter from `research.js`

In [server/routes/research.js](../server/routes/research.js#L80), extract the inline `fileFilter` into a named function and export it (and the allowlist sets, for assertions if wanted):

```js
// Phase 10: exported so the test exercises the SHIPPED filter, not a copy.
export function researchFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
    return cb(new AppError('Unsupported file type.', 400, 'VALIDATION_ERROR', 'file'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: researchFileFilter, // same function the test imports
});

export { ALLOWED_EXT, ALLOWED_MIME }; // optional: for direct allowlist assertions
```

#### Step 2: Rewrite the test to use the real filter

Replace the re-implementation block in [upload.filter.test.js:14-45](../server/test/upload.filter.test.js#L14) with an import of the real filter, mounted on a minimal app with **memory** storage (so the test still doesn't touch disk):

```js
import multer from 'multer';
import { researchFileFilter } from '../routes/research.js';

// Phase 10: exercise the SHIPPED filter. Only storage is overridden to memory so
// the test avoids disk writes; the fileFilter under test is the real one.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: researchFileFilter,
});
```

Keep all six existing `it(...)` cases — they now cover the real code path. If you exported the sets, add one assertion that the allowlists match expectations (`expect(ALLOWED_EXT.has('.exe')).toBe(false)`).

> Note: importing `research.js` pulls its module-level `multer.diskStorage` + `uploadsDir` setup. That is import-safe (no disk write happens at import), but it also imports the model layer. If the model import triggers a real DB connection at import time, keep the existing `vi.mock('../lib/db.js')` at the top of the test (it's harmless — the filter doesn't use the DB). The existing test already mocks the logger; keep that.

### Verification

1. `cd server && npm test` → the upload filter tests pass against the imported `researchFileFilter`.
2. Regression proof: temporarily add `.exe` to `ALLOWED_EXT` in `research.js` → the "rejects a .exe file" test **fails** (proving the test now tracks the real code). Revert.

### Risk / Regression Notes

⚠️ Importing `research.js` into the test may pull in `requireAuth`/model imports. Keep `vi.mock('../lib/db.js')` and `vi.mock('../lib/logger.js')` in the test file so the import is side-effect-free. Verify the test still runs in isolation (`npx vitest run test/upload.filter.test.js`).
⚠️ Do not change the shipped allowlist while doing this — the goal is to *test* it, not alter it.

---

## Fix 3: De-brittle `settle.atomicity.test.js` (outcome-based assertions)

### Criticality
🟡 **MEDIUM (audit filed Low) — §7 Code Quality & Maintainability**

### What the Audit Found

> `settle.atomicity.test.js` asserts on positional mock call order, hard-coding the exact sequence of `BEGIN`/`SELECT`/`INSERT`/`ROLLBACK`. It's brittle: any reordering of equally-correct SQL breaks the test without a real defect. … The integration test above is the durable fix; until then, assert on observable outcomes (no `COMMIT`, row unchanged) rather than exact call indices. — *Priority: Low*

### Current Behavior

[server/test/settle.atomicity.test.js:34-44](../server/test/settle.atomicity.test.js#L34) chains `mockResolvedValueOnce` in an exact positional sequence (BEGIN → SELECT ledger → SELECT account → INSERT → ROLLBACK). Any reordering of equally-correct SQL desyncs the mock chain and breaks the test even with no real defect. (The final assertions — `calls).toContain('ROLLBACK')` / `not.toContain('COMMIT')` — are already outcome-based; the brittleness is in the rigid setup chain.)

### Desired Behavior

- Prefer the **real-transaction** settle test from Fix 1 Step 4 as the durable proof.
- For the remaining mocked test, drive the mock by **matching the SQL** (return the right rows based on the query string) rather than by call position, so reordering correct SQL doesn't desync it. Keep the outcome assertions (`ROLLBACK` present, `COMMIT` absent, row unchanged).

### Files to Modify

- `server/test/settle.atomicity.test.js` — replace the positional `mockResolvedValueOnce` chains with a query-matching `mockImplementation`.

### Implementation

#### Step 1: Drive the mock by SQL content, not position

Replace the per-test `mockResolvedValueOnce` chains with a single `mockImplementation` that branches on the SQL text. Example for the "INSERT fails mid-settle" case:

```js
it('rolls back when the transaction INSERT fails mid-settle', async () => {
  // Phase 10: match on SQL, not call order — reordering correct SQL won't desync the mock.
  mockClient.query.mockImplementation((sql) => {
    if (/^BEGIN/i.test(sql))                      return Promise.resolve({ rows: [] });
    if (/FROM receivables/i.test(sql))            return Promise.resolve({ rows: [{
      id: 1, user_id: 1, person: 'Alice', amount: '500.00', status: 'outstanding', account_id: 10, due_date: null,
    }] });
    if (/FROM accounts/i.test(sql))               return Promise.resolve({ rows: [{ id: 10 }] });
    if (/INSERT INTO transactions/i.test(sql))    return Promise.reject(new Error('DB write error'));
    if (/^ROLLBACK/i.test(sql))                   return Promise.resolve({ rows: [] });
    return Promise.resolve({ rows: [] });
  });

  await expect(settleLedger('receivables', 1, 1, { account_id: 10 }))
    .rejects.toThrow('DB write error');

  const calls = mockClient.query.mock.calls.map(c => c[0]);
  expect(calls).toContain('ROLLBACK');
  expect(calls).not.toContain('COMMIT');
});
```

Apply the same pattern to the "already settled" and "commits successfully" cases (for the commit case, match `INSERT`/`UPDATE` to resolve, and assert `calls).toContain('COMMIT')`). The assertions stay outcome-based; only the setup becomes order-independent.

> The regexes must match the actual SQL in `settleLedger` (read `finance.model.js`). If the model uses `'BEGIN'` exactly and `'ROLLBACK'`/`'COMMIT'` as bare strings (it does — the existing test matches them literally), the `^BEGIN`/`^ROLLBACK` patterns hold.

### Verification

1. `cd server && npm test` → all three settle tests pass.
2. Reordering proof: in `settleLedger`, swap two independent correct statements (e.g. the account SELECT before the ledger SELECT, if both are safe) → the **positional** version would break; the **SQL-matching** version still passes. Revert the experiment.
3. Real-defect proof: make `settleLedger` skip the `ROLLBACK` on error → the test **fails** (`ROLLBACK` missing). Revert.

### Risk / Regression Notes

⚠️ The SQL-matching regexes are tied to the model's query text. If `settleLedger` is later refactored to use different table aliases or comments, update the patterns. This is still far less brittle than positional ordering.
⚠️ The integration test (Fix 1 Step 4) is the real safety net; the mocked test is a fast smoke check. Keep both.

---

## Completion Checklist

- [ ] All files created/modified as specified
- [ ] `npm test` passes in `server/` **without** a DB (integration suites skip; unit + filter + settle tests pass)
- [ ] `npm test` (or `npm run test:integration`) passes **with** a `DATABASE_URL` set (isolation, settle rollback, CHECK, transfer-dedup all verified against real Postgres)
- [ ] `upload.filter.test.js` imports `researchFileFilter` from `research.js` (no re-implemented copy); regression proof passes
- [ ] `settle.atomicity.test.js` uses SQL-matching mocks; reordering proof passes
- [ ] `npm run lint` passes in `server/` (Phase 9 Fix 3)
- [ ] `npm audit` returns 0 vulnerabilities in both packages
- [ ] Changes committed with a descriptive message: `fix: phase 10 — real-DB integration suite, real multer filter in test, de-brittle settle test`
