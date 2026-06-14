-- 019_learning_roadmaps.sql
-- Custom Learning Roadmaps for Polymath OS.
-- Replaces the hardcoded 12-month engineer roadmap with user-defined learning paths.
-- Any discipline: ESP32-S3, STM32, ROS2, gardening, car building, languages, etc.
--
-- Additive: the original engineer_roadmap_months / engineer_roadmap_skills tables
-- (003_engineer_toolkit.sql) are untouched — GET /api/engineer/roadmap keeps working.
--
-- Follows §6.5 conventions: SERIAL PK, user_id FK ON DELETE CASCADE, VARCHAR enums
-- via CHECK (never an ENUM type), TIMESTAMPTZ timestamps, the shared no-arg
-- set_updated_at() trigger function + an explicit CREATE TRIGGER per table (the
-- codebase has NO set_updated_at(text) helper — see 013/015/016), idx_{table}_{cols}.
-- Re-runnable: DROP TABLE IF EXISTS … CASCADE precedes each CREATE; the trigger
-- function is CREATE OR REPLACE; the entity_links constraint is dropped IF EXISTS
-- before being re-added with the two new types whitelisted.

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop children first so the FK cascade order is well-defined on a re-run.
DROP TABLE IF EXISTS roadmap_milestones CASCADE;
DROP TABLE IF EXISTS roadmap_tracks CASCADE;
DROP TABLE IF EXISTS learning_roadmaps CASCADE;

-- ── learning_roadmaps — a learning journey for any discipline ─────────────────
CREATE TABLE learning_roadmaps (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  category        VARCHAR(100),        -- e.g. 'embedded', 'robotics', 'agriculture', 'automotive'
  status          VARCHAR(30) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'completed', 'archived', 'paused')),
  icon            VARCHAR(50),         -- emoji or icon name for visual identification
  color           VARCHAR(7) DEFAULT '#4A7C59', -- hex color for the roadmap card
  progress        NUMERIC(5,2) DEFAULT 0,       -- auto-calculated % complete
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_roadmaps_user     ON learning_roadmaps (user_id);
CREATE INDEX idx_roadmaps_status   ON learning_roadmaps (user_id, status);
CREATE INDEX idx_roadmaps_category ON learning_roadmaps (user_id, category);

CREATE TRIGGER set_updated_at_learning_roadmaps
  BEFORE UPDATE ON learning_roadmaps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── roadmap_tracks — a sub-category / skill lane within a roadmap ─────────────
CREATE TABLE roadmap_tracks (
  id              SERIAL PRIMARY KEY,
  roadmap_id      INTEGER NOT NULL REFERENCES learning_roadmaps(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(300) NOT NULL,
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,  -- ordering within the roadmap
  color           VARCHAR(7),                  -- optional per-track color
  progress        NUMERIC(5,2) DEFAULT 0,      -- auto-calculated
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracks_roadmap ON roadmap_tracks (roadmap_id, sort_order);
CREATE INDEX idx_tracks_user    ON roadmap_tracks (user_id);

CREATE TRIGGER set_updated_at_roadmap_tracks
  BEFORE UPDATE ON roadmap_tracks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── roadmap_milestones — a single achievable item within a track ──────────────
CREATE TABLE roadmap_milestones (
  id              SERIAL PRIMARY KEY,
  track_id        INTEGER NOT NULL REFERENCES roadmap_tracks(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  priority        VARCHAR(20) NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  resources       JSONB DEFAULT '[]',    -- [{ title, url, type: 'video'|'article'|'book' }]
  estimated_hours NUMERIC(6,1),
  actual_hours    NUMERIC(6,1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_milestones_track  ON roadmap_milestones (track_id, sort_order);
CREATE INDEX idx_milestones_user   ON roadmap_milestones (user_id);
CREATE INDEX idx_milestones_status ON roadmap_milestones (user_id, status);
CREATE INDEX idx_milestones_due    ON roadmap_milestones (user_id, due_date) WHERE status != 'completed';

CREATE TRIGGER set_updated_at_roadmap_milestones
  BEFORE UPDATE ON roadmap_milestones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Extend entity_links to allow the two new types (mirrors LINKABLE_TYPES) ────
-- Re-add the whole whitelist with 'learning_roadmap' + 'roadmap_milestone' appended.
-- All 22 pre-existing types are preserved (verify: none dropped).
ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS chk_entity_link_types;
ALTER TABLE entity_links ADD CONSTRAINT chk_entity_link_types CHECK (
  from_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book', 'contact', 'idea',
    'time_entry', 'goal', 'chat', 'learning_roadmap', 'roadmap_milestone'
  )
  AND to_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book', 'contact', 'idea',
    'time_entry', 'goal', 'chat', 'learning_roadmap', 'roadmap_milestone'
  )
);
