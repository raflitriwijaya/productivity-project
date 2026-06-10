-- Migration: 006_fix_dedup_nulls
-- Phase 12: fix the NULL hole in the Transfer dedup index.
--
-- Root cause: Postgres unique indexes treat NULL as distinct from NULL by default,
-- so two identical Transfers with description = NULL both succeed — the most common
-- case for a quick transfer with no note. The index was blocking duplicate Transfers
-- only when every keyed column was non-NULL.
--
-- Fix: recreate the index with NULLS NOT DISTINCT (available in Postgres 15+; the
-- production DB is Postgres 16). This makes NULL = NULL for uniqueness purposes,
-- blocking duplicate no-description Transfers as intended.

DROP INDEX IF EXISTS idx_transactions_transfer_dedup;

CREATE UNIQUE INDEX idx_transactions_transfer_dedup
  ON transactions (user_id, date, amount, source_account_id, dest_account_id, description)
  NULLS NOT DISTINCT WHERE type = 'Transfer';
