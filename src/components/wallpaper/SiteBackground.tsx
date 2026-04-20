'use client'

import { ShaderCanvas } from './ShaderCanvas'
import { SHADERS }     from './shaders'

/**
 * SiteBackground — single fullscreen fixed Neon Grid behind every page.
 *
 * Mounted once from the root layout so it:
 *   - Paints behind `<main>` on the landing AND behind every authenticated
 *     page without remounting (cheap — one WebGL context for the whole
 *     session, survives client-side navigations).
 *   - Sits under the content but still reacts to the cursor via the
 *     `interactive="window"` hook in ShaderCanvas — the canvas itself
 *     is pointer-events:none so clicks pass straight through to the UI.
 *
 * Stacking model (this matters):
 *   The canvas uses `position: fixed` + `z-0`. Our content mains do NOT
 *   set their own z-index, but they ARE rendered after this component in
 *   the DOM — which in the same stacking context means later siblings
 *   paint on top. We intentionally do NOT use `-z-10` here: when a parent
 *   (body) has a solid background, a negative-z fixed child gets pushed
 *   behind the body backdrop and disappears. The globals.css change that
 *   makes `body` transparent is what unlocks this.
 *
 * Opacity + dim overlay are tuned so the grid is clearly present but
 * copy on top stays WCAG-legible.
 */
export function SiteBackground() {
  const neon = SHADERS.find(s => s.id === 'neon')
  if (!neon) return null

  return (
    <div
      aria-hidden
      // fixed + inset-0 + z-0 + pointer-events-none: paints as backdrop,
      // never intercepts clicks. DOM order keeps the rest of the app on top.
      className="fixed inset-0 z-0 pointer-events-none"
    >
      <ShaderCanvas
        fragment={neon.fragment}
        interactive="window"
        className="absolute inset-0 w-full h-full"
        ariaLabel=""
      />
      {/* Dim veil — reduces grid intensity so content reads cleanly.
          Lighter than the first pass: 30→60% so the grid is obviously
          "there" instead of being a barely-perceptible hint. */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060b14]/30 to-[#060b14]/60" />
    </div>
  )
}
