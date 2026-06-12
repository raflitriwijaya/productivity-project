-- 012_time_entries.sql
-- Time Tracking for Polymath OS (Roadmap Wave 5).
-- Tracks time spent on any entity (todo, research, learning, engineering, reading).
-- Feeds Weekly Review and Annual Report.
--
-- Follows §6.5 conventions: SERIAL PK, user_id FK ON DELETE CASCADE, VARCHAR enums
-- via CHECK, TIMESTAMPTZ timestamps, shared set_updated_at() trigger, idx_{table}_{cols}.
--
-- Re-runnable: DROP TABLE IF EXISTS … CASCADE precedes the CREATE; the trigger function
-- is CREATE OR REPLACE. The migration runner wraps each file in its own transaction —
-- NO explicit BEGIN/COMMIT here (mirrors 009–011).
--
-- Also extends entity_links chk_entity_link_types to whitelist 'time_entry' and 'goal'
-- (goal table is created in 013 but we add both here to keep link constraint in sync).

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── time_entries ──────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS time_entries CASCADE;

CREATE TABLE time_entries (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type      VARCHAR(40) NOT NULL,
  entity_id        INTEGER NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (entity_type IN (
    'todo', 'research_entry', 'learning_item', 'engineer_project', 'book'
  )),
  CHECK (ended_at IS NULL OR ended_at > started_at),
  CHECK (duration_seconds IS NULL OR duration_seconds > 0)
);

CREATE INDEX idx_time_entries_user   ON time_entries (user_id);
CREATE INDEX idx_time_entries_entity ON time_entries (user_id, entity_type, entity_id);
CREATE INDEX idx_time_entries_date   ON time_entries (user_id, started_at DESC);
CREATE INDEX idx_time_entries_active ON time_entries (user_id) WHERE ended_at IS NULL;

CREATE TRIGGER set_updated_at_time_entries
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Extend entity_links to allow 'time_entry' and 'goal' ─────────────────────
-- entity_links was created in 007 and extended in 008 (book), 009 (contact),
-- 011 (idea). Re-add the type whitelist including the Wave 5 types.
ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS chk_entity_link_types;
ALTER TABLE entity_links ADD CONSTRAINT chk_entity_link_types CHECK (
  from_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill',
    'book', 'contact', 'idea',
    'time_entry', 'goal'
  )
  AND to_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill',
    'book', 'contact', 'idea',
    'time_entry', 'goal'
  )
);
