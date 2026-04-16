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

import { useState } from 'react'
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

/**
 * Inner wrapper that attaches the onError of the <img> to our fallback trigger.
 * Separated so we can keep MascotImage reusable.
 */
function RasterWithFallback({ onFallback, ...props }: Props & { onFallback: () => void }) {
  const [failed, setFailed] = useState(false)

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

  return (
    <div className={`relative ${className} animate-mascot-float`}>
      <div
        className="absolute -bottom-2 left-1/2 w-3/5 h-6 blur-2xl rounded-full animate-mascot-aura transition-colors duration-700"
        style={{ backgroundColor: palette.aura }}
      />
      <div className="animate-mascot-breathe w-full h-full">{img}</div>
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

/** Highest implemented evolution per mascot — Voltix has 6, Penny has 5. */
export function getMascotMaxEvo(gender: MascotGender): number {
  return gender === 'penny' ? 5 : 6
}

// Exported so tests / tooling can reuse the same path logic.
export { assetPath as mascotAssetPath }
