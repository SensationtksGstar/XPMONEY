-- =========================================================================
-- stripe_events — idempotency ledger for Stripe webhooks
-- =========================================================================
-- Stripe retries webhook deliveries on any non-2xx response, with jittered
-- exponential backoff over ~3 days. Without an idempotency check, a single
-- transient DB error could cause the SAME event (same id) to be processed
-- many times — duplicating plan changes, double-writing subscriptions, etc.
--
-- This table is the de-dup ledger. Every incoming event_id is recorded
-- BEFORE the switch-case runs. If the row already exists, the handler
-- short-circuits with 200 OK and does nothing.
--
-- Apply via Supabase SQL editor. The webhook code has a try/catch fallback
-- that still processes events if this table is missing (so you can deploy
-- the code first and apply the migration on a relaxed schedule), but you
-- really want it applied before public launch.
-- =========================================================================

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id    text    PRIMARY KEY,
  event_type  text    NOT NULL,
  received_at timestamptz DEFAULT now()
);

-- Tiny table; no indexes beyond the PK are needed.
-- Retention policy suggestion (optional): prune rows older than 90 days.
-- Stripe replays only happen within a few days, so 90 d is safe.
--   DELETE FROM stripe_events WHERE received_at < now() - interval '90 days';
