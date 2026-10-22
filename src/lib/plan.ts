import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Single source of truth for "is this user Premium right now".
 *
 * Three ways to be Premium (any one is enough):
 *   - an active subscription → `users.plan = 'premium'` and `premium_until = NULL`
 *     (subscriptions don't expire here; the Stripe webhook flips plan to 'free'
 *     when they end)
 *   - a one-time Annual Pass → `users.plan = 'premium'` and `premium_until` set to
 *     a future date (Multibanco/MB WAY can't recur, so the pass is enforced here)
 *   - a live Stripe subscription row (`subscriptions.status` in
 *     PREMIUM_SUB_STATUSES, with a real `stripe_subscription_id`) — checked
 *     INDEPENDENTLY of `users.plan`/`premium_until`. Without this, a user whose
 *     Annual Pass had expired (premium_until in the past) and who then
 *     subscribed kept paying and stayed Free: the subscription webhook only
 *     writes `plan`, never clears `premium_until` (Oct 2026 audit, sec-3).
 *
 * `premium_until = NULL` therefore means "no expiry" (subscription), NOT "free".
 *
 * Everything above the `fetchPlanRow` section is PURE (no runtime imports) so
 * `node --experimental-strip-types scripts/check-plan.mjs` can import this
 * file directly. Keep it that way: only `import type` at the top.
 */

/** Stripe statuses under which a subscription keeps premium access. Mirrors
 *  PREMIUM_STATUSES in the Stripe webhook (past_due included on purpose:
 *  Stripe is still dunning, yanking access mid-retry punishes a flaky card). */
export const PREMIUM_SUB_STATUSES: readonly string[] = ['active', 'trialing', 'past_due']

/** How long past `current_period_end` a "live" row may still count. A real
 *  live subscription gets its period end pushed forward by every renewal
 *  (customer.subscription.updated); a row whose period ended more than this
 *  ago is a missed customer.subscription.deleted (e.g. while the original
 *  webhook endpoint was auto-disabled) and must NOT keep Premium forever. */
export const SUB_PERIOD_GRACE_MS = 7 * 24 * 60 * 60 * 1000

/** The slice of a `subscriptions` row the plan decision needs. */
export interface SubscriptionSnapshot {
  status?:                 string | null
  plan?:                   string | null
  stripe_subscription_id?: string | null
  current_period_end?:     string | null
}

/**
 * Plan + pass only (no subscription table). Kept with its original contract:
 * `/api/import-statement` and older call sites use it directly.
 * `now` is injectable for the golden-case script; production omits it.
 */
export function isPremiumActive(
  plan: string | null | undefined,
  premiumUntil: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!plan || plan === 'free') return false
  if (!premiumUntil) return true
  const until = new Date(premiumUntil).getTime()
  // Unparseable date → treat as expired (fail closed, like a past date).
  if (!Number.isFinite(until)) return false
  return until > now
}

/**
 * Does this subscriptions row grant Premium on its own?
 *
 *   - status must be active/trialing/past_due (the webhook clamps every other
 *     Stripe status to 'canceled');
 *   - `stripe_subscription_id` must be set — `/api/billing/portal` backfills
 *     rows with `status:'active'` and only a customer id when the webhook was
 *     missed; those are NOT proof of a live subscription;
 *   - `plan` must not be 'free' — the webhook writes 'free' when the price is
 *     unknown or the status isn't premium (legacy plus/pro/family count);
 *   - when `current_period_end` is known, it must not be more than
 *     SUB_PERIOD_GRACE_MS in the past (stale row = missed deletion event).
 *     NULL/absent = unknown → not used (the webhook omits it when Stripe
 *     sends null). Unparseable → fail closed, like isPremiumActive.
 */
export function isSubscriptionPremium(
  sub: SubscriptionSnapshot | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!sub) return false
  if (!sub.stripe_subscription_id) return false
  if (!sub.status || !PREMIUM_SUB_STATUSES.includes(sub.status)) return false
  if ((sub.plan ?? 'free') === 'free') return false
  if (sub.current_period_end) {
    const end = new Date(sub.current_period_end).getTime()
    if (!Number.isFinite(end)) return false
    if (end + SUB_PERIOD_GRACE_MS < now) return false
  }
  return true
}

/**
 * PostgREST embeds a 1:1 relation (subscriptions.user_id is UNIQUE) as an
 * object, but older versions / schema-cache states return an array. Accept
 * both, plus null. With several rows (shouldn't happen — user_id is UNIQUE)
 * the premium one wins.
 */
export function pickSubscription(raw: unknown, now: number = Date.now()): SubscriptionSnapshot | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const rows = raw.filter((r): r is SubscriptionSnapshot => !!r && typeof r === 'object')
    return rows.find(r => isSubscriptionPremium(r, now)) ?? rows[0] ?? null
  }
  if (typeof raw === 'object') return raw as SubscriptionSnapshot
  return null
}

export interface PremiumDecision {
  /** Effective premium state — the ONLY value plan gates may use. */
  isPremium:             boolean
  /** An Annual Pass with a future premium_until is running. */
  passActive:            boolean
  /** A live Stripe subscription grants Premium (manage it via the Portal). */
  hasActiveSubscription: boolean
}

/** Pure decision: plan/pass OR live subscription. */
export function resolvePremium(input: {
  plan:          string | null | undefined
  premiumUntil:  string | null | undefined
  subscription?: SubscriptionSnapshot | null
  now?:          number
}): PremiumDecision {
  const now                   = input.now ?? Date.now()
  const planActive            = isPremiumActive(input.plan, input.premiumUntil, now)
  const hasActiveSubscription = isSubscriptionPremium(input.subscription, now)
  const passActive            = !!input.premiumUntil && planActive
  return {
    isPremium: planActive || hasActiveSubscription,
    passActive,
    hasActiveSubscription,
  }
}

/** Codes meaning "the subscriptions embed can't be resolved" (table or FK
 *  absent from the PostgREST schema cache). */
function isEmbedError(code: string | undefined): boolean {
  return code === 'PGRST200' || code === 'PGRST201' || code === 'PGRST205' || code === '42P01'
}

export type PlanQueryFallback = 'drop_premium_until' | 'drop_embed' | 'fail'

/**
 * Which piece of the select to drop after an error (pure — golden-cased).
 *
 * A 42703 (undefined_column) is blamed on `premium_until` ONLY when the error
 * text names it. Any other 42703 while the embed is still in the select is an
 * embed column (status/plan/stripe_subscription_id/current_period_end) → drop
 * the embed and KEEP premium_until. Blaming every 42703 on premium_until
 * failed OPEN: the column got dropped, read as NULL = "no expiry", and every
 * expired pass became Premium forever. Once the embed is gone the only
 * optional column left is premium_until, so a 42703 there can only be it.
 */
export function planQueryFallback(
  err: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null },
  state: { withPremiumUntil: boolean; withSubEmbed: boolean },
): PlanQueryFallback {
  const code = err.code ?? undefined
  if (code === '42703') {
    const text = `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`
    if (state.withPremiumUntil && text.includes('premium_until')) return 'drop_premium_until'
    if (state.withSubEmbed)     return 'drop_embed'
    if (state.withPremiumUntil) return 'drop_premium_until'
    return 'fail'
  }
  if (isEmbedError(code) && state.withSubEmbed) return 'drop_embed'
  return 'fail'
}

// ─── IO ─────────────────────────────────────────────────────────────────────

export interface PlanRow {
  id:                  string | null
  plan:                string
  onboarding_completed: boolean
  premiumUntil:        string | null
  /** Effective premium state (plan + pass expiry + live subscription). */
  isPremium:           boolean
  /** Annual Pass with a future premium_until. */
  passActive:          boolean
  /** Live Stripe subscription (status active/trialing/past_due). */
  hasActiveSubscription: boolean
}

/** Columns of `subscriptions` the decision reads — also used by the checkout
 *  guard and manual-downgrade so all three judge a row the same way. */
export const SUB_SNAPSHOT_COLS = 'status, plan, stripe_subscription_id, current_period_end'
const SUB_EMBED = `subscriptions(${SUB_SNAPSHOT_COLS})`

/**
 * Read a user's plan fields by `clerk_id` or internal `id`, plus their
 * subscription status (embedded, same round trip), tolerant of schema drift.
 *
 * The Annual Pass migration (database/premium_until_column_2026_06.sql) is run
 * by hand in Supabase, so there's a window where the deployed code knows about
 * `premium_until` but the column is absent. Selecting a missing column makes
 * PostgREST return error 42703 (undefined_column) and the WHOLE query fails —
 * which on the dashboard layout would 500 the entire app (or, since a null
 * here redirects to /onboarding, loop the user out). So the select degrades
 * step by step (see planQueryFallback): drop `premium_until` on a 42703 that
 * names it (treated as NULL = no expiry), drop the subscriptions embed when
 * PostgREST can't resolve it or one of its columns is missing (plan/pass
 * logic alone, i.e. the pre-Oct-2026 behaviour). Only a failure of the
 * minimal select returns null.
 */
export async function fetchPlanRow(
  db: SupabaseClient,
  by: 'clerk_id' | 'id',
  value: string,
): Promise<PlanRow | null> {
  let withPremiumUntil = true
  let withSubEmbed     = true

  // At most 3 attempts: full → drop one piece → minimal.
  for (let attempt = 0; attempt < 3; attempt++) {
    const cols = ['id', 'plan', 'onboarding_completed']
    if (withPremiumUntil) cols.push('premium_until')
    if (withSubEmbed)     cols.push(SUB_EMBED)

    const res = await db
      .from('users')
      .select(cols.join(', '))
      .eq(by, value)
      .maybeSingle()

    if (!res.error) {
      return toPlanRow(res.data as unknown as Record<string, unknown> | null)
    }

    // 42703 naming premium_until → pass migration not applied yet; other
    // 42703 / PGRST2xx / 42P01 → the subscriptions embed can't be resolved.
    const step = planQueryFallback(res.error, { withPremiumUntil, withSubEmbed })
    if (step === 'drop_premium_until') {
      withPremiumUntil = false
      continue
    }
    if (step === 'drop_embed') {
      console.warn('[plan] subscriptions embed unavailable — plan/pass only:', res.error)
      withSubEmbed = false
      continue
    }

    console.warn('[plan] fetchPlanRow failed:', res.error)
    return null
  }

  console.warn('[plan] fetchPlanRow: exhausted fallbacks for', by)
  return null
}

function toPlanRow(data: Record<string, unknown> | null): PlanRow | null {
  if (!data) return null
  const plan         = (data.plan as string) ?? 'free'
  const premiumUntil = (data.premium_until as string | null | undefined) ?? null
  const now          = Date.now()
  const decision     = resolvePremium({
    plan,
    premiumUntil,
    subscription: pickSubscription(data.subscriptions, now),
    now,
  })
  return {
    id:                    (data.id as string | null) ?? null,
    plan,
    onboarding_completed:  Boolean(data.onboarding_completed),
    premiumUntil,
    isPremium:             decision.isPremium,
    passActive:            decision.passActive,
    hasActiveSubscription: decision.hasActiveSubscription,
  }
}
