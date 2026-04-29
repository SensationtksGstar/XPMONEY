import { auth }              from '@clerk/nextjs/server'
import { redirect }           from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getUserProfile }     from '@/lib/userCache'
import { formatCurrency }     from '@/lib/utils'
import { toNumber }           from '@/lib/safeNumber'
import { PrintButton }        from '@/components/reports/PrintButton'
import { getServerT, getServerLocale } from '@/lib/i18n/server'

/**
 * /reports/print — printable financial report page for Premium users.
 *
 * Architecture choice: server-rendered HTML + a print stylesheet.
 * The user clicks "Exportar PDF" in Settings, we open this page in a new tab,
 * the PrintButton client component fires `window.print()` once the data is
 * ready, and the browser's native Save-as-PDF dialog appears. No Chromium,
 * no @react-pdf, no wasm bundle — just the browser's print engine.
 *
 * Gating: checked here (not at the API edge) because this is a regular page
 * route. Free users get a friendly upsell card; Premium users get the report.
 *
 * Layout (rebuilt April 2026 after audit flagged the old version as
 * "incomplete and incoherent"):
 *
 *   PAGE 1 — Overview
 *     Header · narrative line · summary cards (income/expenses/balance) ·
 *     month-over-month delta · financial health snapshot
 *
 *   PAGE 2 — Where the money went
 *     Top expense categories · top income sources · top 5 single
 *     transactions · weekday spending pattern
 *
 *   PAGE 3 — Goals & PT tax notes
 *     Active goals with progress · IRS-deductible category totals
 *     (PT locale only — hidden for EN users)
 *
 *   PAGE 4 — Full transaction list
 *     Every transaction of the month, sorted by date desc
 *
 * Trade-offs vs server-side PDF:
 *   ✗ No cron-friendly automated PDF generation (needs a real browser)
 *   ✓ Zero serverless cold-start cost
 *   ✓ Works offline after the page loads
 *   ✓ Users can re-style / customise via browser print settings
 */

export const metadata = { title: 'Relatório financeiro' }
// Force dynamic — the report MUST reflect today's data, not a cached snapshot
export const dynamic    = 'force-dynamic'
export const revalidate = 0

const PLAN_RANK: Record<string, number> = {
  free:    0,
  premium: 1,
  // legacy aliases — antigos plus/pro/family continuam a poder exportar
  plus:    1,
  pro:     1,
  family:  1,
}

// PT IRS-deductible categories. Names match the seed in database/schema.sql.
// When the user switches to standard regime / changes category names this
// stays correct because it's matched on the seeded `name`.
const FISCAL_HEALTH_CATS    = ['Saúde']
const FISCAL_EDUCATION_CATS = ['Educação']
const FISCAL_HOME_CATS      = ['Casa']
// "Despesas gerais familiares" — broad category that benefits from VAT
// deduction. Most everyday spending qualifies, but for the report we only
// surface categories where the user clearly recorded receipt-bearing
// purchases.
const FISCAL_GENERAL_CATS   = ['Alimentação', 'Roupas', 'Tecnologia', 'Lazer']

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

// 0 = Sunday in JS Date.getDay(); we want Monday-first to match PT conventions
function dayKeyFromDate(iso: string): 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun' {
  const d = new Date(iso).getDay()
  return (['sun','mon','tue','wed','thu','fri','sat'] as const)[d]
}

export default async function ReportPrintPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const t      = await getServerT()
  const locale = await getServerLocale()

  const cached = await getUserProfile(userId)
  const plan   = (cached?.plan ?? 'free') as keyof typeof PLAN_RANK
  const rank   = PLAN_RANK[plan] ?? 0

  // Free users see an upsell. Premium gets the full report.
  if (rank < 1) {
    return (
      <main className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center p-6 print:hidden">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">👑</div>
          <h1 className="text-2xl font-bold">{t('report.lock_title')}</h1>
          <p className="text-white/60">{t('report.lock_desc')}</p>
          <a
            href="/settings/billing"
            className="inline-block bg-purple-500 hover:bg-purple-400 text-white font-bold px-6 py-3 rounded-xl"
          >
            {t('report.lock_cta')}
          </a>
        </div>
      </main>
    )
  }

  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users')
    .select('id, name, email, currency')
    .eq('clerk_id', userId)
    .maybeSingle()

  if (!user) redirect('/sign-in')

  // ── Date windows ──
  const now             = new Date()
  const year            = now.getFullYear()
  const monthStart      = new Date(year, now.getMonth(),     1).toISOString().split('T')[0]
  const lastMonthStart  = new Date(year, now.getMonth() - 1, 1).toISOString().split('T')[0]
  const lastMonthEndExclusive = monthStart   // i.e. >= lastMonthStart AND < monthStart
  // Score history reaches back ~12 months for the trend metric
  const yearAgoIso      = new Date(now.getTime() - 365 * 86_400_000).toISOString()
  // XP history is bounded to the current month for the "earned this month" stat
  const monthStartIso   = new Date(year, now.getMonth(), 1).toISOString()

  // ── Parallel fetch ──
  // Score column: `calculated_at` per database/schema.sql (was `computed_at`
  // in earlier code — that was a typo causing latestScore/avgScore to silently
  // be 0 because the order-by hit a non-existent column. Fixed April 2026.)
  const [
    txMonthRes, txLastMonthRes, scoreRes, xpRes, vxRes, goalsRes,
    xpHistoryRes, catsRes,
  ] = await Promise.all([
    db.from('transactions')
      .select('id, amount, type, date, category_id, description')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .order('date', { ascending: false }),
    db.from('transactions')
      .select('amount, type')
      .eq('user_id', user.id)
      .gte('date', lastMonthStart)
      .lt('date', lastMonthEndExclusive),
    db.from('financial_scores')
      .select('score, calculated_at')
      .eq('user_id', user.id)
      .gte('calculated_at', yearAgoIso)
      .order('calculated_at', { ascending: false })
      .limit(50),
    db.from('xp_progress')
      .select('xp_total, level')
      .eq('user_id', user.id)
      .maybeSingle(),
    db.from('voltix_states')
      .select('evolution_level, mood, streak_days')
      .eq('user_id', user.id)
      .maybeSingle(),
    db.from('goals')
      .select('id, name, target_amount, current_amount, deadline, status')
      .eq('user_id', user.id),
    db.from('xp_history')
      .select('amount')
      .eq('user_id', user.id)
      .gte('earned_at', monthStartIso),
    db.from('categories')
      .select('id, name, icon')
      .or(`user_id.eq.${user.id},is_default.eq.true`),
  ])

  const txs        = txMonthRes.data       ?? []
  const txsLast    = txLastMonthRes.data   ?? []
  const scores     = scoreRes.data         ?? []
  const xp         = xpRes.data
  const voltix     = vxRes.data
  const goals      = (goalsRes.data ?? []).filter(g => g.status !== 'failed')
  const xpHistory  = xpHistoryRes.data     ?? []
  const cats       = catsRes.data          ?? []
  const catMap     = new Map(cats.map(c => [c.id as string, c]))

  // ── Aggregates: current month ──
  const income   = txs.filter(x => x.type === 'income') .reduce((s, x) => s + toNumber(x.amount, 0), 0)
  const expenses = txs.filter(x => x.type === 'expense').reduce((s, x) => s + toNumber(x.amount, 0), 0)
  const balance  = income - expenses

  // ── Aggregates: previous month (for delta cards) ──
  const incomeLast   = txsLast.filter(x => x.type === 'income') .reduce((s, x) => s + toNumber(x.amount, 0), 0)
  const expensesLast = txsLast.filter(x => x.type === 'expense').reduce((s, x) => s + toNumber(x.amount, 0), 0)
  const balanceLast  = incomeLast - expensesLast
  const hasLastMonthData = txsLast.length > 0

  // ── Score: latest + 12-month average ──
  const latestScore = scores[0] ? toNumber(scores[0].score, 0) : 0
  const avgScore    = scores.length > 0
    ? scores.reduce((a, s) => a + toNumber(s.score, 0), 0) / scores.length
    : 0

  // ── XP this month ──
  const xpThisMonth = xpHistory.reduce((s, h) => s + toNumber(h.amount, 0), 0)

  // ── Top 10 expense categories ──
  type CatRow = { name: string; icon: string; total: number; count: number }
  const expByCat = new Map<string, CatRow>()
  for (const x of txs) {
    if (x.type !== 'expense') continue
    const cat  = x.category_id ? catMap.get(x.category_id) : null
    const name = cat?.name ?? '—'
    const icon = cat?.icon ?? '📦'
    const cur  = expByCat.get(name) ?? { name, icon, total: 0, count: 0 }
    cur.total += toNumber(x.amount, 0)
    cur.count += 1
    expByCat.set(name, cur)
  }
  const expenseCategoryRows = [...expByCat.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // ── Top 5 income sources ──
  const incByCat = new Map<string, CatRow>()
  for (const x of txs) {
    if (x.type !== 'income') continue
    const cat  = x.category_id ? catMap.get(x.category_id) : null
    const name = cat?.name ?? '—'
    const icon = cat?.icon ?? '💼'
    const cur  = incByCat.get(name) ?? { name, icon, total: 0, count: 0 }
    cur.total += toNumber(x.amount, 0)
    cur.count += 1
    incByCat.set(name, cur)
  }
  const incomeCategoryRows = [...incByCat.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // ── Top 5 single-transaction expenses (where did the money REALLY go?) ──
  const topExpenses = [...txs]
    .filter(x => x.type === 'expense')
    .map(x => ({
      ...x,
      _amount: toNumber(x.amount, 0),
      _cat:    x.category_id ? (catMap.get(x.category_id)?.name ?? '—') : '—',
      _icon:   x.category_id ? (catMap.get(x.category_id)?.icon ?? '📦') : '📦',
    }))
    .sort((a, b) => b._amount - a._amount)
    .slice(0, 5)

  // ── Weekday pattern (Mon..Sun spend totals) ──
  type WeekdayKey = ReturnType<typeof dayKeyFromDate>
  const weekdaySpend: Record<WeekdayKey, number> = {
    mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0,
  }
  for (const x of txs) {
    if (x.type !== 'expense') continue
    weekdaySpend[dayKeyFromDate(x.date as string)] += toNumber(x.amount, 0)
  }
  const weekdayMax = Math.max(...Object.values(weekdaySpend), 1)

  // ── PT fiscal totals (only meaningful for PT users) ──
  function sumExpensesByCatNames(names: string[]): number {
    let total = 0
    for (const x of txs) {
      if (x.type !== 'expense') continue
      const cat  = x.category_id ? catMap.get(x.category_id) : null
      if (cat && names.includes(cat.name)) total += toNumber(x.amount, 0)
    }
    return total
  }
  const fiscalHealth    = sumExpensesByCatNames(FISCAL_HEALTH_CATS)
  const fiscalEducation = sumExpensesByCatNames(FISCAL_EDUCATION_CATS)
  const fiscalHome      = sumExpensesByCatNames(FISCAL_HOME_CATS)
  const fiscalGeneral   = sumExpensesByCatNames(FISCAL_GENERAL_CATS)
  const showFiscal      = locale === 'pt' && (fiscalHealth + fiscalEducation + fiscalHome + fiscalGeneral) > 0

  // ── Display helpers ──
  const currency = (user.currency as string) || 'EUR'
  const issuedAt = now.toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-PT', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const monthLabel = now.toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-PT', {
    month: 'long', year: 'numeric',
  })

  function deltaPct(curr: number, prev: number): { txt: string; positive: boolean | null } {
    if (prev === 0) {
      if (curr === 0) return { txt: '—', positive: null }
      return { txt: '+∞%', positive: curr > 0 }
    }
    const pct = ((curr - prev) / Math.abs(prev)) * 100
    const sign = pct > 0 ? '+' : ''
    return { txt: `${sign}${pct.toFixed(1)}%`, positive: pct > 0 }
  }
  function deltaAbs(curr: number, prev: number): string {
    const d = curr - prev
    return `${d >= 0 ? '+' : '−'}${formatCurrency(Math.abs(d), currency)}`
  }

  const incomeDelta   = deltaPct(income,   incomeLast)
  const expensesDelta = deltaPct(expenses, expensesLast)
  const balanceDelta  = deltaPct(balance,  balanceLast)

  // Narrative line — short human summary at the top of page 1
  const narrativeKey = balance >= 0 ? 'report.narrative_pos' : 'report.narrative_neg'
  const narrative    = t(narrativeKey, {
    month:    monthLabel,
    income:   formatCurrency(income, currency),
    expenses: formatCurrency(expenses, currency),
    balance:  `${balance >= 0 ? '+' : '−'}${formatCurrency(Math.abs(balance), currency)}`,
    delta:    hasLastMonthData ? deltaAbs(balance, balanceLast) : '—',
  })

  return (
    <main className="min-h-screen bg-white text-[#0a0f1e] print:bg-white">
      {/* Print stylesheet — strips nav / buttons, sets A4 margins, defines
          page-break helpers (.break = always, .avoid = avoid splitting),
          and forces desktop-style card layout in the printed PDF even when
          the user clicks "Save as PDF" from a mobile browser.

          Why the print overrides: iOS Safari (and some Android browsers)
          use the SCREEN viewport for the print engine instead of the @page
          A4 dimensions. Without these overrides, mobile users got cards
          with 24-px text overflowing 110-px-wide containers — the bug
          flagged April 2026. */}
      <style>{`
        @page { margin: 16mm 14mm; size: A4; }
        @media print {
          html, body { background: white !important; }
          .no-print  { display: none !important; }
          .break     { page-break-before: always; }
          .avoid     { page-break-inside: avoid; }
          /* Force the 3-column summary grid to render at desktop widths
             regardless of which viewport the print engine inherited. */
          .report-summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .report-delta-grid   { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .report-summary-card { padding: 1rem !important; }
          /* Snap value text back to desktop size so it fits in the card. */
          .report-summary-value { font-size: 1.375rem !important; line-height: 1.75rem !important; }
          /* Outer container — keep wide horizontal padding on print. */
          .report-container { padding-left: 2rem !important; padding-right: 2rem !important; }
        }
      `}</style>

      {/* Floating action bar — not printed */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton />
        <a
          href="/settings"
          className="px-4 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50"
        >
          {t('report.back')}
        </a>
      </div>

      <div className="report-container max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-10">

        {/* ═══ HEADER ═══════════════════════════════════════════════════ */}
        <header className="flex items-start justify-between border-b-2 border-emerald-600 pb-5 mb-6 avoid">
          <div>
            <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest mb-1">
              {t('report.title')}
            </p>
            <h1 className="text-3xl font-bold">{user.name ?? t('report.fallback_user')}</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{t('report.issued')}</p>
            <p className="font-bold">{issuedAt}</p>
            <p className="text-[10px] text-gray-400 mt-1">
              {t('report.plan_prefix')} {plan === 'free' ? 'FREE' : 'PREMIUM'}
            </p>
          </div>
        </header>

        {/* ═══ NARRATIVE ════════════════════════════════════════════════ */}
        <p className="text-sm text-gray-700 leading-relaxed mb-6 italic avoid">
          {narrative}
        </p>

        {/* ═══ SUMMARY CARDS ════════════════════════════════════════════
            Mobile (screen): 1-col stack so €1.500,00 never overflows on a
            375-px viewport. Tablet+ and print: 3-col side-by-side. The
            print stylesheet above forces 3-col even when iOS Safari uses
            the screen viewport for printing. `tabular-nums` keeps digits
            aligned vertically when stacked. */}
        <section className="report-summary-grid grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 avoid">
          <div className="report-summary-card border border-gray-200 rounded-lg p-3 sm:p-4 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('report.summary.income')}</p>
            <p className="report-summary-value text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums break-words">
              +{formatCurrency(income, currency)}
            </p>
          </div>
          <div className="report-summary-card border border-gray-200 rounded-lg p-3 sm:p-4 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('report.summary.expenses')}</p>
            <p className="report-summary-value text-xl sm:text-2xl font-bold text-red-700 tabular-nums break-words">
              −{formatCurrency(expenses, currency)}
            </p>
          </div>
          <div className="report-summary-card border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('report.summary.balance')}</p>
            <p className={`report-summary-value text-xl sm:text-2xl font-bold tabular-nums break-words ${balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {balance >= 0 ? '+' : '−'}{formatCurrency(Math.abs(balance), currency)}
            </p>
          </div>
        </section>

        {/* ═══ DELTA CARDS (vs previous month) ══════════════════════════ */}
        <section className="mb-8 avoid">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">
            {t('report.compare.title')}
          </h2>
          {hasLastMonthData ? (
            <div className="report-delta-grid grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <DeltaRow label={t('report.compare.income')}   delta={incomeDelta}   diff={deltaAbs(income,   incomeLast)}   invert={false} />
              <DeltaRow label={t('report.compare.expenses')} delta={expensesDelta} diff={deltaAbs(expenses, expensesLast)} invert={true} />
              <DeltaRow label={t('report.compare.balance')}  delta={balanceDelta}  diff={deltaAbs(balance,  balanceLast)}  invert={false} />
            </div>
          ) : (
            <p className="text-gray-400 text-sm italic">{t('report.compare.no_data')}</p>
          )}
        </section>

        {/* ═══ HEALTH SNAPSHOT ══════════════════════════════════════════ */}
        <section className="mb-2 avoid">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">
            {t('report.health.title')}
          </h2>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">{t('report.health.score_now')}</p>
              <p className="font-bold text-lg">{Math.round(latestScore)}/100</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">{t('report.health.score_avg')}</p>
              <p className="font-bold text-lg">{Math.round(avgScore)}/100</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">{t('report.health.level')}</p>
              <p className="font-bold text-lg">{xp?.level ?? 1} ({xp?.xp_total ?? 0} XP)</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">{t('report.health.mascot')}</p>
              <p className="font-bold text-lg">
                {t('report.health.evo_streak', { evo: voltix?.evolution_level ?? 1, days: voltix?.streak_days ?? 0 })}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {t('report.health.xp_month', { xp: xpThisMonth })}
          </p>
        </section>

        {/* ═══ PAGE 2 — Where the money went ════════════════════════════ */}
        <div className="break" />

        {/* ─── Top expense categories ─── */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">
            {t('report.outflow.title')}
          </h2>
          {expenseCategoryRows.length === 0 ? (
            <p className="text-gray-400 text-sm italic">{t('report.outflow.empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.outflow.col_category')}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.outflow.col_count')}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.outflow.col_total')}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.outflow.col_pct')}</th>
                </tr>
              </thead>
              <tbody>
                {expenseCategoryRows.map(c => (
                  <tr key={c.name} className="border-b border-gray-100">
                    <td className="py-2"><span className="mr-2">{c.icon}</span>{c.name}</td>
                    <td className="py-2 text-right text-gray-500">{c.count}</td>
                    <td className="py-2 text-right font-semibold">{formatCurrency(c.total, currency)}</td>
                    <td className="py-2 text-right text-gray-500">
                      {expenses > 0 ? ((c.total / expenses) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ─── Top income sources ─── */}
        <section className="mb-8 avoid">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">
            {t('report.income_sources.title')}
          </h2>
          {incomeCategoryRows.length === 0 ? (
            <p className="text-gray-400 text-sm italic">{t('report.income_sources.empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.outflow.col_category')}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.outflow.col_count')}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.outflow.col_total')}</th>
                </tr>
              </thead>
              <tbody>
                {incomeCategoryRows.map(c => (
                  <tr key={c.name} className="border-b border-gray-100">
                    <td className="py-2"><span className="mr-2">{c.icon}</span>{c.name}</td>
                    <td className="py-2 text-right text-gray-500">{c.count}</td>
                    <td className="py-2 text-right font-semibold text-emerald-700">+{formatCurrency(c.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ─── Top 5 single transactions ─── */}
        <section className="mb-8 avoid">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">
            {t('report.top_tx.title')}
          </h2>
          {topExpenses.length === 0 ? (
            <p className="text-gray-400 text-sm italic">{t('report.top_tx.empty')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.top_tx.col_date')}</th>
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.top_tx.col_description')}</th>
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.top_tx.col_category')}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.top_tx.col_amount')}</th>
                </tr>
              </thead>
              <tbody>
                {topExpenses.map(x => (
                  <tr key={x.id as string} className="border-b border-gray-100">
                    <td className="py-2 text-gray-500 whitespace-nowrap">
                      {new Date(x.date as string).toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-PT', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="py-2 truncate max-w-[200px]">{x.description || '—'}</td>
                    <td className="py-2 text-gray-500"><span className="mr-1">{x._icon}</span>{x._cat}</td>
                    <td className="py-2 text-right font-semibold text-red-700">−{formatCurrency(x._amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ─── Weekday spending pattern ─── */}
        <section className="mb-2 avoid">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">
            {t('report.weekday.title')}
          </h2>
          {expenses === 0 ? (
            <p className="text-gray-400 text-sm italic">{t('report.weekday.empty')}</p>
          ) : (
            <div className="space-y-2">
              {(['mon','tue','wed','thu','fri','sat','sun'] as const).map(k => {
                const total = weekdaySpend[k]
                const pct   = (total / weekdayMax) * 100
                return (
                  <div key={k} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-10 font-semibold">{t(`report.weekday.${k}` as 'report.weekday.mon')}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded relative overflow-hidden">
                      <div
                        className="h-full bg-red-200"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-700 w-24 text-right tabular-nums font-semibold">
                      {formatCurrency(total, currency)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ═══ PAGE 3 — Goals & PT tax ══════════════════════════════════ */}
        {(goals.length > 0 || showFiscal) && <div className="break" />}

        {/* ─── Goals ─── */}
        {goals.length > 0 && (
          <section className="mb-8 avoid">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">
              {t('report.goals.title')}
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.goals.col_name')}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.goals.col_saved')}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.goals.col_target')}</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.goals.col_progress')}</th>
                </tr>
              </thead>
              <tbody>
                {goals.map(g => {
                  const saved  = toNumber(g.current_amount, 0)
                  const target = toNumber(g.target_amount, 0)
                  const pct    = target > 0 ? Math.min(100, (saved / target) * 100) : 0
                  const dl     = toDate(g.deadline as string | null)
                  return (
                    <tr key={g.id as string} className="border-b border-gray-100">
                      <td className="py-2">
                        <p className="font-medium">{g.name}</p>
                        {dl && (
                          <p className="text-[10px] text-gray-400">
                            {t('report.goals.deadline_until', {
                              date: dl.toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-PT'),
                            })}
                          </p>
                        )}
                      </td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(saved, currency)}</td>
                      <td className="py-2 text-right text-gray-500">{formatCurrency(target, currency)}</td>
                      <td className="py-2 text-right">
                        <span className="inline-block w-14 text-right font-semibold">{pct.toFixed(0)}%</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* ─── PT fiscal notes (PT locale only, hidden if all zeros) ─── */}
        {showFiscal && (
          <section className="mb-8 avoid bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800 mb-2">
              {t('report.fiscal.title')}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                <FiscalRow label={t('report.fiscal.health')}    value={fiscalHealth}    currency={currency} hide={fiscalHealth === 0} />
                <FiscalRow label={t('report.fiscal.education')} value={fiscalEducation} currency={currency} hide={fiscalEducation === 0} />
                <FiscalRow label={t('report.fiscal.home')}      value={fiscalHome}      currency={currency} hide={fiscalHome === 0} />
                <FiscalRow label={t('report.fiscal.general')}   value={fiscalGeneral}   currency={currency} hide={fiscalGeneral === 0} />
              </tbody>
            </table>
            <p className="text-[10px] text-amber-700 mt-2 leading-relaxed">
              {t('report.fiscal.disclaimer')}
            </p>
          </section>
        )}

        {/* ═══ PAGE 4 — Full transaction list ═══════════════════════════ */}
        {txs.length > 0 && <div className="break" />}

        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">
            {t('report.full_tx.title')} ({txs.length})
          </h2>
          {txs.length === 0 ? (
            <p className="text-gray-400 text-sm italic">{t('report.full_tx.empty')}</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.full_tx.col_date')}</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.full_tx.col_category')}</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.full_tx.col_description')}</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{t('report.full_tx.col_amount')}</th>
                </tr>
              </thead>
              <tbody>
                {txs.map(x => {
                  const cat  = x.category_id ? catMap.get(x.category_id) : null
                  const amt  = toNumber(x.amount, 0)
                  const isIn = x.type === 'income'
                  return (
                    <tr key={x.id as string} className="border-b border-gray-100">
                      <td className="py-1.5 text-gray-500 whitespace-nowrap">
                        {new Date(x.date as string).toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-PT', { day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className="py-1.5 text-gray-600">
                        <span className="mr-1">{cat?.icon ?? '📦'}</span>{cat?.name ?? '—'}
                      </td>
                      <td className="py-1.5 truncate max-w-[260px]">{x.description || '—'}</td>
                      <td className={`py-1.5 text-right font-semibold tabular-nums ${isIn ? 'text-emerald-700' : 'text-red-700'}`}>
                        {isIn ? '+' : '−'}{formatCurrency(amt, currency)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* ═══ FOOTER ═══════════════════════════════════════════════════ */}
        <footer className="mt-12 pt-5 border-t border-gray-200 text-[10px] text-gray-400 flex items-center justify-between gap-4 flex-wrap">
          <span>{t('report.footer_brand')}</span>
          <span className="text-right">{t('report.footer_disclaimer')}</span>
        </footer>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational helpers
// ─────────────────────────────────────────────────────────────────────────────

interface DeltaRowProps {
  label:  string
  delta:  { txt: string; positive: boolean | null }
  diff:   string
  /** When true, "positive" delta means worse (e.g. expenses going up). */
  invert: boolean
}
function DeltaRow({ label, delta, diff, invert }: DeltaRowProps) {
  // Colour rule:
  //   - income up   = good (green)
  //   - expenses up = bad  (red)   → invert
  //   - balance up  = good (green)
  // Neutral when prev was 0 (no baseline).
  const isGood =
    delta.positive === null ? null
    : invert ? !delta.positive
    :          delta.positive
  const colour =
    isGood === null ? 'text-gray-500'
    : isGood        ? 'text-emerald-700'
    :                 'text-red-700'

  return (
    <div className="border border-gray-200 rounded-lg p-3 min-w-0">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-base font-bold tabular-nums break-words ${colour}`}>{delta.txt}</p>
      <p className="text-[11px] text-gray-500 tabular-nums break-words">{diff}</p>
    </div>
  )
}

interface FiscalRowProps {
  label:    string
  value:    number
  currency: string
  hide?:    boolean
}
function FiscalRow({ label, value, currency, hide }: FiscalRowProps) {
  if (hide) return null
  return (
    <tr className="border-b border-amber-200/60 last:border-0">
      <td className="py-1.5 text-amber-900">{label}</td>
      <td className="py-1.5 text-right font-semibold tabular-nums text-amber-900">
        {formatCurrency(value, currency)}
      </td>
    </tr>
  )
}
