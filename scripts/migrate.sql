-- ================================================================
-- XP Money — Database Migration
-- Run this once in Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. goal_deposits: tracks savings deposits/withdrawals per goal
CREATE TABLE IF NOT EXISTS public.goal_deposits (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID        NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL,   -- positive = deposit, negative = withdrawal
  note        TEXT        NOT NULL DEFAULT '',
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_goal_deposits_goal_id  ON public.goal_deposits(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_deposits_user_id  ON public.goal_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_deposits_date     ON public.goal_deposits(date DESC);

-- Row Level Security
ALTER TABLE public.goal_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own deposits" ON public.goal_deposits;
CREATE POLICY "Users manage own deposits"
  ON public.goal_deposits
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE clerk_id = auth.jwt() ->> 'sub'
      LIMIT 1
    )
  );

-- Done!
SELECT 'goal_deposits table created successfully ✓' AS result;
