import { NextRequest, NextResponse } from 'next/server'
import { z }                          from 'zod'
import { randomBytes }                from 'crypto'
import { createSupabaseAdmin }        from '@/lib/supabase'
import { guardRequest }               from '@/lib/rateLimit'
import { sendNewsletterConfirmation } from '@/lib/email'

/**
 * POST /api/newsletter/subscribe — public, double-opt-in flow.
 *
 * Pipeline:
 *   1. Rate-limit (3 / 5 min + 30 / day per IP+UA) — newsletter signup
 *      is the kind of public endpoint bots hammer first.
 *   2. Validate body (email + locale + honeypot).
 *   3. Honeypot — if the hidden `website` field is non-empty, return 200
 *      (bot's happy, we wrote nothing).
 *   4. Generate two 256-bit random tokens (confirm + unsubscribe).
 *   5. Upsert by email:
 *        - new email → row inserted with status='pending'
 *        - existing 'unsubscribed' → flip back to 'pending', new tokens
 *        - existing 'pending' → resend confirmation with same token
 *        - existing 'active' → no-op, return 200 (don't leak that they
 *          were already subscribed; use a generic success message)
 *   6. Fire-and-forget confirmation email.
 *   7. Return 200 with a generic "check your inbox" message regardless
 *      of which path above ran. Same response for all cases prevents
 *      enumeration of subscribed emails.
 *
 * The DB is the source of truth. If Resend is down we still write the
 * row and return success; the user can hit "resend" later (or we add a
 * cron sweep that re-tries pending rows).
 */

const Schema = z.object({
  email:   z.string().trim().email().max(200).toLowerCase(),
  locale:  z.enum(['pt', 'en']).default('pt'),
  source:  z.string().trim().max(40).optional(),
  // Honeypot — visible-zero-px field bots happily fill in.
  website: z.string().max(0).optional(),
})

function newToken(): string {
  return randomBytes(32).toString('hex')
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://xp-money.com').replace(/\/$/, '')
}

export async function POST(req: NextRequest) {
  // Two-tier rate limit. Bots that hit the burst limit will already be
  // throttled before any DB read.
  const limited = await guardRequest(req, 'newsletter-subscribe', [
    { limit: 3,  windowMs: 5  * 60 * 1000 },
    { limit: 30, windowMs: 24 * 60 * 60 * 1000 },
  ])
  if (limited) return limited

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
    return NextResponse.json({ error: first ?? 'Email inválido.' }, { status: 400 })
  }

  // Honeypot match → silently succeed.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ success: true }, { status: 200 })
  }

  const { email, locale, source } = parsed.data
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()?.slice(0, 80) ?? null
  const ua = req.headers.get('user-agent')?.slice(0, 240) ?? null

  const db = createSupabaseAdmin()

  // Look up existing row first (instead of upsert) so we can branch on
  // status. Upsert would clobber unsubscribed_at + treat re-subscribers
  // as fresh inserts, which we want to log distinctly later.
  const { data: existing, error: lookupErr } = await db
    .from('newsletter_subscribers')
    .select('id, status, confirm_token, unsubscribe_token, locale')
    .eq('email', email)
    .maybeSingle()

  if (lookupErr && !/relation .* does not exist/i.test(lookupErr.message)) {
    console.warn('[newsletter/subscribe] lookup failed:', lookupErr)
    return NextResponse.json({ error: 'Não foi possível processar agora. Tenta novamente.' }, { status: 500 })
  }

  // Migration not applied yet → fail soft so the deploy doesn't 500.
  // Admin sees a clear log line and applies database/newsletter_2026_04.sql.
  const missingTable = lookupErr && /relation .* does not exist/i.test(lookupErr.message)
  if (missingTable) {
    console.error('[newsletter/subscribe] newsletter_subscribers table missing — apply database/newsletter_2026_04.sql')
    return NextResponse.json(
      { error: 'Sistema de newsletter ainda não está disponível. Tenta dentro de algumas horas.' },
      { status: 503 },
    )
  }

  let confirmToken:     string
  let unsubscribeToken: string
  let needsEmail = true

  if (!existing) {
    // Brand-new email
    confirmToken     = newToken()
    unsubscribeToken = newToken()
    const { error: insErr } = await db.from('newsletter_subscribers').insert({
      email,
      locale,
      source:            source ?? null,
      status:            'pending',
      confirm_token:     confirmToken,
      unsubscribe_token: unsubscribeToken,
      signup_ip:         ip,
      signup_ua:         ua,
    })
    if (insErr) {
      // Race: same email submitted twice in parallel. Re-fetch and treat as
      // existing. Otherwise log + return generic error.
      if (/duplicate key/i.test(insErr.message)) {
        const { data: after } = await db
          .from('newsletter_subscribers')
          .select('confirm_token, unsubscribe_token, status, locale')
          .eq('email', email).maybeSingle()
        if (after) {
          confirmToken     = after.confirm_token
          unsubscribeToken = after.unsubscribe_token
          needsEmail = after.status === 'pending'
        } else {
          return NextResponse.json({ success: true }, { status: 200 })
        }
      } else {
        console.warn('[newsletter/subscribe] insert failed:', insErr)
        return NextResponse.json({ error: 'Não foi possível subscrever agora. Tenta novamente.' }, { status: 500 })
      }
    }
  } else if (existing.status === 'active') {
    // Already confirmed — do nothing, return success. Don't reveal status
    // to prevent email enumeration.
    return NextResponse.json({ success: true }, { status: 200 })
  } else if (existing.status === 'pending') {
    // Re-send confirmation with the same token they already received.
    confirmToken     = existing.confirm_token
    unsubscribeToken = existing.unsubscribe_token
  } else {
    // unsubscribed or bounced → flip back to pending, rotate tokens.
    confirmToken     = newToken()
    unsubscribeToken = newToken()
    const { error: upErr } = await db
      .from('newsletter_subscribers')
      .update({
        status:            'pending',
        confirm_token:     confirmToken,
        unsubscribe_token: unsubscribeToken,
        locale,
        unsubscribed_at:   null,
      })
      .eq('id', existing.id)
    if (upErr) {
      console.warn('[newsletter/subscribe] resubscribe update failed:', upErr)
      return NextResponse.json({ error: 'Não foi possível subscrever agora. Tenta novamente.' }, { status: 500 })
    }
  }

  if (needsEmail) {
    const url = `${siteUrl()}/api/newsletter/confirm?token=${confirmToken}`
    void sendNewsletterConfirmation({
      to:        email,
      locale,
      actionUrl: url,
    }).catch(err => console.warn('[newsletter/subscribe] confirmation send failed:', err))
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
