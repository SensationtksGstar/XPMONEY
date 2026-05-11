'use client'

/**
 * MascotPolishWrap — Apple-style finishing layer for the SVG mascots.
 *
 * Wraps a creature SVG with three pure-CSS overlays that lift the figure
 * from "hand-drawn cartoon" to "polished pebble":
 *
 *   1. Premium drop shadow chain — three stacked drop-shadow filters that
 *      mimic Apple's signature soft-shadow + tiny ambient + chromatic
 *      tint. Replaces the raw 0.45 black puddle the creatures had before
 *      with something that reads as "object catching ambient blue light".
 *
 *   2. Glass sheen — a top-down soft white gradient overlay clipped to a
 *      rounded rect, suggests the figure is encased in glossy glass.
 *      Apple uses this on every premium UI surface (App Store icons,
 *      Vision OS dock).
 *
 *   3. Chromatic rim — a faint cyan→navy gradient ring on the outside
 *      edge. The eye reads this as ambient room light bouncing off a
 *      curved surface — same trick as the iOS lock screen widgets.
 *
 * Mood-aware: the shadow tint pulls a hint of the mood accent so a sad
 * mascot drops a cooler blue shadow, a celebrating one a warmer purple.
 *
 * Reduced-motion / mobile: the wrapper is pure CSS; nothing animates
 * here. The float/breathe/aura animations stay in the parent component.
 */

import type { CSSProperties, ReactNode } from 'react'

interface Props {
  /** The mood-driven body color from the creature's palette. Used to
   *  tint the drop shadow + chromatic rim subtly. */
  accentColor: string
  /** Inner SVG / creature element — laid out absolutely inside the wrap. */
  children: ReactNode
  /** Pass-through for sizing. */
  className?: string
}

export function MascotPolishWrap({ accentColor, children, className = '' }: Props) {
  // Three-layer drop shadow:
  //   - 0 1px 1px (40% black)   — micro contact shadow
  //   - 0 8px 16px (28% black)  — soft volumetric mass
  //   - 0 0 32px <accent>       — ambient mood tint (low alpha)
  const shadowFilter = [
    'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.40))',
    'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.28))',
    `drop-shadow(0 0 32px ${accentColor}38)`,   // 38 hex = ~22% alpha
  ].join(' ')

  return (
    <div className={`relative ${className}`} style={{ filter: shadowFilter }}>
      {/* Inner creature — must fill the wrap because the overlays are
          positioned absolute relative to this container. */}
      <div className="relative w-full h-full">
        {children}

        {/* Glass sheen — top-down soft white gradient. pointer-events-none
            so it never intercepts hover/tilt. mix-blend-screen lets it
            brighten only what's already bright (peaks of the radial body
            gradient) — flat shadows stay dark.
            Sized 35 % from the top so it lands on heads/bodies but never
            drifts into the bottom half where it would compete with the
            new ground-shadow layer. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            background:
              'linear-gradient(to bottom, ' +
              'rgba(255,255,255,0.22) 0%, ' +
              'rgba(255,255,255,0.08) 22%, ' +
              'rgba(255,255,255,0.00) 42%)',
            maskImage: 'radial-gradient(ellipse 75% 90% at 50% 30%, black 55%, transparent 90%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 90% at 50% 30%, black 55%, transparent 90%)',
          } as CSSProperties}
        />

        {/*
         * No chromatic rim layer — initial v2 had an outer accent-tinted
         * radial ring that read fine on tall figures (Voltix dragons,
         * Penny rabbits) but on the smaller egg shapes (evo 1) the ring
         * intersected the body silhouette as an ugly coloured band right
         * through the middle. The drop-shadow layer above already paints
         * an ambient mood tint around the figure, so the rim was
         * cosmetic redundancy. Removed.
         */}
      </div>
    </div>
  )
}
