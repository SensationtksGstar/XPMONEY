-- XP Money — Push Notifications Migration
-- Run this in the Supabase SQL Editor (https://app.supabase.com → SQL Editor)

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint   TEXT         NOT NULL,
  p256dh     TEXT         NOT NULL,
  auth       TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (
    user_id = (
      SELECT id FROM public.users WHERE clerk_id = auth.uid()::text
    )
  );
