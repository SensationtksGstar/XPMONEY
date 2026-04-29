-- ============================================================================
-- newsletter_subscribers — opt-in mailing list with double-opt-in flow
-- ============================================================================
--
-- Why double-opt-in (not just store-and-go):
--   - RGPD/ePrivacy: consent must be "freely given, specific, informed and
--     unambiguous". A user typing an email and clicking submit is one
--     verification; clicking the link in the confirmation email proves they
--     control that mailbox. Without it, anyone can add anyone (revenge
--     subscription, mailing-list spam).
--   - Resend (and most providers) penalise sender reputation when emails
--     bounce; double-opt-in cuts bounce rate dramatically.
--
-- Token strategy:
--   - confirm_token: required to flip status from 'pending' → 'active'.
--     Generated server-side with crypto.randomBytes(32).toString('hex'),
--     so 64 hex chars = 256 bits. Random enough that brute-forcing is
--     not viable.
--   - unsubscribe_token: separate token used in every campaign email's
--     unsubscribe link. Kept distinct from confirm_token so we can
--     rotate one without invalidating the other.
--
-- Status lifecycle:
--   pending     → email submitted, confirm email sent, awaiting click
--   active      → user clicked confirm link; we may send campaigns
--   unsubscribed → user clicked unsubscribe in any campaign email
--   bounced     → reserved for future webhook integration with Resend;
--                 marks emails that hard-bounced so we stop sending
--
-- Apply via Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT        NOT NULL UNIQUE,
  locale             TEXT        NOT NULL DEFAULT 'pt'
                                 CHECK (locale IN ('pt', 'en')),
  source             TEXT,           -- 'landing' | 'blog' | 'signup' | etc.
  status             TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'active', 'unsubscribed', 'bounced')),
  -- 64 hex chars = 256-bit random token; generated server-side per row
  confirm_token      TEXT        NOT NULL UNIQUE,
  unsubscribe_token  TEXT        NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at       TIMESTAMPTZ,
  unsubscribed_at    TIMESTAMPTZ,
  -- IP + UA captured at signup for abuse forensics. NOT exposed in any
  -- API response — service-role only.
  signup_ip          TEXT,
  signup_ua          TEXT
);

-- Lookups by token are exact-match → indexed via UNIQUE already.
-- Status is filtered when sending campaigns, so an index pays off:
CREATE INDEX IF NOT EXISTS newsletter_status_idx
  ON public.newsletter_subscribers (status);

-- Cleanup: pending entries older than 7 days never confirmed → drop
-- them so the unique-email constraint doesn't permanently lock the
-- address out of re-signup. Run via cron when ready, or manually.
--   DELETE FROM public.newsletter_subscribers
--    WHERE status = 'pending' AND created_at < NOW() - INTERVAL '7 days';

-- RLS: service-role only. No user has direct access.
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
