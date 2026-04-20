'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { LandingChat } from '@/components/landing/LandingChat'

/**
 * DragonCoinFAB — floating action button that opens the Dragon Coin chat.
 *
 * Design decisions:
 *   - Lives as a global, persistent FAB (WhatsApp-style) so users never have
 *     to scroll to the bottom of a page to ask a question. Previously the
 *     only chat entry point was inside LandingFAQ at the bottom of the
 *     landing page — users bounced before ever seeing it.
 *   - Mounted in both landing (`src/app/page.tsx`) and dashboard
 *     (`src/app/(dashboard)/layout.tsx`) so paying users can also ask
 *     questions about the app without leaving their workflow.
 *   - Positioning is mobile-aware: lifted above the dashboard's bottom nav
 *     (bottom-24 on mobile) so it never collides with the centered "+" FAB.
 *     Desktop uses the usual bottom-6 right-6.
 *   - Panel is a bottom-anchored card (slides up) rather than a centered
 *     modal. This matches the WhatsApp-style convention and keeps the FAB
 *     visually connected to what it spawned.
 *   - z-index tiers:
 *       closed FAB button: z-[45]  (above MobileNav z-40, BELOW the
 *                                   "More" bottom-sheet z-50 so the sheet
 *                                   never gets covered by the coin)
 *       chat backdrop:     z-[95]
 *       chat panel:        z-[100] (above every UI chrome when open)
 *
 * Accessibility:
 *   - Trap-free: closes on backdrop click and on Escape.
 *   - role="dialog" + aria-modal + aria-labelledby.
 *   - FAB has clear aria-label.
 */
export function DragonCoinFAB() {
  const [open, setOpen] = useState(false)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  // Lock body scroll while chat is open on mobile so the page behind doesn't
  // scroll with the overlay. Restored on unmount / close.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  return (
    <>
      {/* ── FAB button ─────────────────────────────────────────────── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir Dragon Coin — assistente da XP-Money"
          // z-[45] intentionally sits BELOW the MobileNav "More" sheet
          // (z-50) — otherwise the closed FAB floats on top of the sheet
          // and covers the Settings icon on mobile. The chat panel when
          // OPEN still lifts above everything via z-[100] below.
          className="group fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-[45] w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-transform bg-[#060b14]/85 backdrop-blur-md ring-2 ring-green-400/50 hover:ring-green-300/70 shadow-[0_8px_24px_rgba(34,197,94,0.35),0_0_22px_rgba(34,197,94,0.25)]"
        >
          {/* Pulse halo — anel verde pulsante por fora do botão para
              indicar "estou vivo, clica". Fica atrás do botão via inset
              negativo + rounded-full para um efeito de ondulação. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1 rounded-full border-2 border-green-400/40 animate-ping"
            style={{ animationDuration: '2.4s' }}
          />

          {/* Dragon Coin portrait. O botão tem moldura circular dark com
              ring verde; o dragão (imagem 512×512 HQ trimada, sem fundo
              branco) está escalado para ~1.2× e posicionado um pouco
              acima do centro para compensar que a cauda sai para baixo
              direita — assim o corpo/cabeça ficam centrados visualmente
              dentro do círculo. */}
          <Image
            src="/dragon-coin.webp"
            alt=""
            aria-hidden
            width={128}
            height={128}
            sizes="128px"
            quality={95}
            priority={false}
            className="relative w-full h-full object-contain scale-[1.22] group-hover:scale-[1.3] -translate-y-[2px] transition-transform duration-300 drop-shadow-[0_0_6px_rgba(34,197,94,0.5)]"
          />
        </button>
      )}

      {/* ── Chat overlay ───────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Chat card — slides up from bottom on mobile, anchored
              bottom-right on desktop. Max dimensions keep it readable on
              large screens without becoming a full-page modal. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dragon-coin-title"
            className="fixed z-[100] inset-x-4 bottom-4 lg:inset-auto lg:right-6 lg:bottom-6 lg:w-[400px] animate-slide-up shadow-2xl shadow-black/60 rounded-2xl overflow-hidden"
          >
            {/* Close button — floating above the chat so it's reachable
                even when the chat header scrolls internally. */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar chat"
              className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 flex items-center justify-center transition-colors z-10"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            {/* Hidden heading for screen readers */}
            <h2 id="dragon-coin-title" className="sr-only">Dragon Coin — chat</h2>

            <LandingChat />
          </div>
        </>
      )}
    </>
  )
}
