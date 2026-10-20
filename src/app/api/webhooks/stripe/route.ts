import { NextRequest, NextResponse, after } from 'next/server'
import { revalidateTag }             from 'next/cache'
import { stripe, getPlanFromPriceId } from '@/lib/stripe'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { notifyAdmin, escapeHtml }     from '@/lib/email'
import Stripe                          from 'stripe'

/**
 * Stripe webhook. Hardened April 2026, reworked October 2026:
 *
 *   - Signature verification via `stripe.webhooks.constructEvent` (Stripe
 *     SDK, timing-safe, unchanged).
 *   - Idempotency = RESERVE → PROCESS → RELEASE ON FAILURE. The `event.id`
 *     is inserted into `stripe_events` (see database/stripe_events_2026_04.sql)
 *     as an atomic reservation (UNIQUE → 23505 on a duplicate delivery). If
 *     processing throws, the reservation is DELETED and we answer 500, so
 *     Stripe's retry processes the event again. Before this, the event was
 *     recorded BEFORE processing and DB errors were only console.warn'd →
 *     a failed grant was retried by Stripe, short-circuited as "idempotent",
 *     and the customer paid without ever getting Premium.
 *   - Every Supabase write that decides access (plan, premium_until,
 *     subscriptions row) THROWS on error instead of warning.
 *   - After every write to users.plan / premium_until the cached profile
 *     (`user-profile-<clerkId>`, src/lib/userCache.ts) is revalidated, so the
 *     user sees Premium right after paying instead of up to 5 min later.
 *   - Null-guard on `current_period_end`: Stripe returns `null` for some
 *     subscription-schedule and trial transitions; we skip the timestamp
 *     and still apply the plan update.
 *   - HARD DEADLINE: handle() runs under a 20 s deadline (vercel.json gives
 *     this function maxDuration 30 s). If the lambda were killed by
 *     maxDuration, the catch would never run, the reservation would stay
 *     forever and every Stripe retry would be answered "idempotent" — the
 *     exact "paid, never got Premium" failure this design removes. On
 *     deadline: abort → checkpoints refuse any further write → release →
 *     500 → Stripe retries. Stripe API calls get their own 8 s timeout (the
 *     SDK default is 80 s, longer than the function itself).
 */

type Db = ReturnType<typeof createSupabaseAdmin>

/** Must stay comfortably below maxDuration in vercel.json (30 s), leaving
 *  room for the release DELETE + response. */
const HANDLE_DEADLINE_MS = 20_000
/** Per-request Stripe options: worst case ~2×8 s, still inside the deadline. */
const STRIPE_CALL_OPTS: Stripe.RequestOptions = { timeout: 8_000, maxNetworkRetries: 1 }
/** Budget for releasing the reservation after a failure. */
const RELEASE_TIMEOUT_MS = 5_000

class DeadlineError extends Error {}

/** Refuse to start a new write once the deadline fired: the response has
 *  already released the reservation, so a late write would race the retry
 *  (and a late grantPass would stack a second year on the retry's grant). */
function checkpoint(signal: AbortSignal, what: string): void {
  if (signal.aborted) throw new DeadlineError(`[webhook] deadline exceeded before ${what}`)
}

/** Email the admin outside the response path (after() keeps the lambda alive
 *  for the send). Every interpolated value must already be escaped. */
function alertAdmin(subject: string, html: string): void {
  after(async () => {
    const res = await notifyAdmin({ subject, html })
    if (!res.ok) console.warn('[webhook] admin alert not sent:', res.reason)
  })
}

/** A payment that we could not attach to any user: answering 500 would not
 *  help (retries don't create the user and sustained 500s get the endpoint
 *  disabled), so we answer 200 — but it MUST reach a human, who grants the
 *  access by hand. */
function alertUnmatchedPayment(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  what: string,
): void {
  const md = session.metadata ?? {}
  const rows: Array<[string, string]> = [
    ['O que', what],
    ['event.id', event.id],
    ['event.type', event.type],
    ['session.id', session.id],
    ['customer', typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? '—')],
    ['metadata.internalUserId', md.internalUserId ?? '—'],
    ['metadata.userId (Clerk)', md.userId ?? '—'],
    ['metadata.kind', md.kind ?? '—'],
  ]
  const html =
    '<p><strong>Pagamento recebido sem utilizador correspondente.</strong> ' +
    'O webhook respondeu 200 (não há retry). Concede o acesso manualmente.</p><ul>' +
    rows.map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</li>`).join('') +
    '</ul>'
  alertAdmin('[XP-Money] Webhook Stripe: pagamento sem utilizador', html)
}

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
 *  the UPDATE violate the CHECK and fail — the row would stay 'active' in
 *  our DB while Stripe considers the subscription dead. */
function clampStatus(s: string): 'active' | 'canceled' | 'past_due' | 'trialing' {
  if (s === 'active' || s === 'canceled' || s === 'past_due' || s === 'trialing') return s
  return 'canceled'
}

/** PostgREST / Postgres codes meaning "stripe_events table not migrated". */
function isMissingTable(code: string | undefined): boolean {
  return code === '42P01' || code === 'PGRST205'
}

/** Invalidate the cached profile (plan/isPremium) for one Clerk user. */
function revalidateProfile(clerkId: string | null | undefined): void {
  if (!clerkId) {
    console.warn('[webhook] profile cache not revalidated: clerk id unknown')
    return
  }
  revalidateTag(`user-profile-${clerkId}`)
}

/** Look up the Clerk id of an internal user (for cache revalidation). */
async function clerkIdFor(db: Db, internalUserId: string): Promise<string | null> {
  const { data, error } = await db
    .from('users').select('clerk_id').eq('id', internalUserId).maybeSingle()
  if (error) {
    console.warn('[webhook] clerk_id lookup failed:', error)
    return null
  }
  return (data as { clerk_id?: string } | null)?.clerk_id ?? null
}

/**
 * Resolve the user a checkout session belongs to. Prefers the internal
 * Supabase id (`metadata.internalUserId`, written since October 2026) and
 * falls back to the Clerk id (`metadata.userId`) for older sessions. The
 * internal id survives a Clerk instance migration (new clerk_ids); the Clerk
 * id does not.
 */
async function resolveSessionUser(
  db: Db,
  metadata: Stripe.Metadata | null | undefined,
): Promise<{ id: string; clerkId: string | null } | null> {
  const internalId = metadata?.internalUserId
  const clerkId    = metadata?.userId
  if (internalId) {
    const { data, error } = await db
      .from('users').select('id, clerk_id').eq('id', internalId).maybeSingle()
    if (error) throw new Error('[webhook] user lookup (internal id): ' + error.message)
    const row = data as { id: string; clerk_id: string | null } | null
    if (row) return { id: row.id, clerkId: row.clerk_id ?? clerkId ?? null }
  }
  if (clerkId) {
    const { data, error } = await db
      .from('users').select('id').eq('clerk_id', clerkId).maybeSingle()
    if (error) throw new Error('[webhook] user lookup (clerk id): ' + error.message)
    const row = data as { id: string } | null
    if (row) return { id: row.id, clerkId }
  }
  return null
}

/**
 * Set users.plan to 'free' UNLESS an unexpired Annual Pass keeps the user
 * premium. Without this check, a subscriber who also bought a pass (or a
 * pass holder whose old subscription finally expires) would have their PAID
 * pass voided by the subscription downgrade — isPremiumActive() returns
 * false the moment plan='free', regardless of premium_until.
 */
async function downgradeRespectingPass(db: Db, internalUserId: string, signal: AbortSignal): Promise<void> {
  let hasActivePass = false
  const probe = await db
    .from('users').select('premium_until').eq('id', internalUserId).maybeSingle()
  if (!probe.error) {
    const pu = (probe.data as { premium_until?: string | null } | null)?.premium_until
    hasActivePass = !!pu && new Date(pu).getTime() > Date.now()
  } else if (probe.error.code !== '42703') {
    // Unknown lookup failure: do NOT guess (a wrong 'free' voids a paid
    // pass) — throw so the event is released and Stripe retries.
    throw new Error('[webhook] downgrade pass probe: ' + probe.error.message)
  }
  // 42703 (column not migrated) → no pass semantics → plain downgrade.
  checkpoint(signal, 'downgrade update')
  const { error } = await db
    .from('users')
    .update({ plan: hasActivePass ? 'premium' : 'free' })
    .eq('id', internalUserId)
  if (error) throw new Error('[webhook] downgrade update: ' + error.message)
}

/**
 * Grant a 1-year Annual Pass (one-time Multibanco/MB WAY/card purchase).
 * EXTENDS rather than resets: if the user already has a future premium_until,
 * we add a year on top of it (buying a 2nd pass stacks).
 *
 * Tolerates the premium_until column not being migrated yet — degrades to
 * granting `plan='premium'` (no expiry) and logs loudly so the admin runs the
 * migration.
 */
async function grantPass(
  db: Db,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  signal: AbortSignal,
): Promise<void> {
  const metadata = session.metadata
  const user = await resolveSessionUser(db, metadata)
  if (!user) {
    // Not a transient failure — retrying for 3 days would not create the
    // user and sustained 500s get the whole endpoint auto-disabled by Stripe.
    // 200 + loud log + admin email (paid pass, no grant → manual fix).
    console.error('[webhook] grantPass: user not found for', metadata?.internalUserId ?? metadata?.userId, 'session', session.id, 'event', event.id)
    alertUnmatchedPayment(event, session, 'Passe Anual pago')
    return
  }

  let currentMs = 0
  const probe = await db
    .from('users').select('premium_until').eq('id', user.id).maybeSingle()
  if (!probe.error) {
    const pu = (probe.data as { premium_until?: string | null } | null)?.premium_until
    currentMs = pu ? new Date(pu).getTime() : 0
  } else if (probe.error.code !== '42703') {
    throw new Error('[webhook] grantPass lookup: ' + probe.error.message)
  }

  const YEAR_MS = 365 * 24 * 60 * 60 * 1000
  const until   = new Date(Math.max(Date.now(), currentMs) + YEAR_MS).toISOString()

  checkpoint(signal, 'grantPass update')
  const upd = await db
    .from('users').update({ plan: 'premium', premium_until: until }).eq('id', user.id)
  if (upd.error?.code === '42703') {
    console.warn('[webhook] premium_until column missing — granted plan only. RUN database/premium_until_column_2026_06.sql')
    checkpoint(signal, 'grantPass plan-only update')
    const fb = await db.from('users').update({ plan: 'premium' }).eq('id', user.id)
    if (fb.error) throw new Error('[webhook] grantPass plan-only update: ' + fb.error.message)
  } else if (upd.error) {
    throw new Error('[webhook] grantPass update: ' + upd.error.message)
  }
  revalidateProfile(user.clerkId)
}

/** Process one verified event. THROWS on any failure that must be retried. */
async function handle(event: Stripe.Event, db: Db, signal: AbortSignal): Promise<void> {
  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (!session.metadata?.userId && !session.metadata?.internalUserId) return

      // One-time Annual Pass (mode:'payment'). Grant ONLY when actually paid:
      // Multibanco fires this event immediately with payment_status='unpaid'
      // (reference issued, not yet paid) — the grant happens later on
      // checkout.session.async_payment_succeeded. Card/MB WAY are 'paid' here.
      if (session.mode === 'payment') {
        if (session.payment_status === 'paid' && session.metadata?.kind === 'premium_pass') {
          await grantPass(db, event, session, signal)
        }
        return
      }

      const user = await resolveSessionUser(db, session.metadata)
      if (!user) {
        // 200 (see grantPass) — but a paying subscriber without access must
        // reach a human, not just the logs.
        console.error('[webhook] checkout: user not found for', session.metadata?.internalUserId ?? session.metadata?.userId, 'session', session.id, 'event', event.id)
        alertUnmatchedPayment(event, session, 'Subscrição Premium (checkout concluído)')
        return
      }

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string, {}, STRIPE_CALL_OPTS,
      )
      const priceId      = subscription.items.data[0]?.price.id
      // Effective plan gates on the subscription STATUS, not just the price
      // (same rule as customer.subscription.updated). This event can now be
      // re-processed days later (release-on-failure → Stripe retries for up
      // to 3 days); if the subscription was meanwhile canceled/unpaid and
      // subscription.deleted already ran, writing plan-from-price here would
      // resurrect Premium forever.
      const planFromPrice = getPlanFromPriceId(priceId)
      const plan          = PREMIUM_STATUSES.has(subscription.status) ? planFromPrice : 'free'

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
      // into a plain insert that violated the user_id constraint — the new
      // stripe_subscription_id was never stored, and the eventual
      // subscription.deleted couldn't find the row → premium forever.
      checkpoint(signal, 'subscriptions upsert')
      const upsertRes = await db
        .from('subscriptions')
        .upsert(row, { onConflict: 'user_id' })
      if (upsertRes.error) throw new Error('[webhook] subscriptions upsert: ' + upsertRes.error.message)

      if (plan === 'free') {
        // Respects an unexpired Annual Pass — see downgradeRespectingPass.
        await downgradeRespectingPass(db, user.id, signal)
      } else {
        checkpoint(signal, 'plan update')
        const planRes = await db.from('users').update({ plan }).eq('id', user.id)
        if (planRes.error) throw new Error('[webhook] plan update: ' + planRes.error.message)
      }
      revalidateProfile(user.clerkId)
      return
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: sub, error: subErr } = await db
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle()
      if (subErr) throw new Error('[webhook] subscription lookup: ' + subErr.message)
      if (!sub) return

      const priceId = subscription.items.data[0]?.price.id
      // Effective plan considers the STATUS, not just the price: a
      // subscription that went 'unpaid'/'paused'/'incomplete_expired' still
      // carries a premium price id, but access must end.
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

      checkpoint(signal, 'subscription patch')
      const updRes = await db.from('subscriptions').update(patch)
        .eq('stripe_subscription_id', subscription.id)
      if (updRes.error) throw new Error('[webhook] subscription patch: ' + updRes.error.message)

      if (effectivePlan === 'free') {
        await downgradeRespectingPass(db, sub.user_id, signal)
      } else {
        checkpoint(signal, 'plan update')
        const planRes = await db.from('users').update({ plan: effectivePlan }).eq('id', sub.user_id)
        if (planRes.error) throw new Error('[webhook] plan update: ' + planRes.error.message)
      }
      revalidateProfile(await clerkIdFor(db, sub.user_id))
      return
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const { data: sub, error: subErr } = await db
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle()
      if (subErr) throw new Error('[webhook] subscription lookup: ' + subErr.message)
      if (!sub) return

      checkpoint(signal, 'subscription cancel patch')
      const delRes = await db.from('subscriptions').update({
        plan:       'free',
        status:     'canceled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subscription.id)
      if (delRes.error) throw new Error('[webhook] subscription cancel patch: ' + delRes.error.message)

      // Respects an unexpired Annual Pass — see downgradeRespectingPass.
      await downgradeRespectingPass(db, sub.user_id, signal)
      revalidateProfile(await clerkIdFor(db, sub.user_id))
      return
    }

    // Multibanco confirma de forma assíncrona (24-72h após a referência ser
    // emitida). Este é o evento que concede o passe quando o pagamento entra.
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session
      if ((session.metadata?.userId || session.metadata?.internalUserId)
          && session.metadata?.kind === 'premium_pass') {
        await grantPass(db, event, session, signal)
      }
      return
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session
      console.warn('[webhook] async pass payment failed:', session.id, session.metadata?.userId)
      return
    }

    default:
      // Eventos não tratados — ignorados de propósito (refund/dispute: fora
      // de âmbito nesta ronda).
      return
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

  // ── Idempotency reservation ─────────────────────────────────────────
  // Atomic: the INSERT either reserves the event or hits the UNIQUE
  // (23505 → already processed or in flight → 200). A missing table
  // (pre-migration install) degrades to processing without dedupe — better
  // to re-run an event than to refuse the webhook, which Stripe would read
  // as a dead endpoint.
  let reserved = false
  const { error: insErr } = await db.from('stripe_events').insert({
    event_id:   event.id,
    event_type: event.type,
  })
  if (!insErr) {
    reserved = true
  } else if (insErr.code === '23505') {
    return NextResponse.json({ received: true, idempotent: true })
  } else if (isMissingTable(insErr.code)) {
    console.warn('[webhook] stripe_events table missing — processing without dedupe. RUN database/stripe_events_2026_04.sql')
  } else {
    console.error('[webhook] stripe_events reservation failed — processing without dedupe:', insErr)
  }

  // ── Process under a hard deadline ───────────────────────────────────
  // The race guarantees we reach the catch (and release the reservation)
  // long before vercel.json's maxDuration kills the lambda. The abort also
  // trips every checkpoint() so a straggling handle() cannot start a write
  // after we answered 500.
  const ac    = new AbortController()
  const timer = setTimeout(() => ac.abort(), HANDLE_DEADLINE_MS)
  const deadline = new Promise<never>((_, reject) => {
    ac.signal.addEventListener('abort', () => {
      reject(new DeadlineError(`[webhook] handle() exceeded ${HANDLE_DEADLINE_MS} ms`))
    }, { once: true })
  })

  try {
    await Promise.race([handle(event, db, ac.signal), deadline])
  } catch (err) {
    ac.abort() // stop a straggler on any failure path, not only the deadline
    if (reserved) {
      let relErr: unknown = null
      try {
        const res = await db.from('stripe_events').delete()
          .eq('event_id', event.id)
          .abortSignal(AbortSignal.timeout(RELEASE_TIMEOUT_MS))
        relErr = res.error
      } catch (e) {
        relErr = e
      }
      if (relErr) {
        // The reservation is stuck → every Stripe retry will be answered
        // "idempotent". Only a human can recover this event now.
        console.error('[webhook] failed to release event reservation', event.id, relErr)
        alertAdmin(
          '[XP-Money] Webhook Stripe: evento preso em stripe_events',
          '<p>O processamento falhou e a reserva <strong>não</strong> foi libertada — os retries do Stripe vão ser ignorados.</p>' +
          `<ul><li><strong>event.id:</strong> ${escapeHtml(event.id)}</li>` +
          `<li><strong>event.type:</strong> ${escapeHtml(event.type)}</li></ul>` +
          '<p>Apaga a linha em <code>stripe_events</code> e reenvia o evento no Stripe Dashboard (Workbench → Events → Resend).</p>',
        )
      }
    }
    console.error('[webhook] processing failed', event.id, event.type, err)
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  } finally {
    clearTimeout(timer)
  }

  return NextResponse.json({ received: true })
}
