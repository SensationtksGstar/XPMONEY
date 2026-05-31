-- Net-worth history (Património trend)
-- One snapshot per user per day, written whenever the user changes any
-- account balance (create/update/delete). The /contas trend chart reads
-- these. Code degrades gracefully when this table doesn't exist yet, so
-- applying this migration is safe to do at any time.
--
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  net           NUMERIC(15, 2) NOT NULL,
  assets        NUMERIC(15, 2) NOT NULL,
  liabilities   NUMERIC(15, 2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One row per user per day — repeated edits on the same day upsert.
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_nws_user_date
  ON net_worth_snapshots(user_id, snapshot_date);

-- Service-role only (the API uses the service key); no public policies.
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
