import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveUser }         from '@/lib/resolveUser'
import { getUserProfile }      from '@/lib/userCache'
import { MISSION_TEMPLATES }   from '@/lib/gamification'
import { isDemoMode, demoResponse } from '@/lib/demo/demoGuard'
import { DEMO_MISSIONS }            from '@/lib/demo/mockData'

export async function GET() {
  if (isDemoMode()) return demoResponse(DEMO_MISSIONS)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('missions').select('*').eq('user_id', internalId)
    .in('status', ['active', 'completed']).order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], error: null })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [internalId, profile] = await Promise.all([
    resolveUser(userId),
    getUserProfile(userId),
  ])
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const isPremium = profile?.plan !== 'free'
  const templates = MISSION_TEMPLATES.filter(m => !m.is_premium || isPremium).slice(0, 3)
  const missions  = templates.map(t => ({
    user_id: internalId, type: t.type, title: t.title, description: t.description,
    xp_reward: t.xp_reward, target_value: t.target_value, current_value: 0,
    status: 'active', is_premium: t.is_premium,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }))

  const db = createSupabaseAdmin()
  const { data, error } = await db.from('missions').insert(missions).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null }, { status: 201 })
}
