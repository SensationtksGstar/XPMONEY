import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }        from '@/lib/supabase'
import { sendNewsletterWelcome }      from '@/lib/email'

/**
 * GET /api/newsletter/confirm?token=xxx
 *
 * Step 2 of the double-opt-in flow. The user clicks the link in the
 * confirmation email; we verify the token, flip status to 'active',
 * fire the welcome email, and redirect them to /newsletter/confirmed.
 *
 * Idempotent: hitting the same link twice produces the same redirect
 * (welcome email is only sent the first time, on the pending → active
 * transition). Expired/invalid tokens redirect to /newsletter/confirmed
 * with `?status=invalid` so the page can show a friendly message
 * without leaking which token was attempted.
 *
 * The endpoint takes a token from the query string, NOT a body, so the
 * link can be a plain GET that works from any email client.
 */

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://xp-money.com').replace(/\/$/, '')
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? ''

  // Sanity bound — real tokens are 64 hex chars. Anything wildly off is
  // a probe; reject without touching the DB.
  if (!token || token.length < 32 || token.length > 128 || !/^[a-f0-9]+$/i.test(token)) {
    return NextResponse.redirect(`${siteUrl()}/newsletter/confirmed?status=invalid`)
  }

  const db = createSupabaseAdmin()
  const { data: row, error } = await db
    .from('newsletter_subscribers')
    .select('id, email, locale, status, unsubscribe_token')
    .eq('confirm_token', token)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.redirect(`${siteUrl()}/newsletter/confirmed?status=invalid`)
  }

  // Idempotent: already-active rows skip straight to success. Don't fire
  // the welcome email again — they already got it.
  if (row.status === 'active') {
    return NextResponse.redirect(`${siteUrl()}/newsletter/confirmed?status=already`)
  }

  // Unsubscribed/bounced rows reaching here means the user clicked an
  // OLD confirmation link AFTER unsubscribing. Treat as invalid.
  if (row.status !== 'pending') {
    return NextResponse.redirect(`${siteUrl()}/newsletter/confirmed?status=invalid`)
  }

  // Flip pending → active.
  const { error: upErr } = await db
    .from('newsletter_subscribers')
    .update({
      status:       'active',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', row.id)
  if (upErr) {
    console.warn('[newsletter/confirm] activate failed:', upErr)
    return NextResponse.redirect(`${siteUrl()}/newsletter/confirmed?status=invalid`)
  }

  // Fire the welcome email — fire-and-forget, don't block the redirect.
  const unsubUrl = `${siteUrl()}/api/newsletter/unsubscribe?token=${row.unsubscribe_token}`
  void sendNewsletterWelcome({
    to:             row.email,
    locale:         (row.locale === 'en' ? 'en' : 'pt') as 'pt' | 'en',
    actionUrl:      `${siteUrl()}/sign-up`,
    unsubscribeUrl: unsubUrl,
  }).catch(err => console.warn('[newsletter/confirm] welcome send failed:', err))

  return NextResponse.redirect(`${siteUrl()}/newsletter/confirmed?status=ok`)
}
