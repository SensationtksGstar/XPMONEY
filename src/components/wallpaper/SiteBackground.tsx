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
 * Opacity + dim overlay are tuned so the grid is clearly present but
 * copy on top stays WCAG-legible. If you raise the grid to full
 * brightness, the hero's trust row and FAQ body start failing AA
 * contrast — not worth it for a wallpaper.
 */
export function SiteBackground() {
  const neon = SHADERS.find(s => s.id === 'neon')
  if (!neon) return null

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none"
    >
      <ShaderCanvas
        fragment={neon.fragment}
        interactive="window"
        className="absolute inset-0 w-full h-full"
        ariaLabel=""
      />
      {/* Dim veil — reduces grid intensity so content reads cleanly.
          Gradient-to-bottom darker so the hero CTAs sit on near-black. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#060b14]/55 via-[#060b14]/70 to-[#060b14]/85" />
    </div>
  )
}
