-- 013_goals.sql
-- Goals/OKRs System for Polymath OS (Roadmap Wave 5).
-- Cross-module goals with manually updated progress tracking.
--
-- Follows §6.5 conventions: SERIAL PK, user_id FK ON DELETE CASCADE, VARCHAR enums
-- via CHECK, TIMESTAMPTZ timestamps, shared set_updated_at() trigger, idx_{table}_{cols}.
--
-- Re-runnable: DROP TABLE IF EXISTS … CASCADE precedes the CREATE.

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── goals ─────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS goals CASCADE;

CREATE TABLE goals (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  goal_type     VARCHAR(30) NOT NULL DEFAULT 'target'
                CHECK (goal_type IN ('target', 'milestone', 'habit', 'learning')),
  target_value  NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit          VARCHAR(100),
  category      VARCHAR(100),
  status        VARCHAR(30) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'abandoned', 'paused')),
  priority      VARCHAR(20) NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  start_date    DATE,
  target_date   DATE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_user        ON goals (user_id);
CREATE INDEX idx_goals_status      ON goals (user_id, status);
CREATE INDEX idx_goals_priority    ON goals (user_id, priority);
CREATE INDEX idx_goals_target_date ON goals (user_id, target_date);

CREATE TRIGGER set_updated_at_goals
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
