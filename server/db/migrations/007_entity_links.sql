-- Migration: 007_entity_links
-- Universal cross-module linking system (Roadmap Wave 1 — the foundation).
-- Connects any entity (transaction, research_entry, learning_item, engineer_project,
-- todo, …) to any other entity, with user_id scoping. Ownership of BOTH sides is
-- validated at the API layer (server/routes/links.js); this table only enforces
-- user scoping, type whitelisting, and de-duplication.
--
-- Follows §6.5 conventions: SERIAL PK, user_id FK ON DELETE CASCADE, VARCHAR enums
-- via CHECK (never ENUM type), TIMESTAMPTZ timestamps, the shared set_updated_at()
-- trigger, and idx_{table}_{cols} indexes.
--
-- Re-runnable: DROP TABLE IF EXISTS ... CASCADE precedes the CREATE, and the trigger
-- function is CREATE OR REPLACE, so a second run is a no-op. The migration runner
-- (db/migrate.js) wraps each file in its own transaction — no explicit BEGIN/COMMIT.

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── entity_links ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS entity_links CASCADE;

CREATE TABLE entity_links (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_type   VARCHAR(40) NOT NULL,
  from_id     INTEGER NOT NULL,
  to_type     VARCHAR(40) NOT NULL,
  to_id       INTEGER NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent exact duplicate links (same direction, same pair). NULLS NOT DISTINCT
  -- is unnecessary here: every keyed column is NOT NULL.
  CONSTRAINT uq_entity_link UNIQUE (user_id, from_type, from_id, to_type, to_id),

  -- Whitelist the linkable entity types. Mirrors LINKABLE_TYPES in server/lib/enums.js;
  -- keep the two in sync when adding a module.
  CONSTRAINT chk_entity_link_types CHECK (
    from_type IN (
      'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
      'receivable', 'payable', 'portfolio', 'budget', 'account',
      'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
      'engineer_checkin', 'engineer_roadmap_skill'
    )
    AND to_type IN (
      'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
      'receivable', 'payable', 'portfolio', 'budget', 'account',
      'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
      'engineer_checkin', 'engineer_roadmap_skill'
    )
  )
);

CREATE TRIGGER entity_links_set_updated_at
  BEFORE UPDATE ON entity_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Forward lookup: "what does this entity link to?"
CREATE INDEX idx_entity_links_from ON entity_links (user_id, from_type, from_id);

-- Reverse lookup: "what links point to this entity?"
CREATE INDEX idx_entity_links_to ON entity_links (user_id, to_type, to_id);

-- Timestamp-sorted for "most recently linked".
CREATE INDEX idx_entity_links_created ON entity_links (user_id, created_at DESC);
