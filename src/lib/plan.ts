import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Single source of truth for "is this user Premium right now".
 *
 * Two ways to be Premium:
 *   - an active subscription → `users.plan = 'premium'` and `premium_until = NULL`
 *     (subscriptions don't expire here; the Stripe webhook flips plan to 'free'
 *     when they end)
 *   - a one-time Annual Pass → `users.plan = 'premium'` and `premium_until` set to
 *     a future date (Multibanco/MB WAY can't recur, so the pass is enforced here)
 *
 * `premium_until = NULL` therefore means "no expiry" (subscription), NOT "free".
 */
export function isPremiumActive(
  plan: string | null | undefined,
  premiumUntil: string | null | undefined,
): boolean {
  if (!plan || plan === 'free') return false
  if (!premiumUntil) return true
  return new Date(premiumUntil).getTime() > Date.now()
}

export interface PlanRow {
  id:                  string | null
  plan:                string
  onboarding_completed: boolean
  premiumUntil:        string | null
  /** Effective premium state (plan + expiry resolved). */
  isPremium:           boolean
}

/**
 * Read a user's plan fields by `clerk_id` or internal `id`, tolerant of the
 * `premium_until` column not existing yet.
 *
 * The Annual Pass migration (database/premium_until_column_2026_06.sql) is run
 * by hand in Supabase, so there's a window where the deployed code knows about
 * `premium_until` but the column is absent. Selecting a missing column makes
 * PostgREST return error 42703 (undefined_column) and the WHOLE query fails —
 * which on the dashboard layout would 500 the entire app. So we catch 42703 and
 * re-select without the column, treating premium_until as NULL (= behaviour
 * identical to today: subscription Premium still works, pass expiry just isn't
 * enforced until the migration lands).
 */
export async function fetchPlanRow(
  db: SupabaseClient,
  by: 'clerk_id' | 'id',
  value: string,
): Promise<PlanRow | null> {
  const withCol = await db
    .from('users')
    .select('id, plan, onboarding_completed, premium_until')
    .eq(by, value)
    .maybeSingle()

  if (!withCol.error) {
    return toPlanRow(withCol.data)
  }

  // 42703 = undefined_column → migration not applied yet. Degrade gracefully.
  if (withCol.error.code === '42703') {
    const noCol = await db
      .from('users')
      .select('id, plan, onboarding_completed')
      .eq(by, value)
      .maybeSingle()
    if (noCol.error) {
      console.warn('[plan] fetchPlanRow fallback failed:', noCol.error)
      return null
    }
    return toPlanRow(noCol.data)
  }

  console.warn('[plan] fetchPlanRow failed:', withCol.error)
  return null
}

function toPlanRow(data: Record<string, unknown> | null): PlanRow | null {
  if (!data) return null
  const plan         = (data.plan as string) ?? 'free'
  const premiumUntil = (data.premium_until as string | null | undefined) ?? null
  return {
    id:                   (data.id as string | null) ?? null,
    plan,
    onboarding_completed: Boolean(data.onboarding_completed),
    premiumUntil,
    isPremium:            isPremiumActive(plan, premiumUntil),
  }
}
