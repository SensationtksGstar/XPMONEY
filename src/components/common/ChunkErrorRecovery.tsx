'use client'

import { useEffect } from 'react'

/**
 * ChunkErrorRecovery — auto-heals "Loading chunk N failed".
 *
 * When a deploy replaces the content-hashed chunks, two things can strand a
 * user on dead chunk URLs:
 *   1. A tab that stayed open across the deploy client-side-navigates to a
 *      route whose lazy chunk hash no longer exists on the server.
 *   2. Stale HTML served from a cache (the pre-v3 service worker did this on
 *      every first open after a deploy).
 *
 * A plain reload fixes both — fresh HTML references chunks that exist. This
 * listener detects the failure and reloads ONCE per minute at most (session-
 * scoped guard) so a genuinely broken deploy can't reload-loop the browser.
 *
 * Mounted in the root layout: it renders nothing and must stay dependency-
 * free (no providers) so it can live on public routes.
 */

const RELOADED_AT_KEY = 'xpmoney:chunk-reload-at'

const CHUNK_ERROR_RE =
  /(Loading chunk [\w-]+ failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module)/i

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT_KEY) ?? 0)
    if (Date.now() - last < 60_000) return
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()))
  } catch {
    // sessionStorage unavailable (rare privacy modes) — reload anyway; the
    // 1-minute guard just won't persist.
  }
  console.warn('[chunk-recovery] stale deploy detected — reloading for fresh chunks')
  window.location.reload()
}

function messageOf(reason: unknown): string {
  if (typeof reason === 'string') return reason
  if (reason && typeof reason === 'object') {
    const r = reason as { message?: unknown; name?: unknown }
    return `${String(r.name ?? '')} ${String(r.message ?? '')}`
  }
  return ''
}

export function ChunkErrorRecovery() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (CHUNK_ERROR_RE.test(e.message ?? '')) reloadOnce()
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      if (CHUNK_ERROR_RE.test(messageOf(e.reason))) reloadOnce()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
