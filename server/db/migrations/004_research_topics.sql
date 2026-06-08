-- Migration: 004_research_topics
-- Extends the Research module with topics (folders/tags-as-entities),
-- an entry↔topic pivot, per-entry file attachments, and a pinned flag on entries.
--
-- Follows §6.5 conventions: SERIAL PK, user_id FK ON DELETE CASCADE,
-- VARCHAR enums via CHECK (never ENUM type), TIMESTAMPTZ timestamps, the shared
-- set_updated_at() trigger, and idx_{table}_{col} indexes.
--
--   research_topics        — per-user topics (colour-coded folders for entries)
--   research_entry_topics  — many-to-many pivot (entry ↔ topic)
--   research_attachments   — per-entry uploaded files (metadata; bytes on disk)
--   research_entries.is_pinned — pinned entries sort to the top
--
-- Re-runnable: every CREATE is preceded by DROP ... IF EXISTS (CASCADE for the
-- parents so the pivot/attachments drop with them), and the ALTER uses
-- ADD COLUMN IF NOT EXISTS so a second run is a no-op.

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Drop in dependency order (children before parents) ───────────────────────
DROP TABLE IF EXISTS research_attachments  CASCADE;
DROP TABLE IF EXISTS research_entry_topics CASCADE;
DROP TABLE IF EXISTS research_topics       CASCADE;

-- ── research_topics ──────────────────────────────────────────────────────────
-- A per-user topic. `color` is a hex string (e.g. '#10b981') used for the UI dot.
CREATE TABLE research_topics (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  color       VARCHAR(7) DEFAULT '#10b981',
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','archived')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER research_topics_set_updated_at
  BEFORE UPDATE ON research_topics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_research_topics_user_id ON research_topics(user_id);
CREATE INDEX idx_research_topics_status  ON research_topics(status);

-- ── research_entry_topics (pivot) ────────────────────────────────────────────
-- Many-to-many between research_entries and research_topics. Composite PK
-- prevents duplicate links; both FKs cascade so deleting either side cleans up.
CREATE TABLE research_entry_topics (
  entry_id INTEGER NOT NULL REFERENCES research_entries(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL REFERENCES research_topics(id)  ON DELETE CASCADE,
  PRIMARY KEY (entry_id, topic_id)
);

CREATE INDEX idx_research_entry_topics_entry_id ON research_entry_topics(entry_id);
CREATE INDEX idx_research_entry_topics_topic_id ON research_entry_topics(topic_id);

-- ── research_attachments ─────────────────────────────────────────────────────
-- File metadata for entry attachments. The bytes live on disk under
-- server/uploads/; `file_path` is the stored (server) path, `original_name` is
-- what the user uploaded. Scoped to a user transitively via entry_id.
CREATE TABLE research_attachments (
  id            SERIAL PRIMARY KEY,
  entry_id      INTEGER NOT NULL REFERENCES research_entries(id) ON DELETE CASCADE,
  filename      VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  mime_type     VARCHAR(100),
  size          INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_research_attachments_entry_id ON research_attachments(entry_id);

-- ── research_entries.is_pinned ───────────────────────────────────────────────
-- Pinned entries sort to the top of the list (is_pinned DESC, created_at DESC).
ALTER TABLE research_entries
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;
