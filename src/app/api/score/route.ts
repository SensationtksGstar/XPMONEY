import { auth }                    from '@clerk/nextjs/server'
import { NextResponse }             from 'next/server'
import { createSupabaseAdmin }      from '@/lib/supabase'
import { resolveUser }              from '@/lib/resolveUser'
import { recalculateScore }         from '@/lib/recalculateScore'
import { isDemoMode, demoResponse } from '@/lib/demo/demoGuard'
import { DEMO_SCORE }               from '@/lib/demo/mockData'

export async function GET() {
  if (isDemoMode()) return demoResponse(DEMO_SCORE)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  // maybeSingle — new users have no financial_scores rows yet
  const { data: latest } = await db
    .from('financial_scores').select('*').eq('user_id', internalId)
    .order('calculated_at', { ascending: false }).limit(1).maybeSingle()

  return NextResponse.json({ data: latest ?? null, error: null })
}

export async function POST() {
  if (isDemoMode()) return demoResponse(DEMO_SCORE)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // Delegate to the shared recalculateScore helper — single source of truth
  // (includes trend detection, per-category concentration analysis, etc.)
  const newScore = await recalculateScore(db, internalId)

  if (!newScore) {
    return NextResponse.json(
      { error: 'Falha ao recalcular score' },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: newScore, error: null })
}
