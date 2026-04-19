import { auth }              from '@clerk/nextjs/server'
import { NextResponse }       from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveUser }         from '@/lib/resolveUser'
import { toNumber }            from '@/lib/safeNumber'
import { categoryToBucket }    from '@/lib/budget'

/**
 * GET /api/budget/history?months=6 — histórico de despesas por bucket,
 * agrupadas por mês, para os últimos N meses (default 6).
 *
 * Retorna um array ordenado do mais antigo para o mais recente para o
 * chart apresentar esquerda-direita naturalmente.
 *
 * Rendimento mensal do user é constante (vem da config do budgets) e vai
 * no mesmo payload para que o chart possa desenhar a linha de referência.
 */

export interface BudgetHistoryPoint {
  month:   string   // YYYY-MM
  label:   string   // "Abr", "Mai", …
  needs:   number
  wants:   number
  savings: number
  total:   number
}

export interface BudgetHistoryResponse {
  income:  number
  points:  BudgetHistoryPoint[]
}

const MONTH_LABELS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: Request) {
  const url    = new URL(req.url)
  const months = Math.max(3, Math.min(12, Number(url.searchParams.get('months')) || 6))

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) {
    return NextResponse.json<{ data: BudgetHistoryResponse }>({
      data: { income: 0, points: [] },
    })
  }

  const db = createSupabaseAdmin()

  // Budget config (para passar o rendimento; se não existir devolvemos 0)
  const { data: budget, error: budgetErr } = await db
    .from('budgets')
    .select('monthly_income')
    .eq('user_id', internalId)
    .maybeSingle()

  if (budgetErr && !/relation .* does not exist/i.test(budgetErr.message)) {
    return NextResponse.json({ error: budgetErr.message }, { status: 500 })
  }

  // Janela dos últimos N meses — inclui o actual
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const startISO = start.toISOString().split('T')[0]
  const endISO   = end.toISOString().split('T')[0]

  const { data: txRaw, error: txErr } = await db
    .from('transactions')
    .select('amount, date, category:category_id(name)')
    .eq('user_id', internalId)
    .eq('type', 'expense')
    .gte('date', startISO)
    .lt('date', endISO)

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  // Normaliza shape (PostgREST pode devolver array no join 1-1)
  type RawRow = {
    amount: unknown
    date:   string
    category: { name: string | null } | Array<{ name: string | null }> | null
  }
  const rows = ((txRaw ?? []) as unknown as RawRow[]).map(r => {
    const cat = Array.isArray(r.category) ? (r.category[0] ?? null) : r.category
    return {
      amount: toNumber(r.amount),
      month:  r.date.slice(0, 7),
      name:   cat?.name ?? 'Sem categoria',
    }
  })

  // Inicializar 6 buckets vazios com a ordem correcta
  const byMonth = new Map<string, BudgetHistoryPoint>()
  for (let i = 0; i < months; i++) {
    const d     = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const key   = monthKey(d)
    const label = MONTH_LABELS[d.getMonth()]
    byMonth.set(key, { month: key, label, needs: 0, wants: 0, savings: 0, total: 0 })
  }

  // Agregar
  for (const r of rows) {
    const point = byMonth.get(r.month)
    if (!point) continue
    const bucket = categoryToBucket(r.name)
    point[bucket] += r.amount
    point.total   += r.amount
  }

  // Round & list (ordem preservada do Map porque foi inserido ordenado)
  const points = Array.from(byMonth.values()).map(p => ({
    ...p,
    needs:   Math.round(p.needs   * 100) / 100,
    wants:   Math.round(p.wants   * 100) / 100,
    savings: Math.round(p.savings * 100) / 100,
    total:   Math.round(p.total   * 100) / 100,
  }))

  const response: BudgetHistoryResponse = {
    income: toNumber(budget?.monthly_income, 0),
    points,
  }
  return NextResponse.json({ data: response })
}
