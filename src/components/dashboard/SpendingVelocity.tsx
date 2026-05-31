'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gauge, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import type { CashFlowResponse } from '@/app/api/cashflow/route'

/**
 * SpendingVelocity — projeção de gasto de fim-de-mês ao ritmo actual,
 * comparada com a média dos meses anteriores.
 *
 * É o widget PREDICTIVO do dashboard: "gastaste €450 em 12 dias → ao este
 * ritmo fechas o mês em €1.125, +18% acima da tua média". Empurra o
 * comportamento ANTES de o mês acabar, ao contrário dos outros widgets que
 * são retrospectivos.
 *
 * Reutiliza o MESMO cache ['cashflow', 6] do CashFlowChart — o último ponto
 * é o mês corrente (parcial) e os anteriores dão a baseline. Derivação
 * 100% client-side → zero rede extra, zero endpoint novo.
 */

async function fetchCashFlow(months: number): Promise<CashFlowResponse | null> {
  const res = await fetch(`/api/cashflow?months=${months}`)
  if (!res.ok) return null
  const { data } = await res.json()
  return data ?? null
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function SpendingVelocity() {
  const { t, locale } = useLocale()
  const { data, isLoading } = useQuery({
    queryKey:             ['cashflow', 6],
    queryFn:              () => fetchCashFlow(6),
    staleTime:            5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const v = useMemo(() => {
    if (!data || data.points.length === 0) return null

    const now          = new Date()
    const currentKey   = monthKey(now)
    const daysElapsed  = now.getDate()
    // new Date(y, monthIndex+1, 0) → último dia do mês corrente.
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const current = data.points.find(p => p.month === currentKey)
    const spent   = current?.expense ?? 0

    // Baseline: média das despesas dos meses ANTERIORES com movimento real
    // (ignora meses a zero — provavelmente o user ainda não usava a app,
    // arrastariam a média para baixo e inflavam o "acima da média").
    const priorWithData = data.points.filter(p => p.month < currentKey && p.expense > 0)
    const baseline = priorWithData.length > 0
      ? priorWithData.reduce((s, p) => s + p.expense, 0) / priorWithData.length
      : null

    const dailyRate = daysElapsed > 0 ? spent / daysElapsed : 0
    const projected = dailyRate * daysInMonth

    const deltaPct = baseline && baseline > 0
      ? Math.round(((projected - baseline) / baseline) * 100)
      : null

    return { spent, daysElapsed, daysInMonth, dailyRate, projected, baseline, deltaPct }
  }, [data])

  if (isLoading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-8 bg-white/10 rounded w-1/2 mb-3" />
        <div className="h-2 bg-white/5 rounded" />
      </div>
    )
  }

  // Sem gastos este mês → projeção não faz sentido.
  if (!v || v.spent === 0) {
    return (
      <div className="glass-card p-5 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Gauge className="w-5 h-5 text-white/30" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">{t('velocity.empty_title')}</p>
          <p className="text-xs text-white/40 mt-0.5">{t('velocity.empty_subtitle')}</p>
        </div>
      </div>
    )
  }

  const monthPct = Math.round((v.daysElapsed / v.daysInMonth) * 100)
  const over     = v.deltaPct !== null && v.deltaPct > 5
  const under    = v.deltaPct !== null && v.deltaPct < -5

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-sky-400" />
        <h3 className="font-semibold text-white text-sm">{t('velocity.title')}</h3>
      </div>

      {/* Projeção em destaque + chip de comparação */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] text-white/40 uppercase tracking-wide">{t('velocity.projection')}</p>
          <p className="text-2xl font-bold text-white tabular-nums">
            {formatCurrency(v.projected, 'EUR', locale)}
          </p>
        </div>
        {v.deltaPct !== null && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${
            over
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : under
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-white/5 border-white/15 text-white/60'
          }`}>
            {over ? <TrendingUp className="w-3 h-3" /> : under ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {over
              ? t('velocity.over', { pct: String(Math.abs(v.deltaPct)) })
              : under
              ? t('velocity.under', { pct: String(Math.abs(v.deltaPct)) })
              : t('velocity.on_track')}
          </span>
        )}
      </div>

      {/* Barra de progresso do mês — contextualiza a confiança da projeção
          (uma projeção ao dia 3 é ruidosa; ver "10% do mês decorrido"
          sinaliza isso implicitamente). */}
      <div className="mt-4">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all"
            style={{ width: `${monthPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px] text-white/45">
          <span>{t('velocity.pace', {
            spent: formatCurrency(v.spent, 'EUR', locale),
            days:  String(v.daysElapsed),
            daily: formatCurrency(v.dailyRate, 'EUR', locale),
          })}</span>
          <span className="tabular-nums">{t('velocity.month_elapsed', { pct: String(monthPct) })}</span>
        </div>
      </div>

      {v.baseline === null && (
        <p className="mt-3 text-[11px] text-white/35">{t('velocity.no_baseline')}</p>
      )}
    </div>
  )
}
