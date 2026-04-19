'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  PiggyBank, Settings as SettingsIcon, Check, AlertTriangle,
  Info, Sparkles, ArrowRight, RotateCcw, Flame,
} from 'lucide-react'
import Link from 'next/link'
import { useBudget, useBudgetStatus } from '@/hooks/useBudget'
import {
  BUCKET_LABELS, BUCKET_DESCRIPTIONS, BUCKET_COLORS,
  validatePercentages, type BudgetBucket, type BucketStatus,
} from '@/lib/budget'
import { formatCurrency } from '@/lib/utils'
import { parseAmountLocale } from '@/lib/safeNumber'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/toaster'

// recharts é ~100 KB gz — carrega só quando o user chega à página
// e o chart entra em vista (via dynamic).
const BudgetHistory = dynamic(
  () => import('@/components/budget/BudgetHistory').then(m => ({ default: m.BudgetHistory })),
  { ssr: false, loading: () => <div className="h-64 bg-white/5 rounded-2xl animate-pulse" /> },
)

/**
 * /orcamento — Orçamento Pessoal 50/30/20 (feature FREE).
 *
 * Fluxo:
 *   - Primeira visita: onboarding de 2 passos (rendimento + percentagens).
 *   - Visitas seguintes: dashboard com 3 barras de progresso, uma por
 *     bucket (needs/wants/savings), top categorias em cada, alertas
 *     quando >80% do limite.
 *   - Botão "Editar" volta ao onboarding com os valores pré-preenchidos.
 *
 * Feature é FREE — é o anzol de retenção. Users free + premium igualmente.
 */

export default function OrcamentoPage() {
  const { budget, loading, save, isSaving } = useBudget()
  const { data: status, isLoading: statusLoading } = useBudgetStatus()
  const { toast } = useToast()

  const [editing, setEditing] = useState(false)

  // Se ainda não há config, força setup na primeira visita
  useEffect(() => {
    if (!loading && !budget) setEditing(true)
  }, [loading, budget])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner /></div>
  }

  if (editing || !budget) {
    return (
      <BudgetSetup
        initial={budget ? {
          monthly_income: Number(budget.monthly_income),
          pct_needs:      Number(budget.pct_needs),
          pct_wants:      Number(budget.pct_wants),
          pct_savings:    Number(budget.pct_savings),
        } : null}
        onCancel={budget ? () => setEditing(false) : undefined}
        onSave={async input => {
          try {
            await save(input)
            toast('Orçamento guardado', 'success')
            setEditing(false)
          } catch (err) {
            toast(err instanceof Error ? err.message : 'Erro ao guardar', 'error')
          }
        }}
        saving={isSaving}
      />
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-emerald-400" />
            Orçamento
          </h1>
          <p className="text-sm text-white/50">
            Método 50/30/20 · {status?.month ?? '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white bg-white/5 border border-white/10 px-3 py-2 rounded-lg font-semibold min-h-[40px]"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          Editar
        </button>
      </div>

      {statusLoading || !status ? (
        <div className="h-40 bg-white/3 rounded-2xl animate-pulse" />
      ) : (
        <BudgetDashboard status={status} />
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────

function BudgetDashboard({ status }: { status: NonNullable<ReturnType<typeof useBudgetStatus>['data']> }) {
  const pctTotal = status.income > 0 ? (status.totalSpent / status.income) * 100 : 0
  const overrun = status.totalRemaining < 0
  const hasAlert = status.buckets.some(b => b.severity !== 'ok')

  return (
    <>
      {/* Resumo */}
      <div className="bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <SummaryStat label="Rendimento" value={formatCurrency(status.income)} tone="neutral" />
          <SummaryStat label="Já gasto"    value={formatCurrency(status.totalSpent)} tone="warn" />
          <SummaryStat
            label={overrun ? 'Em dívida' : 'Ainda disponível'}
            value={formatCurrency(Math.abs(status.totalRemaining))}
            tone={overrun ? 'bad' : 'good'}
          />
        </div>
        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              overrun
                ? 'bg-gradient-to-r from-rose-500 to-orange-500'
                : pctTotal > 80
                ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                : 'bg-gradient-to-r from-emerald-400 to-green-500'
            }`}
            style={{ width: `${Math.min(100, pctTotal)}%` }}
          />
        </div>
        <p className="text-xs text-white/50 mt-1.5 tabular-nums">
          {pctTotal.toFixed(0)}% do rendimento
        </p>
      </div>

      {/* Alerta agregado se algum bucket a rebentar */}
      {hasAlert && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            Uma ou mais categorias passaram dos 80% do limite. Vê em baixo
            quais — e considera reduzir antes do fim do mês.
          </div>
        </div>
      )}

      {/* Buckets */}
      <div className="space-y-3">
        {status.buckets.map(b => <BucketCard key={b.bucket} bucket={b} />)}
      </div>

      {/* Histórico — 6 meses de despesas empilhadas por bucket */}
      <BudgetHistory />

      {/* CTA — transações */}
      <div className="flex items-center justify-between bg-white/3 border border-white/10 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-white/40" />
          <p className="text-xs text-white/60">
            Regista as tuas despesas para ver o orçamento actualizar em tempo real.
          </p>
        </div>
        <Link
          href="/transactions"
          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 whitespace-nowrap"
        >
          Transações <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </>
  )
}

function SummaryStat({
  label, value, tone,
}: {
  label: string; value: string; tone: 'neutral' | 'good' | 'bad' | 'warn'
}) {
  const toneClass =
    tone === 'good' ? 'text-emerald-300' :
    tone === 'bad'  ? 'text-rose-300'    :
    tone === 'warn' ? 'text-amber-300'   :
                      'text-white'
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">{label}</p>
      <p className={`text-lg font-black ${toneClass} tabular-nums`}>{value}</p>
    </div>
  )
}

function BucketCard({ bucket }: { bucket: BucketStatus }) {
  const colors = BUCKET_COLORS[bucket.bucket]
  const sevIcon = bucket.severity === 'over'
    ? <Flame className="w-3.5 h-3.5" />
    : bucket.severity === 'caution'
    ? <AlertTriangle className="w-3.5 h-3.5" />
    : <Check className="w-3.5 h-3.5" />
  const sevColor =
    bucket.severity === 'over'    ? 'text-rose-300 bg-rose-500/15 border-rose-500/30'  :
    bucket.severity === 'caution' ? 'text-amber-300 bg-amber-500/15 border-amber-500/30' :
                                    'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
  const pctText =
    bucket.severity === 'over'    ? `${(bucket.pct - 100).toFixed(0)}% acima` :
    bucket.severity === 'caution' ? `${bucket.pct.toFixed(0)}% usado`         :
                                    `${bucket.pct.toFixed(0)}% usado`

  return (
    <div className={`border ${colors.border} ${colors.bg} rounded-2xl p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className={`font-bold ${colors.text} text-base`}>
            {bucket.label}
            <span className="text-white/40 font-normal ml-2 text-sm">
              {bucket.bucket === 'needs' ? '50%' : bucket.bucket === 'wants' ? '30%' : '20%'}
            </span>
          </h3>
          <p className="text-xs text-white/50 mt-0.5">
            {BUCKET_DESCRIPTIONS[bucket.bucket]}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${sevColor}`}>
          {sevIcon}
          {pctText}
        </span>
      </div>

      {/* Valores + barra */}
      <div className="flex items-end justify-between mb-1.5 text-sm">
        <span className="text-white tabular-nums">
          <strong className="font-black text-lg">{formatCurrency(bucket.spent)}</strong>
          <span className="text-white/40"> / {formatCurrency(bucket.limit)}</span>
        </span>
        <span className="text-xs text-white/50 tabular-nums">
          {bucket.limit - bucket.spent >= 0
            ? `${formatCurrency(bucket.limit - bucket.spent)} livre`
            : `${formatCurrency(Math.abs(bucket.limit - bucket.spent))} acima`}
        </span>
      </div>
      <div className="h-2 bg-black/30 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all bg-gradient-to-r ${
            bucket.severity === 'over'
              ? 'from-rose-500 to-orange-500'
              : bucket.severity === 'caution'
              ? 'from-amber-500 to-orange-400'
              : colors.bar
          }`}
          style={{ width: `${Math.min(100, bucket.pct)}%` }}
        />
      </div>

      {/* Top categorias */}
      {bucket.topCategories.length > 0 && (
        <div className="space-y-1">
          {bucket.topCategories.map(c => (
            <div key={c.name} className="flex items-center gap-2 text-xs">
              <span aria-hidden>{c.icon ?? '📎'}</span>
              <span className="text-white/70 flex-1 truncate">{c.name}</span>
              <span className="text-white/85 font-semibold tabular-nums">
                {formatCurrency(c.total)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Setup (onboarding / editar) ───────────────────────────────────────

interface SetupProps {
  initial: {
    monthly_income: number
    pct_needs:      number
    pct_wants:      number
    pct_savings:    number
  } | null
  onSave:   (input: SetupProps['initial'] extends null
    ? { monthly_income: number; pct_needs: number; pct_wants: number; pct_savings: number }
    : never) => void | Promise<void>
  onCancel?: () => void
  saving:   boolean
}

function BudgetSetup({
  initial, onSave, onCancel, saving,
}: {
  initial: { monthly_income: number; pct_needs: number; pct_wants: number; pct_savings: number } | null
  onSave:  (input: { monthly_income: number; pct_needs: number; pct_wants: number; pct_savings: number }) => void | Promise<void>
  onCancel?: () => void
  saving:  boolean
}) {
  const [income, setIncome]           = useState<string>(initial ? String(Math.round(initial.monthly_income)) : '')
  const [needs, setNeeds]             = useState<number>(initial?.pct_needs   ?? 50)
  const [wants, setWants]             = useState<number>(initial?.pct_wants   ?? 30)
  const [savings, setSavings]         = useState<number>(initial?.pct_savings ?? 20)

  const incomeN = Math.max(0, parseAmountLocale(income) || 0)
  const sum     = needs + wants + savings
  const valid   = validatePercentages(needs, wants, savings) && incomeN > 0

  const preview = useMemo(() => ({
    needs:   (incomeN * needs)   / 100,
    wants:   (incomeN * wants)   / 100,
    savings: (incomeN * savings) / 100,
  }), [incomeN, needs, wants, savings])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSave({
      monthly_income: incomeN,
      pct_needs:      needs,
      pct_wants:      wants,
      pct_savings:    savings,
    })
  }

  function reset() {
    setNeeds(50)
    setWants(30)
    setSavings(20)
  }

  return (
    <form onSubmit={submit} className="space-y-6 pb-20 max-w-xl">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <PiggyBank className="w-6 h-6 text-emerald-400" />
          {initial ? 'Editar orçamento' : 'Configurar orçamento'}
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Método <strong>50/30/20</strong> — 50% necessidades, 30% desejos, 20% poupança.
          Podes ajustar as percentagens.
        </p>
      </div>

      {/* Income */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-white mb-2">
          Rendimento líquido mensal
        </label>
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-3 focus-within:border-emerald-400/60">
          <span className="text-white/40">€</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9.,]*"
            value={income}
            onChange={e => setIncome(e.target.value)}
            placeholder="1500"
            required
            className="flex-1 bg-transparent text-white text-xl font-bold outline-none placeholder-white/25"
          />
          <span className="text-xs text-white/40">/mês</span>
        </div>
        <p className="text-[11px] text-white/40 mt-2">
          Usa o valor que recebes à conta depois de impostos (não o bruto).
        </p>
      </div>

      {/* Percentagens */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm">Distribuição</h3>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white"
          >
            <RotateCcw className="w-3 h-3" />
            50/30/20
          </button>
        </div>

        <PercentSlider
          label="Necessidades"
          value={needs}
          setValue={setNeeds}
          bucket="needs"
          preview={preview.needs}
        />
        <PercentSlider
          label="Desejos"
          value={wants}
          setValue={setWants}
          bucket="wants"
          preview={preview.wants}
        />
        <PercentSlider
          label="Poupança"
          value={savings}
          setValue={setSavings}
          bucket="savings"
          preview={preview.savings}
        />

        <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${
          valid || sum === 0
            ? 'text-white/50'
            : 'text-rose-300 bg-rose-500/10 border border-rose-500/25'
        }`}>
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Total: <strong className="tabular-nums">{sum.toFixed(1)}%</strong>
            {!validatePercentages(needs, wants, savings) &&
              <> · <span className="text-rose-300">tem de ser 100%</span></>
            }
          </span>
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 min-h-[44px]"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={!valid || saving}
          className="flex-1 py-3 rounded-xl text-sm font-bold text-black bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
        >
          {saving ? <Spinner size="sm" /> : <><Check className="w-4 h-4" /> Guardar</>}
        </button>
      </div>
    </form>
  )
}

function PercentSlider({
  label, value, setValue, bucket, preview,
}: {
  label: string
  value: number
  setValue: (v: number) => void
  bucket: BudgetBucket
  preview: number
}) {
  const colors = BUCKET_COLORS[bucket]
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className={`text-sm font-semibold ${colors.text}`}>{label}</label>
        <span className="text-xs text-white/60 tabular-nums">
          <strong className="text-white">{value.toFixed(0)}%</strong>
          {' '}· {formatCurrency(preview)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        className={`w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-emerald-400`}
        aria-label={`Percentagem para ${label}`}
      />
    </div>
  )
}
