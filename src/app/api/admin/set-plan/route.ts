import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { revalidateTag }             from 'next/cache'

// POST /api/admin/set-plan
// Header: x-setup-secret: XPMONEY_SETUP
// Body: { "plan": "pro" }   OR   { "plan": "pro", "all": true }
// Sets plan for current user (or all users if all:true)

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-setup-secret')
  if (secret !== 'XPMONEY_SETUP') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { plan, all } = await req.json()
  const validPlans = ['free', 'plus', 'pro', 'family']
  if (!validPlans.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  if (all) {
    // Update ALL users
    const { error, data: updated } = await db
      .from('users')
      .update({ plan })
      .neq('id', '00000000-0000-0000-0000-000000000000') // match all rows
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Invalidate entire user-profile cache
    revalidateTag('user-profile')
    return NextResponse.json({ success: true, plan, updated: updated?.length ?? 0 })
  }

  // Single user
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await db
    .from('users')
    .update({ plan })
    .eq('clerk_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Invalidate this user's cache
  revalidateTag(`user-profile-${userId}`)

  return NextResponse.json({ success: true, plan })
}
