import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { awardXP }                   from '@/lib/awardXP'
import { XP_REWARDS }                from '@/types'
import { z }                         from 'zod'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'
import { DEMO_GOALS }                from '@/lib/demo/mockData'
import { getServerLocale }           from '@/lib/i18n/server'

const GoalSchema = z.object({
  name:          z.string().min(1),
  icon:          z.string().default('🎯'),
  target_amount: z.number().positive(),
  deadline:      z.string().nullable().optional(),
})

// Free plan: max 2 active savings goals. Completed goals don't count —
// finishing one frees a slot, which matches user expectation ("I poupei
// para férias, agora quero outro objetivo"). Existing free users who
// already have 3+ active goals keep them; this gate only blocks the
// next creation. Premium (and legacy plus/pro/family) is unlimited.
const FREE_GOAL_LIMIT = 2
const PAID_PLANS = new Set(['premium', 'plus', 'pro', 'family'])

export async function GET() {
  if (isDemoMode()) return demoResponse(DEMO_GOALS)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: [], error: null })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('goals').select('*').eq('user_id', internalId).order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], error: null })
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) return demoResponse(DEMO_GOALS[0], 201)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = GoalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // Free-plan gate: count active goals and refuse if at the limit. Marketing
  // copy promises "2 savings goals" for Free / unlimited for Premium —
  // before this gate the API didn't enforce it and free users could create
  // goals indefinitely (mismatch flagged April 2026 audit).
  const { data: planRow } = await db
    .from('users').select('plan').eq('id', internalId).maybeSingle()
  const isPaid = PAID_PLANS.has(planRow?.plan ?? 'free')
  if (!isPaid) {
    const { count: activeCount } = await db
      .from('goals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalId)
      .eq('status', 'active')
    if ((activeCount ?? 0) >= FREE_GOAL_LIMIT) {
      const locale = await getServerLocale()
      return NextResponse.json(
        {
          error: locale === 'en'
            ? `Free plan is limited to ${FREE_GOAL_LIMIT} active savings goals. Complete one or upgrade to Premium for unlimited goals.`
            : `O plano Grátis permite até ${FREE_GOAL_LIMIT} objetivos ativos. Conclui um existente ou faz upgrade para Premium para objetivos ilimitados.`,
          code:   'free_goal_limit',
          limit:  FREE_GOAL_LIMIT,
          active: activeCount ?? 0,
        },
        { status: 403 },
      )
    }
  }

  const { data, error } = await db
    .from('goals').insert({ ...parsed.data, user_id: internalId }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reward creating a goal — defining a target is the first step of the savings loop.
  // Best-effort: XP failure never blocks the goal creation itself.
  let xpGained  = 0
  let leveledUp = false
  try {
    const r = await awardXP(db, internalId, XP_REWARDS.GOAL_CREATED, 'goal_created')
    if (r) {
      xpGained  = r.xp_gained
      leveledUp = r.leveled_up
    }
  } catch (err) {
    console.warn('[goals] XP award failed (non-fatal):', err)
  }

  return NextResponse.json(
    { data, xp_gained: xpGained, leveled_up: leveledUp, error: null },
    { status: 201 },
  )
}
