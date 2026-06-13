-- 017_push_subscriptions.sql
-- Web-Push subscription store (Roadmap Forward Phase 1 / Audit V6 §13.5).
--
-- v1 reminders use the browser Notification API + client polling (see
-- client/src/lib/notifications.js). This table is the substrate for true Web Push
-- (VAPID) in a later iteration: one row per (user, endpoint); re-subscribing the
-- same endpoint refreshes the stored keys via the UNIQUE upsert.
--
-- Follows §6.5: SERIAL PK, user_id FK ON DELETE CASCADE, JSONB keys, TIMESTAMPTZ
-- timestamps, the shared set_updated_at() trigger. Re-runnable: DROP ... CASCADE.

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── push_subscriptions ─────────────────────────────────────────────────────────
DROP TABLE IF EXISTS push_subscriptions CASCADE;

CREATE TABLE push_subscriptions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  keys        JSONB NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

CREATE TRIGGER set_updated_at_push_subscriptions
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
