-- 016_user_settings.sql
-- Server-side user preferences (Post-V5 Medium-Term fix; addresses V5 §12.2/§13.4).
-- Moves theme, default AI model, and the notification preference off the client's
-- localStorage so they follow the user across devices. Exactly one row per user
-- (UNIQUE user_id), lazily created on first read by settings.model.js.
--
-- Follows §6.5: SERIAL PK, user_id FK ON DELETE CASCADE, VARCHAR enums via CHECK,
-- TIMESTAMPTZ timestamps, the shared set_updated_at() trigger.
-- Re-runnable: DROP TABLE IF EXISTS … CASCADE precedes the CREATE.

-- ── Shared updated_at trigger function (idempotent) ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── user_settings ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS user_settings CASCADE;

CREATE TABLE user_settings (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme                 VARCHAR(20) NOT NULL DEFAULT 'system'
                        CHECK (theme IN ('light', 'dark', 'system')),
  default_model         VARCHAR(50) NOT NULL DEFAULT 'deepseek-chat',
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One settings row per user. The UNIQUE constraint also provides the lookup
  -- index, so no separate idx_user_settings_user is needed.
  UNIQUE (user_id)
);

CREATE TRIGGER set_updated_at_user_settings
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
