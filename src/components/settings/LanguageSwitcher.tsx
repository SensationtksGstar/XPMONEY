'use client'

import { Check, Globe } from 'lucide-react'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n/translations'

/**
 * LanguageSwitcher — settings card that lets the user pick PT or EN.
 *
 * Intent (user request): "quero uma app escalável... opção de ser em inglês
 * para users de todo mundo". The toggle writes to localStorage via
 * `LocaleProvider`, no server round-trip — the choice is device-local so a
 * user on holiday in English-speaking countries can switch without touching
 * their profile, and the preference survives refreshes.
 *
 * The app's string migration is progressive: `useT()` falls back to the PT
 * string if a key hasn't been translated yet, so English users still see a
 * consistent UI even on views that aren't fully localised.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale()

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
        <Globe className="w-4 h-4 text-blue-400" />
        {t('settings.language')}
      </h2>
      <p className="text-sm text-white/50 mb-4">
        {t('settings.language_desc')}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {LOCALES.map(l => {
          const meta   = LOCALE_LABELS[l]
          const active = locale === l
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={active}
              className={`relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all touch-target no-tap-highlight ${
                active
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-white/10 bg-white/5 hover:border-blue-500/40'
              }`}
            >
              <span className="text-2xl">{meta.flag}</span>
              <span className="text-white font-semibold text-sm">{meta.native}</span>
              {active && (
                <span className="absolute top-2 right-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-black">
                  <Check className="w-3 h-3" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
