import type { VoltixMood } from '@/types'
import type { TranslationKey } from '@/lib/i18n/translations'
import { nextEvoProgress, type EvoStage } from '@/lib/mascotEvolution'

/**
 * mascotSpeak — the mascot's shared "voice" (July 2026, Tamagotchi pass).
 *
 * One brain for every surface that lets the pet talk (dashboard VoltixWidget,
 * /voltix page). Builds a DECK of lines for the current context and hands out
 * one line at a time; tapping the mascot cycles through the deck.
 *
 * Deck order is deliberate:
 *   1. Contextual hooks first — the retention levers: "X points until I
 *      hatch/evolve", "don't break the streak". These are what make the pet
 *      feel aware of the user's finances rather than a random quote machine.
 *   2. The three mood lines (already translated as voltix.mood_<mood>_1..3),
 *      rotated by day-of-year so a returning user doesn't read the same tail
 *      every day.
 *
 * Pure and deterministic (no Math.random) — same context → same line, so
 * re-renders never flicker the bubble and tests stay stable.
 */

export interface MascotSpeakContext {
  mood:     VoltixMood
  evo:      number
  streak:   number
  /** Latest financial score, or null when unknown/not loaded. */
  score:    number | null
  /** User taps on the mascot — cycles the deck. */
  tapCount: number
  /** Day seed for daily variety. Defaults to day-of-year (client-side). */
  daySeed?: number
}

export interface MascotLine {
  key:     TranslationKey
  params?: Record<string, string | number>
}

const MOOD_MESSAGE_KEYS: Record<VoltixMood, TranslationKey[]> = {
  sad:         ['voltix.mood_sad_1',         'voltix.mood_sad_2',         'voltix.mood_sad_3'],
  neutral:     ['voltix.mood_neutral_1',     'voltix.mood_neutral_2',     'voltix.mood_neutral_3'],
  happy:       ['voltix.mood_happy_1',       'voltix.mood_happy_2',       'voltix.mood_happy_3'],
  excited:     ['voltix.mood_excited_1',     'voltix.mood_excited_2',     'voltix.mood_excited_3'],
  celebrating: ['voltix.mood_celebrating_1', 'voltix.mood_celebrating_2', 'voltix.mood_celebrating_3'],
}

function dayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000)
}

/** Build the full deck for a context — contextual hooks first, mood tail after. */
export function mascotDeck(ctx: MascotSpeakContext): MascotLine[] {
  const deck: MascotLine[] = []
  const seed = ctx.daySeed ?? dayOfYear()

  // ── Contextual hooks (the Tamagotchi levers) ──
  if (ctx.score != null && ctx.evo >= 1 && ctx.evo < 6) {
    const prog = nextEvoProgress(ctx.score, Math.max(1, Math.min(6, ctx.evo)) as EvoStage)
    if (prog) {
      if (ctx.evo === 1) {
        // The egg narrative — the day-one hook.
        deck.push(
          prog.remaining <= 5
            ? { key: 'mascot.speak.hatch_close', params: { n: prog.remaining } }
            : { key: 'mascot.speak.hatch_far',   params: { target: prog.needed } },
        )
      } else {
        deck.push({ key: 'mascot.speak.next_evo', params: { n: prog.remaining } })
      }
    }
  }

  if (ctx.streak >= 3) {
    deck.push({ key: 'mascot.speak.streak', params: { days: ctx.streak } })
  }

  // ── Mood tail, rotated by day so the pet doesn't repeat itself ──
  const moods = MOOD_MESSAGE_KEYS[ctx.mood] ?? MOOD_MESSAGE_KEYS.neutral
  for (let i = 0; i < moods.length; i++) {
    deck.push({ key: moods[(seed + i) % moods.length] })
  }

  return deck
}

/** The line to show right now + deck size (for cycling UIs). */
export function mascotLine(ctx: MascotSpeakContext): { line: MascotLine; deckSize: number } {
  const deck = mascotDeck(ctx)
  const idx  = ((ctx.tapCount % deck.length) + deck.length) % deck.length
  return { line: deck[idx], deckSize: deck.length }
}
