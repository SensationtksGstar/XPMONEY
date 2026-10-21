'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { useT } from '@/lib/i18n/LocaleProvider'
import { AVAILABLE_EVENT, OPEN_EVENT, type InstallKind } from './PWAInstallPrompt'

/**
 * Manual "Install app" CTA — surfaces in the landing nav and elsewhere we
 * want to give users an explicit way to install without waiting for the
 * auto-prompt.
 *
 * Self-hiding: starts hidden and only renders when PWAInstallPrompt has
 * confirmed an install path actually exists for this browser. Subscribing
 * to AVAILABLE_EVENT means we don't have to duplicate detection here, and
 * we never show a button that does nothing (e.g. desktop Firefox where
 * there's no install API).
 *
 * On click, dispatches OPEN_EVENT — PWAInstallPrompt picks it up and
 * surfaces the modal immediately, bypassing the dismissal-cooldown that
 * applies to auto-open. An explicit click is a fresh consent.
 */

interface Props {
  className?: string
  /**
   * Compact form for cramped layouts (e.g. mobile nav). Hides the label
   * and shows just the icon. ARIA label is preserved either way.
   */
  iconOnly?: boolean
  /**
   * Icon-only below the `sm` breakpoint, icon + label from `sm` up. Keeps
   * the landing nav from overflowing on 360px phones (the aria-label stays
   * either way) while the touch target stays 44×44.
   */
  iconOnlyMobile?: boolean
}

export function InstallAppButton({ className, iconOnly = false, iconOnlyMobile = false }: Props) {
  const t = useT()
  const [available, setAvailable] = useState<InstallKind | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    function onAvailable(e: Event) {
      const detail = (e as CustomEvent<InstallKind>).detail
      if (detail === 'chromium' || detail === 'ios') setAvailable(detail)
    }
    window.addEventListener(AVAILABLE_EVENT, onAvailable)
    return () => window.removeEventListener(AVAILABLE_EVENT, onAvailable)
  }, [])

  if (!available) return null

  function handleClick() {
    window.dispatchEvent(new Event(OPEN_EVENT))
  }

  const label = t('pwa.install.now')
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={
        className ??
        'inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 font-medium px-2.5 sm:px-3 rounded-md sm:rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-w-0 touch-manipulation max-[339px]:hidden'
      }
    >
      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      {!iconOnly && <span className={iconOnlyMobile ? 'hidden sm:inline' : undefined}>{label}</span>}
    </button>
  )
}
