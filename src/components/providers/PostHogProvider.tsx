'use client'

import { useEffect } from 'react'
import { CONSENT_EVENT, getConsent, type ConsentValue } from '@/lib/consent'

/**
 * PostHog is gated on explicit consent (RGPD + ePrivacy) AND lazy-loaded.
 *
 * `posthog-js` (~50-60 KB gzipped) used to be a STATIC import here, so it landed
 * in the root-layout chunk and was downloaded + parsed on EVERY page — including
 * the public marketing surface of a visitor who never consented. It's now
 * `await import()`-ed only when consent is accepted, so it stays out of the
 * shared bundle entirely until needed (biggest TBT win on the landing).
 *
 * Nothing in the app uses the `usePostHog()` React hook — analytics fire through
 * the global singleton (src/lib/posthog.ts) — so we don't need the
 * `posthog-js/react` provider wrapper at all.
 *
 * It does NOT init on first paint. We wait for either:
 *   1. A stored "accepted" decision (returning users), OR
 *   2. The user accepting via the cookie banner (CONSENT_EVENT broadcast)
 * Explicit rejection opts out any already-loaded SDK — rejection means rejection,
 * including the race where "reject" fires while posthog-js is still importing.
 */

let initialised = false
let optedOut    = false
// Holds the dynamically-imported client so the reject path can opt it out.
let client: typeof import('posthog-js').default | null = null

async function initIfAllowed() {
  if (initialised) return
  if (typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
  initialised = true // set before await so a second call can't double-import

  const posthog = (await import('posthog-js')).default
  client = posthog
  posthog.init(key, {
    api_host:         process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    capture_pageview: false,
    autocapture:      false,
    person_profiles:  'identified_only',
    // Belt + braces: tell PostHog itself to require opt-in. If anything
    // bypasses our gate (e.g. an imported helper firing capture before
    // init), the SDK will still hold events back until opt_in is called.
    opt_out_capturing_by_default: true,
  })
  // If the user rejected WHILE the SDK was importing, honour it now.
  if (optedOut) posthog.opt_out_capturing()
  else          posthog.opt_in_capturing()
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Returning user with prior consent → load + init immediately on mount.
    if (getConsent() === 'accepted') {
      void initIfAllowed()
      return
    }
    // Otherwise wait for the banner decision.
    const onChange = (e: Event) => {
      const value = (e as CustomEvent<ConsentValue | null>).detail
      if (value === 'accepted') {
        void initIfAllowed()
      } else if (value === 'rejected') {
        // Mark opted-out (covers the still-importing race) and shut down any
        // already-loaded SDK so the user's "no" actually means no.
        optedOut = true
        try { client?.opt_out_capturing() } catch { /* SDK not loaded yet */ }
      }
    }
    window.addEventListener(CONSENT_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_EVENT, onChange)
  }, [])

  return <>{children}</>
}
