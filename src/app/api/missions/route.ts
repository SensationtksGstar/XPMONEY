import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveUser }         from '@/lib/resolveUser'
import { getUserProfile }      from '@/lib/userCache'
import { MISSION_TEMPLATES }   from '@/lib/gamification'
import { isDemoMode, demoResponse } from '@/lib/demo/demoGuard'
import { DEMO_MISSIONS }            from '@/lib/demo/mockData'
import { toNumber }                 from '@/lib/safeNumber'
import { completeReadyMissions }    from '@/lib/updateMissionProgress'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Semeia o próximo lote de 3 missões (validade 7 dias), rodando pela lista
 * elegível com base no nº HISTÓRICO de missões do user — cada reseed avança
 * a roda, por isso os templates 4-7 (incluindo os premium) entram em jogo a
 * partir do 2º ciclo. Antes desta rotação, o `.filter().slice(0, 3)` fazia
 * com que só os 3 primeiros templates fossem alguma vez semeados e as duas
 * missões premium fossem conteúdo morto que nenhum assinante recebia.
 *
 * i18n: os títulos/descrições PT ficam congelados na row (padrão do repo) e
 * são resolvidos em render via missionLabel.ts — todos os 7 templates já
 * têm chaves `missions.tpl.*` mapeadas, por isso a rotação é i18n-safe.
 */
async function seedNextBatch(
  db:         ReturnType<typeof createSupabaseAdmin>,
  internalId: string,
  isPremium:  boolean,
) {
  const eligible = MISSION_TEMPLATES.filter(m => !m.is_premium || isPremium)
  if (eligible.length === 0) return { data: [], error: null }

  const { count } = await db
    .from('missions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', internalId)

  const cycle = Math.floor((count ?? 0) / 3)
  const seen  = new Set<string>()
  const batch: typeof eligible = []
  for (let i = 0; batch.length < Math.min(3, eligible.length) && i < eligible.length; i++) {
    const t   = eligible[(cycle * 3 + i) % eligible.length]
    const key = `${t.type}_${t.target_value}`
    if (seen.has(key)) continue
    seen.add(key)
    batch.push(t)
  }

  const rows = batch.map(t => ({
    user_id: internalId, type: t.type, title: t.title, description: t.description,
    xp_reward: t.xp_reward, target_value: t.target_value, current_value: 0,
    status: 'active', is_premium: t.is_premium,
    expires_at: new Date(Date.now() + WEEK_MS).toISOString(),
  }))

  return db.from('missions').insert(rows).select()
}

export async function GET() {
  if (isDemoMode()) return demoResponse(DEMO_MISSIONS)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // Missões vencidas (lazy, sem cron). Antes disto nada nunca expirava — o
  // expires_at era decorativo. Outubro 2026: as vencidas que JÁ estavam no
  // alvo (prontas a reclamar, nunca tocadas) são PAGAS via completeMission
  // em vez de expirar — XP ganho nunca se perde por não abrir /missions. As
  // restantes expiram pelos ids. Como ambas saem de 'active', o re-seed
  // abaixo continua a disparar.
  // Nota: este pagamento é serial só dentro deste pedido — pode correr em
  // paralelo com outro pedido do cliente que chame awardXP (ex.: o after()
  // do daily-checkin) e perder um incremento no xp_progress (read-modify-
  // write). A correção real é o RPC atómico de incremento (perf-api-7).
  const nowISO = new Date().toISOString()
  const { data: overdue, error: overdueErr } = await db
    .from('missions')
    .select('id, current_value, target_value')
    .eq('user_id', internalId)
    .eq('status', 'active')
    .lt('expires_at', nowISO)

  if (overdueErr) {
    console.warn('[missions] expire probe failed:', overdueErr.message)
  } else if (overdue && overdue.length > 0) {
    const readyIds:  string[] = []
    const expireIds: string[] = []
    for (const m of overdue) {
      if (toNumber(m.current_value, 0) >= toNumber(m.target_value, 1)) readyIds.push(m.id)
      else expireIds.push(m.id)
    }
    if (readyIds.length > 0) await completeReadyMissions(db, internalId, readyIds)
    if (expireIds.length > 0) {
      const { error: expireErr } = await db
        .from('missions')
        .update({ status: 'expired' })
        .eq('user_id', internalId)
        .eq('status', 'active')
        .in('id', expireIds)
      if (expireErr) console.warn('[missions] expire pass failed:', expireErr.message)
    }
  }

  const { data, error } = await db
    .from('missions').select('*').eq('user_id', internalId)
    .in('status', ['active', 'completed']).order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let missions = data ?? []

  // Lazy reseed semanal: sem missões ativas → novo lote. Era o fim-de-jogo
  // ao dia ~30 — o onboarding semeava 3 missões UMA vez e o sistema ficava
  // vazio para sempre depois de completadas.
  // Missões vencidas que continuam 'active' (pagamento de uma pronta falhou
  // e o claim foi libertado, ou a passagem de expiração falhou) NÃO contam:
  // senão uma falha rara de DB bloqueava o re-seed indefinidamente. Ficam
  // 'active' para o próximo GET voltar a tentar pagá-las — XP ganho não se
  // perde por as expirarmos à força.
  const nowMs = Date.parse(nowISO)
  const hasLiveActive = missions.some(m => {
    if (m.status !== 'active') return false
    const exp = typeof m.expires_at === 'string' ? Date.parse(m.expires_at) : NaN
    return !(Number.isFinite(exp) && exp < nowMs)
  })
  if (!hasLiveActive) {
    const profile = await getUserProfile(userId)
    const seeded  = await seedNextBatch(db, internalId, profile?.isPremium ?? false)
    if (seeded.error) console.warn('[missions] reseed failed:', seeded.error.message)
    else missions = [...(seeded.data ?? []), ...missions]
  }

  return NextResponse.json({ data: missions, error: null })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [internalId, profile] = await Promise.all([
    resolveUser(userId),
    getUserProfile(userId),
  ])
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // Dedup: só semeia quando NÃO há missões ativas. Antes, cada chamada
  // inseria 3 missões novas sem guarda nenhuma — completar + re-semear em
  // loop via curl era um farm de ~650 XP por ciclo.
  const { count: activeCount } = await db
    .from('missions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', internalId)
    .eq('status', 'active')

  if ((activeCount ?? 0) > 0) {
    return NextResponse.json({ data: [], error: null })
  }

  const seeded = await seedNextBatch(db, internalId, profile?.isPremium ?? false)
  if (seeded.error) return NextResponse.json({ error: seeded.error.message }, { status: 500 })
  return NextResponse.json({ data: seeded.data, error: null }, { status: 201 })
}
