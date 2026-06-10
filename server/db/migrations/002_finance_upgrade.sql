-- Migration: 002_finance_upgrade
-- Upgrades the Finance module from a single flat `transactions` table to a
-- multi-account, double-entry-style general ledger.
--
-- Creates 7 tables (all scoped by user_id, all following §6.5):
--   accounts, categories, transactions, receivables, payables, portfolio, budgets
--
-- The pre-upgrade `transactions` table (type income/expense, free-text category)
-- has an incompatible shape (account FKs, category FK, new type vocabulary), so
-- it is dropped and recreated. Pre-upgrade transaction rows are NOT migrated —
-- this is an intentional schema reset for the finance overhaul.
--
-- Re-runnable: every CREATE is preceded by DROP ... IF EXISTS, so applying the
-- migration twice yields the same result.

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Phase 7: refuse to run against a populated ledger ────────────────────────
-- This migration DROPs `transactions` (and the rest of the finance schema). The
-- runner normally applies each file once, but if schema_migrations is cleared,
-- a partial DB is restored, or the file is run by hand, an unguarded re-run
-- would destroy every ledger row. Abort loudly instead. to_regclass returns NULL
-- when the table does not exist (fresh install), so this is a no-op on first run.
-- To intentionally re-run after a real reset: TRUNCATE transactions first.
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL
     AND (SELECT count(*) FROM transactions) > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop a populated transactions table (% rows). Snapshot with pg_dump and TRUNCATE first if this is intentional. See docs/RUNBOOK.md §2.',
      (SELECT count(*) FROM transactions);
  END IF;
END $$;

-- ── Drop in dependency order (children before parents) ───────────────────────
DROP TABLE IF EXISTS budgets       CASCADE;
DROP TABLE IF EXISTS portfolio     CASCADE;
DROP TABLE IF EXISTS payables      CASCADE;
DROP TABLE IF EXISTS receivables   CASCADE;
DROP TABLE IF EXISTS transactions  CASCADE;
DROP TABLE IF EXISTS categories    CASCADE;
DROP TABLE IF EXISTS accounts      CASCADE;

-- ── accounts ─────────────────────────────────────────────────────────────────
-- One money store per (user, type). The six standard types are seeded lazily by
-- the model (ensureDefaultAccounts). `initial_balance` is the opening balance;
-- the live balance is initial_balance + ledger movements (see getBalances).
CREATE TABLE accounts (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  type            VARCHAR(20)  NOT NULL
                    CHECK (type IN ('CASH','ATM','DANA','SHOPEEPAY','GOPAY','INVESTMENT')),
  initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

CREATE TRIGGER accounts_set_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_type    ON accounts(type);

-- ── categories ───────────────────────────────────────────────────────────────
-- 14 standard categories are seeded lazily by the model (ensureDefaultCategories).
-- `kind` distinguishes user-facing INCOME/EXPENSE buckets from SYSTEM buckets
-- (Transfer / Adjustment) that never appear in income/expense reporting.
CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  kind       VARCHAR(10)  NOT NULL CHECK (kind IN ('INCOME','EXPENSE','SYSTEM')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_kind    ON categories(kind);

-- ── transactions ─────────────────────────────────────────────────────────────
-- The ledger. Which account columns apply depends on `type` (enforced in the model):
--   Income             → dest_account_id   (+dest)
--   Expense            → source_account_id (-source)
--   Transfer           → source + dest     (-source, +dest; source <> dest)
--   Balance Adjustment → dest_account_id   (+dest; amount may be negative)
--   Market Adjustment  → dest_account_id   (+dest; amount may be negative)
-- `amount` is NOT constrained > 0 because adjustments can be negative.
CREATE TABLE transactions (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              VARCHAR(20) NOT NULL
                      CHECK (type IN ('Income','Expense','Transfer','Balance Adjustment','Market Adjustment')),
  amount            NUMERIC(14,2) NOT NULL,
  description       TEXT,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  source_account_id INTEGER REFERENCES accounts(id)   ON DELETE SET NULL,
  dest_account_id   INTEGER REFERENCES accounts(id)   ON DELETE SET NULL,
  category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  reconciled        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_transactions_user_id    ON transactions(user_id);
CREATE INDEX idx_transactions_type       ON transactions(type);
CREATE INDEX idx_transactions_date       ON transactions(date DESC);
CREATE INDEX idx_transactions_category   ON transactions(category_id);
CREATE INDEX idx_transactions_source_acc ON transactions(source_account_id);
CREATE INDEX idx_transactions_dest_acc   ON transactions(dest_account_id);

-- ── receivables ──────────────────────────────────────────────────────────────
-- Money owed TO the user. Settling marks it 'settled' and (in the model) posts
-- an Income transaction into `account_id`.
CREATE TABLE receivables (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person      VARCHAR(255) NOT NULL,
  description TEXT,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  due_date    DATE,
  status      VARCHAR(20) NOT NULL DEFAULT 'outstanding'
                CHECK (status IN ('outstanding','settled')),
  account_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  settled_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER receivables_set_updated_at
  BEFORE UPDATE ON receivables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_receivables_user_id ON receivables(user_id);
CREATE INDEX idx_receivables_status  ON receivables(status);

-- ── payables ─────────────────────────────────────────────────────────────────
-- Money the user OWES. Settling marks it 'settled' and (in the model) posts an
-- Expense transaction out of `account_id`.
CREATE TABLE payables (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person      VARCHAR(255) NOT NULL,
  description TEXT,
  amount      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  due_date    DATE,
  status      VARCHAR(20) NOT NULL DEFAULT 'outstanding'
                CHECK (status IN ('outstanding','settled')),
  account_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  settled_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER payables_set_updated_at
  BEFORE UPDATE ON payables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_payables_user_id ON payables(user_id);
CREATE INDEX idx_payables_status  ON payables(status);

-- ── portfolio ────────────────────────────────────────────────────────────────
-- Investment holdings. Market value = quantity * current_price; cost basis =
-- quantity * avg_price. Inline price edits drive the Portfolio pie chart and
-- (optionally) a Market Adjustment on the INVESTMENT account.
CREATE TABLE portfolio (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  symbol        VARCHAR(50),
  quantity      NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  avg_price     NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (avg_price >= 0),
  current_price NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (current_price >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER portfolio_set_updated_at
  BEFORE UPDATE ON portfolio
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_portfolio_user_id ON portfolio(user_id);

-- ── budgets ──────────────────────────────────────────────────────────────────
-- One recurring monthly budget per (user, category). The Budget page compares
-- `amount` against the selected month's spend for that category.
CREATE TABLE budgets (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id)
);

CREATE TRIGGER budgets_set_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_budgets_user_id  ON budgets(user_id);
CREATE INDEX idx_budgets_category ON budgets(category_id);
