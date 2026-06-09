-- Migration: 005_idempotency_guards
-- Phase 2: DB-level guards against duplicate financial writes.
--
-- Choice rationale (per audit §9):
--   * Settle idempotency is already enforced in settleLedger() via an ALREADY_SETTLED
--     check + atomic transaction; no additional DB constraint is needed there.
--   * For general transactions there is no single natural key that uniquely identifies
--     a legitimate ledger entry without also blocking valid repeated entries (e.g. two
--     transfers of the same amount on the same day). The chosen guard is therefore:
--       1. CHECK (amount <> 0) — rejects zero-value rows (explicit audit gap §4).
--       2. A UNIQUE partial index on Transfer rows keyed on the full set of
--          structural columns. Two identical transfers on the same day from/to the
--          same accounts with the same description are treated as duplicates.
--          Non-Transfer types are excluded because Income/Expense rows legitimately
--          recur (e.g. daily salary credit).
--
-- This migration is forward-only and safe to re-run (IF NOT EXISTS / ADD CONSTRAINT
-- ... IF NOT EXISTS equivalents used where available).

-- 1. Enforce non-zero amount on every transaction.
ALTER TABLE transactions
  ADD CONSTRAINT transactions_amount_nonzero CHECK (amount <> 0);

-- 2. Partial unique index: identical Transfer rows on the same day are rejected.
--    Covers the concurrent double-submit of a Transfer that slips past the client
--    disabled-button guard (e.g. two browser tabs).
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_transfer_dedup
  ON transactions (user_id, date, amount, source_account_id, dest_account_id, description)
  WHERE type = 'Transfer';
