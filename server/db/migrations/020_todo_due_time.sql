-- 020_todo_due_time.sql
-- Add time-of-day precision to todo items for Telegram due-time reminders.
-- Additive (Invariant 3): new columns are NULL by default, so existing todos
-- and the existing /due aggregation keep working unchanged.

-- Add due_time column (TIME without timezone — local server time is fine for a
-- single-user, self-hosted system; reminders fire against LOCALTIME).
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_time TIME;

-- Add reminder tracking: when was the last Telegram reminder sent for this todo?
-- NULL = never reminded; updated each time a reminder fires (anti-spam guard).
ALTER TABLE todos ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;

-- Partial index for the reminder scan: only open, dated todos are ever queried.
CREATE INDEX IF NOT EXISTS idx_todos_reminder
  ON todos (user_id, due_date, due_time)
  WHERE status IN ('pending', 'in_progress') AND due_date IS NOT NULL;
