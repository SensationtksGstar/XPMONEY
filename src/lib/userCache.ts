import { unstable_cache } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase'

/**
 * Cached user profile lookup — shared between layout and all pages.
 * Cache key includes clerkId so each user has their own entry.
 * TTL: 5 minutes. Invalidate with revalidateTag('user-profile').
 */
export const getUserProfile = (clerkId: string) =>
  unstable_cache(
    async () => {
      const db = createSupabaseAdmin()
      const { data } = await db
        .from('users')
        .select('id, plan, onboarding_completed')
        .eq('clerk_id', clerkId)
        .single()
      return data
    },
    [`user-profile-${clerkId}`],
    { revalidate: 300, tags: ['user-profile', `user-profile-${clerkId}`] },
  )()
