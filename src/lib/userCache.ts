import { unstable_cache } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase'
import { fetchPlanRow, type PlanRow } from '@/lib/plan'

/**
 * Cached user profile lookup — shared between layout and all pages.
 * Cache key includes clerkId so each user has their own entry.
 * TTL: 5 minutes. Invalidate with revalidateTag('user-profile').
 *
 * Returns a resolved {@link PlanRow}: besides the raw `plan`, it exposes
 * `isPremium` (subscription OR an unexpired Annual Pass) so callers never have
 * to re-derive premium state — and it degrades gracefully when the
 * `premium_until` column hasn't been migrated yet (see fetchPlanRow).
 */
export const getUserProfile = (clerkId: string) =>
  unstable_cache(
    async (): Promise<PlanRow | null> => {
      const db = createSupabaseAdmin()
      return fetchPlanRow(db, 'clerk_id', clerkId)
    },
    [`user-profile-${clerkId}`],
    { revalidate: 300, tags: ['user-profile', `user-profile-${clerkId}`] },
  )()
