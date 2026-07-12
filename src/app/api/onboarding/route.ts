import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { MISSION_TEMPLATES }         from '@/lib/gamification'
import { getServerLocale }           from '@/lib/i18n/server'
import { z }                         from 'zod'

// Ids dos ecrãs de perfil (julho 2026). `challenge` legado continua aceite
// (clientes antigos em voo durante o deploy) — o cliente novo espelha a
// motivação nesse campo para compat com quem lê publicMetadata.challenge.
const OnboardingSchema = z.object({
  mascot_gender:    z.enum(['voltix', 'penny']).default('voltix'),
  challenge:        z.string().optional().default(''),
  goal:             z.string(),
  goal_amount:      z.number().min(0).default(0),
  motivation:       z.enum(['debts', 'save_goal', 'track', 'invest', 'curious']).nullish(),
  life_stage:       z.enum(['student', 'first_job', 'independent', 'family', 'pre_retire']).nullish(),
  discovery_source: z.enum(['social', 'search', 'friend', 'blog', 'other']).nullish(),
})

// Nome + ícone do objetivo semeado. (O antigo `icon: goal.slice(0,2)` gravava
// lixo tipo "em"/"tr" na coluna icon — corrigido julho 2026.)
const GOAL_META: Record<string, { name: string; icon: string }> = {
  emergency: { name: '🛡️ Fundo de emergência', icon: '🛡️' },
  travel:    { name: '✈️ Viagem de sonho',      icon: '✈️' },
  house:     { name: '🏠 Casa própria',          icon: '🏠' },
  car:       { name: '🚗 Carro novo',            icon: '🚗' },
  invest:    { name: '📈 Investimentos',         icon: '📈' },
  debt:      { name: '⛓️ Pagar dívidas',         icon: '⛓️' },
  other:     { name: '🎯 Objetivo pessoal',      icon: '🎯' },
}

type UserRow = { id: string } | null

/**
 * Insert/update em `users` com fallback de colunas opcionais: as colunas
 * `mascot_gender` e `onboarding_profile` vieram de migrações posteriores.
 * Se o PostgREST rejeitar por coluna inexistente, retira-se a coluna do
 * payload e tenta-se outra vez — o onboarding NUNCA bloqueia num deploy
 * pré-migração (mesmo padrão do retry mascot_gender original).
 */
const OPTIONAL_USER_COLUMNS = ['onboarding_profile', 'mascot_gender'] as const

async function writeUserWithFallback(
  db: ReturnType<typeof createSupabaseAdmin>,
  mode: 'insert' | 'update',
  payload: Record<string, unknown>,
  userId?: string,
): Promise<{ data: UserRow; error: { message: string } | null }> {
  const attempt = { ...payload }
  for (let i = 0; i <= OPTIONAL_USER_COLUMNS.length; i++) {
    const q = mode === 'insert'
      ? db.from('users').insert(attempt).select('id').maybeSingle()
      : db.from('users').update(attempt).eq('id', userId!).select('id').maybeSingle()
    const { data, error } = await q
    if (!error) return { data, error: null }

    const missing = OPTIONAL_USER_COLUMNS.find(
      col => col in attempt && new RegExp(col).test(error.message ?? ''),
    )
    if (!missing) return { data: null, error }
    delete attempt[missing]
  }
  return { data: null, error: { message: 'fallback exhausted' } }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = OnboardingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const db = createSupabaseAdmin()

  // Perfil agregável (o "conhecer os users" do dono): jsonb versionado numa
  // coluna só — perguntas futuras entram sem DDL novo. Skip grava null.
  // Migração: database/onboarding_profile_2026_07.sql (opcional — ver
  // writeUserWithFallback). Backup universal: Clerk publicMetadata abaixo.
  const profile = {
    v:                1,
    motivation:       parsed.data.motivation ?? null,
    life_stage:       parsed.data.life_stage ?? null,
    goal:             parsed.data.goal || null,
    goal_amount:      parsed.data.goal_amount || 0,
    discovery_source: parsed.data.discovery_source ?? null,
    challenge_legacy: parsed.data.challenge || null,
    answered_at:      new Date().toISOString(),
  }

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

  let user: UserRow = existingUser
  const clerk = await clerkClient()

  // Se não existe, criar
  if (!user) {
    // clerkClient (SDK oficial) em vez do fetch cru à REST API — o fetch
    // antigo não verificava r.ok e um 4xx criava o user com email vazio.
    let email = ''
    let name  = 'Utilizador'
    let avatarUrl: string | null = null
    try {
      const cu  = await clerk.users.getUser(userId)
      email     = cu.emailAddresses?.[0]?.emailAddress ?? ''
      name      = `${cu.firstName ?? ''} ${cu.lastName ?? ''}`.trim() || 'Utilizador'
      avatarUrl = cu.imageUrl ?? null
    } catch (err) {
      console.warn('[onboarding] clerk user fetch failed (using placeholders):', err)
    }

    const { data: created, error: insertErr } = await writeUserWithFallback(db, 'insert', {
      clerk_id:             userId,
      email,
      name,
      avatar_url:           avatarUrl,
      onboarding_completed: true,
      mascot_gender:        parsed.data.mascot_gender,
      onboarding_profile:   profile,
    })

    if (insertErr || !created) {
      console.warn('[onboarding] user insert failed:', insertErr)
      return NextResponse.json(
        { error: `Falha ao criar utilizador: ${insertErr?.message ?? 'sem detalhe'}` },
        { status: 500 },
      )
    }
    user = created
  } else {
    const { error: updateErr } = await writeUserWithFallback(db, 'update', {
      onboarding_completed: true,
      mascot_gender:        parsed.data.mascot_gender,
      onboarding_profile:   profile,
    }, user.id)

    if (updateErr) {
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

  // Criar conta padrão — só se ainda não existir. Nome no idioma do user
  // (cookie xpmoney-locale / Accept-Language).
  const locale = await getServerLocale()
  const { data: existingAccount } = await db
    .from('accounts').select('id').eq('user_id', user.id).limit(1).maybeSingle()

  if (!existingAccount) {
    const { error } = await db.from('accounts').insert({
      user_id:    user.id,
      name:       locale === 'en' ? 'Main Account' : 'Conta Principal',
      type:       'checking',
      balance:    0,
      is_default: true,
    })
    if (error) console.warn('[onboarding] account insert failed:', error)
  }

  // Criar estado XP inicial — só se ainda não existir
  const { data: existingXP } = await db
    .from('xp_progress').select('id').eq('user_id', user.id).maybeSingle()

  if (!existingXP) {
    const { error: xpErr } = await db.from('xp_progress').insert({
      user_id:  user.id,
      xp_total: 100,
      level:    1,
    })
    if (xpErr) console.warn('[onboarding] xp_progress insert failed:', xpErr)
    const { error: histErr } = await db.from('xp_history').insert({
      user_id: user.id,
      amount:  100,
      reason:  'onboarding_complete',
    })
    if (histErr) console.warn('[onboarding] xp_history insert failed:', histErr)
  }

  // Criar estado Voltix — só se ainda não existir
  const { data: existingVoltix } = await db
    .from('voltix_states').select('id').eq('user_id', user.id).maybeSingle()

  if (!existingVoltix) {
    const { error } = await db.from('voltix_states').insert({
      user_id:          user.id,
      mood:             'happy',
      evolution_level:  1,
      last_interaction: new Date().toISOString(),
    })
    if (error) console.warn('[onboarding] voltix_states insert failed:', error)
  }

  // Criar missões iniciais — só se ainda não existir nenhuma. Validade de
  // 7 dias, alinhada com o sistema de renovação semanal (julho 2026) — o
  // antigo +30d deixava o primeiro lote fora do ciclo de re-seed.
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
        expires_at:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }))
    const { error } = await db.from('missions').insert(missions)
    if (error) console.warn('[onboarding] missions insert failed:', error)
  }

  // Criar objetivo financeiro se definido
  if (parsed.data.goal_amount > 0) {
    const meta = GOAL_META[parsed.data.goal] ?? { name: '🎯 Objetivo', icon: '🎯' }
    const { error } = await db.from('goals').insert({
      user_id:        user.id,
      name:           meta.name,
      icon:           meta.icon,
      target_amount:  parsed.data.goal_amount,
      current_amount: 0,
      status:         'active',
    })
    if (error) console.warn('[onboarding] goal insert failed:', error)
  }

  // Dar badge Early Adopter
  const { data: badge } = await db
    .from('badges').select('id').eq('code', 'early_adopter').maybeSingle()
  if (badge) {
    const { error } = await db.from('user_badges').upsert({
      user_id:  user.id,
      badge_id: badge.id,
    })
    if (error) console.warn('[onboarding] badge upsert failed:', error)
  }

  // Update Clerk publicMetadata — flag + respostas de perfil (backup sem DDL:
  // funciona hoje mesmo sem a migração onboarding_profile e permite
  // re-hidratar a coluna mais tarde). Best-effort: uma falha aqui não pode
  // 500-ar um onboarding já persistido no Supabase.
  try {
    const clerkUser = await clerk.users.getUser(userId)
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...clerkUser.publicMetadata,
        onboarding_completed: true,
        challenge:            parsed.data.challenge,
        goal:                 parsed.data.goal,
        motivation:           parsed.data.motivation ?? null,
        life_stage:           parsed.data.life_stage ?? null,
        discovery_source:     parsed.data.discovery_source ?? null,
      },
    })
  } catch (err) {
    console.warn('[onboarding] clerk metadata update failed:', err)
  }

  return NextResponse.json({ success: true, error: null })
}
