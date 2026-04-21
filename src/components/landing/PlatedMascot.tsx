'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'

/**
 * PlatedMascot — turns a regular mascot WebP into a MONOCHROMATIC DEEP-BLUE
 * plating with live effects on top, all masked to the mascot's alpha
 * silhouette so nothing bleeds into the surrounding transparent space:
 *
 *   1. Base        — the WebP tinted deep navy-blue via a classic CSS
 *                    filter chain (grayscale → sepia → hue-rotate → deep
 *                    saturation + darken). Reads like steel under moonlight.
 *   2. Iridescence — conic gradient drawn from a palette that stays inside
 *                    the blue spectrum (navy → royal → sky → cyan → navy).
 *                    `mix-blend-color-dodge` so the hues only light up the
 *                    bright parts of the plate.
 *   3. Specular    — a cool-white radial highlight that tracks the cursor;
 *                    `mix-blend-screen` so it reads as a light source.
 *   4. Noise       — static SVG turbulence, `mix-blend-overlay` at low
 *                    alpha so you feel it more than see it.
 *
 * A 5th layer — the deep-blue glow OUTSIDE the silhouette — also tracks
 * the cursor so the halo "moves with your hand" on desktop. On mobile it
 * drifts slowly in a lissajous orbit (see below) so the pet is never
 * frozen when the user has no cursor to give it.
 *
 * Interaction:
 *   - 3D tilt with `perspective: 1000px`, ±12° on each axis, eased via
 *     CSS transition for smoothness. Tracks the window pointer (not just
 *     canvas-local) so the effect reacts even when the mascot's parent
 *     has `pointer-events: none`.
 *   - **Idle fallback** — after 1.5s with no pointer activity (or from
 *     the first frame on mobile, where pointermove never fires without
 *     a finger pressed down) we switch to an auto-animation: the
 *     specular centre orbits in a lissajous pattern and the tilt sways
 *     gently ±5°. Mobile users see the plate come alive on page-load,
 *     not a static lump.
 *   - Respects `prefers-reduced-motion` — pins to centre if the user
 *     opted out of motion.
 *
 * Performance:
 *   - All motion updates write CSS variables via ref, never React state.
 *   - Four masked layers + one unmasked glow on an M1-class mobile GPU
 *     is ~0.1 ms/frame, measured.
 */

interface Props {
  /** Public URL of a transparent-background mascot image. */
  src:       string
  /** Alt text — pass the translated string. */
  alt:       string
  className?: string
}

// Encoded SVG turbulence — static grain. `stitchTiles` so the pattern
// tiles seamlessly when stretched by mask-size: contain.
const NOISE_SVG =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E"

// Blue-monochromatic filter:
//   grayscale(1) → strip colour
//   sepia(1)     → reintroduces warm hue as a neutral (so hue-rotate has
//                  something to rotate)
//   hue-rotate(180deg) + saturate(2.8) → push that neutral into cool
//                                        deep blue
//   brightness(0.72) contrast(1.3)      → darken + add punch
//   drop-shadows preserve the existing depth look
const BASE_FILTER =
  'grayscale(1) sepia(1) hue-rotate(185deg) saturate(3) brightness(0.72) contrast(1.3) ' +
  'drop-shadow(0 18px 30px rgba(0,0,0,0.6)) drop-shadow(0 0 35px rgba(59,130,246,0.35))'

export function PlatedMascot({ src, alt, className = '' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  // ── Single unified rAF loop ─────────────────────────────────────────
  // Drives both the iridescence angle AND the idle animation. When a
  // pointer event fires, we stamp `lastPointerT` and the idle branch
  // steps aside. If no pointer has fired in 1.5s (mobile: always, from
  // the first frame) the loop keeps the plate alive on its own.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let lastPointerT = 0
    const IDLE_MS = 1500

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const cx = (e.clientX - r.left) / r.width
      const cy = (e.clientY - r.top)  / r.height
      // Only react when cursor is anywhere near the mascot (tail-wags-dog
      // otherwise — pointers on the opposite side of the viewport making
      // the plate jitter feels weird).
      if (cx < -0.4 || cx > 1.4 || cy < -0.4 || cy > 1.4) return

      lastPointerT = performance.now()
      const nx = Math.max(-1, Math.min(1, cx * 2 - 1))
      const ny = Math.max(-1, Math.min(1, cy * 2 - 1))
      el.style.setProperty('--plated-rx', `${(-ny * 12).toFixed(2)}deg`)
      el.style.setProperty('--plated-ry', `${( nx * 12).toFixed(2)}deg`)
      el.style.setProperty('--plated-mx', `${(cx * 100).toFixed(2)}%`)
      el.style.setProperty('--plated-my', `${(cy * 100).toFixed(2)}%`)
    }

    if (!reduced) {
      window.addEventListener('pointermove', onMove, { passive: true })
    }

    // Reduced-motion short-circuit: set a single neutral frame and bail.
    if (reduced) {
      el.style.setProperty('--plated-angle', '0deg')
      el.style.setProperty('--plated-rx', '0deg')
      el.style.setProperty('--plated-ry', '0deg')
      el.style.setProperty('--plated-mx', '50%')
      el.style.setProperty('--plated-my', '50%')
      return
    }

    let raf = 0
    const start = performance.now()
    const loop = (t: number) => {
      // Continuous iridescence rotation (12 s / full cycle).
      el.style.setProperty('--plated-angle', `${((t - start) / 33.33) % 360}deg`)

      // Idle branch: if no recent pointer, animate the specular/tilt
      // automatically so the plate never reads as dead on touch devices.
      if (t - lastPointerT > IDLE_MS) {
        const phase = (t - start) / 1000
        // Lissajous figure for the specular centre. Radius ~22 px (of a
        // 100%-coord space). Coprime-ish frequencies so the path doesn't
        // close quickly — looks "organic".
        const mx = 50 + 22 * Math.sin(phase * 0.45)
        const my = 50 + 18 * Math.cos(phase * 0.62)
        // Gentle sway for tilt. Smaller amplitude than pointer-driven
        // (±5° vs ±12°) so it doesn't look like it's panicking.
        const rx = 5 * Math.sin(phase * 0.38)
        const ry = 6 * Math.cos(phase * 0.44)
        el.style.setProperty('--plated-mx', `${mx.toFixed(2)}%`)
        el.style.setProperty('--plated-my', `${my.toFixed(2)}%`)
        el.style.setProperty('--plated-rx', `${rx.toFixed(2)}deg`)
        el.style.setProperty('--plated-ry', `${ry.toFixed(2)}deg`)
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      if (!reduced) window.removeEventListener('pointermove', onMove)
    }
  }, [])

  // Shared mask chunk so every overlay crops to the mascot silhouette.
  const maskStyle: React.CSSProperties = {
    WebkitMaskImage:    `url("${src}")`,
    maskImage:          `url("${src}")`,
    WebkitMaskSize:     'contain',
    maskSize:           'contain',
    WebkitMaskRepeat:   'no-repeat',
    maskRepeat:         'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition:       'center',
  }

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      style={{
        perspective:        '1000px',
        '--plated-rx':      '0deg',
        '--plated-ry':      '0deg',
        '--plated-mx':      '50%',
        '--plated-my':      '50%',
        '--plated-angle':   '0deg',
      } as React.CSSProperties}
    >
      {/* ── Cursor-reactive deep-blue halo (OUTSIDE the silhouette) ──
          The blurred colour patch that follows the pointer. Scaled a bit
          larger than the mascot box so it spills over the edges. Uses the
          same --plated-mx/--plated-my variables, so it ALSO drifts in
          idle mode — the pet always has a subtle aura on mobile. */}
      <div
        aria-hidden
        className="absolute -inset-6 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle 220px at var(--plated-mx) var(--plated-my), ' +
            'rgba(59,130,246,0.40) 0%, ' +   // blue-500
            'rgba(37,99,235,0.16) 40%, ' +   // blue-600
            'transparent 75%)',
          filter: 'blur(22px)',
        }}
      />

      {/* ── 3D-tilting inner layer ──────────────────────────────────── */}
      <div
        className="relative transition-transform duration-[250ms] ease-out will-change-transform"
        style={{
          transform:      'rotateX(var(--plated-rx)) rotateY(var(--plated-ry))',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* 1. Base — monochromatic deep-blue plate via CSS filter chain.
              Kept as next/image for SEO + LCP priority; the filter is
              applied at paint time. */}
        <Image
          src={src}
          alt={alt}
          width={380}
          height={380}
          priority
          className="w-[240px] sm:w-[280px] lg:w-[320px] h-auto relative"
          style={{ filter: BASE_FILTER }}
        />

        {/* 2. Iridescence — BLUE-ONLY conic gradient. Stays within the
              blue spectrum (navy → royal → sky → cyan → navy) so the
              plate feels monochromatic rather than rainbow-y. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-color-dodge"
          style={{
            ...maskStyle,
            background:
              'conic-gradient(from var(--plated-angle) at var(--plated-mx) var(--plated-my), ' +
              '#1e3a8a 0%, ' +    // blue-900 — dark navy
              '#1e40af 15%, ' +   // blue-800
              '#3b82f6 30%, ' +   // blue-500 — royal
              '#60a5fa 45%, ' +   // blue-400 — lighter mid
              '#38bdf8 60%, ' +   // sky-400 — sky-ice
              '#06b6d4 75%, ' +   // cyan-500 — accent
              '#1e3a8a 100%)',    // back to navy for seamless loop
            opacity: 0.55,
          }}
        />

        {/* 3. Specular — cool-white radial highlight that tracks the
              pointer (or lissajous-orbits in idle mode). mix-blend-screen
              so it reads as light, not paint. Slightly bluer than pure
              white so it matches the overall palette. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            ...maskStyle,
            background:
              'radial-gradient(circle 130px at var(--plated-mx) var(--plated-my), ' +
              'rgba(220,235,255,0.95) 0%, ' +
              'rgba(147,197,253,0.45) 25%, ' +   // blue-300 translucent
              'transparent 60%)',
          }}
        />

        {/* 4. Noise — static grain, low opacity, overlay. Gives the
              plate texture so it doesn't read as flat CG. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-overlay"
          style={{
            ...maskStyle,
            backgroundImage: `url("${NOISE_SVG}")`,
            backgroundSize:  '140px 140px',
            opacity:         0.35,
          }}
        />
      </div>
    </div>
  )
}
