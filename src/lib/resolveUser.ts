import { unstable_cache } from 'next/cache'
import { createSupabaseAdmin } from '@/lib/supabase'

/** Thrown inside the cached function so "not found" is NEVER cached
 *  (unstable_cache does not store results of a function that throws). */
class UserNotFoundError extends Error {
  constructor() {
    super('user not found')
    this.name = 'UserNotFoundError'
  }
}

/**
 * Resolves a Clerk user ID to the internal Supabase user ID.
 * Cached for 1 hour — user IDs never change after creation.
 * Call this instead of querying users table in every API route.
 *
 * Only HITS are cached. A miss (fresh user whose row is not created yet, or
 * a transient DB error) throws inside the cache and resolves to `null`
 * here, so the next call queries again — before October 2026 a `null` was
 * cached for 1 h and a just-onboarded user was "not found" for an hour.
 * The onboarding POST also revalidates the `user-id-<clerkId>` tag.
 */
export async function resolveUser(clerkId: string): Promise<string | null> {
  const cached = unstable_cache(
    async (): Promise<string> => {
      const db = createSupabaseAdmin()
      const { data, error } = await db
        .from('users')
        .select('id')
        .eq('clerk_id', clerkId)
        .maybeSingle()
      if (error) throw error
      const id = (data as { id?: string } | null)?.id
      if (!id) throw new UserNotFoundError()
      return id
    },
    [`user-id-${clerkId}`],
    { revalidate: 3600, tags: [`user-id-${clerkId}`] },
  )

  try {
    return await cached()
  } catch (e) {
    if (e instanceof UserNotFoundError || (e as { name?: string })?.name === 'UserNotFoundError') return null
    console.warn('[resolveUser] failed:', e)
    return null
  }
}
