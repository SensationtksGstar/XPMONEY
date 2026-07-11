'use client'

import { useState, useEffect } from 'react'
import { X, BellRing }         from 'lucide-react'
import { useUser }             from '@clerk/nextjs'
import { useVoltix }           from '@/hooks/useVoltix'
import { PushOptIn }           from '@/components/notifications/PushOptIn'
import { useT }                from '@/lib/i18n/LocaleProvider'

const DISMISS_KEY  = 'xpmoney:push_nudge_dismissed'
const DISMISS_DAYS = 14

/**
 * PushNudgeCard — opt-in de notificações no momento CERTO.
 *
 * A auditoria de retenção encontrou o opt-in enterrado em /settings, onde
 * utilizadores felizes nunca vão — captação ≈ zero por design. Este card
 * aparece no dashboard apenas quando:
 *   • o browser suporta push E a permissão está em 'default' (nunca pedida),
 *   • o user já tem streak ≥ 2 (valor demonstrado — tem algo a proteger),
 *   • não foi dispensado nos últimos 14 dias.
 *
 * NOTA Fase 4 (dashboard = glance): isto NÃO é uma secção nova do feed — é
 * um prompt transitório que desaparece ao conceder/dispensar, a mesma
 * categoria dos momentos contextuais permitidos (paywalls, teasers).
 */
export function PushNudgeCard() {
  const t          = useT()
  const { user }   = useUser()
  const { voltix } = useVoltix(user?.id ?? '')
  const [visible, setVisible] = useState(false)

  const streak = voltix?.streak_days ?? 0

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('PushManager' in window)) return
    if (Notification.permission !== 'default') return
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY)
      if (dismissed && Date.now() - Number(dismissed) < DISMISS_DAYS * 86_400_000) return
    } catch { /* localStorage indisponível — mostra na mesma */ }
    if (streak >= 2) setVisible(true)
  }, [streak])

  if (!visible) return null

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* quota */ }
    setVisible(false)
  }

  return (
    <div className="relative bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3 animate-fade-in-up">
      <button
        onClick={dismiss}
        aria-label={t('pushcard.dismiss_aria')}
        className="absolute top-1 right-1 w-9 h-9 flex items-center justify-center rounded-full text-white/35 hover:text-white active:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <BellRing className="w-5 h-5 text-orange-400 flex-shrink-0" aria-hidden />
      <div className="flex-1 min-w-[180px] pr-8">
        <p className="text-sm font-semibold text-white">{t('pushcard.title', { n: streak })}</p>
        <p className="text-xs text-white/50">{t('pushcard.body')}</p>
      </div>
      <PushOptIn />
    </div>
  )
}
