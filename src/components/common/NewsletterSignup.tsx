'use client'

import { useId, useState } from 'react'
import { Mail, Loader2, Check } from 'lucide-react'
import Link from 'next/link'
import { useT, useLocale } from '@/lib/i18n/LocaleProvider'

/**
 * NewsletterSignup — opt-in form with double-opt-in flow.
 *
 * Submitting POSTs /api/newsletter/subscribe; the server fires a
 * confirmation email. We surface a "check your inbox" message in-place
 * (no redirect) so the user keeps their scroll position.
 *
 * RGPD: this component shows a privacy-policy link beneath the email
 * field. The endpoint enforces consent via double-opt-in (we never
 * send anything past the confirmation email until they click).
 *
 * Variants:
 *   - default — full card with description, used in landing
 *   - inline  — slim, single-line layout for footer / blog post tail
 */

interface Props {
  source?:   string
  variant?:  'default' | 'inline'
  className?: string
}

export function NewsletterSignup({ source = 'landing', variant = 'default', className = '' }: Props) {
  const t            = useT()
  const { locale }   = useLocale()
  const inputId      = useId()
  const honeypotId   = useId()
  const [email, setEmail]     = useState('')
  const [website, setWebsite] = useState('') // honeypot — visible 0px to bots
  const [status, setStatus]   = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === 'loading') return

    const trimmed = email.trim()
    if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setStatus('error')
      setErrorMsg(t('newsletter.error.email'))
      return
    }

    setStatus('loading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:   trimmed,
          locale,
          source,
          website,  // honeypot
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)
      setStatus('success')
      setEmail('')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : t('newsletter.error.generic'))
    }
  }

  // Successful state — green confirmation card.
  if (status === 'success') {
    return (
      <div className={
        variant === 'inline'
          ? `flex items-center gap-2 text-sm text-emerald-300 ${className}`
          : `bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 ${className}`
      }>
        <Check className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-200">
            {t('newsletter.success.title')}
          </p>
          <p className="text-xs text-emerald-300/80 mt-0.5">
            {t('newsletter.success.desc')}
          </p>
        </div>
      </div>
    )
  }

  const isInline = variant === 'inline'
  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      {!isInline && (
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-400" />
            {t('newsletter.title')}
          </h3>
          <p className="text-sm text-white/60 leading-relaxed">
            {t('newsletter.desc')}
          </p>
        </div>
      )}

      <div className={isInline ? 'flex flex-col sm:flex-row gap-2' : 'flex flex-col gap-2'}>
        <label htmlFor={inputId} className="sr-only">{t('newsletter.email_label')}</label>
        <input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={t('newsletter.email_placeholder')}
          disabled={status === 'loading'}
          className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0a0f1e] border border-white/15 text-white placeholder-white/30 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 outline-none disabled:opacity-50 text-sm"
        />

        {/* Honeypot — same name attackers expect, hidden from real users
            via 0×0 size + tabindex -1 + aria-hidden + autocomplete off. */}
        <label htmlFor={honeypotId} aria-hidden className="absolute w-0 h-0 opacity-0 overflow-hidden pointer-events-none">
          Website
        </label>
        <input
          id={honeypotId}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={website}
          onChange={e => setWebsite(e.target.value)}
          className="absolute w-0 h-0 opacity-0 overflow-hidden pointer-events-none"
        />

        <button
          type="submit"
          disabled={status === 'loading'}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold text-sm transition-colors active:scale-[0.98] inline-flex items-center justify-center gap-2 touch-manipulation"
        >
          {status === 'loading'
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('newsletter.submitting')}</>
            : t('newsletter.submit')}
        </button>
      </div>

      {errorMsg && (
        <p role="alert" className="mt-2 text-xs text-red-400">{errorMsg}</p>
      )}

      <p className={`text-[11px] text-white/40 mt-2 ${isInline ? '' : 'leading-relaxed'}`}>
        {t('newsletter.privacy_note')}{' '}
        <Link href="/privacidade" className="underline hover:text-white/70">
          {t('newsletter.privacy_link')}
        </Link>
        .
      </p>
    </form>
  )
}
