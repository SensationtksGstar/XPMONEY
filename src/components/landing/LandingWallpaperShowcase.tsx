'use client'

import { useState } from 'react'
import { MousePointer2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ShaderCanvas } from '@/components/wallpaper/ShaderCanvas'
import { SHADERS }      from '@/components/wallpaper/shaders'
import { useT }         from '@/lib/i18n/LocaleProvider'

/**
 * LandingWallpaperShowcase — "fidget" section with 5 interactive WebGL
 * wallpapers. Sits between Mascot Showcase and Advantages where the page
 * needs a breather (two dense text sections on either side).
 *
 * Why interactive wallpapers on a landing:
 *   - Demonstrates "this app has a soul" in one glance — no copy needed.
 *   - Primal engagement lever: people will literally stop scrolling and
 *     wiggle the mouse for 10-20 seconds. In conversion data, time-on-
 *     page is the single strongest predictor of sign-up conversion for
 *     consumer SaaS.
 *   - Sets up the Premium CTA later: "wallpapers personalizáveis" is a
 *     concrete Premium feature the visitor has already felt value from.
 *
 * Performance:
 *   - The big preview runs at DPR-capped 2 @ 60fps.
 *   - Thumbnails share the same ShaderCanvas but are tiny (~140×80 CSS
 *     px), which keeps fragment cost trivial. They pause when scrolled
 *     off-screen via the shared IntersectionObserver in ShaderCanvas.
 *   - Everything respects `prefers-reduced-motion` (see ShaderCanvas).
 *
 * Must be a client component because of the picker state.
 */
export function LandingWallpaperShowcase() {
  const t = useT()
  const [activeId, setActiveId] = useState<string>(SHADERS[0].id)
  const active = SHADERS.find(s => s.id === activeId) ?? SHADERS[0]

  return (
    <section className="relative py-24 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Eyebrow + heading */}
        <div className="text-center mb-10">
          <p className="text-emerald-400 font-semibold text-sm uppercase tracking-widest mb-2">
            {t('wallpaper.eyebrow')}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold leading-[1.1]">
            {t('wallpaper.title_a')}{' '}
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              {t('wallpaper.title_b')}
            </span>
          </h2>
          <p className="text-white/55 text-lg mt-4 max-w-xl mx-auto">
            {t('wallpaper.subtitle')}
          </p>
        </div>

        {/* ── Big active wallpaper ─────────────────────────────────── */}
        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-white/10 mb-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
          <ShaderCanvas
            // `key` forces a fresh WebGL context when the user picks a
            // different shader — cleaner than swapping the fragment on
            // the same canvas (avoids state bleed across loops).
            key={active.id}
            fragment={active.fragment}
            className="w-full h-full"
            ariaLabel={t(active.nameKey)}
          />
          {/* Floating label */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full text-xs font-semibold text-white/90 pointer-events-none">
            <Sparkles className="w-3 h-3 text-emerald-300" />
            {t(active.nameKey)}
            <span className="text-white/40 font-normal hidden sm:inline">· {t(active.descKey)}</span>
          </div>
          {/* Mouse-hint (only visible on desktop) */}
          <div className="absolute top-4 right-4 hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full text-[11px] font-medium text-white/70 pointer-events-none">
            <MousePointer2 className="w-3 h-3" />
            {t('wallpaper.hint')}
          </div>
        </div>

        {/* ── Picker ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {SHADERS.map(s => {
            const isActive = s.id === activeId
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveId(s.id)}
                aria-pressed={isActive}
                aria-label={t(s.nameKey)}
                className={cn(
                  'group relative aspect-video rounded-xl overflow-hidden border-2 transition-all',
                  // The picker uses `min-h-[44px]` floor because some mobile
                  // aspect-video cells can compute under the a11y touch target.
                  'min-h-[44px]',
                  isActive
                    ? 'border-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.2)]'
                    : 'border-white/10 hover:border-white/30',
                )}
              >
                <ShaderCanvas
                  fragment={s.fragment}
                  className="w-full h-full pointer-events-none"
                  interactive={false}
                  animate={!isActive ? false : true}
                  ariaLabel=""
                />
                {/* Gradient overlay for label legibility */}
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/85 to-transparent pointer-events-none" />
                <span className={cn(
                  'absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate pointer-events-none',
                  isActive ? 'text-emerald-200' : 'text-white/85',
                )}>
                  {t(s.nameKey)}
                </span>
              </button>
            )
          })}
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          {t('wallpaper.premium_note')}
        </p>
      </div>
    </section>
  )
}
