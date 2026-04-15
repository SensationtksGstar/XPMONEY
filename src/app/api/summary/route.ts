import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { resolveUser }                 from '@/lib/resolveUser'
import { isDemoMode, demoResponse }    from '@/lib/demo/demoGuard'

export interface MonthlySummaryData {
  income:   number
  expense:  number
  savings:  number
  rate:     number   // savings / income * 100
  month:    string   // YYYY-MM
}

// ── Demo mock ──────────────────────────────────────────────────────────────
const now   = new Date()
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const DEMO_SUMMARY: MonthlySummaryData = {
  income:  1850,
  expense: 947.99,
  savings: 902.01,
  rate:    48.8,
  month,
}

export async function GET(_req: NextRequest) {
  if (isDemoMode()) return demoResponse(DEMO_SUMMARY)

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
    .select('amount, type')
    .eq('user_id', internalId)
    .gte('date', startOfMonth)
    .lt('date', startOfNext)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows    = data ?? []
  const income  = rows.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const expense = rows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const savings = income - expense
  const rate    = income > 0 ? (savings / income) * 100 : 0

  const summary: MonthlySummaryData = { income, expense, savings, rate, month }
  return NextResponse.json({ data: summary })
}
