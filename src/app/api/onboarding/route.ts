import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { MISSION_TEMPLATES }         from '@/lib/gamification'
import { z }                         from 'zod'

const OnboardingSchema = z.object({
  challenge:   z.string(),
  goal:        z.string(),
  goal_amount: z.number().min(0).default(0),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = OnboardingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  // Buscar utilizador
  let { data: user } = await db
    .from('users').select('id').eq('clerk_id', userId).single()

  // Se não existe, criar
  if (!user) {
    const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    }).then(r => r.json())

    const { data: created } = await db
      .from('users')
      .insert({
        clerk_id:             userId,
        email:                clerkUser.email_addresses[0]?.email_address ?? '',
        name:                 `${clerkUser.first_name ?? ''} ${clerkUser.last_name ?? ''}`.trim() || 'Utilizador',
        avatar_url:           clerkUser.image_url ?? null,
        onboarding_completed: true,
      })
      .select('id')
      .single()

    user = created
  } else {
    // Marcar onboarding completo
    await db.from('users')
      .update({ onboarding_completed: true })
      .eq('id', user.id)
  }

  if (!user) return NextResponse.json({ error: 'Falha ao criar utilizador' }, { status: 500 })

  // Criar conta padrão
  await db.from('accounts').insert({
    user_id:    user.id,
    name:       'Conta Principal',
    type:       'checking',
    balance:    0,
    is_default: true,
  }).select().single()

  // Criar estado XP inicial
  await db.from('xp_progress').upsert({
    user_id:   user.id,
    xp_total:  100, // bónus onboarding
    level:     1,
    updated_at: new Date().toISOString(),
  })

  // Log XP
  await db.from('xp_history').insert({
    user_id:  user.id,
    amount:   100,
    reason:   'onboarding_complete',
  })

  // Criar estado Voltix
  await db.from('voltix_states').upsert({
    user_id:          user.id,
    mood:             'happy',
    evolution_level:  1,
    last_interaction: new Date().toISOString(),
  })

  // Criar missões iniciais
  const missions = MISSION_TEMPLATES
    .filter(m => !m.is_premium)
    .slice(0, 3)
    .map(t => ({
      user_id:       user!.id,
      type:          t.type,
      title:         t.title,
      description:   t.description,
      xp_reward:     t.xp_reward,
      target_value:  t.target_value,
      current_value: 0,
      status:        'active',
      is_premium:    false,
      expires_at:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }))

  await db.from('missions').insert(missions)

  // Criar objetivo financeiro se definido
  if (parsed.data.goal_amount > 0) {
    const GOAL_NAMES: Record<string, string> = {
      emergency: '🛡️ Fundo de emergência',
      travel:    '✈️ Viagem de sonho',
      house:     '🏠 Casa própria',
      car:       '🚗 Carro novo',
      invest:    '📈 Investimentos',
      debt:      '⛓️ Pagar dívidas',
      other:     '🎯 Objetivo pessoal',
    }
    await db.from('goals').insert({
      user_id:        user.id,
      name:           GOAL_NAMES[parsed.data.goal] ?? '🎯 Objetivo',
      icon:           parsed.data.goal.slice(0, 2) || '🎯',
      target_amount:  parsed.data.goal_amount,
      current_amount: 0,
      status:         'active',
    })
  }

  // Dar badge Early Adopter
  const { data: badge } = await db
    .from('badges').select('id').eq('code', 'early_adopter').single()
  if (badge) {
    await db.from('user_badges').upsert({
      user_id:  user.id,
      badge_id: badge.id,
    })
  }

  return NextResponse.json({ success: true, error: null })
}
