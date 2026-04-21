'use client'

import { useEffect, useRef } from 'react'

/**
 * TurnstileWidget — Cloudflare invisible CAPTCHA for public forms.
 *
 * Lifecycle:
 *   1. If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, render nothing
 *      and let the form submit unguarded. The server-side
 *      `verifyTurnstile()` also no-ops in this mode, so local dev and
 *      first-deploy-before-keys keep working.
 *   2. Otherwise, load the Cloudflare script on mount (singleton —
 *      subsequent mounts reuse the existing script), render the widget
 *      into a div, and surface the resulting token via `onToken`.
 *   3. On token expiry or error, emit an empty string so the form's
 *      submit handler can block until a fresh challenge completes.
 *
 * Theme locked to 'dark' to match the app; size `flexible` so it fills
 * whatever column the form places it in.
 */

interface Props {
  onToken: (token: string) => void
}

type TurnstileOptions = {
  sitekey:             string
  callback:            (token: string) => void
  'error-callback'?:   () => void
  'expired-callback'?: () => void
  theme?:              'auto' | 'light' | 'dark'
  size?:               'normal' | 'compact' | 'flexible'
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement | string, options: TurnstileOptions) => string
      reset:  (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
    __xpmoneyTurnstileOnLoad?: () => void
  }
}

const SCRIPT_ID  = 'cf-turnstile-script'
const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js' +
  '?onload=__xpmoneyTurnstileOnLoad&render=explicit'

function loadScriptOnce(onReady: () => void) {
  if (typeof window === 'undefined') return
  if (window.turnstile) { onReady(); return }
  if (document.getElementById(SCRIPT_ID)) {
    // Script is loading from a previous mount; just queue our callback.
    const prev = window.__xpmoneyTurnstileOnLoad
    window.__xpmoneyTurnstileOnLoad = () => { prev?.(); onReady() }
    return
  }
  window.__xpmoneyTurnstileOnLoad = onReady
  const s = document.createElement('script')
  s.id    = SCRIPT_ID
  s.async = true
  s.defer = true
  s.src   = SCRIPT_URL
  document.head.appendChild(s)
}

export function TurnstileWidget({ onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef  = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

  useEffect(() => {
    if (!siteKey || !containerRef.current) return

    const mount = () => {
      if (!containerRef.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey:            siteKey,
        callback:           (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback':   () => onToken(''),
        theme:              'dark',
        size:               'flexible',
      })
    }

    loadScriptOnce(mount)

    return () => {
      const id = widgetIdRef.current
      if (id && window.turnstile) {
        try { window.turnstile.remove(id) } catch { /* widget already gone */ }
      }
    }
  }, [siteKey, onToken])

  // No key configured → render nothing and let the server short-circuit.
  if (!siteKey) return null

  return <div ref={containerRef} className="my-2" />
}
