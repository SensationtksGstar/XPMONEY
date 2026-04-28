'use client'

import posthog      from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { CONSENT_EVENT, getConsent, type ConsentValue } from '@/lib/consent'

/**
 * PostHog is gated on explicit consent (RGPD + ePrivacy). It does NOT init
 * on first paint — instead we wait for either:
 *   1. A stored "accepted" decision in localStorage (returning users), OR
 *   2. The user accepting via the cookie banner (CONSENT_EVENT broadcast)
 *
 * If the user explicitly rejects, posthog.opt_out_capturing() ensures any
 * already-loaded SDK code stops firing events. We never silently downgrade
 * to anonymous-only either: rejection means rejection.
 */

let initialised = false

function initIfAllowed() {
  if (initialised) return
  if (typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return
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
  posthog.opt_in_capturing()
  initialised = true
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Returning user with prior consent → init immediately on mount.
    if (getConsent() === 'accepted') {
      initIfAllowed()
      return
    }
    // Otherwise wait for the banner decision.
    const onChange = (e: Event) => {
      const value = (e as CustomEvent<ConsentValue | null>).detail
      if (value === 'accepted') {
        initIfAllowed()
      } else if (value === 'rejected') {
        // If we somehow got initialised already (e.g. dev hot-reload),
        // shut tracking down so the user's "no" actually means no.
        try { posthog.opt_out_capturing() } catch { /* SDK not loaded yet */ }
      }
    }
    window.addEventListener(CONSENT_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_EVENT, onChange)
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
