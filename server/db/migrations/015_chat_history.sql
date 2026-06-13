-- 015_chat_history.sql
-- Roadmap Wave 7 (final): AI Chat history for the DeepSeek-powered assistant.
-- Stores conversations with their full message log as JSONB, the model used, and
-- an optional context entity (the module item the chat was opened from).
--
-- Follows §6.5: SERIAL PK, user_id FK ON DELETE CASCADE, VARCHAR enums (none here),
-- TIMESTAMPTZ timestamps, the shared set_updated_at() trigger, idx_{table}_{cols}.
-- Re-runnable: DROP TABLE IF EXISTS … CASCADE precedes the CREATE; the trigger
-- function is CREATE OR REPLACE; the entity_links constraint is dropped IF EXISTS
-- before being re-added with 'chat' whitelisted.

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── chat_conversations ────────────────────────────────────────────────────────
DROP TABLE IF EXISTS chat_conversations CASCADE;

CREATE TABLE chat_conversations (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               VARCHAR(500),
  model               VARCHAR(100) NOT NULL DEFAULT 'deepseek-v4-flash',
  messages            JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_entity_type VARCHAR(40),
  context_entity_id   INTEGER,
  temperature         NUMERIC(3,2) DEFAULT 0.7,
  top_p               NUMERIC(3,2) DEFAULT 0.9,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_convos_user    ON chat_conversations (user_id);
CREATE INDEX idx_chat_convos_updated ON chat_conversations (user_id, updated_at DESC);
CREATE INDEX idx_chat_convos_context ON chat_conversations (user_id, context_entity_type, context_entity_id);

CREATE TRIGGER set_updated_at_chat_conversations
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Extend entity_links to allow 'chat' (mirrors LINKABLE_TYPES in enums.js) ───
-- Lets a saved conversation participate in Universal Links (Wave 1). Re-add the
-- whole whitelist with 'chat' appended.
ALTER TABLE entity_links DROP CONSTRAINT IF EXISTS chk_entity_link_types;
ALTER TABLE entity_links ADD CONSTRAINT chk_entity_link_types CHECK (
  from_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book', 'contact', 'idea',
    'time_entry', 'goal', 'chat'
  )
  AND to_type IN (
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book', 'contact', 'idea',
    'time_entry', 'goal', 'chat'
  )
);
