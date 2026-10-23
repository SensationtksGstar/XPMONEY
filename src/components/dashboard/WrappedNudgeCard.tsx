'use client'

import { useEffect, useState } from 'react'
import Link                    from 'next/link'
import { Gift, X }             from 'lucide-react'
import { useT }                from '@/lib/i18n/LocaleProvider'
import { useMoment }           from '@/lib/momentQueue'
import { useWrappedSeason }    from '@/hooks/useWrappedSeason'
import { wrappedCardDismissKey, wrappedSeenKey } from '@/lib/wrapped'

/**
 * WrappedNudgeCard — convite transitório para o Wrapped-lite ("O teu ano").
 *
 * Mesma categoria do PushNudgeCard (NÃO é secção nova do feed do dashboard):
 *   • só de 1 a 15 de dezembro (Europe/Lisbon),
 *   • some para sempre (nesse ano) quando o user abre /wrapped ou o dispensa,
 *   • passa pela fila de momentos como `request` (máx. 1 pedido por sessão e
 *     por dia, nunca por cima de cinematic/celebração/boas-vindas).
 */
export function WrappedNudgeCard() {
  const t = useT()
  const { cardWindow, year } = useWrappedSeason()
  const [eligible, setEligible] = useState(false)
  const slot = useMoment('request', eligible, 'wrapped-nudge')

  useEffect(() => {
    if (!cardWindow || !year) {
      setEligible(false)
      return
    }
    try {
      if (localStorage.getItem(wrappedSeenKey(year)))        return
      if (localStorage.getItem(wrappedCardDismissKey(year))) return
    } catch (err) {
      console.warn('[wrappedcard] localStorage unavailable, showing anyway:', err)
    }
    setEligible(true)
  }, [cardWindow, year])

  if (slot !== 'granted') return null

  function dismiss() {
    try {
      localStorage.setItem(wrappedCardDismissKey(year), String(Date.now()))
    } catch (err) {
      console.warn('[wrappedcard] could not persist dismissal:', err)
    }
    setEligible(false)
  }

  return (
    <div className="relative bg-surface-1 border border-white/10 rounded-2xl pl-4 pr-12 py-3 flex flex-wrap items-center gap-3 animate-fade-in-up">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('wrapped.card_dismiss_aria')}
        className="absolute top-0.5 right-0.5 w-11 h-11 flex items-center justify-center rounded-full text-white/35 hover:text-white active:bg-white/10 transition-colors touch-manipulation"
      >
        <X className="w-4 h-4" />
      </button>
      <span className="w-10 h-10 rounded-xl bg-surface-2 border border-white/10 flex items-center justify-center flex-shrink-0" aria-hidden>
        <Gift className="w-5 h-5 text-green-400" />
      </span>
      <div className="flex-1 min-w-[160px]">
        <p className="text-sm font-semibold text-white">{t('wrapped.card_title', { year })}</p>
        <p className="text-xs text-white/50">{t('wrapped.card_body')}</p>
      </div>
      <Link
        href="/wrapped"
        className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl bg-green-500 hover:bg-green-400 active:bg-green-600 text-black text-sm font-bold transition-colors touch-manipulation"
      >
        {t('wrapped.card_cta')}
      </Link>
    </div>
  )
}
