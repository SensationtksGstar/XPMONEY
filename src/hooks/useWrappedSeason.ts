'use client'

import { useEffect, useState } from 'react'
import { isWrappedCardWindow, isWrappedOpen, wrappedYear } from '@/lib/wrapped'

export interface WrappedSeason {
  /** Dezembro em Lisboa → a entrada de navegação existe. */
  open:       boolean
  /** 1-15 de dezembro em Lisboa → o cartão do dashboard pode aparecer. */
  cardWindow: boolean
  year:       number
}

const CLOSED: WrappedSeason = { open: false, cardWindow: false, year: 0 }

/**
 * Estado da janela do Wrapped, resolvido SÓ depois de montar: o SSR e o 1.º
 * render do cliente veem sempre "fechado", por isso não há mismatch de
 * hidratação na fronteira de 30/11 → 1/12 (servidor UTC vs. dispositivo).
 * Re-verifica a cada hora para uma aba deixada aberta atravessar o dia 1.
 */
export function useWrappedSeason(): WrappedSeason {
  const [season, setSeason] = useState<WrappedSeason>(CLOSED)

  useEffect(() => {
    const check = () => {
      const now = new Date()
      setSeason(prev => {
        const next = { open: isWrappedOpen(now), cardWindow: isWrappedCardWindow(now), year: wrappedYear(now) }
        return prev.open === next.open && prev.cardWindow === next.cardWindow && prev.year === next.year ? prev : next
      })
    }
    check()
    const id = window.setInterval(check, 60 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [])

  return season
}
