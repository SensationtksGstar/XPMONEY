import Link from 'next/link'
import type { ReactNode } from 'react'
import { Logo } from '@/components/ui/Logo'

/**
 * Casca comum das páginas públicas de partilha (/p/evo/*, /p/streak/*).
 *
 * Server component puro: sem Clerk, sem PostHog, sem framer-motion, sem
 * fetch — o destino de um link partilhado tem de abrir instantâneo no
 * browser in-app do WhatsApp/Instagram. Apple-calm: superfície neutra,
 * hairline, UM verde (o CTA), sem glow.
 *
 * O CTA leva só `?ref=share-*` (atribuição do canal) — nunca dados do
 * utilizador que partilhou.
 */
export function SharePage({
  eyebrow, visual, title, sub, ctaHref, ctaLabel, ctaNote, learnMore,
}: {
  eyebrow:   string
  visual:    ReactNode
  title:     string
  sub:       string
  ctaHref:   string
  ctaLabel:  string
  ctaNote:   string
  learnMore: string
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 min-h-[44px]">
        <Logo size={32} />
        <span className="font-bold text-white text-lg tracking-tight">XP-Money</span>
      </Link>

      <div className="w-full max-w-md bg-surface-1 border border-white/10 rounded-3xl px-6 py-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45 mb-5">{eyebrow}</p>

        <div className="flex justify-center mb-6">{visual}</div>

        <h1 className="text-2xl font-bold text-white leading-tight mb-3 break-words">{title}</h1>
        <p className="text-sm text-white/60 leading-relaxed mb-7">{sub}</p>

        <Link
          href={ctaHref}
          className="flex w-full items-center justify-center min-h-[48px] px-5 rounded-2xl bg-green-500 hover:bg-green-400 active:bg-green-600 text-black font-bold text-base transition-colors touch-manipulation"
        >
          {ctaLabel}
        </Link>
        <p className="text-xs text-white/40 mt-3">{ctaNote}</p>
      </div>

      <Link
        href="/"
        className="mt-6 inline-flex items-center min-h-[44px] px-3 text-sm text-white/45 hover:text-white transition-colors"
      >
        {learnMore}
      </Link>
    </main>
  )
}
