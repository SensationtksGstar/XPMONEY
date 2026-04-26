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
      toast('Dívidas ilimitadas exigem Premium.', 'info')
      return
    }
    try {
      await createDebt(input)
      toast('Dívida adicionada', 'success')
      setShowForm(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro desconhecido', 'error')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDebt(id)
      toast('Dívida removida', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro desconhecido', 'error')
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
            Mata-Dívidas
          </h1>
          <p className="text-sm text-white/50">
            Regista, traça a estratégia e abate cada dívida com o seu saldo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4" />
          Nova dívida
        </button>
      </div>

      {isFree && (
        <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/25 rounded-xl p-4">
          <Crown className="w-5 h-5 text-purple-300 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-purple-200">
              Grátis inclui 1 dívida — Premium tem ilimitadas
            </p>
            <p className="text-xs text-white/60 mt-0.5">
              Regista uma para testares a mecânica. Dívidas adicionais + XP por ataque
              são Premium (€4,99/mês).
            </p>
          </div>
          <Link
            href="/settings/billing"
            className="text-xs text-purple-300 font-bold hover:text-purple-100 whitespace-nowrap"
          >
            Ver planos →
          </Link>
        </div>
      )}

      {/* ── Lista de dívidas ───────────────────────────────────────── */}
      {debts.length === 0 ? (
        <EmptyState
          icon={<Sword className="w-10 h-10 text-white/30" />}
          title="Ainda não registaste dívidas"
          description="Começa por adicionar uma para ver o plano de abate."
          action={{
            label:   'Adicionar dívida',
            onClick: () => setShowForm(true),
          }}
        />
      ) : (
        <>
          {/* Totais */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Dívida actual</p>
              <p className="text-xl font-black text-red-300">{formatCurrency(totalBalance)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Já abatido</p>
              <p className="text-xl font-black text-green-300">{formatCurrency(paidOff)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Progresso</p>
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
                Dívidas activas ({active.length})
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
                Abatidas ({killed.length})
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
                        Abatida {d.killed_at ? new Date(d.killed_at).toLocaleDateString('pt-PT') : ''}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-green-300">
                      {formatCurrency(Number(d.initial_amount))}
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
          title="Eliminar dívida?"
          description="O histórico de ataques também é apagado. Esta acção não pode ser desfeita."
          confirmLabel="Eliminar"
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
            Plano de abate
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Quanto consegues pagar acima do mínimo por mês?
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
            aria-label="Amortização extra mensal"
          />
          <span className="text-xs text-white/40">/mês</span>
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
                Poupa €{compare.savings.toFixed(0)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/55 leading-relaxed">
            Ataca a de juro mais alto primeiro. Matemática pura, menos juros totais.
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
            <span className="font-bold text-white text-sm">Bola de Neve</span>
            {compare.better === 'snowball' && (
              <span className="text-[9px] font-bold bg-blue-400/25 text-blue-200 px-1.5 py-0.5 rounded-full uppercase">
                Poupa €{compare.savings.toFixed(0)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/55 leading-relaxed">
            Ataca a menor primeiro. Vitórias rápidas, motivação alta.
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
                <strong className="text-blue-100">Estratégias equivalentes</strong> com
                a tua configuração ({debts.length === 1 ? 'só 1 dívida activa' : 'taxas / saldos parecidos'}).
                Avalanche e Bola de Neve dão o mesmo resultado — escolhe a que te motivar mais.
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
                {formatMonths(avM)} · <span className="text-orange-300">{formatCurrency(avI)}</span>
              </p>
              {/* Full attack queue — prevents the "it's always the same
                  debt" confusion when the user has 2+ debts. */}
              {avQ.length > 0 && renderQueue(avQ)}
            </div>
            <div className={`rounded-xl border p-3 ${
              strategy === 'snowball' ? 'border-blue-400/40 bg-blue-500/8' : 'border-white/8 bg-white/3'
            }`}>
              <p className="uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1">
                <span aria-hidden>❄️</span> Bola de Neve
              </p>
              <p className="text-white/85 tabular-nums">
                {formatMonths(snM)} · <span className="text-orange-300">{formatCurrency(snI)}</span>
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
              A prestação mínima + €{(parseFloat(monthlyExtra) || 0).toFixed(0)} não cobre
              os juros. Aumenta o extra mensal ou reduz uma dívida para ver o plano.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Livre em</p>
              <p className="text-xl font-black text-white">
                {formatMonths(plan.monthsToFree)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Juros totais</p>
              <p className="text-xl font-black text-orange-300">
                {formatCurrency(plan.totalInterest)}
              </p>
            </div>
          </div>
        )}

        {firstTarget && !plan.infinite && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs">
            <span className="text-white/40">Próxima a abater:</span>
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
        const base    = parseFloat(monthlyExtra) || 0
        const ladder  = base === 0
          ? [0, 50, 100, 200, 500]
          : [0, Math.round(base / 2), Math.round(base), Math.round(base * 2), Math.round(base * 3)]
        const amounts = Array.from(new Set(ladder)).sort((a, b) => a - b)
        const sims    = amounts.map(amt => ({
          amt,
          ...simulatePlan(debts, amt, strategy),
        }))
        const noExtra = sims.find(s => s.amt === 0 && !s.infinite)
        const baseline = noExtra?.totalInterest ?? null

        // If everything diverges (e.g. user has only crippling debts), don't
        // show the table — would be confusing. Need at least 2 viable rows.
        const viable = sims.filter(s => !s.infinite)
        if (viable.length < 2) return null

        return (
          <div className="bg-black/20 border border-white/8 rounded-xl p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
              <TrendingDown className="w-3 h-3 text-emerald-400" />
              E se pagares mais por mês?
            </p>
            <div className="space-y-1">
              {sims.map(s => {
                const isCurrent = Math.abs(s.amt - Math.round(base)) < 0.5
                const savings   = baseline !== null ? baseline - s.totalInterest : null
                const isBetter  = savings !== null && savings > 0.5

                if (s.infinite) {
                  return (
                    <div
                      key={s.amt}
                      className="flex items-center gap-2 text-[11px] text-white/35 px-2 py-1.5 rounded-lg"
                    >
                      <span className="font-semibold tabular-nums w-16">€{s.amt}/mês</span>
                      <span className="italic">não chega para os juros</span>
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
                    <span className={`font-semibold tabular-nums w-16 ${isCurrent ? 'text-yellow-200' : ''}`}>
                      €{s.amt}/mês
                    </span>
                    <span className="text-white/50 tabular-nums w-20">
                      {formatMonths(s.monthsToFree)}
                    </span>
                    <span className="text-orange-300/85 tabular-nums flex-1 text-right">
                      {formatCurrency(s.totalInterest)}
                    </span>
                    {isBetter && (
                      <span className="text-emerald-300 font-bold tabular-nums">
                        −{formatCurrency(savings ?? 0)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-white/35 mt-2 leading-relaxed">
              Toca numa linha para definir esse extra. A coluna verde é o que poupas em juros face a pagar só os mínimos.
            </p>
          </div>
        )
      })()}
    </div>
  )
}

// ── Row de dívida na lista ────────────────────────────────────────────

function DebtRow({ debt, onDelete }: { debt: Debt; onDelete: () => void }) {
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
                {debt.interest_rate.toFixed(2)}% TAEG
              </span>
            )}
          </div>
          <p className="text-xs text-white/50">
            Mín. mensal {formatCurrency(Number(debt.min_payment))} · {cat.label}
          </p>
        </div>
        <button
          type="button"
          onClick={e => { e.preventDefault(); onDelete() }}
          aria-label="Eliminar dívida"
          className="text-white/40 hover:text-red-400 transition-colors opacity-60 md:opacity-0 md:group-hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-end justify-between mb-1.5">
        <span className="text-xs text-white/50">Saldo actual</span>
        <span className="text-lg font-black text-white">
          {formatCurrency(current)}
          <span className="text-xs text-white/40 font-normal"> / {formatCurrency(initial)}</span>
        </span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-white/40">
        <span>{pct}% abatido</span>
        <span className="flex items-center gap-1 text-red-300 font-semibold">
          <TrendingDown className="w-3 h-3" />
          Atacar →
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
          <h2 className="text-lg font-bold text-white">Nova dívida</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            className="text-white/40 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {disabled && (
          <div className="bg-purple-500/10 border border-purple-500/25 rounded-lg px-3 py-2 text-xs text-purple-200 flex items-center gap-2">
            <Crown className="w-4 h-4 flex-shrink-0" />
            Já tens 1 dívida — Premium desbloqueia ilimitadas.
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1.5">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="Ex: Cartão Millennium"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 outline-none focus:border-red-500/50 transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-white/60">Categoria</label>
            <button
              type="button"
              onClick={() => setIsCustomCat(v => !v)}
              className="text-[11px] text-red-300 hover:text-red-200 font-semibold"
            >
              {isCustomCat ? '← Pré-definidas' : 'Criar categoria +'}
            </button>
          </div>
          {isCustomCat ? (
            <input
              type="text"
              value={customCategory}
              onChange={e => setCustom(e.target.value)}
              maxLength={40}
              placeholder="Ex: empréstimo-pai"
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
                  <span className="block text-[9px] text-white/70 leading-tight">{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">Saldo actual</label>
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
            <label className="block text-xs font-semibold text-white/60 mb-1.5">Taxa anual %</label>
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
          <label className="block text-xs font-semibold text-white/60 mb-1.5">Prestação mínima mensal</label>
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
            Cancelar
          </button>
          <button
            type="submit"
            disabled={disabled || submitting || !name.trim() || !amount}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
          >
            {submitting ? <Spinner size="sm" /> : <><Check className="w-4 h-4" /> Registar</>}
          </button>
        </div>
      </form>
    </div>
  )
}
