import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { z }                         from 'zod'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'

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

  // current_amount defaulta a initial_amount no momento da criação (ainda
  // não foi abatida nada). O user pode já começar com saldo diferente se
  // estiver a registar uma dívida antiga que já pagou parte.
  const initial = parsed.data.initial_amount
  const current = parsed.data.current_amount ?? initial

  const db = createSupabaseAdmin()
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
