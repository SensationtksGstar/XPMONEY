import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'
import { fetchPlanRow }              from '@/lib/plan'
import { getServerLocale }           from '@/lib/i18n/server'
import { toNumber }                  from '@/lib/safeNumber'
import { parseOverrides, type Budget } from '@/lib/budget'
import {
  buildSpendForecast, type TxRow, type SpendForecast,
} from '@/lib/spendForecast'

/**
 * GET /api/forecast?overrides=<json>
 *
 * Premium spend forecast — end-of-month total + per-category + 50/30/20
 * bucket overrun signals. Deterministic stats over the user's own history
 * (src/lib/spendForecast.ts) — no AI calls, no new tables, zero marginal
 * cost, so no rate limit beyond the platform defaults.
 *
 * `overrides` uses the same contract as /api/budget/status (client's
 * localStorage category→bucket recategorisations, via parseOverrides).
 */

// Static payload so demo mode shows a lively card without real data.
const DEMO_FORECAST: SpendForecast = {
  status: 'ok',
  month: new Date().toISOString().slice(0, 7),
  daysElapsed: 14, daysInMonth: 30, spentSoFar: 612.4,
  total: {
    forecast: 1180, low: 1085, high: 1275, confidence: 'high',
    baseline: 1150, pace: 1210, blendAlpha: 0.47, usableMonths: 5,
    recurringPending: [
      { description: 'Netflix', categoryName: 'Subscrições', amount: 12.99, expectedDay: 22 },
    ],
  },
  categories: [
    { categoryId: 'demo-1', name: 'Alimentação', icon: '🛒', spentSoFar: 231.5, forecast: 465, confidence: 'high',   bucket: 'needs' },
    { categoryId: 'demo-2', name: 'Restaurantes', icon: '🍽️', spentSoFar: 118.2, forecast: 240, confidence: 'medium', bucket: 'wants' },
    { categoryId: 'demo-3', name: 'Transportes', icon: '⛽', spentSoFar: 84.0,  forecast: 165, confidence: 'high',   bucket: 'needs' },
  ],
  budget: {
    monthlyIncome: 1850,
    buckets: [
      { bucket: 'needs',   limit: 925,   spentSoFar: 340.1, forecast: 690, forecastPct: 74.6,  severity: 'on_track', breachDate: null, alreadyOver: false },
      { bucket: 'wants',   limit: 555,   spentSoFar: 252.3, forecast: 470, forecastPct: 84.7,  severity: 'risk',     breachDate: null, alreadyOver: false },
      { bucket: 'savings', limit: 370,   spentSoFar: 20.0,  forecast: 20,  forecastPct: 5.4,   severity: 'on_track', breachDate: null, alreadyOver: false },
    ],
  },
}

export async function GET(req: NextRequest) {
  if (isDemoMode()) return demoResponse(DEMO_FORECAST)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db  = createSupabaseAdmin()
  const now = new Date()
  // History window: 1st of (current − 6 months) → 1st of next month.
  const startISO = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    .toISOString().split('T')[0]
  const endISO = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toISOString().split('T')[0]

  // Plan + transactions + budget are independent — one parallel batch.
  const [planRow, txRes, budgetRes] = await Promise.all([
    fetchPlanRow(db, 'id', internalId),   // effective plan — NEVER raw users.plan
    // DESCENDING + explicit limit — PostgREST silently caps responses at
    // db.max_rows (default 1000) with NO error. Ascending order would make
    // that cap drop the NEWEST rows, i.e. zero out the current month and
    // corrupt the forecast for heavy statement-import users. Descending
    // means a cap (if ever hit past 5000) sheds the OLDEST history months —
    // graceful degradation. Aggregation downstream is order-independent.
    db.from('transactions')
      .select('amount, date, category_id, description, category:category_id(name, icon)')
      .eq('user_id', internalId)
      .eq('type', 'expense')
      .gte('date', startISO)
      .lt('date', endISO)
      .order('date', { ascending: false })
      .limit(5000),
    db.from('budgets').select('*').eq('user_id', internalId).maybeSingle(),
  ])

  if (!(planRow?.isPremium ?? false)) {
    const locale = await getServerLocale()
    return NextResponse.json(
      {
        error: locale === 'en'
          ? 'Spending forecast is a Premium feature.'
          : 'A previsão de gastos é uma funcionalidade Premium.',
        code: 'plan_required',
      },
      { status: 403 },
    )
  }

  if (txRes.error) {
    return NextResponse.json({ error: txRes.error.message }, { status: 500 })
  }

  // budgets table may not exist pre-migration → forecast still works, budget: null.
  let budget: Budget | null = null
  if (budgetRes.error) {
    if (!/relation .* does not exist/i.test(budgetRes.error.message)) {
      console.warn('[forecast] budget fetch failed:', budgetRes.error.message)
    }
  } else {
    budget = (budgetRes.data as Budget | null) ?? null
  }

  // PostgREST types 1-to-1 joins as arrays — normalise, and numerics come
  // back as strings → toNumber.
  type RawRow = {
    amount: unknown
    date: string
    category_id: string | null
    description: string | null
    category: { name: string | null; icon: string | null }
      | Array<{ name: string | null; icon: string | null }>
      | null
  }
  const rows: TxRow[] = ((txRes.data ?? []) as unknown as RawRow[]).map(r => {
    const cat = Array.isArray(r.category) ? (r.category[0] ?? null) : r.category
    return {
      date:         r.date,
      amount:       toNumber(r.amount),
      categoryId:   r.category_id,
      categoryName: cat?.name ?? null,
      categoryIcon: cat?.icon ?? null,
      description:  r.description ?? '',
    }
  })

  const overrides = parseOverrides(new URL(req.url).searchParams.get('overrides'))
  const data = buildSpendForecast(rows, budget, overrides, now)

  return NextResponse.json({ data })
}
