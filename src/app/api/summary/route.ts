import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { resolveUser }                 from '@/lib/resolveUser'
import { toNumber }                    from '@/lib/safeNumber'
import { isDemoMode, demoResponse }    from '@/lib/demo/demoGuard'

export interface MonthlySummaryData {
  income:   number
  expense:  number
  savings:  number
  rate:     number   // savings / income * 100
  month:    string   // YYYY-MM
  /**
   * Top 6 categorias de despesa ordenadas por valor descendente.
   * Adicionado para o widget ExpenseBreakdown no dashboard.
   */
  top_categories: Array<{
    name:   string
    icon:   string | null
    total:  number
    pct:    number  // % do total de despesas
  }>
}

// Helper — builds "YYYY-MM" for the given Date in local time
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(_req: NextRequest) {
  // Dates MUST be computed per-request. When they were module-scoped, a
  // serverless cold-start that happened on April 30 would keep returning
  // April data until the function was redeployed or cycled.
  const now   = new Date()
  const month = monthKey(now)

  if (isDemoMode()) {
    const DEMO_SUMMARY: MonthlySummaryData = {
      income:  1850,
      expense: 947.99,
      savings: 902.01,
      rate:    48.8,
      month,
      top_categories: [
        { name: 'Alimentação',  icon: '🍽️', total: 345.40, pct: 36.4 },
        { name: 'Transportes',  icon: '🚗', total: 182.50, pct: 19.3 },
        { name: 'Lazer',        icon: '🎉', total: 156.20, pct: 16.5 },
        { name: 'Casa',         icon: '🏠', total: 140.00, pct: 14.8 },
        { name: 'Saúde',        icon: '💊', total:  85.90, pct:  9.1 },
        { name: 'Outros',       icon: '📎', total:  37.99, pct:  4.0 },
      ],
    }
    return demoResponse(DEMO_SUMMARY)
  }

  // ── Auth ──
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // Server-side aggregation — only rows for current month
  const startOfMonth = `${month}-01`
  const startOfNext  = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString().split('T')[0]

  const { data, error } = await db
    .from('transactions')
    .select('amount, type, category:category_id(name, icon)')
    .eq('user_id', internalId)
    .gte('date', startOfMonth)
    .lt('date', startOfNext)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Supabase returns numeric columns as strings — always wrap in toNumber().
  // Como o join de `category:category_id(...)` é tipado como array pelo
  // PostgREST JS client mesmo sendo 1-to-1, precisamos de normalizar.
  type RawRow = {
    amount: unknown
    type:   'income' | 'expense'
    category: { name: string | null; icon: string | null } | Array<{ name: string | null; icon: string | null }> | null
  }
  type Row = {
    amount: unknown
    type:   'income' | 'expense'
    category: { name: string | null; icon: string | null } | null
  }
  const rows: Row[] = ((data ?? []) as unknown as RawRow[]).map(r => ({
    amount: r.amount,
    type:   r.type,
    category: Array.isArray(r.category) ? (r.category[0] ?? null) : r.category,
  }))
  const income  = rows
    .filter(r => r.type === 'income')
    .reduce((s, r) => s + toNumber(r.amount), 0)
  const expense = rows
    .filter(r => r.type === 'expense')
    .reduce((s, r) => s + toNumber(r.amount), 0)
  const savings = income - expense
  const rate    = income > 0 ? (savings / income) * 100 : 0

  // Breakdown por categoria — só despesas
  const byCategory = new Map<string, { icon: string | null; total: number }>()
  for (const r of rows) {
    if (r.type !== 'expense') continue
    const name = r.category?.name ?? 'Sem categoria'
    const icon = r.category?.icon ?? null
    const existing = byCategory.get(name)
    const amount = toNumber(r.amount)
    if (existing) {
      existing.total += amount
    } else {
      byCategory.set(name, { icon, total: amount })
    }
  }
  const top_categories = Array.from(byCategory.entries())
    .map(([name, v]) => ({
      name,
      icon:  v.icon,
      total: v.total,
      pct:   expense > 0 ? (v.total / expense) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const summary: MonthlySummaryData = { income, expense, savings, rate, month, top_categories }
  return NextResponse.json({ data: summary })
}
