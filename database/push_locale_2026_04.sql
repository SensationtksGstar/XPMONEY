-- =========================================================================
-- Optional: per-subscriber locale for push notifications
-- =========================================================================
-- Adds a `locale` column to push_subscriptions so the daily broadcast can
-- send EN messages to EN users. The /api/notifications/send route already
-- falls back gracefully if this column is missing (runtime guard), so the
-- migration is optional but recommended for EN user satisfaction.
--
-- Apply via Supabase SQL editor.
-- =========================================================================

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS locale text
    CHECK (locale IS NULL OR locale IN ('pt', 'en'));

-- Backfill: leave existing rows NULL. The send route treats NULL as PT
-- (the historic default) — no mass update needed. New subscriptions will
-- populate `locale` from the user's active cookie when /api/notifications/
-- subscribe gets updated to write it.
