import { NextResponse } from 'next/server'

/**
 * Demo mode guard.
 *
 * SECURITY — READ THIS BEFORE CHANGING
 * =====================================================================
 * `NEXT_PUBLIC_DEMO_MODE` is an env var with a `NEXT_PUBLIC_` prefix,
 * which means it is:
 *   - BAKED INTO THE CLIENT BUNDLE (publicly visible)
 *   - copy-pasted easily between staging/prod `.env` files by accident
 *
 * Historically `isDemoMode()` returned `true` whenever this flag was
 * set — and the middleware, /api/scan-receipt and /api/daily-checkin
 * all used it to bypass Clerk auth. A single misconfigured Vercel
 * deploy with this flag flipped on would therefore open the entire
 * authenticated surface to unauthenticated traffic.
 *
 * New behaviour: `isDemoMode()` still returns true on non-production
 * (so local dev + staging keep working), but REFUSES to be demo-mode
 * in `NODE_ENV === 'production'` UNLESS an explicit opt-in env var
 * `ALLOW_DEMO_IN_PROD='true'` is ALSO set. The opt-in is:
 *   - NOT prefixed with `NEXT_PUBLIC_` (server-only, never leaks to
 *     the client bundle)
 *   - Deliberately long/ugly to force a conscious decision
 *
 * UI components (banner, copy swaps) that read `NEXT_PUBLIC_DEMO_MODE`
 * directly are not updated — they only show cosmetic cues, not auth
 * behaviour. Any code that grants or skips auth MUST import this
 * helper instead of reading the env var.
 */
export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return false
  if (process.env.NODE_ENV !== 'production') return true
  return process.env.ALLOW_DEMO_IN_PROD === 'true'
}

export function demoResponse(data: unknown, status = 200) {
  return NextResponse.json({ data, error: null }, { status })
}
