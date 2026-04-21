import { auth }                from '@clerk/nextjs/server'
import { NextResponse }          from 'next/server'
import { createSupabaseAdmin }   from '@/lib/supabase'
import { checkAllBadges }        from '@/lib/checkAllBadges'

/**
 * Thin HTTP wrapper around `checkAllBadges()`. Clients call this when
 * opening the Conquistas page to re-evaluate the user's full state. The
 * same helper is invoked directly (no HTTP hop) from mutation endpoints
 * like /api/debts/[id]/attack, /api/courses/[id]/complete and
 * /api/goals/[id]/deposits, so a freshly-killed debt or finished course
 * reveals its badge immediately without waiting for the next page open.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()

  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('clerk_id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const awarded = await checkAllBadges(db, user.id)

  return NextResponse.json({
    badges_awarded: awarded,
    count:          awarded.length,
  })
}
