'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Sword, PlusCircle, Trash2, Check, X, Zap, Crown,
  TrendingDown, ArrowRight, Target, Info,
} from 'lucide-react'
import { useUserPlan } from '@/lib/contexts/UserPlanContext'
import { useDebts }    from '@/hooks/useDebts'
import {
  DEBT_CATEGORIES,
  resolveCategory,
  simulatePlan,
  compareStrategies,
  orderByStrategy,
  formatMonths,
  type Debt,
  type DebtStrategy,
} from '@/lib/killDebt'
import { formatCurrency } from '@/lib/utils'
import { parseAmountLocale } from '@/lib/safeNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/toaster'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { catLabel } from '@/lib/debtCategoryLabel'

/**
 * /dividas — página principal do Kill Debt.
 *
 * Layout:
 *   1. Header com totais (saldo total, nº de dívidas, meses até livre)
 *   2. Planeador — input "amortização extra mensal" + toggle avalanche/snowball
 *      + comparação side-by-side dos dois planos
 *   3. Lista de dívidas activas (cartão com barra de progresso, taxa, min payment)
 *   4. Dívidas já abatidas (collapsible, fica como trophy wall)
 *   5. Formulário de adicionar — modal
 *
 * Gating:
 *   • Premium: dívidas ilimitadas, planeador, ataques, XP.
 *   • Free:    pode ver UI/simular 1 dívida como teaser; ao tentar criar a 2ª
 *              surge paywall. Isto evita que o free user sinta que a feature
 *              "não faz nada" e ao mesmo tempo cria clara barreira à segunda.
 */

const FREE_LIMIT = 1

export default function DividasPage() {
  const { plan } = useUserPlan()
  const isFree = plan === 'free'
  const { debts, loading, createDebt, updateDebt, deleteDebt, isCreating } = useDebts()
  const { toast } = useToast()
  const { t, locale } = useLocale()

  const [showForm, setShowForm]             = useState(false)
  const [deleteId, setDeleteId]             = useState<string | null>(null)
  const [monthlyExtra, setMonthlyExtra]     = useState<string>('100')
  const [strategy, setStrategy]             = useState<DebtStrategy>('avalanche')

  const active  = useMemo(() => debts.filter(d => d.status === 'active'),  [debts])
  const killed  = useMemo(() => debts.filter(d => d.status === 'killed'),  [debts])

  const totalBalance = active.reduce((s, d) => s + Number(d.current_amount), 0)
  const totalInitial = debts.reduce((s, d) => s + Number(d.initial_amount), 0)
  const paidOff      = Math.max(0, totalInitial - totalBalance)
  const pctPaid      = totalInitial > 0 ? Math.round((paidOff / totalInitial) * 100) : 0

  const extraNum = parseAmountLocale(monthlyExtra) || 0
  const plan_    = useMemo(() => simulatePlan(active, extraNum, strategy), [active, extraNum, strategy])
  const compare  = useMemo(() => compareStrategies(active, extraNum), [active, extraNum])

  async function handleCreate(input: Partial<Debt>) {
    if (isFree && active.length >= FREE_LIMIT) {
      toast(t('dividas.toast_unlimited'), 'info')
      return
    }
    try {
      await createDebt(input)
      toast(t('dividas.toast_added'), 'success')
      setShowForm(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('dividas.toast_error'), 'error')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDebt(id)
      toast(t('dividas.toast_removed'), 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : t('dividas.toast_error'), 'error')
    } finally {
      setDeleteId(null)
    }
  }

  async function handleStrategyChange(s: DebtStrategy) {
    setStrategy(s)
    // Propaga para TODAS as dívidas activas (simplifica a mental model:
    // user tem uma estratégia, não uma por dívida)
    await Promise.all(
      active.map(d =>
        d.strategy !== s ? updateDebt({ id: d.id, strategy: s }) : Promise.resolve(),
      ),
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Sword className="w-6 h-6 text-red-400" />
            {t('debt.title')}
          </h1>
          <p className="text-sm text-white/50">
            {t('dividas.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4" />
          {t('dividas.new')}
        </button>
      </div>

      {isFree && (
        <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/25 rounded-xl p-4">
          <Crown className="w-5 h-5 text-purple-300 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-purple-200">
              {t('dividas.free_title')}
            </p>
            <p className="text-xs text-white/60 mt-0.5">
              {t('dividas.free_body')}
            </p>
          </div>
          <Link
            href="/settings/billing"
            className="text-xs text-purple-300 font-bold hover:text-purple-100 whitespace-nowrap"
          >
            {t('dividas.see_plans')} →
          </Link>
        </div>
      )}

      {/* ── Lista de dívidas ───────────────────────────────────────── */}
      {debts.length === 0 ? (
        <EmptyState
          icon={<Sword className="w-10 h-10 text-white/30" />}
          title={t('dividas.empty_title')}
          description={t('dividas.empty_desc')}
          action={{
            label:   t('dividas.empty_action'),
            onClick: () => setShowForm(true),
          }}
        />
      ) : (
        <>
          {/* Totais */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t('dividas.total_current')}</p>
              <p className="text-xl font-black text-red-300">{formatCurrency(totalBalance, 'EUR', locale)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t('dividas.total_paid')}</p>
              <p className="text-xl font-black text-green-300">{formatCurrency(paidOff, 'EUR', locale)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t('dividas.progress')}</p>
              <p className="text-xl font-black text-white">{pctPaid}%</p>
            </div>
          </div>

          {/* Planeador */}
          {active.length > 0 && (
            <Planeador
              monthlyExtra={monthlyExtra}
              setMonthlyExtra={setMonthlyExtra}
              strategy={strategy}
              setStrategy={handleStrategyChange}
              plan={plan_}
              compare={compare}
              debts={active}
            />
          )}

          {/* Dívidas activas */}
          {active.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-red-400" />
                {t('dividas.active_heading')} ({active.length})
              </h2>
              <div className="space-y-3">
                {active.map(d => (
                  <DebtRow key={d.id} debt={d} onDelete={() => setDeleteId(d.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Dívidas abatidas */}
          {killed.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                {t('dividas.killed_heading')} ({killed.length})
              </h2>
              <div className="space-y-2">
                {killed.map(d => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3"
                  >
                    <span className="text-lg" aria-hidden>{resolveCategory(d.category).icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{d.name}</p>
                      <p className="text-xs text-white/45">
                        {t('dividas.killed_on', {
                          date: d.killed_at
                            ? new Date(d.killed_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-PT')
                            : '',
                        })}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-green-300">
                      {formatCurrency(Number(d.initial_amount), 'EUR', locale)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modal de criar dívida ──────────────────────────────────── */}
      {showForm && (
        <DebtForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          submitting={isCreating}
          disabled={isFree && active.length >= FREE_LIMIT}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          open
          title={t('dividas.del_title')}
          description={t('dividas.del_desc')}
          confirmLabel={t('dividas.del_confirm')}
          tone="danger"
          onClose={() => setDeleteId(null)}
          onConfirm={() => handleDelete(deleteId)}
        />
      )}
    </div>
  )
}

// ── Planeador — caixa com input + toggle + plano ──────────────────────

function Planeador({
  monthlyExtra, setMonthlyExtra, strategy, setStrategy, plan, compare, debts,
}: {
  monthlyExtra:    string
  setMonthlyExtra: (v: string) => void
  strategy:        DebtStrategy
  setStrategy:     (s: DebtStrategy) => void
  plan:            ReturnType<typeof simulatePlan>
  compare:         ReturnType<typeof compareStrategies>
  debts:           Debt[]
}) {
  const { t, locale } = useLocale()
  const firstTarget = debts.length > 0
    ? debts
        .slice()
        .sort((a, b) => strategy === 'avalanche'
          ? b.interest_rate - a.interest_rate
          : a.current_amount - b.current_amount,
        )[0]
    : null

  return (
    <div className="bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border border-red-500/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-300" />
            {t('dividas.plan_title')}
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            {t('dividas.plan_q')}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2">
          <span className="text-white/40 text-sm">€</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9.,]*"
            value={monthlyExtra}
            onChange={e => setMonthlyExtra(e.target.value)}
            className="w-20 bg-transparent text-white font-bold outline-none"
            aria-label={t('dividas.extra_aria')}
          />
          <span className="text-xs text-white/40">{t('budget.income_unit')}</span>
        </div>
      </div>

      {/* Toggle estratégia */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setStrategy('avalanche')}
          className={`p-3 rounded-xl border text-left transition-all ${
            strategy === 'avalanche'
              ? 'border-yellow-400/60 bg-yellow-500/10'
              : 'border-white/10 bg-white/3 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden className="text-lg">🏔️</span>
            <span className="font-bold text-white text-sm">Avalanche</span>
            {compare.better === 'avalanche' && (
              <span className="text-[9px] font-bold bg-yellow-400/25 text-yellow-200 px-1.5 py-0.5 rounded-full uppercase">
                {t('dividas.saves', { n: compare.savings.toFixed(0) })}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/55 leading-relaxed">
            {t('dividas.avalanche_desc')}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setStrategy('snowball')}
          className={`p-3 rounded-xl border text-left transition-all ${
            strategy === 'snowball'
              ? 'border-blue-400/60 bg-blue-500/10'
              : 'border-white/10 bg-white/3 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden className="text-lg">❄️</span>
            <span className="font-bold text-white text-sm">{t('dividas.snowball')}</span>
            {compare.better === 'snowball' && (
              <span className="text-[9px] font-bold bg-blue-400/25 text-blue-200 px-1.5 py-0.5 rounded-full uppercase">
                {t('dividas.saves', { n: compare.savings.toFixed(0) })}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/55 leading-relaxed">
            {t('dividas.snowball_desc')}
          </p>
        </button>
      </div>

      {/* Comparação directa das duas estratégias — fica SEMPRE visível
          para que a diferença (ou a falta dela) não passe despercebida.
          Antes só mudava um chip "Poupa €X" e os números do `plan` activo,
          o que em casos degenerados (1 dívida, extra=0, taxas iguais)
          faziam parecer que o toggle não tinha efeito. */}
      {!plan.infinite && (() => {
        const avM = compare.avalanche.monthsToFree
        const snM = compare.snowball.monthsToFree
        const avI = compare.avalanche.totalInterest
        const snI = compare.snowball.totalInterest
        const tied = avM === snM && Math.abs(avI - snI) < 0.5

        if (tied) {
          return (
            <div className="bg-blue-500/10 border border-blue-400/25 rounded-xl px-3 py-2 flex items-start gap-2 text-xs text-blue-200">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed">
                <strong className="text-blue-100">{t('dividas.equiv_title')}</strong>{' '}
                {t('dividas.equiv_rest', {
                  cond: debts.length === 1 ? t('dividas.equiv_1debt') : t('dividas.equiv_similar'),
                })}
              </p>
            </div>
          )
        }

        // Ordered attack queue per strategy. Reusing orderByStrategy ensures
        // the visible list matches what simulatePlan internally iterates,
        // so the user sees exactly the path the math is taking.
        const avQ = orderByStrategy(debts, 'avalanche')
        const snQ = orderByStrategy(debts, 'snowball')
        const renderQueue = (queue: Debt[]) => (
          <ol className="mt-2 space-y-0.5 text-[11px] text-white/70">
            {queue.map((d, i) => (
              <li key={d.id} className="flex items-center gap-1.5 truncate">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[9px] font-bold text-white/70 flex-shrink-0">
                  {i + 1}
                </span>
                <span aria-hidden className="text-sm flex-shrink-0">{resolveCategory(d.category).icon}</span>
                <span className="truncate">{d.name}</span>
              </li>
            ))}
          </ol>
        )

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className={`rounded-xl border p-3 ${
              strategy === 'avalanche' ? 'border-yellow-400/40 bg-yellow-500/8' : 'border-white/8 bg-white/3'
            }`}>
              <p className="uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1">
                <span aria-hidden>🏔️</span> Avalanche
              </p>
              <p className="text-white/85 tabular-nums">
                {formatMonths(avM, locale)} · <span className="text-orange-300">{formatCurrency(avI, 'EUR', locale)}</span>
              </p>
              {/* Full attack queue — prevents the "it's always the same
                  debt" confusion when the user has 2+ debts. */}
              {avQ.length > 0 && renderQueue(avQ)}
            </div>
            <div className={`rounded-xl border p-3 ${
              strategy === 'snowball' ? 'border-blue-400/40 bg-blue-500/8' : 'border-white/8 bg-white/3'
            }`}>
              <p className="uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1">
                <span aria-hidden>❄️</span> {t('dividas.snowball')}
              </p>
              <p className="text-white/85 tabular-nums">
                {formatMonths(snM, locale)} · <span className="text-orange-300">{formatCurrency(snI, 'EUR', locale)}</span>
              </p>
              {snQ.length > 0 && renderQueue(snQ)}
            </div>
          </div>
        )
      })()}

      {/* Resultado do plano */}
      <div className="bg-black/30 border border-white/5 rounded-xl p-4">
        {plan.infinite ? (
          <div className="flex items-start gap-2 text-orange-300">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-xs leading-relaxed">
              {t('dividas.infinite', { extra: (parseFloat(monthlyExtra) || 0).toFixed(0) })}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t('dividas.free_in')}</p>
              <p className="text-xl font-black text-white">
                {formatMonths(plan.monthsToFree, locale)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{t('dividas.total_interest')}</p>
              <p className="text-xl font-black text-orange-300">
                {formatCurrency(plan.totalInterest, 'EUR', locale)}
              </p>
            </div>
          </div>
        )}

        {firstTarget && !plan.infinite && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs">
            <span className="text-white/40">{t('dividas.next_target')}</span>
            <span aria-hidden>{resolveCategory(firstTarget.category).icon}</span>
            <Link
              href={`/dividas/${firstTarget.id}`}
              className="font-semibold text-white hover:text-yellow-300 truncate"
            >
              {firstTarget.name}
            </Link>
            <ArrowRight className="w-3 h-3 text-white/30 ml-auto" />
          </div>
        )}
      </div>

      {/* ── Sensitivity table — "what if I pay more?" ─────────────────
          Lets the user FEEL how their monthly extra translates into total
          interest paid. The biggest behaviour-change lever in debt-payoff
          UX is showing that doubling a small extra often halves total
          interest — without this table the math stays abstract. Each row
          is clickable: tapping it sets `monthlyExtra` to that scenario,
          turning the table into a "what-if" tuner.

          Anchored around the current extra so a user already paying
          €100/mo sees €0, €50, €100, €200, €300; a user with no extra
          sees a fixed ladder (50/100/200/500). All scenarios that fail
          to converge (interest > min payment) are filtered out so the
          row doesn't lie. */}
      {(() => {
        // Use parseAmountLocale (PT decimal-comma + thousand-dot aware) for
        // consistency with the rest of the page. parseFloat alone gives
        // wrong results on "1.234,56"-shaped input.
        const base = parseAmountLocale(monthlyExtra) || 0

        // Sanity-cap: if the user has typed an absurdly high extra (e.g.
        // missing decimal — "437400" intended as €4 374,00), the ladder
        // runs ×3 = €1 312 200/mês which trivially clears any debt in 1
        // month. Every scenario above the "instant kill" threshold then
        // produces identical numbers, making the ladder useless.
        //
        // Clamp the base used for ladder generation to "what could
        // realistically pay off the largest debt in 1 month" — that's the
        // upper bound where any extra makes a different outcome.
        const totalBalance  = debts.reduce((s, d) => s + Number(d.current_amount), 0)
        const totalMinMonth = debts.reduce((s, d) => s + Number(d.min_payment), 0)
        const cap           = Math.max(500, totalBalance + totalMinMonth)
        const baseClamped   = Math.min(base, cap)

        const ladder  = baseClamped === 0
          ? [0, 50, 100, 200, 500]
          : [0, Math.round(baseClamped / 2), Math.round(baseClamped), Math.round(baseClamped * 2), Math.round(baseClamped * 3)]
        const amounts = Array.from(new Set(ladder.map(a => Math.min(a, cap)))).sort((a, b) => a - b)
        const sims    = amounts.map(amt => ({
          amt,
          ...simulatePlan(debts, amt, strategy),
        }))
        const noExtra = sims.find(s => s.amt === 0 && !s.infinite)
        const baseline = noExtra?.totalInterest ?? null

        // Drop scenarios that produce IDENTICAL outcomes (months + interest
        // both match a previously-shown row). Anything beyond the
        // "instant kill" threshold collapses to the same numbers — showing
        // 4 rows with the same answer reads as a UI bug.
        const seen   = new Set<string>()
        const unique = sims.filter(s => {
          if (s.infinite) return true   // distinguishable as "não chega"
          const key = `${s.monthsToFree}|${s.totalInterest.toFixed(2)}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        // If everything diverges (e.g. user has only crippling debts), don't
        // show the table — would be confusing. Need at least 2 viable rows.
        const viable = unique.filter(s => !s.infinite)
        if (viable.length < 2) return null

        return (
          <div className="bg-black/20 border border-white/8 rounded-xl p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
              <TrendingDown className="w-3 h-3 text-emerald-400" />
              {t('dividas.what_if')}
            </p>
            <div className="space-y-1">
              {unique.map(s => {
                const isCurrent = Math.abs(s.amt - Math.round(base)) < 0.5
                const savings   = baseline !== null ? baseline - s.totalInterest : null
                const isBetter  = savings !== null && savings > 0.5
                // Format the amount with PT thousand separator so 4374 reads
                // as "€4 374" instead of the unreadable "€4374" / "€218700"
                // that surfaced when the input was set to a typo (e.g.
                // missing decimal). 4-digit and below stay unsegmented for
                // visual rhythm.
                const amtLabel = s.amt < 10_000
                  ? `€${s.amt}${t('budget.income_unit')}`
                  : `€${s.amt.toLocaleString(locale === 'en' ? 'en-US' : 'pt-PT')}${t('budget.income_unit')}`

                if (s.infinite) {
                  return (
                    <div
                      key={s.amt}
                      className="flex items-center gap-2 text-[11px] text-white/35 px-2 py-1.5 rounded-lg"
                    >
                      <span className="font-semibold tabular-nums w-20 truncate">{amtLabel}</span>
                      <span className="italic">{t('dividas.not_enough')}</span>
                    </div>
                  )
                }

                return (
                  <button
                    key={s.amt}
                    type="button"
                    onClick={() => setMonthlyExtra(String(s.amt))}
                    className={`w-full flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg transition-colors text-left ${
                      isCurrent
                        ? 'bg-yellow-500/15 border border-yellow-400/40 text-white'
                        : 'bg-white/3 hover:bg-white/8 border border-white/5 text-white/75'
                    }`}
                  >
                    <span className={`font-semibold tabular-nums w-24 truncate ${isCurrent ? 'text-yellow-200' : ''}`}>
                      {amtLabel}
                    </span>
                    <span className="text-white/50 tabular-nums w-20">
                      {formatMonths(s.monthsToFree, locale)}
                    </span>
                    <span className="text-orange-300/85 tabular-nums flex-1 text-right">
                      {formatCurrency(s.totalInterest, 'EUR', locale)}
                    </span>
                    {isBetter && (
                      <span className="text-emerald-300 font-bold tabular-nums">
                        −{formatCurrency(savings ?? 0, 'EUR', locale)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-white/35 mt-2 leading-relaxed">
              {t('dividas.what_if_hint')}
            </p>
          </div>
        )
      })()}
    </div>
  )
}

// ── Row de dívida na lista ────────────────────────────────────────────

function DebtRow({ debt, onDelete }: { debt: Debt; onDelete: () => void }) {
  const { t, locale } = useLocale()
  const cat     = resolveCategory(debt.category)
  const current = Number(debt.current_amount)
  const initial = Number(debt.initial_amount)
  const pct     = initial > 0 ? Math.min(100, Math.round(((initial - current) / initial) * 100)) : 0

  return (
    <Link
      href={`/dividas/${debt.id}`}
      className="group block bg-white/5 border border-white/10 hover:border-red-500/40 rounded-2xl p-4 transition-colors"
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-2xl flex-shrink-0" aria-hidden>{cat.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white truncate">{debt.name}</h3>
            {debt.interest_rate > 0 && (
              <span className="text-[10px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded-full">
                {t('dividas.apr', { rate: debt.interest_rate.toFixed(2) })}
              </span>
            )}
          </div>
          <p className="text-xs text-white/50">
            {t('dividas.min_monthly', { amount: formatCurrency(Number(debt.min_payment), 'EUR', locale) })} · {catLabel(debt.category, cat.label, t)}
          </p>
        </div>
        <button
          type="button"
          onClick={e => { e.preventDefault(); onDelete() }}
          aria-label={t('dividas.delete_aria')}
          className="text-white/40 hover:text-red-400 transition-colors opacity-60 md:opacity-0 md:group-hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-end justify-between mb-1.5">
        <span className="text-xs text-white/50">{t('dividas.current_balance')}</span>
        <span className="text-lg font-black text-white">
          {formatCurrency(current, 'EUR', locale)}
          <span className="text-xs text-white/40 font-normal"> / {formatCurrency(initial, 'EUR', locale)}</span>
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-white/40">
        <span>{t('dividas.pct_paid', { pct })}</span>
        <span className="flex items-center gap-1 text-red-300 font-semibold">
          <TrendingDown className="w-3 h-3" />
          {t('dividas.attack')} →
        </span>
      </div>
    </Link>
  )
}

// ── Form de criar dívida ──────────────────────────────────────────────

function DebtForm({
  onSubmit, onCancel, submitting, disabled,
}: {
  onSubmit:   (input: Partial<Debt>) => void
  onCancel:   () => void
  submitting: boolean
  disabled:   boolean
}) {
  const { t } = useLocale()
  const [name, setName]               = useState('')
  const [category, setCategory]       = useState<string>('cartao')
  const [customCategory, setCustom]   = useState('')
  const [amount, setAmount]           = useState('')
  const [rate, setRate]               = useState('')
  const [minPayment, setMinPayment]   = useState('')
  const [isCustomCat, setIsCustomCat] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const finalCategory = isCustomCat
      ? (customCategory.trim().toLowerCase() || 'outro')
      : category
    const parsed: Partial<Debt> = {
      name:           name.trim(),
      category:       finalCategory,
      initial_amount: parseAmountLocale(amount) || 0,
      current_amount: parseAmountLocale(amount) || 0,
      interest_rate:  parseAmountLocale(rate)   || 0,
      min_payment:    parseAmountLocale(minPayment) || 0,
    }
    if (!parsed.name || !parsed.initial_amount) return
    onSubmit(parsed)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg bg-[#0a1220] border border-white/10 rounded-2xl p-5 max-h-[90vh] overflow-y-auto space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{t('dividas.new')}</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('dividas.close')}
            className="text-white/40 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {disabled && (
          <div className="bg-purple-500/10 border border-purple-500/25 rounded-lg px-3 py-2 text-xs text-purple-200 flex items-center gap-2">
            <Crown className="w-4 h-4 flex-shrink-0" />
            {t('dividas.form_paywall')}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1.5">{t('dividas.name')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder={t('dividas.name_ph')}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 outline-none focus:border-red-500/50 transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-white/60">{t('dividas.category')}</label>
            <button
              type="button"
              onClick={() => setIsCustomCat(v => !v)}
              className="text-[11px] text-red-300 hover:text-red-200 font-semibold"
            >
              {isCustomCat ? t('dividas.predefined') : t('dividas.create_cat')}
            </button>
          </div>
          {isCustomCat ? (
            <input
              type="text"
              value={customCategory}
              onChange={e => setCustom(e.target.value)}
              maxLength={40}
              placeholder={t('dividas.custom_cat_ph')}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 outline-none focus:border-red-500/50 transition-colors"
            />
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {DEBT_CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    category === c.id
                      ? 'border-red-400/60 bg-red-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <span className="block text-xl mb-0.5" aria-hidden>{c.icon}</span>
                  <span className="block text-[9px] text-white/70 leading-tight">{catLabel(c.id, c.label, t)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">{t('dividas.current_balance')}</label>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 focus-within:border-red-500/50">
              <span className="text-white/40">€</span>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9.,]*"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                placeholder="1500,00"
                className="flex-1 bg-transparent text-white placeholder-white/30 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">{t('dividas.rate')}</label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9.,]*"
              value={rate}
              onChange={e => setRate(e.target.value)}
              placeholder="14,99"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 outline-none focus:border-red-500/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1.5">{t('dividas.min_payment')}</label>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 focus-within:border-red-500/50">
            <span className="text-white/40">€</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9.,]*"
              value={minPayment}
              onChange={e => setMinPayment(e.target.value)}
              placeholder="50,00"
              className="flex-1 bg-transparent text-white placeholder-white/30 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 min-h-[44px]"
          >
            {t('budget.cancel')}
          </button>
          <button
            type="submit"
            disabled={disabled || submitting || !name.trim() || !amount}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
          >
            {submitting ? <Spinner size="sm" /> : <><Check className="w-4 h-4" /> {t('dividas.register')}</>}
          </button>
        </div>
      </form>
    </div>
  )
}
