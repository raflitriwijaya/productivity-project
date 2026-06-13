-- 018_habit_logs.sql
-- Habit Streaks / Calendar (Roadmap Forward Phase 1 / Audit V6 §13.5).
--
-- Daily completion log for goals with goal_type = 'habit'. One row per
-- (user, goal, day); the presence of a row means "done that day". Current and
-- longest streaks are DERIVED in goals.model.js from the consecutive log_date
-- rows — not stored — so there is nothing to keep in sync. The goal's
-- current_value is mirrored to the current streak on each toggle so the existing
-- GoalCard / stats surfaces reflect it without a schema change.
--
-- Rows are insert/delete only (never mutated), so there is no updated_at column
-- and therefore no set_updated_at trigger. Re-runnable: DROP ... CASCADE.

DROP TABLE IF EXISTS habit_logs CASCADE;

CREATE TABLE habit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id     INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL,
  value       NUMERIC DEFAULT 1,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, goal_id, log_date)
);

CREATE INDEX idx_habit_logs_goal      ON habit_logs (goal_id, log_date);
CREATE INDEX idx_habit_logs_user_date ON habit_logs (user_id, log_date);
