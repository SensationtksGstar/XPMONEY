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
 * Animation: framer-motion for the selection highlight slide (layoutId)
 * + smooth height transition when the custom panel opens. Reduces the
 * "jumpy state change" feel that plain conditional rendering has.
 */

import { useState } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
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

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}
function aMonthAgoIso(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().split('T')[0]
}

export function PeriodFilter() {
  const t = useT()
  const { key, custom, setPeriod } = usePeriod()
  const [showCustom, setShowCustom] = useState(false)
  // Local editable state for the custom date inputs. Hydrated from the
  // current custom range if one exists, otherwise a sensible default
  // (last month).
  const [from, setFrom] = useState(custom?.from ?? aMonthAgoIso())
  const [to,   setTo]   = useState(custom?.to   ?? todayIso())

  const applyCustom = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return
    if (from > to) return
    setPeriod('custom', { from, to })
    setShowCustom(false)
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4">
      <LayoutGroup>
        {/* Chip strip — horizontally scrollable on mobile, wraps on lg+ */}
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-hide">
          {VISIBLE_ORDER.map(k => {
            const active = key === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => { setPeriod(k); setShowCustom(false) }}
                className={`relative flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[36px] ${
                  active
                    ? 'text-white'
                    : 'text-white/55 hover:text-white/90'
                }`}
              >
                {/* Animated highlight pill — uses layoutId so framer-motion
                    smoothly slides between selected chips instead of an
                    abrupt class swap. */}
                {active && (
                  <motion.span
                    layoutId="period-pill"
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500/25 to-emerald-400/15 border border-emerald-400/40 rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{t(PERIOD_KEY[k])}</span>
              </button>
            )
          })}
          {/* Custom chip — same visual treatment, opens inline panel */}
          <button
            type="button"
            onClick={() => setShowCustom(s => !s)}
            className={`relative flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[36px] ${
              key === 'custom'
                ? 'text-white'
                : 'text-white/55 hover:text-white/90'
            }`}
          >
            {key === 'custom' && (
              <motion.span
                layoutId="period-pill"
                className="absolute inset-0 bg-gradient-to-r from-emerald-500/25 to-emerald-400/15 border border-emerald-400/40 rounded-full"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <Calendar className="relative w-3 h-3" />
            <span className="relative">
              {key === 'custom' && custom
                ? `${custom.from} → ${custom.to}`
                : t('period.custom')}
            </span>
          </button>
        </div>
      </LayoutGroup>

      {/* Custom range inline panel — height-animated open/close so the
          surrounding content doesn't jump. */}
      <AnimatePresence initial={false}>
        {showCustom && (
          <motion.div
            key="custom-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.9, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap items-end gap-2 pt-3 border-t border-white/8">
              <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-white/40">
                {t('period.from')}
                <input
                  type="date"
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-emerald-400/50"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-white/40">
                {t('period.to')}
                <input
                  type="date"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-emerald-400/50"
                />
              </label>
              <button
                type="button"
                onClick={applyCustom}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-1.5 rounded-lg text-xs min-h-[36px] active:scale-95 transition-transform"
              >
                {t('period.apply')}
              </button>
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                aria-label={t('period.close')}
                className="text-white/40 hover:text-white p-1.5 ml-auto min-h-[36px] min-w-[36px]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
