import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis }     from '@upstash/redis'

/**
 * Two-tier rate limiter for public endpoints.
 *
 * Backend selection (automatic at boot):
 *   - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are present
 *     → use Upstash Redis. GLOBAL, PERSISTENT, multi-region consistent.
 *     This is the production-grade path.
 *   - Otherwise → in-memory Map, per-instance. Fine for local dev and
 *     as a "better than nothing" stopgap on first deploy before Upstash
 *     credentials land.
 *
 * Transparent: caller API (`guardRequest`) is identical. Flip the env
 * vars on Vercel, redeploy, done — no code changes.
 *
 * Why Upstash specifically:
 *   - REST API over HTTPS, plays nice with Vercel's Edge/Lambda model
 *     (no TCP socket reuse required).
 *   - Official `@upstash/ratelimit` implements sliding-window, fixed-
 *     window and token-bucket; we use sliding-window (most forgiving
 *     to burst-y real users, still caps abusers).
 *   - Generous free tier (10k requests/day) — one request per guarded
 *     endpoint hit.
 *
 * Identifier = (first forwarded-for IP) + (UA[0..40]). Soft fingerprint,
 * enough to punish casual scripting; a determined attacker with rotating
 * IPs still gets through both layers (which is why we also want
 * Cloudflare Turnstile on the form — belt + braces).
 */

// ── Backend ─────────────────────────────────────────────────────────────────
const HAS_UPSTASH =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN

const redis = HAS_UPSTASH
  ? new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

// Cache Ratelimit instances by "scope:limit:windowMs" — @upstash/ratelimit
// reuses its own script SHA once constructed, so building fresh ones per
// request would be wasteful.
const UPSTASH_CACHE = new Map<string, Ratelimit>()

function getUpstashLimiter(
  scope:    string,
  limit:    number,
  windowMs: number,
): Ratelimit | null {
  if (!redis) return null
  const key = `${scope}:${limit}:${windowMs}`
  let rl = UPSTASH_CACHE.get(key)
  if (!rl) {
    rl = new Ratelimit({
      redis,
      limiter:  Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix:   `xpmoney:${scope}`,
      // `ephemeralCache` keeps a short-lived per-instance bloom filter
      // so duplicate checks within the same request don't each hit Redis.
      analytics: false,
      ephemeralCache: new Map(),
    })
    UPSTASH_CACHE.set(key, rl)
  }
  return rl
}

// ── In-memory fallback ──────────────────────────────────────────────────────
interface Bucket { hits: number[] }
const BUCKETS = new Map<string, Bucket>()

function pruneBucket(bucket: Bucket, windowMs: number, now: number) {
  const cutoff = now - windowMs
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
  allowed:    boolean
  used:       number
  limit:      number
  retryAfter: number
}

export async function hit(
  scope:      string,
  identifier: string,
  opts:       { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  // Upstash path
  const rl = getUpstashLimiter(scope, opts.limit, opts.windowMs)
  if (rl) {
    const { success, limit, remaining, reset } = await rl.limit(identifier)
    const retryAfter = success
      ? 0
      : Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    return {
      allowed:    success,
      used:       limit - remaining,
      limit,
      retryAfter,
    }
  }

  // In-memory fallback
  const key    = `${scope}::${identifier}`
  const now    = Date.now()
  const bucket = BUCKETS.get(key) ?? { hits: [] }
  pruneBucket(bucket, opts.windowMs, now)

  if (bucket.hits.length >= opts.limit) {
    const oldest     = bucket.hits[0] ?? now
    const retryAfter = Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000))
    return { allowed: false, used: bucket.hits.length, limit: opts.limit, retryAfter }
  }

  bucket.hits.push(now)
  BUCKETS.set(key, bucket)
  return { allowed: true, used: bucket.hits.length, limit: opts.limit, retryAfter: 0 }
}

/**
 * Run every window serially; short-circuit on the first rejection. Typical
 * usage:
 *
 *   const rl = await guardRequest(req, 'landing-chat', [
 *     { limit: 10,  windowMs: 10 * 60 * 1000 },
 *     { limit: 150, windowMs: 24 * 60 * 60 * 1000 },
 *   ])
 *   if (rl) return rl
 */
export async function guardRequest(
  req:     NextRequest,
  scope:   string,
  windows: Array<{ limit: number; windowMs: number }>,
): Promise<NextResponse | null> {
  const id = identifierFromReq(req)
  for (const w of windows) {
    const rl = await hit(scope, id, w)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Slow down.' },
        {
          status:  429,
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
