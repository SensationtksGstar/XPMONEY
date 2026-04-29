import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }        from '@/lib/supabase'

/**
 * GET /api/newsletter/unsubscribe?token=xxx
 *
 * One-click unsubscribe (RFC 8058 / List-Unsubscribe header expectation).
 * Token is unique-per-row and rotates only when the user re-subscribes
 * after unsubscribing, so old emails containing this URL keep working
 * indefinitely for opt-out purposes.
 *
 * Idempotent: clicking twice keeps `status='unsubscribed'` and reuses
 * the original `unsubscribed_at` so we don't drift the audit trail.
 *
 * On any failure (invalid token, network, DB error) we still redirect
 * to /newsletter/goodbye — the user clicked "unsubscribe" expecting it
 * to work; throwing a 500 in their face after that intent is bad UX.
 * Status carries detail for the page to surface a softer message
 * ("link expired — already unsubscribed?") if needed.
 */

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'https://xp-money.com').replace(/\/$/, '')
}

async function doUnsubscribe(token: string): Promise<'ok' | 'already' | 'invalid'> {
  if (!token || token.length < 32 || token.length > 128 || !/^[a-f0-9]+$/i.test(token)) {
    return 'invalid'
  }
  const db = createSupabaseAdmin()
  const { data: row, error } = await db
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('unsubscribe_token', token)
    .maybeSingle()
  if (error || !row) return 'invalid'
  if (row.status === 'unsubscribed') return 'already'
  const { error: upErr } = await db
    .from('newsletter_subscribers')
    .update({
      status:          'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('id', row.id)
  if (upErr) {
    console.warn('[newsletter/unsubscribe] update failed:', upErr)
    return 'invalid'
  }
  return 'ok'
}

export async function GET(req: NextRequest) {
  const token  = req.nextUrl.searchParams.get('token')?.trim() ?? ''
  const status = await doUnsubscribe(token)
  return NextResponse.redirect(`${siteUrl()}/newsletter/goodbye?status=${status}`)
}

// Some email clients (Gmail in particular) hit `List-Unsubscribe-Post`
// with POST. Mirror GET so one-click unsubscribe Just Works.
export async function POST(req: NextRequest) {
  const token  = req.nextUrl.searchParams.get('token')?.trim() ?? ''
  const status = await doUnsubscribe(token)
  return NextResponse.redirect(`${siteUrl()}/newsletter/goodbye?status=${status}`)
}
