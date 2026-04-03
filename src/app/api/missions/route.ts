import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { MISSION_TEMPLATES }   from '@/lib/gamification'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users').select('id, plan').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data, error } = await db
    .from('missions')
    .select('*')
    .eq('user_id', user.id)
    .in('status', ['active', 'completed'])
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], error: null })
}

// Inicializar missões para novo utilizador
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users').select('id, plan').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const isPremium = user.plan !== 'free'

  // Selecionar missões disponíveis para o plano
  const templates = MISSION_TEMPLATES
    .filter(m => !m.is_premium || isPremium)
    .slice(0, 3) // máximo 3 missões free

  const missions = templates.map(t => ({
    user_id:      user.id,
    type:         t.type,
    title:        t.title,
    description:  t.description,
    xp_reward:    t.xp_reward,
    target_value: t.target_value,
    current_value: 0,
    status:       'active',
    is_premium:   t.is_premium,
    expires_at:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
  }))

  const { data, error } = await db
    .from('missions')
    .insert(missions)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, error: null }, { status: 201 })
}
