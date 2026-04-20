import 'server-only'
import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, translate,
  type Locale, type TranslationKey,
} from './translations'

/**
 * Resolve the active locale on the server. Priority:
 *   1. Cookie (`xpmoney-locale`) — set by <LocaleProvider> when the user
 *      flips the switch. Wins over headers so an explicit choice sticks.
 *   2. `Accept-Language` header — for the very first visit before any
 *      client JS runs. Browser-negotiated so EN visitors see EN SSR even
 *      on the first paint.
 *   3. DEFAULT_LOCALE (`pt`) — fallback.
 *
 * The cookie can only be set client-side (React state flips it). A middleware
 * redirect is intentionally NOT used: we want the SAME URL to render either
 * locale so links, caches and SEO stay stable.
 */
export async function getServerLocale(): Promise<Locale> {
  try {
    const store    = await cookies()
    const fromCookie = store.get(LOCALE_COOKIE)?.value as Locale | undefined
    if (fromCookie && LOCALES.includes(fromCookie)) return fromCookie
  } catch { /* cookies() unavailable — generate / edge */ }

  try {
    const h       = await headers()
    const accept  = h.get('accept-language')?.toLowerCase() ?? ''
    // Match only primary language tag. "en-US,pt;q=0.8" → "en".
    const primary = accept.split(',')[0]?.split('-')[0] ?? ''
    if (primary === 'pt') return 'pt'
    if (primary === 'en') return 'en'
  } catch { /* headers() unavailable */ }

  return DEFAULT_LOCALE
}

/**
 * Server-side translator. Call once per render, pass it down as a prop (or
 * destructure into local `t`).
 *
 *   const t = await getServerT()
 *   <h1>{t('landing.hero.title_l1_a')}</h1>
 */
export async function getServerT(): Promise<
  (key: TranslationKey, vars?: Record<string, string | number>) => string
> {
  const locale = await getServerLocale()
  return (key, vars) => translate(locale, key, vars)
}
