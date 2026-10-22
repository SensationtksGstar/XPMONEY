'use client'

/**
 * PeriodFilter — top-of-dashboard control for the global period state.
 *
 * Two layers:
 *   1. A horizontally-scrollable chip strip with the common shortcuts
 *      (Este mês / Mês anterior / Últimos 3M / 6M / 12M / Ano até hoje
 *      / Tudo). Tap selects.
 *   2. A "Personalizado" chip opens a small inline form with two date
 *      inputs and an Apply button. Hidden behind a single tap so the
 *      strip stays uncluttered for the 99 % case.
 *
 * Animation (out. 2026): CSS puro — era framer-motion (layoutId + height
 * auto), ~36 kB gz descarregados no glance do dashboard só para isto.
 *   - O pill de seleção é UM elemento absoluto na faixa, posicionado a partir
 *     do offsetLeft/offsetWidth do chip ativo e animado com transition de
 *     transform/width. A primeira medição não anima (não desliza desde 0).
 *   - O painel personalizado abre com grid-template-rows 0fr → 1fr (altura
 *     "auto" animável em CSS) e fica `inert` quando fechado.
 *   - `motion-safe:` em ambos: reduced-motion recebe a troca instantânea.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Calendar, X } from 'lucide-react'
import { usePeriod, type PeriodKey } from '@/lib/contexts/PeriodContext'
import { useT } from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

const VISIBLE_ORDER: PeriodKey[] = [
  'this-month', 'last-month', 'last-3m', 'last-6m', 'last-12m', 'ytd', 'all',
]

// Locale-aware labels — replaces the PT-only PERIOD_LABELS constant.
const PERIOD_KEY: Record<PeriodKey, TranslationKey> = {
  'this-month': 'period.this_month',
  'last-month': 'period.last_month',
  'last-3m':    'period.last_3m',
  'last-6m':    'period.last_6m',
  'last-12m':   'period.last_12m',
  'ytd':        'period.ytd',
  'all':        'period.all',
  'custom':     'period.custom',
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// useLayoutEffect avisa no servidor; o componente é ssr:false no dashboard,
// mas fica seguro se alguém o montar num caminho com SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}
function aMonthAgoIso(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().split('T')[0]
}

interface PillBox { left: number; top: number; width: number; height: number; animate: boolean }

export function PeriodFilter() {
  const t = useT()
  const { key, custom, setPeriod } = usePeriod()
  const [showCustom, setShowCustom] = useState(false)
  // Local editable state for the custom date inputs. Hydrated from the
  // current custom range if one exists, otherwise a sensible default
  // (last month).
  const [from, setFrom] = useState(custom?.from ?? aMonthAgoIso())
  const [to,   setTo]   = useState(custom?.to   ?? todayIso())
  // Sem dead-end: validação dentro do handler + erro inline (nunca disabled).
  const [rangeError, setRangeError] = useState<TranslationKey | null>(null)

  const stripRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<PillBox | null>(null)
  const panelId = useId()
  const errorId = useId()

  const customLabel = key === 'custom' && custom
    ? `${custom.from} → ${custom.to}`
    : t('period.custom')

  // Mede o chip ativo e posiciona o pill. Re-mede quando muda a seleção, o
  // texto do chip personalizado ou o idioma (larguras diferentes) e quando a
  // faixa/chip mudam de tamanho (rotação, fontes a carregar).
  useIsoLayoutEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const measure = () => {
      const el = strip.querySelector<HTMLElement>(`[data-period="${key}"]`)
      if (!el) { setPill(null); return }
      const box = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }
      setPill(prev => {
        if (prev && prev.left === box.left && prev.top === box.top
          && prev.width === box.width && prev.height === box.height) return prev
        return { ...box, animate: prev !== null }
      })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(strip)
    const active = strip.querySelector<HTMLElement>(`[data-period="${key}"]`)
    if (active) ro.observe(active)
    return () => ro.disconnect()
  }, [key, customLabel])

  const applyCustom = () => {
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) { setRangeError('period.invalid_date'); return }
    if (from > to) { setRangeError('period.invalid_range'); return }
    setRangeError(null)
    setPeriod('custom', { from, to })
    setShowCustom(false)
  }

  const chipClass = (active: boolean) =>
    `relative flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[40px] touch-manipulation ${
      active ? 'text-white' : 'text-white/55 hover:text-white/90'
    }`

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4">
      {/* Chip strip — horizontally scrollable on mobile, wraps on lg+ */}
      <div
        ref={stripRef}
        className="relative flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-hide"
      >
        {/* Pill de seleção — um só elemento que desliza entre chips. */}
        {pill && (
          <span
            aria-hidden
            className={`absolute left-0 top-0 rounded-full bg-gradient-to-r from-emerald-500/25 to-emerald-400/15 border border-emerald-400/40 pointer-events-none ${
              pill.animate
                ? 'motion-safe:transition-[transform,width] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.2,0.9,0.3,1)]'
                : ''
            }`}
            style={{
              width:     pill.width,
              height:    pill.height,
              transform: `translate(${pill.left}px, ${pill.top}px)`,
            }}
          />
        )}
        {VISIBLE_ORDER.map(k => {
          const active = key === k
          return (
            <button
              key={k}
              type="button"
              data-period={k}
              aria-pressed={active}
              onClick={() => { setPeriod(k); setShowCustom(false) }}
              className={chipClass(active)}
            >
              <span className="relative">{t(PERIOD_KEY[k])}</span>
            </button>
          )
        })}
        {/* Custom chip — same visual treatment, opens inline panel */}
        <button
          type="button"
          data-period="custom"
          // Só semântica de disclosure (abre o painel). aria-pressed aqui
          // somava um 2.º estado independente ("premido, recolhido"); a
          // seleção já se lê no rótulo, que mostra o intervalo ativo.
          aria-expanded={showCustom}
          aria-controls={panelId}
          onClick={() => setShowCustom(s => !s)}
          className={`${chipClass(key === 'custom')} flex items-center gap-1.5`}
        >
          <Calendar className="relative w-3 h-3" />
          <span className="relative">{customLabel}</span>
        </button>
      </div>

      {/* Custom range inline panel — altura animada em CSS (0fr → 1fr) para o
          conteúdo à volta não saltar. Fechado = inert (fora do foco/leitor). */}
      <div
        id={panelId}
        inert={!showCustom}
        className={`grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 motion-safe:ease-out ${
          showCustom ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-3 flex flex-wrap items-end gap-2 pt-3 border-t border-white/8">
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-white/40">
              {t('period.from')}
              <input
                type="date"
                value={from}
                onChange={e => { setFrom(e.target.value); setRangeError(null) }}
                aria-invalid={rangeError !== null}
                aria-describedby={rangeError ? errorId : undefined}
                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-emerald-400/50 min-h-[44px]"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-white/40">
              {t('period.to')}
              <input
                type="date"
                value={to}
                onChange={e => { setTo(e.target.value); setRangeError(null) }}
                aria-invalid={rangeError !== null}
                aria-describedby={rangeError ? errorId : undefined}
                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-emerald-400/50 min-h-[44px]"
              />
            </label>
            <button
              type="button"
              onClick={applyCustom}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-1.5 rounded-lg text-xs min-h-[44px] active:scale-95 transition-transform touch-manipulation"
            >
              {t('period.apply')}
            </button>
            <button
              type="button"
              onClick={() => { setShowCustom(false); setRangeError(null) }}
              aria-label={t('period.close')}
              className="flex items-center justify-center text-white/40 hover:text-white ml-auto min-h-[44px] min-w-[44px] touch-manipulation"
            >
              <X className="w-4 h-4" />
            </button>
            {rangeError && (
              <p id={errorId} role="alert" className="w-full text-xs text-amber-300">
                {t(rangeError)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
