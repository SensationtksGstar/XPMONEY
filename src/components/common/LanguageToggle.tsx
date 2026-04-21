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
 * dark; the inactive side is muted. Both show just the flag on mobile
 * (tight nav), flag + code on desktop (clearer affordance). Hitting the
 * already-active one is a no-op.
 */
interface Props {
  /** `compact` shrinks padding to fit a mobile TopBar (default). */
  size?:       'compact' | 'default'
  className?:  string
}

export function LanguageToggle({ size = 'compact', className = '' }: Props) {
  const { locale, setLocale } = useLocale()

  const pad =
    size === 'compact'
      ? 'px-2 py-1 text-[10px]'
      : 'px-2.5 py-1.5 text-xs'

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
            className={cn(
              'rounded-full font-semibold transition-all flex items-center gap-1',
              pad,
              active
                ? 'bg-white text-black shadow-sm'
                : 'text-white/60 hover:text-white',
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
