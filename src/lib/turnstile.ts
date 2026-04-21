import 'server-only'

/**
 * Cloudflare Turnstile server-side verification.
 *
 * Turnstile is Cloudflare's invisible CAPTCHA: the client-side widget
 * fingerprints the visitor (JS challenges, TLS signals, behaviour), gets
 * a short-lived token, and posts it to our API alongside the real form.
 * We verify the token against Cloudflare before accepting the write.
 *
 * Configuration (env):
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  — the public site key the widget reads
 *   TURNSTILE_SECRET_KEY            — server-only secret for verify
 *
 * Graceful fallback: if the secret isn't configured, verify() returns
 * `{ ok: true, skipped: true }` so local dev and first-deploy scenarios
 * don't break. In production, monitor for `skipped: true` in logs —
 * means Turnstile isn't enforcing yet.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

interface VerifyResult {
  ok:      boolean
  /** True if we skipped verification because no secret is set. */
  skipped: boolean
  /** Cloudflare's raw error codes (e.g. "invalid-input-response"). */
  errors?: string[]
}

export async function verifyTurnstile(
  token:    string | null | undefined,
  remoteIp?: string,
): Promise<VerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return { ok: true, skipped: true }

  if (!token) return { ok: false, skipped: false, errors: ['missing-input-response'] }

  const body = new URLSearchParams()
  body.set('secret',   secret)
  body.set('response', token)
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const res = await fetch(VERIFY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
      // 5 s guard so a Cloudflare outage doesn't stall the form indefinitely.
      signal:  AbortSignal.timeout(5000),
    })
    const json = await res.json().catch(() => ({ success: false })) as {
      success?:          boolean
      'error-codes'?:    string[]
    }
    return {
      ok:      json.success === true,
      skipped: false,
      errors:  json['error-codes'],
    }
  } catch (err) {
    console.warn('[turnstile] verify failed:', err)
    // Fail CLOSED — if we can't verify, we reject. A Cloudflare 502 is
    // rare enough that users will just retry; better than opening the
    // form to the whole internet on provider failure.
    return { ok: false, skipped: false, errors: ['network-error'] }
  }
}
