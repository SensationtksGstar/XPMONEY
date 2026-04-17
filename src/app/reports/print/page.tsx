import { auth }             from '@clerk/nextjs/server'
import { redirect }          from 'next/navigation'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getUserProfile }    from '@/lib/userCache'
import { formatCurrency }    from '@/lib/utils'
import { toNumber }          from '@/lib/safeNumber'
import { PrintButton }       from '@/components/reports/PrintButton'

/**
 * /reports/print — printable financial report page for Pro / Family users.
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
 * Trade-offs vs server-side PDF:
 *   ✗ No cron-friendly automated PDF generation (needs a real browser)
 *   ✓ Zero serverless cold-start cost
 *   ✓ Works offline after the page loads
 *   ✓ Users can re-style / customise via browser print settings
 */

export const metadata = { title: 'Relatório financeiro' }

const PLAN_RANK: Record<string, number> = {
  free:    0,
  premium: 1,
  // legacy aliases — antigos plus/pro/family continuam a poder exportar
  plus:    1,
  pro:     1,
  family:  1,
}

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

export default async function ReportPrintPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const cached = await getUserProfile(userId)
  const plan   = (cached?.plan ?? 'free') as keyof typeof PLAN_RANK
  const rank   = PLAN_RANK[plan] ?? 0

  // Só Premium pode ver o relatório completo. Free vê um upsell.
  if (rank < 1) {
    return (
      <main className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center p-6 print:hidden">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">👑</div>
          <h1 className="text-2xl font-bold">Relatório PDF é uma funcionalidade Premium</h1>
          <p className="text-white/60">
            Faz upgrade para o plano Premium para exportar o teu relatório financeiro completo em PDF,
            com histórico mensal, categorias, score e evolução do teu mascote.
          </p>
          <a
            href="/settings/billing"
            className="inline-block bg-purple-500 hover:bg-purple-400 text-white font-bold px-6 py-3 rounded-xl"
          >
            Fazer upgrade
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

  // ── Parallel fetch: everything the report needs ─────────────────────────
  const now     = new Date()
  const year    = now.getFullYear()
  // ISO truncated to month start (first day of current month)
  const monthStart = new Date(year, now.getMonth(), 1).toISOString()

  const [txRes, scoreRes, xpRes, vxRes, goalsRes] = await Promise.all([
    db.from('transactions')
      .select('id, amount, type, date, category_id, description')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .order('date', { ascending: false }),
    db.from('financial_scores')
      .select('score, computed_at')
      .eq('user_id', user.id)
      .order('computed_at', { ascending: false })
      .limit(12),
    db.from('xp_progress')
      .select('xp_total, level')
      .eq('user_id', user.id)
      .maybeSingle(),
    db.from('voltix_states')
      .select('evolution_level, mood, streak_days')
      .eq('user_id', user.id)
      .maybeSingle(),
    db.from('goals')
      .select('id, name, target_amount, current_amount, deadline')
      .eq('user_id', user.id),
  ])

  const txs      = txRes.data   ?? []
  const scores   = scoreRes.data ?? []
  const xp       = xpRes.data
  const voltix   = vxRes.data
  const goals    = goalsRes.data ?? []

  // Summaries
  const income   = txs.filter(t => t.type === 'income').reduce((a, t) => a + toNumber(t.amount, 0), 0)
  const expenses = txs.filter(t => t.type === 'expense').reduce((a, t) => a + toNumber(t.amount, 0), 0)
  const balance  = income - expenses
  const latestScore = scores[0] ? toNumber(scores[0].score, 0) : 0
  const avgScore    = scores.length > 0
    ? scores.reduce((a, s) => a + toNumber(s.score, 0), 0) / scores.length
    : 0

  // Category grouping
  const { data: cats } = await db
    .from('categories')
    .select('id, name, icon')
    .or(`user_id.eq.${user.id},is_default.eq.true`)
  const catMap = new Map((cats ?? []).map(c => [c.id as string, c]))

  const byCategory = new Map<string, { name: string; icon: string; total: number; count: number }>()
  for (const t of txs) {
    if (t.type !== 'expense') continue
    const cat = t.category_id ? catMap.get(t.category_id) : null
    const key = cat?.name ?? 'Sem categoria'
    const icon = cat?.icon ?? '📦'
    const cur  = byCategory.get(key) ?? { name: key, icon, total: 0, count: 0 }
    cur.total += toNumber(t.amount, 0)
    cur.count += 1
    byCategory.set(key, cur)
  }
  const categoryRows = [...byCategory.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const currency = (user.currency as string) || 'EUR'
  const issuedAt = now.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <main className="min-h-screen bg-white text-[#0a0f1e] print:bg-white">
      {/* Print stylesheet — strips nav / buttons, maps colors to grayscale-friendly */}
      <style>{`
        @page { margin: 18mm 14mm; size: A4; }
        @media print {
          html, body { background: white !important; }
          .no-print  { display: none !important; }
          .break     { page-break-after: always; }
        }
      `}</style>

      {/* Floating print button — not included in the printed PDF */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton />
        <a
          href="/settings"
          className="px-4 py-2.5 rounded-xl bg-white border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50"
        >
          Voltar
        </a>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-10">

        {/* Header */}
        <header className="flex items-start justify-between border-b-2 border-emerald-600 pb-5 mb-6">
          <div>
            <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest mb-1">Relatório Financeiro</p>
            <h1 className="text-3xl font-bold">{user.name ?? 'Utilizador'}</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Emitido</p>
            <p className="font-bold">{issuedAt}</p>
            <p className="text-[10px] text-gray-400 mt-1">Plano {plan.toUpperCase()}</p>
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid grid-cols-3 gap-3 mb-8">
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Rendimentos (mês)</p>
            <p className="text-2xl font-bold text-emerald-700">+{formatCurrency(income, currency)}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Despesas (mês)</p>
            <p className="text-2xl font-bold text-red-700">−{formatCurrency(expenses, currency)}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Balanço</p>
            <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {balance >= 0 ? '+' : '−'}{formatCurrency(Math.abs(balance), currency)}
            </p>
          </div>
        </section>

        {/* Score + XP stats */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">Saúde financeira</h2>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Score atual</p>
              <p className="font-bold text-lg">{Math.round(latestScore)}/100</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Score médio 12m</p>
              <p className="font-bold text-lg">{Math.round(avgScore)}/100</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Nível XP</p>
              <p className="font-bold text-lg">{xp?.level ?? 1} ({xp?.xp_total ?? 0} XP)</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Mascote</p>
              <p className="font-bold text-lg">Evo {voltix?.evolution_level ?? 1} · {voltix?.streak_days ?? 0}d</p>
            </div>
          </div>
        </section>

        {/* Top categories */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">Top 10 Categorias (despesa este mês)</h2>
          {categoryRows.length === 0 ? (
            <p className="text-gray-400 text-sm italic">Sem despesas registadas este mês.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Categoria</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Nº</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Total</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">% despesas</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map(c => (
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

        {/* Goals */}
        {goals.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 mb-3">Poupanças e objetivos</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Objetivo</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Poupado</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Meta</th>
                  <th className="text-right py-2 text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Progresso</th>
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
                        {dl && <p className="text-[10px] text-gray-400">Até {dl.toLocaleDateString('pt-PT')}</p>}
                      </td>
                      <td className="py-2 text-right">{formatCurrency(saved, currency)}</td>
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

        {/* Footer */}
        <footer className="mt-12 pt-5 border-t border-gray-200 text-[10px] text-gray-400 flex items-center justify-between">
          <span>Gerado por XP-Money · xpmoney.app</span>
          <span>Para fins informativos — não substitui aconselhamento financeiro profissional.</span>
        </footer>
      </div>
    </main>
  )
}
