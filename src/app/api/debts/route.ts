import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { z }                         from 'zod'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'
import { fetchPlanRow }              from '@/lib/plan'
import { getServerLocale }           from '@/lib/i18n/server'

/** Free tier allows 1 active debt — the paywall on the 2nd is a Premium
 *  conversion hook (same class as FREE_GOAL_LIMIT on /api/goals). */
const FREE_DEBT_LIMIT = 1

/**
 * /api/debts — CRUD de dívidas para a feature Kill Debt.
 *
 * GET  → lista as dívidas do user ordenadas por estado (active primeiro) e
 *        data de criação. Devolve [] se a tabela ainda não existir no DB
 *        (graceful degrade — CLAUDE.md rule: novas colunas/tabelas precisam
 *        sempre de fallback).
 * POST → cria uma dívida nova. Valida com zod + clampa taxas/valores.
 */

const DebtSchema = z.object({
  name:            z.string().min(1).max(80),
  category:        z.string().min(1).max(40).default('outro'),
  initial_amount:  z.number().nonnegative().max(10_000_000),
  current_amount:  z.number().nonnegative().max(10_000_000).optional(),
  interest_rate:   z.number().nonnegative().max(100).default(0),
  min_payment:     z.number().nonnegative().max(1_000_000).default(0),
  strategy:        z.enum(['avalanche', 'snowball']).default('avalanche'),
})

export async function GET() {
  if (isDemoMode()) return demoResponse([])

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: [], error: null })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('debts')
    .select('*')
    .eq('user_id', internalId)
    .order('status',      { ascending: true })   // active vem antes de killed (a<k)
    .order('created_at',  { ascending: false })

  if (error) {
    // Se a tabela ainda não foi criada (user não correu o SQL de migração),
    // devolvemos [] para o frontend carregar um empty state em vez de 500.
    if (/relation .* does not exist/i.test(error.message)) {
      console.warn('[debts] table missing — run database/kill_debt.sql')
      return NextResponse.json({ data: [], error: null, migration_needed: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data: data ?? [], error: null })
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) return demoResponse({}, 201)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const parsed = DebtSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // Free-plan gate: marketing + UI promise "1 dívida ativa" no Grátis
  // (paywall na 2ª), mas até Junho 2026 só o CLIENTE o impunha — um POST
  // direto criava dívidas ilimitadas (mesma classe de bug corrigida em
  // /api/goals em Abril). Plan row + count em paralelo. Se a contagem
  // falhar (ex.: tabela ainda não migrada), o gate abre — o insert abaixo
  // devolve o 503 amigável na mesma.
  const [planRow, countRes] = await Promise.all([
    fetchPlanRow(db, 'id', internalId),
    db
      .from('debts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', internalId)
      .eq('status', 'active'),
  ])
  const isPaid = planRow?.isPremium ?? false
  if (!isPaid && !countRes.error && (countRes.count ?? 0) >= FREE_DEBT_LIMIT) {
    const locale = await getServerLocale()
    return NextResponse.json(
      {
        error: locale === 'en'
          ? `Free plan is limited to ${FREE_DEBT_LIMIT} active debt. Kill it first or upgrade to Premium for unlimited debts.`
          : `O plano Grátis permite ${FREE_DEBT_LIMIT} dívida ativa. Elimina-a primeiro ou faz upgrade para Premium para dívidas ilimitadas.`,
        code:   'free_debt_limit',
        limit:  FREE_DEBT_LIMIT,
        active: countRes.count ?? 0,
      },
      { status: 403 },
    )
  }

  // current_amount defaulta a initial_amount no momento da criação (ainda
  // não foi abatida nada). O user pode já começar com saldo diferente se
  // estiver a registar uma dívida antiga que já pagou parte.
  const initial = parsed.data.initial_amount
  const current = parsed.data.current_amount ?? initial
  const { data, error } = await db
    .from('debts')
    .insert({
      user_id:        internalId,
      name:           parsed.data.name,
      category:       parsed.data.category,
      initial_amount: initial,
      current_amount: current,
      interest_rate:  parsed.data.interest_rate,
      min_payment:    parsed.data.min_payment,
      strategy:       parsed.data.strategy,
      status:         'active',
    })
    .select()
    .single()

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Tabela debts não existe. Corre database/kill_debt.sql no SQL editor do Supabase.' },
        { status: 503 },
      )
    }
    console.warn('[debts] insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, error: null }, { status: 201 })
}
