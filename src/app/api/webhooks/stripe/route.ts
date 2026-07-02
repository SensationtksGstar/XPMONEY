import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPlanFromPriceId } from '@/lib/stripe'
import { createSupabaseAdmin }         from '@/lib/supabase'
import Stripe                          from 'stripe'

/**
 * Stripe webhook. Hardened April 2026:
 *
 *   - Signature verification via `stripe.webhooks.constructEvent` (Stripe
 *     SDK, timing-safe, unchanged).
 *   - Idempotency: every processed `event.id` is recorded in
 *     `stripe_events` (see database/stripe_events_2026_04.sql). A retry
 *     of the same event short-circuits before any DB mutation so we can
 *     never double-apply a plan change or charge.
 *   - Null-guard on `current_period_end`: Stripe returns `null` for some
 *     subscription-schedule and trial transitions; the previous code
 *     passed it directly into `new Date()` → `Date(NaN).toISOString()`
 *     threw, the webhook returned 500, Stripe retried forever AND the
 *     plan row was left in a partial state. Now we skip the timestamp
 *     and still apply the plan update.
 */

function toIsoOrNull(unixSeconds: unknown): string | null {
  if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds)) return null
  return new Date(unixSeconds * 1000).toISOString()
}

/** Stripe statuses under which the user keeps premium access. past_due is
 *  included on purpose: Stripe is still smart-retrying the charge (dunning)
 *  and yanking access mid-retry punishes a flaky card, not a deadbeat. */
const PREMIUM_STATUSES = new Set(['active', 'trialing', 'past_due'])

/** Clamp any Stripe subscription status into the set allowed by the
 *  subscriptions.status CHECK constraint (active|canceled|past_due|trialing).
 *  Without this, a status like 'unpaid'/'paused'/'incomplete_expired' makes
 *  the UPDATE violate the CHECK and fail silently — the row would stay
 *  'active' in our DB while Stripe considers the subscription dead. */
function clampStatus(s: string): 'active' | 'canceled' | 'past_due' | 'trialing' {
  if (s === 'active' || s === 'canceled' || s === 'past_due' || s === 'trialing') return s
  return 'canceled'
}

/**
 * Set users.plan to 'free' UNLESS an unexpired Annual Pass keeps the user
 * premium. Without this check, a subscriber who also bought a pass (or a
 * pass holder whose old subscription finally expires) would have their PAID
 * pass voided by the subscription downgrade — isPremiumActive() returns
 * false the moment plan='free', regardless of premium_until.
 */
async function downgradeRespectingPass(
  db: ReturnType<typeof createSupabaseAdmin>,
  internalUserId: string,
): Promise<void> {
  let hasActivePass = false
  const probe = await db
    .from('users').select('premium_until').eq('id', internalUserId).maybeSingle()
  if (!probe.error) {
    const pu = (probe.data as { premium_until?: string | null } | null)?.premium_until
    hasActivePass = !!pu && new Date(pu).getTime() > Date.now()
  }
  // 42703 (column not migrated) or lookup failure → no pass semantics → plain downgrade.
  const { error } = await db
    .from('users')
    .update({ plan: hasActivePass ? 'premium' : 'free' })
    .eq('id', internalUserId)
  if (error) console.warn('[webhook] downgrade update failed:', error)
}

/**
 * Grant a 1-year Annual Pass (one-time Multibanco/MB WAY/card purchase).
 * EXTENDS rather than resets: if the user already has a future premium_until,
 * we add a year on top of it (buying a 2nd pass stacks). `clerkUserId` is the
 * Clerk id carried in the checkout session metadata.
 *
 * Tolerates the premium_until column not being migrated yet — degrades to
 * granting `plan='premium'` (no expiry) and logs loudly so the admin runs the
 * migration. We never let a missing column make the webhook 500 (Stripe would
 * retry forever and the customer paid but got nothing).
 */
async function grantPass(
  db: ReturnType<typeof createSupabaseAdmin>,
  clerkUserId: string,
): Promise<void> {
  let internalId: string | null = null
  let currentMs  = 0

  const probe = await db
    .from('users').select('id, premium_until').eq('clerk_id', clerkUserId).maybeSingle()
  if (!probe.error) {
    internalId = (probe.data as { id?: string } | null)?.id ?? null
    const pu = (probe.data as { premium_until?: string | null } | null)?.premium_until
    currentMs = pu ? new Date(pu).getTime() : 0
  } else if (probe.error.code === '42703') {
    const fb = await db.from('users').select('id').eq('clerk_id', clerkUserId).maybeSingle()
    internalId = (fb.data as { id?: string } | null)?.id ?? null
  } else {
    console.warn('[webhook] grantPass lookup failed:', probe.error)
    return
  }

  if (!internalId) {
    console.warn('[webhook] grantPass: user not found for', clerkUserId)
    return
  }

  const YEAR_MS = 365 * 24 * 60 * 60 * 1000
  const until   = new Date(Math.max(Date.now(), currentMs) + YEAR_MS).toISOString()

  const upd = await db
    .from('users').update({ plan: 'premium', premium_until: until }).eq('id', internalId)
  if (upd.error?.code === '42703') {
    console.warn('[webhook] premium_until column missing — granted plan only. RUN database/premium_until_column_2026_06.sql')
    await db.from('users').update({ plan: 'premium' }).eq('id', internalId)
  } else if (upd.error) {
    console.warn('[webhook] grantPass update failed:', upd.error)
  }
}

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? '',
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  // ── Idempotency gate ────────────────────────────────────────────────
  // `INSERT ... ON CONFLICT DO NOTHING` and check rowcount via .select().
  // If the event was processed before, skip. If the `stripe_events`
  // table doesn't exist yet (pre-migration install), the insert fails
  // and we fall through to the switch — better to re-run an event than
  // to refuse the webhook entirely, which Stripe would interpret as a
  // dead endpoint.
  try {
    const { data: alreadySeen } = await db
      .from('stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle()
    if (alreadySeen) {
      return NextResponse.json({ received: true, idempotent: true })
    }
    await db.from('stripe_events').insert({
      event_id:   event.id,
      event_type: event.type,
    })
  } catch (err) {
    // Table may not exist yet — log and continue with best-effort processing.
    console.warn('[webhook] stripe_events idempotency skipped:', err)
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.userId
      if (!userId) break

      // One-time Annual Pass (mode:'payment'). Grant ONLY when actually paid:
      // Multibanco fires this event immediately with payment_status='unpaid'
      // (reference issued, not yet paid) — the grant happens later on
      // checkout.session.async_payment_succeeded. Card/MB WAY are 'paid' here.
      if (session.mode === 'payment') {
        if (session.payment_status === 'paid' && session.metadata?.kind === 'premium_pass') {
          await grantPass(db, userId)
        }
        break
      }

      const { data: user } = await db
        .from('users').select('id').eq('clerk_id', userId).maybeSingle()
      if (!user) break

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId      = subscription.items.data[0]?.price.id
      const plan         = getPlanFromPriceId(priceId)

      const periodEndIso = toIsoOrNull(subscription.current_period_end)

      // Build the row explicitly so we can OMIT current_period_end when it's
      // null, rather than writing a bogus "1970-01-01" sentinel.
      const row: Record<string, unknown> = {
        user_id:                user.id,
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: subscription.id,
        plan,
        status:                 clampStatus(subscription.status),
        cancel_at_period_end:   subscription.cancel_at_period_end,
        updated_at:             new Date().toISOString(),
      }
      if (periodEndIso) row.current_period_end = periodEndIso

      // onConflict user_id is LOAD-BEARING: the table has user_id UNIQUE and
      // the supabase-js default conflict target is the PK (id). On a
      // RE-subscription (cancel → subscribe again) the default turned this
      // into a plain insert that violated the user_id constraint — the error
      // was silently dropped, the new stripe_subscription_id was never
      // stored, and the eventual subscription.deleted couldn't find the row
      // → the user kept premium forever after cancelling.
      const upsertRes = await db
        .from('subscriptions')
        .upsert(row, { onConflict: 'user_id' })
      if (upsertRes.error) {
        console.warn('[webhook] subscriptions upsert failed:', upsertRes.error)
      }
      const planRes = await db.from('users').update({ plan }).eq('id', user.id)
      if (planRes.error) console.warn('[webhook] plan update failed:', planRes.error)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: sub } = await db
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle()
      if (!sub) break

      const priceId = subscription.items.data[0]?.price.id
      // Effective plan considers the STATUS, not just the price: a
      // subscription that went 'unpaid'/'paused'/'incomplete_expired' still
      // carries a premium price id, but access must end. (Previously the
      // price alone decided → an unpaid subscription stayed premium forever.)
      const planFromPrice = getPlanFromPriceId(priceId)
      const effectivePlan = PREMIUM_STATUSES.has(subscription.status) ? planFromPrice : 'free'

      const periodEndIso = toIsoOrNull(subscription.current_period_end)
      const patch: Record<string, unknown> = {
        plan:                 effectivePlan,
        status:               clampStatus(subscription.status),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at:           new Date().toISOString(),
      }
      if (periodEndIso) patch.current_period_end = periodEndIso

      const updRes = await db.from('subscriptions').update(patch)
        .eq('stripe_subscription_id', subscription.id)
      if (updRes.error) console.warn('[webhook] subscription patch failed:', updRes.error)

      if (effectivePlan === 'free') {
        await downgradeRespectingPass(db, sub.user_id)
      } else {
        const planRes = await db.from('users').update({ plan: effectivePlan }).eq('id', sub.user_id)
        if (planRes.error) console.warn('[webhook] plan update failed:', planRes.error)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: sub } = await db
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle()
      if (!sub) break

      const delRes = await db.from('subscriptions').update({
        plan:       'free',
        status:     'canceled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subscription.id)
      if (delRes.error) console.warn('[webhook] subscription cancel patch failed:', delRes.error)

      // Respects an unexpired Annual Pass — see downgradeRespectingPass.
      await downgradeRespectingPass(db, sub.user_id)
      break
    }

    // Multibanco confirma de forma assíncrona (24-72h após a referência ser
    // emitida). Este é o evento que concede o passe quando o pagamento entra.
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId  = session.metadata?.userId
      if (userId && session.metadata?.kind === 'premium_pass') {
        await grantPass(db, userId)
      }
      break
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session
      console.warn('[webhook] async pass payment failed:', session.id, session.metadata?.userId)
      break
    }

    default:
      // Eventos não tratados — ignorar silenciosamente
      break
  }

  return NextResponse.json({ received: true })
}
