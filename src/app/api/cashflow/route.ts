import { auth }               from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin }  from '@/lib/supabase'
import { resolveUser }          from '@/lib/resolveUser'
import { toNumber }             from '@/lib/safeNumber'
import { isDemoMode, demoResponse } from '@/lib/demo/demoGuard'

/**
 * GET /api/cashflow?months=6 — receitas vs despesas (e net) agrupadas por
 * mês para os últimos N meses (default 6, clamp 3..12).
 *
 * Distinto de /api/budget/history (que só soma despesas e divide por
 * bucket needs/wants/savings): este dá a leitura de tesouraria — quanto
 * entrou, quanto saiu, e a diferença mês a mês. Alimenta o widget
 * CashFlowChart no dashboard.
 *
 * Devolve `month` (YYYY-MM) cru — o label curto é computado client-side
 * de forma locale-aware (o dashboard é PT/EN), por isso a API NÃO emite
 * texto traduzível.
 */

export interface CashFlowPoint {
  month:   string   // YYYY-MM (ordenado do mais antigo → mais recente)
  income:  number
  expense: number
  net:     number   // income - expense (pode ser negativo)
}

export interface CashFlowResponse {
  points: CashFlowPoint[]
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: Request) {
  const url    = new URL(req.url)
  const months = Math.max(3, Math.min(12, Number(url.searchParams.get('months')) || 6))

  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  /** Constrói N pontos vazios em ordem cronológica. */
  function emptyPoints(): Map<string, CashFlowPoint> {
    const m = new Map<string, CashFlowPoint>()
    for (let i = 0; i < months; i++) {
      const d   = new Date(start.getFullYear(), start.getMonth() + i, 1)
      const key = monthKey(d)
      m.set(key, { month: key, income: 0, expense: 0, net: 0 })
    }
    return m
  }

  if (isDemoMode()) {
    const demo = emptyPoints()
    const sample = [
      { income: 1700, expense: 1320 },
      { income: 1850, expense: 980 },
      { income: 1850, expense: 1410 },
      { income: 2100, expense: 1190 },
      { income: 1850, expense: 1505 },
      { income: 1950, expense: 948 },
    ]
    let i = 0
    for (const [key] of demo) {
      const s = sample[i] ?? sample[sample.length - 1]
      demo.set(key, { month: key, income: s.income, expense: s.expense, net: s.income - s.expense })
      i++
    }
    const demoPayload: CashFlowResponse = { points: Array.from(demo.values()) }
    return demoResponse(demoPayload)
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) {
    return NextResponse.json<{ data: CashFlowResponse }>({ data: { points: [] } })
  }

  const db = createSupabaseAdmin()

  const startISO = start.toISOString().split('T')[0]
  const endISO   = end.toISOString().split('T')[0]

  const { data: txRaw, error: txErr } = await db
    .from('transactions')
    .select('amount, type, date')
    .eq('user_id', internalId)
    .gte('date', startISO)
    .lt('date', endISO)

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  const byMonth = emptyPoints()

  for (const r of (txRaw ?? []) as Array<{ amount: unknown; type: 'income' | 'expense'; date: string }>) {
    const point = byMonth.get(r.date.slice(0, 7))
    if (!point) continue
    const amount = toNumber(r.amount)
    if (r.type === 'income')  point.income  += amount
    else                      point.expense += amount
  }

  const points = Array.from(byMonth.values()).map(p => {
    const income  = Math.round(p.income  * 100) / 100
    const expense = Math.round(p.expense * 100) / 100
    return { month: p.month, income, expense, net: Math.round((income - expense) * 100) / 100 }
  })

  return NextResponse.json<{ data: CashFlowResponse }>({ data: { points } })
}
