-- Migration: 009_contacts
-- Startup Founder CRM (lite) — Roadmap Wave 4. Tracks clients, stakeholders,
-- partners, suppliers, investors, and mentors. Links to projects, receivables,
-- and payables via entity_links (Wave 1), so this migration also extends the
-- chk_entity_link_types CHECK to whitelist 'contact'.
--
-- Follows §6.5 conventions: SERIAL PK, user_id FK ON DELETE CASCADE, VARCHAR enums
-- via CHECK (never ENUM type), TIMESTAMPTZ timestamps, the shared set_updated_at()
-- trigger, and idx_{table}_{cols} indexes.
--
-- Re-runnable: DROP TABLE IF EXISTS ... CASCADE precedes the CREATE, the trigger
-- function is CREATE OR REPLACE, and the entity_links constraint is dropped IF
-- EXISTS before being re-added. The migration runner (db/migrate.js) wraps each
-- file in its own transaction — NO explicit BEGIN/COMMIT here (mirrors 007/008).

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── contacts ─────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS contacts CASCADE;

CREATE TABLE contacts (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(300),
  phone           VARCHAR(50),
  company         VARCHAR(200),
  role            VARCHAR(100),
  type            VARCHAR(50) NOT NULL DEFAULT 'client'
                  CHECK (type IN ('client', 'partner', 'supplier', 'investor', 'mentor', 'other')),
  status          VARCHAR(50) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive', 'lead')),
  notes           TEXT,
  last_contacted  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER contacts_set_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for the common query patterns (per-user lists, type/status filters,
-- and name search/sort).
CREATE INDEX idx_contacts_user_id ON contacts (user_id);
CREATE INDEX idx_contacts_type    ON contacts (user_id, type);
CREATE INDEX idx_contacts_status  ON contacts (user_id, status);
CREATE INDEX idx_contacts_name    ON contacts (user_id, name);

-- ── Extend entity_links to allow 'contact' (mirrors LINKABLE_TYPES in enums.js) ─
-- entity_links was created in 007 and extended in 008 (book). Re-add the type
-- whitelist with 'contact' included.
ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS chk_entity_link_types;
ALTER TABLE entity_links ADD CONSTRAINT chk_entity_link_types CHECK (
  from_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book', 'contact'
  )
  AND to_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book', 'contact'
  )
);
