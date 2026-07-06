'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Gauge, TrendingUp, TrendingDown, Minus, Lock, CalendarClock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { useUserPlan } from '@/lib/contexts/UserPlanContext'
import { useSpendForecast } from '@/hooks/useSpendForecast'
import { approxEur, type SpendForecast as ForecastData } from '@/lib/spendForecast'
import type { CashFlowResponse } from '@/app/api/cashflow/route'

/**
 * SpendForecast — o cartão preditivo do dashboard (substitui SpendingVelocity;
 * um slot, UM número de fim-de-mês — dois números concorrentes no mesmo ecrã
 * matam a confiança).
 *
 *   FREE     → o conteúdo clássico de "velocidade" (ritmo atual × dias),
 *              derivado 100% client-side do cache partilhado ['cashflow', 6],
 *              + um rodapé-teaser de uma linha para o Premium. Sem blur, sem
 *              coroas — calmo.
 *   PREMIUM  → previsão real de /api/forecast (perfil dia-a-dia do próprio
 *              utilizador + média ponderada + piso de recorrentes), com
 *              intervalo provável, chip de delta, top categorias e ligação
 *              ao orçamento. Estados: insuficiente / confiança baixa /
 *              normal / estouro (âmbar é o teto de alarme — nunca vermelho).
 *
 * Números da previsão arredondados a ~€5 e sem cêntimos — precisão falsa é
 * desonestidade visual. Os valores exatos vivem na API.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(iso: string, locale: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return locale === 'en'
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
}

async function fetchCashFlow(months: number): Promise<CashFlowResponse | null> {
  const res = await fetch(`/api/cashflow?months=${months}`)
  if (!res.ok) return null
  const { data } = await res.json()
  return data ?? null
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Free branch: the classic velocity card (absorbed from SpendingVelocity) ──

function VelocityBody({ withTeaser }: { withTeaser: boolean }) {
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
    const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const current = data.points.find(p => p.month === currentKey)
    const spent   = current?.expense ?? 0
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
              ? t('velocity.over', { pct: String(Math.abs(v.deltaPct ?? 0)) })
              : under
              ? t('velocity.under', { pct: String(Math.abs(v.deltaPct ?? 0)) })
              : t('velocity.on_track')}
          </span>
        )}
      </div>

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

      {withTeaser && (
        <Link
          href="/settings/billing?period=yearly"
          className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 min-h-[44px] group"
        >
          <Lock className="w-3 h-3 text-white/35 flex-none" aria-hidden />
          <span className="text-xs text-white/45 flex-1 min-w-0 truncate">
            {t('predict.free_teaser')}
          </span>
          <span className="text-xs font-medium text-green-400/90 group-hover:text-green-300 whitespace-nowrap">
            {t('predict.free_cta')} →
          </span>
        </Link>
      )}
    </div>
  )
}

// ── Premium branch ───────────────────────────────────────────────────────────

function ForecastBody({ f }: { f: ForecastData }) {
  const { t, locale } = useLocale()

  const F = f.total.forecast
  const monthPct = Math.round((f.daysElapsed / f.daysInMonth) * 100)
  const lowConf = f.total.confidence === 'low'

  // Delta chip — vs budget when configured, else vs the user's own baseline.
  const ref = f.budget ? f.budget.monthlyIncome : f.total.baseline
  const meaningful = ref != null && Math.abs(F - ref) > Math.max(10, 0.03 * ref)
  const overBudget = f.budget != null && meaningful && F > (ref as number)
  let chip: { text: string; tone: 'amber' | 'emerald' | 'neutral' } | null = null
  if (ref != null) {
    const deltaTxt = approxEur(Math.abs(F - ref), locale)
    if (f.budget) {
      chip = meaningful
        ? overBudget
          ? { text: t('predict.vs_budget_over',  { amount: deltaTxt }), tone: 'amber' }
          : { text: t('predict.vs_budget_under', { amount: deltaTxt }), tone: 'emerald' }
        : { text: t('predict.on_track'), tone: 'neutral' }
    } else if (meaningful) {
      chip = F > ref
        ? { text: t('predict.vs_avg_over',  { amount: deltaTxt }), tone: 'amber' }
        : { text: t('predict.vs_avg_under', { amount: deltaTxt }), tone: 'emerald' }
    }
  }

  // Amber bar hue for categories feeding an over bucket.
  const overBuckets = new Set(
    (f.budget?.buckets ?? []).filter(b => b.severity === 'over').map(b => b.bucket),
  )
  const topCats = f.categories.slice(0, 3)
  const maxF = Math.max(...topCats.map(c => c.forecast), 1)

  return (
    <div className="bg-[#13161b] border border-white/[0.06] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
      {/* ① Header */}
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-white/40" aria-hidden />
        <h3 className="font-semibold text-white/90 text-[13px] flex-1">{t('predict.title')}</h3>
        {lowConf && (
          <span className="text-[11px] text-white/40">{t('predict.low_tag')}</span>
        )}
      </div>

      {/* ② O número */}
      <p className="text-[10px] uppercase tracking-wide text-white/40">{t('predict.month_end')}</p>
      <p className="text-[28px] leading-tight font-semibold text-white tabular-nums">
        {approxEur(F, locale)}
      </p>

      {/* ③ Intervalo — sempre visível (honestidade > confiança fingida) */}
      <p className="text-xs text-white/45 mt-0.5">
        {t('predict.range', {
          low:  approxEur(f.total.low, locale),
          high: approxEur(f.total.high, locale),
        })}
      </p>

      {/* ④ Chip de delta */}
      {chip && (
        <span className={`inline-flex items-center mt-2.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
          chip.tone === 'amber'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
            : chip.tone === 'emerald'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-white/5 border-white/10 text-white/55'
        }`}>
          {chip.text}
        </span>
      )}
      {overBudget && (
        <p className="text-xs text-amber-200/80 mt-2">{t('predict.overrun_note')}</p>
      )}

      {lowConf && (
        <p className="text-[11px] text-white/35 mt-2">{t('predict.low_note')}</p>
      )}

      {/* ⑤ Top categorias (escondido em confiança baixa) */}
      {!lowConf && topCats.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2">
            {t('predict.categories_title')}
          </p>
          <div className="space-y-2.5">
            {topCats.map(c => {
              const name = c.name ?? t('biggest.no_category')
              const amber = c.bucket != null && overBuckets.has(c.bucket)
              const spentPct = Math.min(100, (c.spentSoFar / maxF) * 100)
              const projPct  = Math.min(100, (c.forecast   / maxF) * 100)
              return (
                <div
                  key={c.categoryId ?? 'uncat'}
                  aria-label={t('predict.category_aria', {
                    name,
                    spent:     formatCurrency(c.spentSoFar, 'EUR', locale),
                    projected: approxEur(c.forecast, locale),
                  })}
                >
                  <div className="flex items-center gap-2 text-[13px]">
                    {c.icon && <span aria-hidden className="text-xs">{c.icon}</span>}
                    <span className="text-white/70 truncate flex-1 min-w-0">{name}</span>
                    <span className="tabular-nums whitespace-nowrap">
                      <span className="text-white/45">{formatCurrency(c.spentSoFar, 'EUR', locale)}</span>
                      <span className="text-white/30"> → </span>
                      <span className="text-white/90">{approxEur(c.forecast, locale)}</span>
                    </span>
                  </div>
                  <div className="relative h-[2px] mt-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full opacity-40 ${amber ? 'bg-amber-400' : 'bg-white/60'}`}
                      style={{ width: `${projPct}%` }}
                    />
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${amber ? 'bg-amber-400' : 'bg-white/60'}`}
                      style={{ width: `${spentPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ⑥ Rodapé */}
      <div className="mt-4 pt-3 border-t border-white/[0.06]">
        <div className="h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-white/25" style={{ width: `${monthPct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-[11px]">
          <span className="text-white/45 tabular-nums">
            {t('velocity.month_elapsed', { pct: String(monthPct) })}
          </span>
          <Link href="/orcamento" className="text-green-400 hover:text-green-300 font-medium">
            {t('predict.see_budget')} →
          </Link>
        </div>
      </div>
    </div>
  )
}

function InsufficientBody({ activatesOn }: { activatesOn: string }) {
  const { t, locale } = useLocale()
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const pct = Math.min(100, Math.round((now.getDate() / daysInMonth) * 100))

  return (
    <div className="bg-[#13161b] border border-white/[0.06] rounded-2xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.4)] flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3">
        <CalendarClock className="w-5 h-5 text-white/35" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-white/90">{t('predict.insufficient_title')}</p>
      <p className="text-xs text-white/45 mt-1 max-w-[260px]">
        {t('predict.insufficient_body', { date: shortDate(activatesOn, locale) })}
      </p>
      <div className="w-full h-[2px] rounded-full bg-white/[0.06] overflow-hidden mt-4">
        <div className="h-full rounded-full bg-white/25" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Entry ────────────────────────────────────────────────────────────────────

export function SpendForecast() {
  const { isPaid } = useUserPlan()
  const { forecast, loading } = useSpendForecast()

  if (!isPaid) return <VelocityBody withTeaser />

  if (loading) {
    return (
      <div className="bg-[#13161b] border border-white/[0.06] rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-8 bg-white/10 rounded w-1/2 mb-3" />
        <div className="h-2 bg-white/5 rounded" />
      </div>
    )
  }

  // Fetch failed / downgraded mid-session → degrade to the velocity view.
  if (!forecast) return <VelocityBody withTeaser={false} />

  if (forecast.status === 'insufficient_history') {
    return <InsufficientBody activatesOn={forecast.activatesOn} />
  }

  return <ForecastBody f={forecast} />
}
