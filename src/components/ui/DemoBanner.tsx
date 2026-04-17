'use client'

import Link from 'next/link'
import { Zap, ArrowLeft } from 'lucide-react'

/**
 * DemoBanner — top-of-page banner shown when NEXT_PUBLIC_DEMO_MODE=true.
 *
 * Now includes an explicit "Sair da demo" exit so visitors landing inside the
 * dashboard from `/demo` have a one-click path back to the marketing site.
 * Previously the banner was information-only and users would get stuck inside
 * the dashboard without an obvious way back.
 *
 * Layout is a 3-column flex so the exit CTA sits on the right regardless of
 * viewport width; the message truncates before touching the button.
 */
export function DemoBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-yellow-500/95 backdrop-blur-sm text-black text-xs font-bold flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="flex items-center gap-2 min-w-0">
        <Zap className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">MODO DEMO — dados simulados</span>
      </span>
      <Link
        href="/"
        className="flex-shrink-0 inline-flex items-center gap-1 bg-black/15 hover:bg-black/25 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors"
        aria-label="Sair da demo e voltar à página inicial"
      >
        <ArrowLeft className="w-3 h-3" />
        Sair da demo
      </Link>
    </div>
  )
}
