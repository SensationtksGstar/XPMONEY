'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LOCALE_COOKIE, LOCALES, TABLES,
  type Locale, type TranslationKey,
} from './translations'

interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

const STORAGE_KEY = 'xpmoney:locale'

/**
 * Read the explicit locale choice stored by a previous visit, if any.
 * Browser-only; returns null when storage is blocked or holds junk.
 */
function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored && LOCALES.includes(stored)) return stored
  } catch { /* storage unavailable */ }
  return null
}

/**
 * Interpolate {placeholder} tokens in a translation. We keep this inline
 * rather than pulling `intl-messageformat` because we only need the simplest
 * substitution and every kB matters on mobile.
 */
function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  )
}

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode
  /** Locale already resolved on the server (cookie > Accept-Language). */
  initialLocale: Locale
}) {
  const router = useRouter()
  // Start from the SERVER's locale so the island SSR output and the first
  // client render agree (no PT flash on EN pages, no re-render of the tree).
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const syncedRef = useRef(false)

  // The server only sees the cookie / Accept-Language. If the visitor made an
  // explicit choice on a previous visit (localStorage) that the cookie lost,
  // persist it to the cookie and refresh the RSC tree ONCE so server and
  // client agree from then on.
  useEffect(() => {
    if (syncedRef.current) return
    syncedRef.current = true
    const stored = readStoredLocale()
    if (!stored || stored === initialLocale) return
    try {
      document.cookie = `${LOCALE_COOKIE}=${stored}; Path=/; Max-Age=31536000; SameSite=Lax`
    } catch (err) {
      console.warn('[locale] cookie write failed:', err)
      return
    }
    setLocaleState(stored)
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist + update <html lang> when the user flips the switch.
  //
  // WHY router.refresh(): after the cookie is written, any SERVER
  // component (landing hero copy, feature cards, generateMetadata titles,
  // the <html lang> attribute, the Clerk localization bundle passed from
  // the root layout) still holds the OLD locale — they were rendered
  // before the cookie change. `router.refresh()` re-fetches the RSC tree
  // with the new cookie in place, so everything flips in one motion
  // without losing client state (scroll, form fields, React Query cache).
  //
  // Without the refresh, clicking EN on the LanguageToggle made only
  // client-rendered strings flip; the hero + ClerkProvider stayed PT,
  // which felt like "the button does nothing" to the user.
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      window.localStorage.setItem(STORAGE_KEY, l)
      document.documentElement.lang = l
      // 1y cookie; SameSite=Lax is fine — locale isn't a secret.
      document.cookie = `${LOCALE_COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax`
    } catch { /* storage blocked — choice still applies in-memory */ }
    // Refresh server components with the new cookie in the same tick.
    router.refresh()
  }, [router])

  // Keep <html lang> in sync whenever the locale changes (incl. hydration)
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      // Primary: requested locale. Fallback: PT. Last resort: the key itself
      // (makes missing keys visible during development).
      const raw = TABLES[locale]?.[key] ?? TABLES.pt[key] ?? key
      return interpolate(raw, vars)
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}

/**
 * Hook into the current locale + translator. Safe to call from any client
 * component under <LocaleProvider>.
 */
export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale() must be used inside <LocaleProvider>')
  return ctx
}

/**
 * Convenience — just the translator, when you don't need to read the locale.
 */
export function useT() {
  return useLocale().t
}
