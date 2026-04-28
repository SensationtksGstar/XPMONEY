'use client'

import { useEffect, useId, useState } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n/LocaleProvider'

/**
 * PWA install prompt — handles BOTH browser ecosystems honestly:
 *
 *   - Chromium (Chrome, Edge, Brave, Samsung Internet on Android):
 *     `beforeinstallprompt` fires → we capture the event and show a button
 *     that calls `event.prompt()` to surface the native install UI.
 *
 *   - Safari iOS (iPhone, iPad, in-app browsers based on WKWebView):
 *     Apple does NOT support beforeinstallprompt and never has. Install is
 *     manual: tap Share → "Add to Home Screen". We detect iOS Safari and
 *     show an instructional card with the steps + icons, since pretending
 *     a button works on iOS is the worst UX possible.
 *
 * Dismissal is sticky for 14 days (localStorage) so we don't re-nag a user
 * who said no. The flag is per-device, not per-account, so they can opt in
 * later from Settings if they change their mind (TODO: add Settings entry).
 *
 * Hidden when:
 *   - Already running standalone (display-mode: standalone or iOS navigator.standalone)
 *   - Dismissed within the last 14 days
 *   - Browser is neither Chromium-eligible nor iOS Safari (no install path)
 */

const DISMISS_KEY     = 'xpmoney:install-prompt-dismissed'
const DISMISS_TTL_MS  = 14 * 24 * 60 * 60 * 1000   // 14 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const ts = Number(window.localStorage.getItem(DISMISS_KEY))
    if (!ts) return false
    return Date.now() - ts < DISMISS_TTL_MS
  } catch { return false }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // CSS-driven detection (works on Android Chromium, desktop PWAs)
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  // iOS-specific Safari property
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return true
  return false
}

function detectIOSSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIOS    = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
  // WKWebView in third-party apps (Telegram, FB) doesn't expose Add-to-Home-Screen,
  // but real Safari does. Both have "Safari" in UA except WKWebView lacks it.
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  return isIOS && isSafari
}

export function PWAInstallPrompt() {
  const t          = useT()
  const { locale } = useLocale()
  const titleId    = useId()

  const [bipEvent,   setBipEvent]   = useState<BeforeInstallPromptEvent | null>(null)
  const [showIos,    setShowIos]    = useState(false)
  const [open,       setOpen]       = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone())            return
    if (wasDismissedRecently())    return

    // Chromium path
    function onBip(e: Event) {
      e.preventDefault()  // Prevents the mini-infobar from also showing
      setBipEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBip as EventListener)

    // iOS path — no event, just detect + delay so we don't interrupt the
    // first paint with a modal. 8s gives the user time to look around.
    if (detectIOSSafari()) {
      const t = window.setTimeout(() => setShowIos(true), 8000)
      return () => {
        window.removeEventListener('beforeinstallprompt', onBip as EventListener)
        window.clearTimeout(t)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip as EventListener)
    }
  }, [])

  // Auto-open the prompt 5s after the BIP event so we don't fight the user
  // who's mid-task. They can also trigger it via any "Install app" CTA that
  // calls window.dispatchEvent(new Event('xpmoney:open-install')).
  useEffect(() => {
    if (!bipEvent && !showIos) return
    const t = window.setTimeout(() => setOpen(true), bipEvent ? 5000 : 0)
    function onOpen() { setOpen(true) }
    window.addEventListener('xpmoney:open-install', onOpen)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('xpmoney:open-install', onOpen)
    }
  }, [bipEvent, showIos])

  function dismiss() {
    setOpen(false)
    try { window.localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* */ }
  }

  async function install() {
    if (!bipEvent) return
    await bipEvent.prompt()
    const { outcome } = await bipEvent.userChoice
    if (outcome === 'accepted') {
      setOpen(false)
      setBipEvent(null)
    } else {
      dismiss()
    }
  }

  if (!open) return null

  // ── iOS: instructional card (no JS install possible) ──
  if (showIos && !bipEvent) {
    return (
      <div
        role="dialog"
        aria-labelledby={titleId}
        className="fixed inset-x-0 bottom-0 z-[55] p-3 sm:p-4 pointer-events-none"
      >
        <div className="mx-auto max-w-sm pointer-events-auto bg-[#0d1424]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 id={titleId} className="font-semibold text-white text-base">
              📱 {t('pwa.install_ios.title')}
            </h2>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('common.close')}
              className="text-white/50 hover:text-white/80 -m-1 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-white/70 mt-1.5 leading-relaxed">
            {t('pwa.install_ios.desc')}
          </p>
          <ol className="mt-3 space-y-2 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <span className="text-white/40 font-mono text-xs w-5">1.</span>
              <Share className="w-4 h-4 text-blue-400" aria-hidden />
              <span>{t('pwa.install_ios.step1')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-white/40 font-mono text-xs w-5">2.</span>
              <Plus className="w-4 h-4 text-blue-400" aria-hidden />
              <span>{t('pwa.install_ios.step2')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-white/40 font-mono text-xs w-5">3.</span>
              <span aria-hidden>✓</span>
              <span>{t('pwa.install_ios.step3')}</span>
            </li>
          </ol>
        </div>
      </div>
    )
  }

  // ── Chromium: native install button ──
  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      className="fixed inset-x-0 bottom-0 z-[55] p-3 sm:p-4 pointer-events-none"
    >
      <div className="mx-auto max-w-sm pointer-events-auto bg-[#0d1424]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 id={titleId} className="font-semibold text-white text-base">
            ⚡ {t('pwa.install.title')}
          </h2>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('common.close')}
            className="text-white/50 hover:text-white/80 -m-1 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-white/70 mt-1.5 leading-relaxed">
          {t('pwa.install.desc')}
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 text-sm font-medium transition-colors active:scale-[0.98]"
          >
            {t('pwa.install.later')}
          </button>
          <button
            type="button"
            onClick={install}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-green-500 hover:bg-green-400 text-black text-sm font-bold transition-colors active:scale-[0.98] inline-flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {t('pwa.install.now')}
          </button>
        </div>
        <p className="text-[10px] text-white/30 mt-3 text-center">
          {locale === 'en'
            ? 'Free · Works offline · Same data as the web app'
            : 'Grátis · Funciona offline · Mesmos dados da web'}
        </p>
      </div>
    </div>
  )
}
