'use client'

import Link        from 'next/link'
import { useEffect, useId, useState } from 'react'
import { useT }    from '@/lib/i18n/LocaleProvider'
import { getConsent, setConsent } from '@/lib/consent'

/**
 * RGPD / ePrivacy cookie consent banner.
 *
 * Renders only when there's no stored decision. Two equally-prominent
 * buttons (Accept + Reject) — the CNPD has been clear since 2022 that a
 * "Reject" option that's harder to find than "Accept" violates the
 * freely-given-consent requirement, so we give them identical visual weight.
 *
 * Mounted at the root layout. Until the user decides, PostHog stays inert
 * (see PostHogProvider). Strictly-necessary storage (Clerk session, locale
 * cookie) is exempt and works regardless of choice — they're not subject
 * to consent under Art. 7 + ePrivacy.
 */
export function CookieConsentBanner() {
  const t = useT()
  const titleId = useId()
  const descId  = useId()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Defer to next tick so SSR + hydration don't flash the banner before
    // localStorage is readable.
    setVisible(getConsent() === null)
  }, [])

  if (!visible) return null

  function decide(value: 'accepted' | 'rejected') {
    setConsent(value)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4 pointer-events-none"
    >
      <div className="mx-auto max-w-3xl pointer-events-auto bg-[#0d1424]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-5 sm:p-6">
        <h2 id={titleId} className="font-semibold text-white text-base sm:text-lg">
          🍪 {t('consent.title')}
        </h2>
        <p id={descId} className="text-sm text-white/70 mt-1.5 leading-relaxed">
          {t('consent.body')}{' '}
          <Link href="/privacidade" className="text-green-400 hover:text-green-300 underline">
            {t('consent.privacy_link')}
          </Link>
          {' · '}
          <Link href="/cookies" className="text-green-400 hover:text-green-300 underline">
            {t('consent.cookies_link')}
          </Link>
        </p>

        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => decide('rejected')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 text-sm font-medium transition-colors active:scale-[0.98]"
          >
            {t('consent.reject')}
          </button>
          <button
            type="button"
            onClick={() => decide('accepted')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 text-black text-sm font-bold transition-colors active:scale-[0.98]"
          >
            {t('consent.accept')}
          </button>
        </div>
      </div>
    </div>
  )
}
