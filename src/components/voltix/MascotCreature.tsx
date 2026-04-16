'use client'

/**
 * MascotCreature — router that picks Voltix (male) or Penny (female) based on
 * the user's stored `mascot_gender`. Keeps the public API identical for both
 * mascots so callers just need to pass `gender` + evo + mood.
 *
 * Also re-exports the evo names / descriptions / requirements via helpers so
 * UI code doesn't need to import both sets directly.
 */

import { VoltixCreature, EVO_NAMES, EVO_DESCRIPTIONS, EVO_REQUIREMENTS } from './VoltixCreature'
import {
  PennyCreature,
  PENNY_EVO_NAMES,
  PENNY_EVO_DESCRIPTIONS,
  PENNY_EVO_REQUIREMENTS,
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

export function MascotCreature({ gender, ...rest }: Props) {
  if (gender === 'penny') return <PennyCreature {...rest} />
  return <VoltixCreature {...rest} />
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
