import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { revalidateTag }             from 'next/cache'

/**
 * POST /api/admin/set-plan
 *
 * Dev-only helper for escalating the current user's plan during local testing
 * (e.g. to exercise gated Pro features without going through Stripe).
 *
 * Security:
 *   - Hard-refused in production (NODE_ENV === 'production').
 *   - Requires a logged-in Clerk session — only updates the caller's row.
 *   - The previous `x-setup-secret` header + `{ all: true }` broadcast path
 *     is removed; it was a plan-escalation hole if the hard-coded secret
 *     ever leaked.
 *
 * Body: { "plan": "free" | "plus" | "pro" | "family" }
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production.' }, { status: 403 })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { plan?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const validPlans = ['free', 'plus', 'pro', 'family'] as const
  const plan = body.plan
  if (typeof plan !== 'string' || !validPlans.includes(plan as typeof validPlans[number])) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const db = createSupabaseAdmin()
  const { error } = await db
    .from('users')
    .update({ plan })
    .eq('clerk_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag(`user-profile-${userId}`)
  return NextResponse.json({ success: true, plan })
}
