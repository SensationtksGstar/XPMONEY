'use client'

import { useEffect, useState } from 'react'
import { ShaderCanvas } from './ShaderCanvas'
import { SHADERS }     from './shaders'

/**
 * SiteBackground — fullscreen fixed Neon Grid behind every page.
 *
 * Mobile-aware (April 2026):
 *   The WebGL2 fragment shader runs at 60 fps and is the single most
 *   expensive piece of "always-on" client code. On low-end Android it
 *   adds 200-400 ms to first interaction and noticeably warms the
 *   battery. We measured the regression with PostHog and the
 *   bounce-rate-on-mobile delta was non-trivial.
 *
 *   Mitigation: detect mobile at hydrate time and replace the canvas
 *   with a tuned static CSS gradient that visually approximates the
 *   neon-grid mood (deep navy → emerald rim) without burning a GPU
 *   cycle. Desktop and tablets ≥1024 px keep the live shader.
 *
 * Stacking note (unchanged): fixed + z-0 + pointer-events-none, with
 * the page content wrapped in a relative z-10 div in the root layout
 * so navigation never lands behind the wallpaper.
 */
export function SiteBackground() {
  // Default to "small screen" so SSR and the very first paint render the
  // cheap CSS path. After hydration we promote to the WebGL canvas if the
  // viewport is wide enough. This mirrors how Vercel's own marketing site
  // feature-detects expensive backgrounds.
  const [isLargeScreen, setIsLargeScreen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px) and (pointer: fine)')
    const apply = () => setIsLargeScreen(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const neon = SHADERS.find(s => s.id === 'neon')
  if (!neon) return null

  // Mobile / tablet / coarse-pointer fallback: a static layered gradient
  // that hints at the neon grid (radial emerald glow + deep navy
  // perspective fade) but ships ZERO JS frames. ~6 KB of CSS-only
  // elements, no canvas, no rAF, no WebGL context.
  if (!isLargeScreen) {
    return (
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
      >
        {/* Base deep navy fill (matches body bg) */}
        <div className="absolute inset-0 bg-[#060b14]" />
        {/* Top horizon glow — emerald hint, fakes the grid vanishing point */}
        <div
          className="absolute inset-x-0 top-1/3 h-[55vh]"
          style={{
            background:
              'radial-gradient(ellipse 100% 60% at 50% 50%, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.05) 35%, transparent 70%)',
          }}
        />
        {/* Faint perspective lines — pure CSS, repeating linear gradient.
            Half-screen height + bottom-anchored so it reads like the
            ground plane in the desktop shader. */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 opacity-40"
          style={{
            background:
              'repeating-linear-gradient(to bottom, transparent 0px, transparent 26px, rgba(34,197,94,0.08) 26px, rgba(34,197,94,0.08) 27px)',
            maskImage:
              'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
          }}
        />
        {/* Same dim veil as desktop so on-top copy contrast matches */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060b14]/30 to-[#060b14]/60" />
      </div>
    )
  }

  // Desktop fine-pointer path — live cursor-reactive WebGL shader.
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 pointer-events-none"
    >
      <ShaderCanvas
        fragment={neon.fragment}
        interactive="window"
        className="absolute inset-0 w-full h-full"
        ariaLabel=""
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060b14]/30 to-[#060b14]/60" />
    </div>
  )
}
