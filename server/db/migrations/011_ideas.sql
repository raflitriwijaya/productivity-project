-- Migration: 011_ideas
-- Ideas Tracker (Roadmap Wave 4 — Startup Founder OS). Captures impulsive ideas
-- before they evaporate: product features, business models, partnership angles,
-- marketing tactics. Links to projects, research, contacts, etc. via entity_links
-- (Wave 1), so this migration also extends the chk_entity_link_types CHECK to
-- whitelist 'idea'.
--
-- Follows §6.5 conventions: SERIAL PK, user_id FK ON DELETE CASCADE, VARCHAR enums
-- via CHECK (never ENUM type), TIMESTAMPTZ timestamps, the shared set_updated_at()
-- trigger, and idx_{table}_{cols} indexes.
--
-- Re-runnable: DROP TABLE IF EXISTS ... CASCADE precedes the CREATE, the trigger
-- function is CREATE OR REPLACE, and the entity_links constraint is dropped IF
-- EXISTS before being re-added. The migration runner (db/migrate.js) wraps each
-- file in its own transaction — NO explicit BEGIN/COMMIT here (mirrors 007–010).

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── ideas ────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS ideas CASCADE;

CREATE TABLE ideas (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  status          VARCHAR(30) NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'developing', 'validated', 'archived', 'converted')),
  tags            VARCHAR(500),
  source          VARCHAR(100),
  converted_to    VARCHAR(40),
  converted_id    INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER ideas_set_updated_at
  BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for the common query patterns (per-user lists, status filter, recency).
CREATE INDEX idx_ideas_user_id ON ideas (user_id);
CREATE INDEX idx_ideas_status  ON ideas (user_id, status);
CREATE INDEX idx_ideas_created ON ideas (user_id, created_at DESC);

-- ── Extend entity_links to allow 'idea' (mirrors LINKABLE_TYPES in enums.js) ───
-- entity_links was created in 007 and extended in 008 (book) / 009 (contact).
-- Re-add the type whitelist with 'idea' included.
ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS chk_entity_link_types;
ALTER TABLE entity_links ADD CONSTRAINT chk_entity_link_types CHECK (
  from_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book', 'contact', 'idea'
  )
  AND to_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book', 'contact', 'idea'
  )
);
