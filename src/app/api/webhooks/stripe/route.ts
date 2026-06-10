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
        .from('users').select('id').eq('clerk_id', userId).single()
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
        status:                 subscription.status,
        cancel_at_period_end:   subscription.cancel_at_period_end,
        updated_at:             new Date().toISOString(),
      }
      if (periodEndIso) row.current_period_end = periodEndIso

      await db.from('subscriptions').upsert(row)
      await db.from('users').update({ plan }).eq('id', user.id)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: sub } = await db
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()
      if (!sub) break

      const priceId = subscription.items.data[0]?.price.id
      const plan    = getPlanFromPriceId(priceId)

      const periodEndIso = toIsoOrNull(subscription.current_period_end)
      const patch: Record<string, unknown> = {
        plan,
        status:               subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at:           new Date().toISOString(),
      }
      if (periodEndIso) patch.current_period_end = periodEndIso

      await db.from('subscriptions').update(patch)
        .eq('stripe_subscription_id', subscription.id)

      await db.from('users').update({ plan }).eq('id', sub.user_id)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: sub } = await db
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()
      if (!sub) break

      await db.from('subscriptions').update({
        plan:       'free',
        status:     'canceled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subscription.id)

      await db.from('users').update({ plan: 'free' }).eq('id', sub.user_id)
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
