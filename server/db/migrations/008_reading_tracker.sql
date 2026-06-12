-- Migration: 008_reading_tracker
-- Reading Tracker (Roadmap Wave 3 — Polymath Toolkit).
-- Tracks books across three shelves: want_to_read, reading, finished. Links to
-- Research entries (chapter notes, highlights) via entity_links (Wave 1), so this
-- migration also extends the chk_entity_link_types CHECK to whitelist 'book'.
--
-- Follows §6.5 conventions: SERIAL PK, user_id FK ON DELETE CASCADE, VARCHAR enums
-- via CHECK (never ENUM type), TIMESTAMPTZ timestamps, the shared set_updated_at()
-- trigger, and idx_{table}_{cols} indexes.
--
-- Re-runnable: DROP TABLE IF EXISTS ... CASCADE precedes the CREATE, the trigger
-- function is CREATE OR REPLACE, and the entity_links constraint is dropped IF
-- EXISTS before being re-added. The migration runner (db/migrate.js) wraps each
-- file in its own transaction — NO explicit BEGIN/COMMIT here (mirrors 007).

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── books ────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS books CASCADE;

CREATE TABLE books (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         VARCHAR(500) NOT NULL,
  author        VARCHAR(300),
  shelf         VARCHAR(20) NOT NULL DEFAULT 'want_to_read'
                  CHECK (shelf IN ('want_to_read', 'reading', 'finished')),
  current_page  INTEGER DEFAULT 0 CHECK (current_page >= 0),
  total_pages   INTEGER CHECK (total_pages > 0),
  rating        INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes         TEXT,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  cover_url     VARCHAR(1000),
  genre         VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER books_set_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for the common query patterns (per-user lists, shelf filter, recency,
-- and the "finished this year" stat).
CREATE INDEX idx_books_user_id  ON books (user_id);
CREATE INDEX idx_books_shelf    ON books (user_id, shelf);
CREATE INDEX idx_books_created  ON books (user_id, created_at DESC);
CREATE INDEX idx_books_finished ON books (user_id, finished_at DESC) WHERE shelf = 'finished';

-- ── Extend entity_links to allow 'book' (mirrors LINKABLE_TYPES in enums.js) ──
-- entity_links was created in 007. Re-add the type whitelist with 'book' included.
ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS chk_entity_link_types;
ALTER TABLE entity_links ADD CONSTRAINT chk_entity_link_types CHECK (
  from_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book'
  )
  AND to_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book'
  )
);
