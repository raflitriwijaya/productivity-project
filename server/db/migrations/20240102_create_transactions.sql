-- Migration: 20240102_create_transactions
-- Creates the transactions table for the Finance module.

CREATE TABLE transactions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  category     VARCHAR(100) NOT NULL,
  description  TEXT,
  amount       NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every row change.
-- Reuses the set_updated_at() function created by the todos migration.
-- If that migration has not run, create the function first:
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Standard indexes for the most common query patterns.
CREATE INDEX idx_transactions_user_id  ON transactions(user_id);
CREATE INDEX idx_transactions_type     ON transactions(type);
CREATE INDEX idx_transactions_date     ON transactions(date DESC);
