'use client'

/**
 * Eager service-worker registration.
 *
 * Previously the only place `navigator.serviceWorker.register` lived was
 * inside `PushOptIn` (settings page). Users who never touched push
 * permissions — i.e. the vast majority on mobile — never had the SW
 * installed, so the cache strategy in public/sw.js never activated and
 * every cold start re-fetched the whole shell. That's the 5 s the user
 * reported on PWA boot.
 *
 * Now we register on every session, but DEFERRED until after first paint
 * (requestIdleCallback / setTimeout fallback) so the registration call
 * itself never delays LCP. The SW does its precache + activate in the
 * background; subsequent loads hit the cache.
 *
 * Reload-on-update: when a new SW takes control, we soft-reload the page
 * so users get the latest static-chunk hashes instead of mixing them
 * with the new HTML (a known Next.js + SW combination footgun).
 *
 * Mount once in the root layout. Renders nothing.
 */

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Skip in dev — Next.js's HMR conflicts with cached chunks.
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(reg => {
          // Soft reload when an updated SW activates. Avoids the
          // "stale chunks + new HTML" black-screen-on-route-change bug.
          let didReload = false
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing
            if (!nw) return
            nw.addEventListener('statechange', () => {
              if (nw.state === 'activated' && navigator.serviceWorker.controller && !didReload) {
                didReload = true
                window.location.reload()
              }
            })
          })
        })
        .catch(err => {
          // Failure here is non-fatal — app keeps working, just without
          // the cache speed-up. Don't show anything to the user.
          console.warn('[sw] registration failed (non-fatal):', err)
        })
    }

    // Defer until after first paint so registration never delays LCP.
    if ('requestIdleCallback' in window) {
      const id = (window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      }).requestIdleCallback!(register, { timeout: 4000 })
      return () => {
        ;(window as Window & {
          cancelIdleCallback?: (id: number) => void
        }).cancelIdleCallback?.(id)
      }
    } else {
      const t = setTimeout(register, 1500)
      return () => clearTimeout(t)
    }
  }, [])

  return null
}
