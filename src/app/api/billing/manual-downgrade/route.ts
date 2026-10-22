import { auth }                     from '@clerk/nextjs/server'
import { NextResponse }              from 'next/server'
import { revalidateTag }             from 'next/cache'
import { stripe }                    from '@/lib/stripe'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { getServerT }                from '@/lib/i18n/server'
import {
  isSubscriptionPremium, SUB_SNAPSHOT_COLS, PREMIUM_SUB_STATUSES,
  type SubscriptionSnapshot,
} from '@/lib/plan'

/** Same budget as the webhook's Stripe calls — never hang the lambda. */
const STRIPE_CALL_OPTS = { timeout: 8_000, maxNetworkRetries: 1 }

/**
 * POST /api/billing/manual-downgrade
 *
 * Emergency exit for users whose `users.plan = 'premium'` flag was set
 * WITHOUT an underlying Stripe subscription — typical scenarios:
 *
 *   1. Admin / dev manually promoted via SQL for testing.
 *   2. Webhook from a real checkout failed, but the user has since
 *      changed mind and just wants the flag flipped back.
 *
 * Safety rule: this endpoint refuses to run when a real Stripe customer
 * exists for the user's email. If Stripe knows about them, the canonical
 * path is the Customer Portal (use /api/billing/portal). We never set
 * plan='free' while Stripe is still billing — that would silently keep
 * charging the user with no app access.
 *
 * Since Oct 2026 the effective plan (src/lib/plan.ts) also counts a live
 * `subscriptions` row, independently of users.plan. So "free" here means
 * BOTH: users.plan='free' AND no subscriptions row that still looks live.
 * A row that looks live but that Stripe confirms is dead (a missed
 * customer.subscription.deleted) is marked canceled here — otherwise the
 * user would stay Premium forever after "Voltar ao Free".
 *
 * Idempotent: calling it on an effectively-free user no-ops with success.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()
  const userRes = await db
    .from('users').select('id, email, plan').eq('clerk_id', userId).maybeSingle()
  if (userRes.error) {
    console.warn('[billing/manual-downgrade] user lookup failed:', userRes.error)
    return NextResponse.json({ error: userRes.error.message }, { status: 500 })
  }
  const user = userRes.data
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Subscription row: table absent (pre-migration) or read error → treat as
  // none, exactly like fetchPlanRow's degraded path.
  const subRes = await db
    .from('subscriptions').select(SUB_SNAPSHOT_COLS).eq('user_id', user.id).maybeSingle()
  let sub: SubscriptionSnapshot | null = null
  if (subRes.error) {
    console.warn('[billing/manual-downgrade] subscription probe failed (treating as none):', subRes.error)
  } else {
    sub = (subRes.data as SubscriptionSnapshot | null) ?? null
  }
  const rowLooksLive = isSubscriptionPremium(sub)

  if (user.plan === 'free' && !rowLooksLive) {
    return NextResponse.json({ ok: true, alreadyFree: true })
  }

  // Hard guard: NEVER drop the plan if there's an active Stripe customer.
  // The user must go through the Portal in that case so Stripe stops
  // charging them.
  const activeStripeResponse = () => NextResponse.json(
    {
      error:
        'Tens uma subscrição activa no Stripe — usa o portal de gestão ' +
        'para cancelar (caso contrário continuas a ser cobrado). ' +
        'Volta atrás e clica em "Gerir subscrição".',
      code: 'has_active_stripe',
    },
    { status: 409 },
  )

  if (user.email) {
    try {
      const list = await stripe.customers.list({ email: user.email, limit: 1 }, STRIPE_CALL_OPTS)
      if (list.data.length > 0) {
        const customer = list.data[0]
        // Check if any subscription is active for this customer
        const subs = await stripe.subscriptions.list({
          customer: customer.id, status: 'all', limit: 5,
        }, STRIPE_CALL_OPTS)
        const hasActive = subs.data.some(s => PREMIUM_SUB_STATUSES.includes(s.status))
        if (hasActive) return activeStripeResponse()
      }
    } catch (err) {
      // Stripe outage shouldn't block the user from cancelling a manual
      // promotion. Log and proceed — they're not being billed anyway.
      // (A row that looks live is verified separately below, fail closed.)
      console.warn('[billing/manual-downgrade] stripe lookup failed (non-fatal):', err)
    }
  }

  // The row claims a live subscription: ask Stripe about THAT id (the email
  // lookup above only sees the first Customer). Only a definitive answer —
  // a non-premium status, or the subscription no longer existing — lets us
  // retire the row. Anything else: refuse, don't guess.
  if (rowLooksLive && sub?.stripe_subscription_id) {
    try {
      const live = await stripe.subscriptions.retrieve(sub.stripe_subscription_id, {}, STRIPE_CALL_OPTS)
      if (PREMIUM_SUB_STATUSES.includes(live.status)) return activeStripeResponse()
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code !== 'resource_missing') {
        console.warn('[billing/manual-downgrade] subscription verify failed:', err)
        const t = await getServerT()
        return NextResponse.json(
          { error: t('billing.err_downgrade_unverified'), code: 'stripe_unverified' },
          { status: 503 },
        )
      }
    }

    // Stripe confirmed it's dead → retire the stale row (scoped to that id,
    // so a concurrent webhook that stored a NEW subscription isn't clobbered).
    const subUpd = await db.from('subscriptions').update({
      plan:       'free',
      status:     'canceled',
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id).eq('stripe_subscription_id', sub.stripe_subscription_id)
    if (subUpd.error) {
      console.warn('[billing/manual-downgrade] stale subscription retire failed:', subUpd.error)
      return NextResponse.json({ error: subUpd.error.message }, { status: 500 })
    }
  }

  if (user.plan !== 'free') {
    const { error } = await db
      .from('users').update({ plan: 'free' }).eq('id', user.id)
    if (error) {
      console.warn('[billing/manual-downgrade] plan update failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // The dashboard/settings read the effective plan from the 5-min profile cache.
  revalidateTag(`user-profile-${userId}`)
  return NextResponse.json({ ok: true, downgraded: true })
}
