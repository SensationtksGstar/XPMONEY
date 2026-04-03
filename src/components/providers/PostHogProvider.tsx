'use client'

import posthog      from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host:         process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      capture_pageview: false,
      autocapture:      false,
      person_profiles:  'identified_only',
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
