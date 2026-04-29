'use client'

import { useLocale } from '@/lib/i18n/LocaleProvider'
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n/translations'
import { cn } from '@/lib/utils'

/**
 * LanguageToggle — compact PT/EN segmented switch for navbars.
 *
 * Sits next to the "Entrar / Sign in" button on the landing nav and on
 * the dashboard TopBar. Complements (does NOT replace) the big card-style
 * `LanguageSwitcher` in settings — that one stays for discoverability,
 * this one is for the single-click-swap visitors need on the landing
 * without hunting through the app.
 *
 * Two buttons in one rounded pill. The active side is solid white-on-
 * dark; the inactive side is muted.
 *
 * April 2026 — mobile fix: the previous compact mode used `px-2 py-1
 * text-[10px]` which made each button ~28×40 px. CLAUDE.md A11y floor
 * mandates 44×44 touch targets; below that, fat-finger taps either fell
 * between the two buttons (gap-0.5) or hit the already-active one (a
 * no-op via `!active && setLocale(l)`), making it feel as if "the button
 * doesn't change the language". The compact mode now uses padded
 * touch zones (visual size unchanged, hit area lifted to ~44 px) so a
 * tap reliably registers on the intended language. `touch-manipulation`
 * also disables the 300 ms double-tap-zoom delay on iOS Safari.
 */
interface Props {
  /** `compact` shrinks padding to fit a mobile TopBar (default). */
  size?:       'compact' | 'default'
  className?:  string
}

export function LanguageToggle({ size = 'compact', className = '' }: Props) {
  const { locale, setLocale } = useLocale()

  // Padding tuned so each button hits ≥44 px on the long axis even in
  // compact mode (the prev `text-[10px]/py-1` came out to ~28 px). The
  // visual `text-xs` keeps the nav slim; `min-h-[40px]` + the wrapper's
  // `p-0.5` push the effective tap zone to ~44 px.
  const pad =
    size === 'compact'
      ? 'px-3 py-2 text-xs min-h-[40px]'
      : 'px-3.5 py-2 text-xs min-h-[44px]'

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        'inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/5 border border-white/10',
        className,
      )}
    >
      {LOCALES.map(l => {
        const meta   = LOCALE_LABELS[l]
        const active = locale === l
        return (
          <button
            key={l}
            type="button"
            onClick={() => !active && setLocale(l)}
            aria-pressed={active}
            aria-label={meta.name}
            title={meta.native}
            // touch-manipulation kills the 300 ms iOS double-tap delay so
            // the language flip feels instant on mobile.
            className={cn(
              'rounded-full font-semibold transition-all flex items-center justify-center gap-1 touch-manipulation select-none',
              pad,
              active
                ? 'bg-white text-black shadow-sm cursor-default'
                : 'text-white/60 hover:text-white active:bg-white/10',
            )}
          >
            <span aria-hidden className="text-sm leading-none">{meta.flag}</span>
            <span className="uppercase tracking-wider">{l}</span>
          </button>
        )
      })}
    </div>
  )
}
