-- Migration: create_learning
-- Creates the learning_items table with all required columns,
-- updated_at trigger, and standard indexes.

CREATE TABLE learning_items (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  type          VARCHAR(50)  NOT NULL DEFAULT 'course',   -- course | book | video | article | other
  source        VARCHAR(255),
  status        VARCHAR(50)  NOT NULL DEFAULT 'not_started', -- not_started | in_progress | completed | on_hold
  priority      SMALLINT     NOT NULL DEFAULT 2,           -- 1=high 2=medium 3=low
  progress      SMALLINT     NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  total_hours   NUMERIC(6,2),
  spent_hours   NUMERIC(6,2),
  started_at    DATE,
  completed_at  DATE,
  notes         TEXT,
  url           VARCHAR(2048),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- updated_at trigger (reuse function if already created by another migration)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER learning_items_set_updated_at
  BEFORE UPDATE ON learning_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Standard indexes
CREATE INDEX idx_learning_items_user_id ON learning_items(user_id);
CREATE INDEX idx_learning_items_status  ON learning_items(status);
CREATE INDEX idx_learning_items_type    ON learning_items(type);
