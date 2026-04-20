'use client'

import { ChevronLeft, ChevronRight, Calendar, Infinity } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { formatMonth } from '@/lib/utils'

/**
 * MonthSelector — controlo de navegação entre meses no dashboard.
 *
 * Valores possíveis:
 *   - 'YYYY-MM'  (mês específico)
 *   - 'all'      (tudo — cômputo geral de todas as transações)
 *
 * Localizado — o nome do mês é formatado via Intl/date-fns conforme o locale
 * activo (pt-PT ou en-US), e todos os aria-labels e botões saem da tabela
 * de traduções.
 */

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return monthKey(d)
}

interface Props {
  /** Valor actual: 'YYYY-MM', 'all', ou null (auto — resolvido pelo backend). */
  value:    string | null
  onChange: (v: string | null) => void
}

export function MonthSelector({ value, onChange }: Props) {
  const { t, locale } = useLocale()

  const currentYm = useMemo(() => monthKey(new Date()), [])
  const isAll     = value === 'all'
  const resolvedMonth = value && value !== 'all' ? value : currentYm

  const label = isAll
    ? t('ms.all_history')
    : formatMonth(new Date(
        Number(resolvedMonth.split('-')[0]),
        Number(resolvedMonth.split('-')[1]) - 1,
        1,
      ), locale)

  const goPrev = useCallback(() => {
    onChange(addMonths(resolvedMonth, -1))
  }, [resolvedMonth, onChange])

  const goNext = useCallback(() => {
    onChange(addMonths(resolvedMonth, +1))
  }, [resolvedMonth, onChange])

  const resetToCurrent = useCallback(() => {
    onChange(null)
  }, [onChange])

  const toggleAll = useCallback(() => {
    onChange(isAll ? null : 'all')
  }, [isAll, onChange])

  // Não deixa ir ao futuro distante — limita a +1 mês do corrente para o
  // caso de o user querer começar a planear o próximo mês com transações
  // recorrentes agendadas, mas bloqueia spam infinito.
  const atFutureLimit = !isAll && addMonths(resolvedMonth, +1) > addMonths(currentYm, +1)
  const notCurrent    = !isAll && resolvedMonth !== currentYm

  return (
    <div className="flex items-center justify-between gap-2 flex-wrap bg-white/3 border border-white/8 rounded-xl px-3 py-2">
      <div className="flex items-center gap-2">
        {!isAll && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label={t('ms.prev_aria')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={atFutureLimit}
              aria-label={t('ms.next_aria')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        <div className="flex items-center gap-1.5 px-2 text-sm font-semibold text-white">
          {isAll
            ? <Infinity className="w-4 h-4 text-emerald-300" aria-hidden />
            : <Calendar className="w-4 h-4 text-white/40" aria-hidden />}
          <span className="capitalize">{label}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {notCurrent && (
          <button
            type="button"
            onClick={resetToCurrent}
            className="text-[11px] font-semibold text-white/60 hover:text-white bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg min-h-[32px]"
          >
            {t('ms.this_month')}
          </button>
        )}
        <button
          type="button"
          onClick={toggleAll}
          aria-pressed={isAll}
          className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-colors min-h-[32px] ${
            isAll
              ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
          }`}
        >
          {isAll ? t('ms.all_btn_active') : t('ms.all_btn')}
        </button>
      </div>
    </div>
  )
}
