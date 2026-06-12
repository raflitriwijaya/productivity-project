-- Migration: 010_revenue_tx_type
-- Roadmap Wave 4 — Revenue tracking. Adds 'Revenue' to the transactions.type
-- CHECK vocabulary so the founder can categorize startup revenue distinctly from
-- personal Income. Revenue behaves like Income at the ledger level (credits the
-- destination account — see CREDITS_DEST / validateTransactionShape in
-- finance.model.js and TX_TYPES in lib/enums.js).
--
-- The original constraint was defined inline (unnamed) in 002_finance_upgrade.sql,
-- so Postgres auto-named it `transactions_type_check`. We drop it IF EXISTS and
-- re-add a named constraint with the extended vocabulary.
--
-- Re-runnable: DROP CONSTRAINT IF EXISTS, then ADD. The migration runner wraps each
-- file in its own transaction — NO explicit BEGIN/COMMIT here (mirrors 007–009).
-- 'Revenue' (7 chars) fits the existing VARCHAR(20), so no column-width change.

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (
  type IN ('Income','Expense','Transfer','Balance Adjustment','Market Adjustment','Revenue')
);
