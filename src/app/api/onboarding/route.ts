import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { MISSION_TEMPLATES }         from '@/lib/gamification'
import { z }                         from 'zod'

const OnboardingSchema = z.object({
  mascot_gender: z.enum(['voltix', 'penny']).default('voltix'),
  challenge:     z.string(),
  goal:          z.string(),
  goal_amount:   z.number().min(0).default(0),
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

  // Buscar utilizador — maybeSingle() para não rebentar com PGRST116 em users frescos
  const { data: existingUser, error: lookupErr } = await db
    .from('users').select('id').eq('clerk_id', userId).maybeSingle()

  if (lookupErr) {
    console.warn('[onboarding] user lookup failed:', lookupErr)
    return NextResponse.json(
      { error: `Falha ao localizar utilizador: ${lookupErr.message}` },
      { status: 500 },
    )
  }

  let user = existingUser

  // Se não existe, criar
  if (!user) {
    const clerkUser = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    }).then(r => r.json())

    // Base payload — cada linha deste insert deve existir em produção. A coluna
    // `mascot_gender` só foi adicionada em migração posterior, portanto se o
    // insert falhar por coluna inexistente tentamos outra vez sem ela e
    // delegamos a escolha ao localStorage (comportamento documentado no
    // MascotPicker). Isto evita bloquear onboarding em deploys onde a
    // migração ainda não foi aplicada.
    const basePayload = {
      clerk_id:             userId,
      email:                clerkUser.email_addresses?.[0]?.email_address ?? '',
      name:                 `${clerkUser.first_name ?? ''} ${clerkUser.last_name ?? ''}`.trim() || 'Utilizador',
      avatar_url:           clerkUser.image_url ?? null,
      onboarding_completed: true,
    }

    let { data: created, error: insertErr } = await db
      .from('users')
      .insert({ ...basePayload, mascot_gender: parsed.data.mascot_gender })
      .select('id')
      .maybeSingle()

    if (insertErr && /mascot_gender/.test(insertErr.message ?? '')) {
      // Retry sem a coluna em falta
      const retry = await db
        .from('users')
        .insert(basePayload)
        .select('id')
        .maybeSingle()
      created    = retry.data
      insertErr  = retry.error
    }

    if (insertErr || !created) {
      console.warn('[onboarding] user insert failed:', insertErr)
      return NextResponse.json(
        { error: `Falha ao criar utilizador: ${insertErr?.message ?? 'sem detalhe'}` },
        { status: 500 },
      )
    }

    user = created
  } else {
    // Marcar onboarding completo + gravar escolha de mascote — ignorar falha
    // silenciosa só se for coluna inexistente (graceful degrade)
    const { error: updateErr } = await db.from('users')
      .update({
        onboarding_completed: true,
        mascot_gender:        parsed.data.mascot_gender,
      })
      .eq('id', user.id)

    if (updateErr && /mascot_gender/.test(updateErr.message ?? '')) {
      await db.from('users')
        .update({ onboarding_completed: true })
        .eq('id', user.id)
    } else if (updateErr) {
      console.warn('[onboarding] user update failed:', updateErr)
      return NextResponse.json(
        { error: `Falha ao actualizar utilizador: ${updateErr.message}` },
        { status: 500 },
      )
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Falha ao criar utilizador' }, { status: 500 })
  }

  // Criar conta padrão — só se ainda não existir
  const { data: existingAccount } = await db
    .from('accounts').select('id').eq('user_id', user.id).limit(1).maybeSingle()

  if (!existingAccount) {
    await db.from('accounts').insert({
      user_id:    user.id,
      name:       'Conta Principal',
      type:       'checking',
      balance:    0,
      is_default: true,
    })
  }

  // Criar estado XP inicial — só se ainda não existir
  const { data: existingXP } = await db
    .from('xp_progress').select('id').eq('user_id', user.id).maybeSingle()

  if (!existingXP) {
    await db.from('xp_progress').insert({
      user_id:  user.id,
      xp_total: 100,
      level:    1,
    })
    await db.from('xp_history').insert({
      user_id: user.id,
      amount:  100,
      reason:  'onboarding_complete',
    })
  }

  // Criar estado Voltix — só se ainda não existir
  const { data: existingVoltix } = await db
    .from('voltix_states').select('id').eq('user_id', user.id).maybeSingle()

  if (!existingVoltix) {
    await db.from('voltix_states').insert({
      user_id:          user.id,
      mood:             'happy',
      evolution_level:  1,
      last_interaction: new Date().toISOString(),
    })
  }

  // Criar missões iniciais — só se ainda não existir nenhuma
  const { data: existingMissions } = await db
    .from('missions').select('id').eq('user_id', user.id).limit(1)

  if (!existingMissions || existingMissions.length === 0) {
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
  }

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
    .from('badges').select('id').eq('code', 'early_adopter').maybeSingle()
  if (badge) {
    await db.from('user_badges').upsert({
      user_id:  user.id,
      badge_id: badge.id,
    })
  }

  // Update Clerk publicMetadata — onboarding flag + goal/challenge (no DDL needed)
  const clerk       = await clerkClient()
  const clerkUser   = await clerk.users.getUser(userId)
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...clerkUser.publicMetadata,
      onboarding_completed: true,
      challenge:            parsed.data.challenge,
      goal:                 parsed.data.goal,
    },
  })

  return NextResponse.json({ success: true, error: null })
}
