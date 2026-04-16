'use client'

/**
 * MascotCreature — router that picks Voltix (male) or Penny (female) based on
 * the user's stored `mascot_gender`. Keeps the public API identical for both
 * mascots so callers just need to pass `gender` + evo + mood.
 *
 * Render precedence:
 *   1. If /mascot/<gender>/<evo>.webp exists (user uploaded real renders),
 *      show that image with the same animation wrapper.
 *   2. Otherwise fall back to the hand-crafted SVG component.
 *
 * The component is client-only so it can `onError` the <img> and swap to SVG
 * without SSR flicker.
 */

import { useRef, useState } from 'react'
import {
  VoltixCreature,
  EVO_NAMES,
  EVO_DESCRIPTIONS,
  EVO_REQUIREMENTS,
  MOOD_PALETTE,
} from './VoltixCreature'
import {
  PennyCreature,
  PENNY_EVO_NAMES,
  PENNY_EVO_DESCRIPTIONS,
  PENNY_EVO_REQUIREMENTS,
  PENNY_PALETTE,
} from './PennyCreature'
import type { VoltixMood } from '@/types'

export type MascotGender = 'voltix' | 'penny'

interface Props {
  gender: MascotGender
  evo: number
  mood: VoltixMood
  className?: string
  animate?: boolean
}

/** Where the optional raster asset lives for a given evo. */
function assetPath(gender: MascotGender, evo: number): string {
  return `/mascot/${gender}/${evo}.webp`
}

/**
 * Shell component — tries the raster image first; if it 404s it silently
 * swaps to the SVG variant so the UI is never broken.
 */
export function MascotCreature(props: Props) {
  const [useSvg, setUseSvg] = useState(false)

  if (useSvg) {
    return props.gender === 'penny'
      ? <PennyCreature {...props} />
      : <VoltixCreature {...props} />
  }

  return (
    <RasterWithFallback
      {...props}
      onFallback={() => setUseSvg(true)}
    />
  )
}

/** Max rotation applied on pointer-follow tilt, in degrees. */
const TILT_MAX_DEG = 16

/** Set inline transform directly on a ref'd node — avoids re-rendering on every pixel of mouse movement. */
function applyTilt(node: HTMLDivElement | null, rx: number, ry: number) {
  if (!node) return
  node.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`
}

/**
 * Inner wrapper that attaches the onError of the <img> to our fallback trigger.
 * Separated so we can keep MascotImage reusable.
 *
 * Also hosts the pointer-driven 3D tilt: a middle layer between the float
 * animation and the breathe animation rotates on mousemove to give the
 * illusion of a real 3D pet. Disabled on touch + prefers-reduced-motion.
 */
function RasterWithFallback({ onFallback, ...props }: Props & { onFallback: () => void }) {
  const [failed, setFailed] = useState(false)
  const tiltRef = useRef<HTMLDivElement>(null)

  if (failed) {
    // onFallback runs once on first error to trigger parent re-render
    setTimeout(onFallback, 0)
    return null
  }

  const { gender, evo, mood, className = '', animate = true } = props
  const palette =
    gender === 'penny'
      ? { aura: PENNY_PALETTE[mood].accent }
      : { aura: MOOD_PALETTE[mood].body }

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetPath(gender, evo)}
      alt={`${gender} evolution ${evo}`}
      onError={() => setFailed(true)}
      className="w-full h-full object-contain select-none pointer-events-none"
      draggable={false}
    />
  )

  if (!animate) return <div className={`relative ${className}`}>{img}</div>

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    // Skip on touch/pen — feels jittery when finger is on the creature
    if (e.pointerType !== 'mouse') return
    // Skip if user wants reduced motion
    if (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width  - 0.5  // -0.5 .. 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5
    // Invert Y so moving mouse up tilts the top of the head toward you
    applyTilt(tiltRef.current, -y * TILT_MAX_DEG, x * TILT_MAX_DEG)
  }

  function onPointerLeave() {
    applyTilt(tiltRef.current, 0, 0)
  }

  return (
    <div className={`relative ${className} animate-mascot-float`}>
      <div
        className="absolute -bottom-2 left-1/2 w-3/5 h-6 blur-2xl rounded-full animate-mascot-aura transition-colors duration-700"
        style={{ backgroundColor: palette.aura }}
      />
      {/* Perspective host — listens to pointer, anchors the 3D scene */}
      <div
        className="relative w-full h-full"
        style={{ perspective: '800px' }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {/* Tilt layer — rotates on mousemove, returns home on leave.
            Breathing animation lives inside so the two transforms compose. */}
        <div
          ref={tiltRef}
          className="w-full h-full will-change-transform"
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1)',
          }}
        >
          <div className="animate-mascot-breathe w-full h-full">{img}</div>
        </div>
      </div>
      {evo >= 3 && (
        <>
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-yellow-300 animate-mascot-sparkle" aria-hidden />
          <span className="absolute top-6 left-3 w-1 h-1 rounded-full bg-white animate-mascot-sparkle delay-600" aria-hidden />
          <span className="absolute bottom-10 right-5 w-1 h-1 rounded-full bg-yellow-200 animate-mascot-sparkle delay-1200" aria-hidden />
        </>
      )}
    </div>
  )
}

export function getMascotEvoName(gender: MascotGender, evo: number): string {
  const source = gender === 'penny' ? PENNY_EVO_NAMES : EVO_NAMES
  return source[evo] ?? source[1]
}

export function getMascotEvoDescription(gender: MascotGender, evo: number): string {
  const source = gender === 'penny' ? PENNY_EVO_DESCRIPTIONS : EVO_DESCRIPTIONS
  return source[evo] ?? source[1]
}

export function getMascotEvoRequirement(gender: MascotGender, evo: number): string {
  const source = gender === 'penny' ? PENNY_EVO_REQUIREMENTS : EVO_REQUIREMENTS
  return source[evo] ?? source[1]
}

/** Highest implemented evolution per mascot — both have 6. */
export function getMascotMaxEvo(gender: MascotGender): number {
  return gender === 'penny' ? 6 : 6
}

// Exported so tests / tooling can reuse the same path logic.
export { assetPath as mascotAssetPath }
