'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'

/**
 * PlatedMascot — the hero's attention-magnet: a monochromatic DEEP-BLUE
 * plated 3D-ish mascot built entirely from stacked CSS/SVG layers. No
 * 3D model, no WebGL, no .glb — just the flat WebP plus eight layered
 * effects that fake depth, light and material response.
 *
 * Layer stack (bottom → top, all alpha-masked to the mascot silhouette
 * except the outer glow):
 *
 *   0. Outer glow (not masked) — a wide, cursor-tracking deep-blue halo
 *      that bleeds past the silhouette edges.
 *
 *   1. BASE — the WebP through a filter chain that pushes it into deep
 *      navy with heavy contrast. Acts as the silhouette fill.
 *
 *   2. CORE SHADOW — a darkening layer (radial gradient centred opposite
 *      to the cursor) simulating the side of the volume facing AWAY
 *      from the light. mix-blend-multiply so it only darkens where the
 *      base is already lit, preserving deep shadow areas.
 *
 *   3. IRIDESCENCE — blue-spectrum conic gradient (navy → royal → sky
 *      → cyan → back) rotating slowly. mix-blend-color-dodge paints the
 *      bright side of the silhouette in subtle iridescent colour.
 *
 *   4. RIM LIGHT — a second radial specular, offset ~opposite the main
 *      one, that simulates the "back-rim" of a lit object. Cooler
 *      (cyan), much smaller radius, lower opacity. This is the single
 *      biggest "oh that's 3D" trick — real surfaces always have a rim
 *      when lit, 2D CG never does.
 *
 *   5. MAIN SPECULAR — the primary highlight, tracks the cursor. Large,
 *      bright, cool-white with a blue fringe. mix-blend-screen so it
 *      reads as light.
 *
 *   6. SPECULAR CORE — a pin-sharp white dot inside the main specular,
 *      gives the surface the "polished chrome" glint that reads as
 *      highly detailed rather than airbrush-soft.
 *
 *   7. NOISE — static SVG turbulence overlay. Low opacity, keeps the
 *      plate from looking too clean / CGI.
 *
 *   8. CHROMATIC FRINGE — a very subtle red+blue offset via inset box-
 *      shadow-in-mask hack. Gives the silhouette a "printed" feel,
 *      adds micro-detail on the edges.
 *
 * Interaction: all layers read CSS variables `--plated-mx`, `--plated-my`
 * (0–100%) and `--plated-rx`, `--plated-ry` (tilt) updated imperatively
 * via ref — no React re-renders on pointer motion.
 *
 * Mobile / reduced-motion: the rAF loop runs a lissajous idle pattern
 * when no pointer activity is detected for 1.5 s. Reduced-motion pins
 * everything to neutral.
 */

interface Props {
  src:        string
  alt:        string
  className?: string
}

// Encoded SVG turbulence — static grain, tileable.
const NOISE_SVG =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E"

// Deep-blue monochrome filter chain.
// grayscale → strip colour;  sepia → reintroduce a neutral hue;
// hue-rotate 185° + saturate 3 → push to cool blue;
// brightness 0.58 + contrast 1.5 → darken + amplify volume.
// Darker than v1 (0.72 → 0.58) so the plate reads "carved obsidian
// with moonlight" rather than "matte steel".
const BASE_FILTER =
  'grayscale(1) sepia(1) hue-rotate(185deg) saturate(3) brightness(0.58) contrast(1.5) ' +
  'drop-shadow(0 22px 32px rgba(0,0,0,0.7)) ' +
  'drop-shadow(0 0 40px rgba(37,99,235,0.45)) ' +
  'drop-shadow(0 0 80px rgba(30,58,138,0.3))'

export function PlatedMascot({ src, alt, className = '' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

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
      if (cx < -0.4 || cx > 1.4 || cy < -0.4 || cy > 1.4) return

      lastPointerT = performance.now()
      const nx = Math.max(-1, Math.min(1, cx * 2 - 1))
      const ny = Math.max(-1, Math.min(1, cy * 2 - 1))
      el.style.setProperty('--plated-rx', `${(-ny * 14).toFixed(2)}deg`)
      el.style.setProperty('--plated-ry', `${( nx * 14).toFixed(2)}deg`)
      el.style.setProperty('--plated-mx', `${(cx * 100).toFixed(2)}%`)
      el.style.setProperty('--plated-my', `${(cy * 100).toFixed(2)}%`)
    }

    if (!reduced) {
      window.addEventListener('pointermove', onMove, { passive: true })
    }

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
      el.style.setProperty('--plated-angle', `${((t - start) / 33.33) % 360}deg`)

      if (t - lastPointerT > IDLE_MS) {
        const phase = (t - start) / 1000
        const mx = 50 + 26 * Math.sin(phase * 0.45)
        const my = 50 + 20 * Math.cos(phase * 0.62)
        const rx = 6 * Math.sin(phase * 0.38)
        const ry = 8 * Math.cos(phase * 0.44)
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
        perspective:        '1100px',
        '--plated-rx':      '0deg',
        '--plated-ry':      '0deg',
        '--plated-mx':      '50%',
        '--plated-my':      '50%',
        '--plated-angle':   '0deg',
      } as React.CSSProperties}
    >
      {/* 0. Outer glow — wide deep-blue halo that bleeds past the edges */}
      <div
        aria-hidden
        className="absolute -inset-8 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle 260px at var(--plated-mx) var(--plated-my), ' +
            'rgba(96,165,250,0.45) 0%, ' +    // blue-400 bright core
            'rgba(37,99,235,0.22) 35%, ' +    // blue-600 mid
            'rgba(29,78,216,0.08) 65%, ' +    // blue-700 fade
            'transparent 80%)',
          filter: 'blur(26px)',
        }}
      />

      {/* 3D-tilting inner stack */}
      <div
        className="relative transition-transform duration-[250ms] ease-out will-change-transform"
        style={{
          transform:      'rotateX(var(--plated-rx)) rotateY(var(--plated-ry))',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* 1. BASE — monochrome deep-blue plate */}
        <Image
          src={src}
          alt={alt}
          width={380}
          height={380}
          priority
          className="w-[240px] sm:w-[280px] lg:w-[320px] h-auto relative"
          style={{ filter: BASE_FILTER }}
        />

        {/* 2. CORE SHADOW — darkens the side OPPOSITE the cursor.
            calc() inverts the mouse coord so the shadow lives on the
            far hemisphere. mix-blend-multiply so only lit pixels darken. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-multiply"
          style={{
            ...maskStyle,
            background:
              'radial-gradient(circle 280px at calc(100% - var(--plated-mx)) calc(100% - var(--plated-my)), ' +
              'rgba(0,0,20,0.75) 0%, ' +
              'rgba(0,0,20,0.35) 30%, ' +
              'transparent 70%)',
          }}
        />

        {/* 3. IRIDESCENCE — blue conic rotation, lands only on bright
            parts via color-dodge. Expanded palette for more "depth". */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-color-dodge"
          style={{
            ...maskStyle,
            background:
              'conic-gradient(from var(--plated-angle) at var(--plated-mx) var(--plated-my), ' +
              '#0c4a6e 0%, '  +   // sky-900 very dark
              '#1e3a8a 12%, ' +   // blue-900
              '#1e40af 24%, ' +   // blue-800
              '#2563eb 36%, ' +   // blue-600
              '#3b82f6 48%, ' +   // blue-500 royal
              '#38bdf8 60%, ' +   // sky-400
              '#06b6d4 72%, ' +   // cyan-500 accent
              '#0ea5e9 84%, ' +   // sky-500
              '#0c4a6e 100%)',    // loop
            opacity: 0.62,
          }}
        />

        {/* 4. RIM LIGHT — cyan back-rim opposite the main light. Small
            radius, subtle, cranks the 3D-ness without stealing focus. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            ...maskStyle,
            background:
              'radial-gradient(circle 70px at calc(100% - var(--plated-mx)) calc(100% - var(--plated-my)), ' +
              'rgba(103,232,249,0.55) 0%, ' +   // cyan-300 bright
              'rgba(56,189,248,0.25) 35%, ' +   // sky-400
              'transparent 70%)',
          }}
        />

        {/* 5. MAIN SPECULAR — primary light, tracks cursor. Larger + softer. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            ...maskStyle,
            background:
              'radial-gradient(circle 150px at var(--plated-mx) var(--plated-my), ' +
              'rgba(219,234,254,0.95) 0%, ' +   // blue-100 near-white
              'rgba(147,197,253,0.5) 25%, ' +   // blue-300
              'rgba(96,165,250,0.2) 50%, ' +    // blue-400 faint
              'transparent 65%)',
          }}
        />

        {/* 6. SPECULAR CORE — pin-sharp glint inside the main specular.
            Sells "polished chrome" so the eye reads "highly detailed"
            rather than "soft paint". */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            ...maskStyle,
            background:
              'radial-gradient(circle 28px at var(--plated-mx) var(--plated-my), ' +
              'rgba(255,255,255,1) 0%, ' +
              'rgba(255,255,255,0.7) 35%, ' +
              'transparent 80%)',
          }}
        />

        {/* 7. NOISE — static grain for micro-texture */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-overlay"
          style={{
            ...maskStyle,
            backgroundImage: `url("${NOISE_SVG}")`,
            backgroundSize:  '120px 120px',
            opacity:         0.42,
          }}
        />

        {/* 8. CHROMATIC FRINGE — subtle red+cyan offset on the edge. Two
            thin layers scaled slightly up and slightly down, each tinted.
            mix-blend-screen, very low opacity. Gives the silhouette an
            "RGB monitor"/"printed" edge that reads as micro-detail. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            ...maskStyle,
            background: 'rgba(59,130,246,0.18)',   // blue halo edge
            transform:  'scale(1.008) translate(-0.5px, 0.3px)',
            mixBlendMode: 'screen',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-screen"
          style={{
            ...maskStyle,
            background: 'rgba(56,189,248,0.15)',   // sky rim edge
            transform:  'scale(0.992) translate(0.5px, -0.3px)',
            mixBlendMode: 'screen',
          }}
        />
      </div>
    </div>
  )
}
