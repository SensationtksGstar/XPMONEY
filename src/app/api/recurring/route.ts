import { auth }                      from '@clerk/nextjs/server'
import { NextResponse }                from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { resolveUser }                 from '@/lib/resolveUser'
import { toNumber }                    from '@/lib/safeNumber'
import { isDemoMode, demoResponse }    from '@/lib/demo/demoGuard'

/**
 * GET /api/recurring — detects likely RECURRING expenses (rent, subscriptions,
 * gym, utilities, regular groceries…) from the last 6 months of transactions.
 *
 * Heuristic, deliberately conservative: a merchant (normalised description)
 * that shows up in ≥3 distinct months is treated as recurring. The monthly
 * figure is the merchant's total spend divided by the number of distinct
 * months it appeared in — an honest "what this costs me per month" rather
 * than a single transaction. No new tables; reuses existing transactions.
 *
 * Framed as "recurring expenses", not "subscriptions" — regular groceries at
 * the same store ARE recurring even if they're not a subscription.
 */

export interface RecurringItem {
  key:           string   // normalised merchant key (display label)
  icon:          string | null
  category:      string | null
  monthlyAmount: number   // total ÷ distinct months
  months:        number   // distinct months it appeared in
  occurrences:   number   // total transactions
  lastDate:      string   // most recent occurrence (YYYY-MM-DD)
}

export interface RecurringResponse {
  items:        RecurringItem[]
  totalMonthly: number
}

/** Strip digits/punctuation/bank noise → the merchant's core name (≤3 words). */
function merchantKey(desc: string): string {
  const cleaned = desc
    .toLowerCase()
    .replace(/[0-9]/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Drop common PT/EN bank-statement prefixes that aren't the merchant.
  const NOISE = new Set([
    'compra', 'pagamento', 'pag', 'dd', 'deb', 'debito', 'débito', 'mb',
    'mbway', 'trf', 'transferencia', 'transferência', 'payment', 'card',
    'purchase', 'direct', 'debit', 'pos', 'levantamento',
  ])
  const words = cleaned.split(' ').filter(w => w.length >= 3 && !NOISE.has(w))
  return words.slice(0, 3).join(' ')
}

export async function GET() {
  if (isDemoMode()) {
    const demo: RecurringResponse = {
      totalMonthly: 87.4,
      items: [
        { key: 'netflix',       icon: '🎬', category: 'Subscrições', monthlyAmount: 13.99, months: 6, occurrences: 6, lastDate: '2026-05-02' },
        { key: 'ginásio fitup', icon: '🏋️', category: 'Saúde',       monthlyAmount: 29.99, months: 5, occurrences: 5, lastDate: '2026-05-01' },
        { key: 'spotify',       icon: '🎵', category: 'Subscrições', monthlyAmount:  6.99, months: 6, occurrences: 6, lastDate: '2026-05-04' },
        { key: 'edp comercial', icon: '⚡', category: 'Serviços',     monthlyAmount: 36.43, months: 4, occurrences: 4, lastDate: '2026-04-28' },
      ],
    }
    return demoResponse(demo)
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json<{ data: RecurringResponse }>({ data: { items: [], totalMonthly: 0 } })

  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('transactions')
    .select('amount, date, description, original_description, category:category_id(name, icon)')
    .eq('user_id', internalId)
    .eq('type', 'expense')
    .gte('date', start)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RawRow = {
    amount: unknown
    date: string
    description: string | null
    original_description: string | null
    category: { name: string | null; icon: string | null } | Array<{ name: string | null; icon: string | null }> | null
  }

  interface Group {
    total:  number
    months: Set<string>
    count:  number
    last:   string
    catName: Map<string, number>
    catIcon: string | null
  }
  const groups = new Map<string, Group>()

  for (const r of (data ?? []) as unknown as RawRow[]) {
    // Prefer the bank's raw token (stable) over the user-facing description.
    const source = (r.original_description || r.description || '').trim()
    const key = merchantKey(source)
    if (key.length < 3) continue   // too generic to be a reliable merchant

    const cat = Array.isArray(r.category) ? (r.category[0] ?? null) : r.category
    const amount = toNumber(r.amount)
    const month  = r.date.slice(0, 7)

    let g = groups.get(key)
    if (!g) {
      g = { total: 0, months: new Set(), count: 0, last: r.date, catName: new Map(), catIcon: cat?.icon ?? null }
      groups.set(key, g)
    }
    g.total += amount
    g.months.add(month)
    g.count += 1
    if (r.date > g.last) g.last = r.date
    if (cat?.name) g.catName.set(cat.name, (g.catName.get(cat.name) ?? 0) + 1)
    if (!g.catIcon && cat?.icon) g.catIcon = cat.icon
  }

  const items: RecurringItem[] = []
  for (const [key, g] of groups) {
    if (g.months.size < 3) continue   // recurring = ≥3 distinct months
    // Most frequent category for this merchant.
    let topCat: string | null = null, topN = 0
    for (const [name, n] of g.catName) if (n > topN) { topN = n; topCat = name }
    items.push({
      key,
      icon:          g.catIcon,
      category:      topCat,
      monthlyAmount: Math.round((g.total / g.months.size) * 100) / 100,
      months:        g.months.size,
      occurrences:   g.count,
      lastDate:      g.last,
    })
  }

  items.sort((a, b) => b.monthlyAmount - a.monthlyAmount)
  const top = items.slice(0, 8)
  const totalMonthly = Math.round(items.reduce((s, i) => s + i.monthlyAmount, 0) * 100) / 100

  return NextResponse.json<{ data: RecurringResponse }>({ data: { items: top, totalMonthly } })
}
