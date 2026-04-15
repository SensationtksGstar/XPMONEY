import { unstable_cache } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase'

/**
 * Resolves a Clerk user ID to the internal Supabase user ID.
 * Cached for 1 hour — user IDs never change after creation.
 * Call this instead of querying users table in every API route.
 */
export async function resolveUser(clerkId: string): Promise<string | null> {
  return unstable_cache(
    async () => {
      const db = createSupabaseAdmin()
      const { data } = await db
        .from('users')
        .select('id')
        .eq('clerk_id', clerkId)
        .single()
      return data?.id ?? null
    },
    [`user-id-${clerkId}`],
    { revalidate: 3600, tags: [`user-id-${clerkId}`] },
  )()
}
