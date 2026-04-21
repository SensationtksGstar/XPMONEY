import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Minimal server-side rate limiter.
 *
 * Purpose
 * =====================================================================
 * Protect public, expensive, unauthenticated endpoints (/api/landing-
 * chat, /api/contact-message) against simple abuse — scripted burst
 * floods that drain Gemini credits or spam the Supabase free tier.
 *
 * Backend
 * =====================================================================
 * Uses a per-instance in-memory `Map` keyed by (scope + identifier).
 * Each bucket is a sliding window over the last N ms with a max-count.
 * Expired buckets are cleaned lazily on access (no timers / intervals
 * that would keep the Lambda warm pointlessly).
 *
 * Honest limitations of in-memory:
 *   - Vercel serverless runs multiple regional instances. A burst from
 *     one attacker may hit instance A and B separately, effectively
 *     doubling their budget. For casual scrapers / curl scripts this is
 *     still enough friction.
 *   - A cold-start resets the Map. Limit is per-instance per-warm-
 *     period — fine as a first layer, not a fortress.
 *
 * When you need a real fortress:
 *   - Drop in Upstash Redis: replace the Map with @upstash/ratelimit
 *     and keep the exported API identical. No caller changes required.
 *   - Layer a Cloudflare / WAF rule in front of /api/landing-chat and
 *     /api/contact-message.
 *
 * Identifier
 * =====================================================================
 * We key on `x-forwarded-for` (first hop) + `user-agent` (first 40 chars)
 * as a soft fingerprint. Vercel populates x-forwarded-for with the
 * client IP upstream of the edge. Fallback to `unknown` if headers are
 * missing — means a pathological request with no headers counts toward
 * a shared `unknown` bucket, which actually HELPS the limiter (it caps
 * that whole class of traffic globally).
 */

interface Bucket {
  /** Timestamps of hits within the window, in ms. */
  hits: number[]
}

const BUCKETS = new Map<string, Bucket>()

/** Strip bucket entries older than their window on read. O(n) per key. */
function prune(bucket: Bucket, windowMs: number, now: number) {
  const cutoff = now - windowMs
  // Array is chronological (push-only), so drop leading expired entries.
  let i = 0
  while (i < bucket.hits.length && bucket.hits[i] < cutoff) i++
  if (i > 0) bucket.hits.splice(0, i)
}

function identifierFromReq(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const ua = (req.headers.get('user-agent') ?? '').slice(0, 40)
  return `${ip}|${ua}`
}

export interface RateLimitResult {
  allowed:   boolean
  /** Hits used so far in the current window (after accounting for this one). */
  used:      number
  /** Configured limit for this window. */
  limit:     number
  /** Seconds until the oldest hit in the window expires — what to send in Retry-After. */
  retryAfter: number
}

/**
 * Check + record a hit for `scope` keyed by `identifier`.
 *
 *   const rl = hit('landing-chat', identifierFromReq(req), { limit: 10, windowMs: 10*60*1000 })
 *   if (!rl.allowed) return 429
 */
export function hit(
  scope:      string,
  identifier: string,
  opts:       { limit: number; windowMs: number },
): RateLimitResult {
  const key    = `${scope}::${identifier}`
  const now    = Date.now()
  const bucket = BUCKETS.get(key) ?? { hits: [] }
  prune(bucket, opts.windowMs, now)

  if (bucket.hits.length >= opts.limit) {
    const oldest = bucket.hits[0] ?? now
    const retryAfter = Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000))
    return { allowed: false, used: bucket.hits.length, limit: opts.limit, retryAfter }
  }

  bucket.hits.push(now)
  BUCKETS.set(key, bucket)
  return { allowed: true, used: bucket.hits.length, limit: opts.limit, retryAfter: 0 }
}

/**
 * Convenience wrapper that runs both a short-window (burst) and a long-
 * window (daily) limit in series. Typical usage:
 *
 *   const rl = guardRequest(req, 'landing-chat', [
 *     { limit: 10,  windowMs: 10 * 60 * 1000 },   // 10 in 10 min
 *     { limit: 300, windowMs: 24 * 60 * 60 * 1000 }, // 300 / day
 *   ])
 *   if (rl) return rl   // 429 response already constructed
 */
export function guardRequest(
  req:   NextRequest,
  scope: string,
  windows: Array<{ limit: number; windowMs: number }>,
): NextResponse | null {
  const id = identifierFromReq(req)
  for (const w of windows) {
    const rl = hit(scope, id, w)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Slow down.' },
        {
          status: 429,
          headers: {
            'Retry-After':          String(rl.retryAfter),
            'X-RateLimit-Limit':    String(rl.limit),
            'X-RateLimit-Window-s': String(Math.round(w.windowMs / 1000)),
          },
        },
      )
    }
  }
  return null
}
