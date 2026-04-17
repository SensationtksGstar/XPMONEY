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
 *   - z-index sits below the demo banner (z-200) but above the dashboard's
 *     nav (z-40) and transaction form FAB (z-40).
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
          className="group fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-[90] w-16 h-16 rounded-full flex items-center justify-center shadow-[0_10px_28px_rgba(34,197,94,0.5),0_0_0_3px_rgba(16,185,129,0.25)] active:scale-95 transition-transform bg-gradient-to-br from-emerald-500 via-green-400 to-emerald-500 overflow-hidden"
        >
          {/* Pulse ring — subtle "alive" indicator, attention-getter without
              being intrusive. Sits OUTSIDE the image so overflow-hidden on
              the button doesn't clip it — we render it as an absolutely
              positioned sibling OUTSIDE the button via a following span. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-0.5 rounded-full border-2 border-green-300/60 animate-ping"
            style={{ animationDuration: '2.4s' }}
          />

          {/* Proper Dragon Coin portrait. `priority` = false because it sits
              below the fold until the user scrolls; we don't want it to
              compete with above-the-fold LCP. `sizes` matches the 64×64 box
              so Next picks the smallest variant. */}
          <Image
            src="/dragon-coin.webp"
            alt=""
            aria-hidden
            width={64}
            height={64}
            sizes="64px"
            priority={false}
            className="relative w-full h-full object-cover object-top scale-[1.35] group-hover:scale-[1.45] transition-transform duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
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
