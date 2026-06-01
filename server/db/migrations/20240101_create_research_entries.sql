-- Migration: create_research_entries
-- Creates the research_entries table for the Research module.
-- Entry types: 'journal' | 'citation' | 'note'
-- Status:       'draft' | 'active' | 'archived'

CREATE TABLE research_entries (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  type        VARCHAR(50)  NOT NULL DEFAULT 'note',        -- 'journal' | 'citation' | 'note'
  status      VARCHAR(50)  NOT NULL DEFAULT 'draft',       -- 'draft' | 'active' | 'archived'
  content     TEXT,
  source      VARCHAR(500),                                -- URL or citation source string
  tags        VARCHAR(500),                                -- comma-separated tag list
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER research_entries_set_updated_at
  BEFORE UPDATE ON research_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Standard indexes
CREATE INDEX idx_research_entries_user_id ON research_entries(user_id);
CREATE INDEX idx_research_entries_type    ON research_entries(type);
CREATE INDEX idx_research_entries_status  ON research_entries(status);
