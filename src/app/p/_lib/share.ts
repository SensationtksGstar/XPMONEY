/**
 * Conjuntos FECHADOS das páginas públicas de partilha (/p/evo, /p/streak).
 *
 * São destinos de partilha estáticos: nenhum dado pessoal, nenhum valor
 * financeiro — só a forma da mascote ou o nº de dias da sequência, ambos de
 * um conjunto conhecido. Fora destes conjuntos → 404 real.
 *
 * Sem imports de runtime além de `@/lib/mascotEvolution` (só constantes).
 * A pasta `_lib` é privada no App Router (não gera rota).
 */
import type { MascotGender } from '@/types'
import { EVO_DISPLAY_NAMES, type EvoStage } from '@/lib/mascotEvolution'

/** O ovo (forma 1) nunca se partilha — só uma evolução. */
export const EVO_SHARE_STAGES   = [2, 3, 4, 5, 6] as const
export const EVO_SHARE_GENDERS  = ['voltix', 'penny'] as const satisfies readonly MascotGender[]
/** Marcos de sequência partilháveis (os que têm celebração/recompensa). */
export const STREAK_SHARE_DAYS  = [7, 14, 30, 60, 100] as const

export type EvoShareStage = typeof EVO_SHARE_STAGES[number]
export type StreakShareDays = typeof STREAK_SHARE_DAYS[number]

export interface EvoShare {
  gender: MascotGender
  evo:    EvoShareStage
  name:   string
}

export function evoSlugs(): string[] {
  return EVO_SHARE_GENDERS.flatMap(g => EVO_SHARE_STAGES.map(n => `${g}-${n}`))
}

export function parseEvoSlug(slug: string): EvoShare | null {
  const m = /^(voltix|penny)-([2-6])$/.exec(slug)
  if (!m) return null
  const gender = m[1] as MascotGender
  const evo    = Number(m[2]) as EvoShareStage
  return { gender, evo, name: EVO_DISPLAY_NAMES[gender][evo as EvoStage] }
}

export function parseStreakDays(raw: string): StreakShareDays | null {
  if (!/^\d{1,3}$/.test(raw)) return null
  const n = Number(raw)
  return (STREAK_SHARE_DAYS as readonly number[]).includes(n) ? (n as StreakShareDays) : null
}

/** Caminho de partilha de uma evolução, ou null fora do conjunto. */
export function evoSharePath(gender: MascotGender, evo: number): string | null {
  return parseEvoSlug(`${gender}-${evo}`) ? `/p/evo/${gender}-${evo}` : null
}

/** Caminho de partilha de um marco de sequência, ou null fora do conjunto. */
export function streakSharePath(days: number): string | null {
  return parseStreakDays(String(days)) ? `/p/streak/${days}` : null
}
