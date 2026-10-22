import type { Mission, Transaction, VoltixMood } from '@/types'
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
 *      Day-aware hooks (Oct 2026, "a mascote nota o dia de hoje") sit right
 *      after the hatch/evolution line and BEFORE streak/forecast/mood:
 *      hungry (>= 2 days without a log), mission ready to claim, fed today.
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
  /**
   * Premium spend-forecast delta (already localized/rounded by the caller,
   * e.g. "~€45" — the brain stays pure/locale-free). `over` only ever true
   * when the reference is the user's BUDGET (copy says "orçamento"); the
   * pet stays quiet about being over a mere average. Free users pass null —
   * the pet never upsells.
   */
  forecastDelta?: { label: string; over: boolean } | null
  /**
   * Whole calendar days since the user last REGISTERED a transaction
   * (0 = today). null = unknown / nothing logged yet / still loading — the
   * pet then says nothing about hunger (never guess, never guilt-trip).
   */
  daysSinceLastTx?: number | null
  /** The user logged at least one transaction today. */
  loggedToday?: boolean
  /** >= 1 active, non-expired mission with current_value >= target_value. */
  missionReady?: boolean
}

export interface MascotLine {
  key:     TranslationKey
  params?: Record<string, string | number>
  /** Optional call-to-action: the bubble renders a link with `ctaKey`. */
  href?:   string
  ctaKey?: TranslationKey
}

/** What the pet knows about "today", derived from data the client already has. */
export interface DayAwareness {
  daysSinceLastTx: number | null
  loggedToday:     boolean
  missionReady:    boolean
}

const MS_DAY = 86_400_000

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Pure derivation of the day-aware fields from React Query data
 * (['transactions'] + ['missions']). Uses `created_at` — WHEN the user
 * registered the movement — not `date`, so a backdated form entry still counts
 * as feeding today. Imports count as a registration of today BY DESIGN (their
 * created_at is now). `transactions` arrives ordered by `date` and capped at
 * the 50 most recent, so take the max created_at; a backdated row registered
 * today behind 50+ newer-dated rows is outside the window (known limitation).
 * Day boundaries use the browser's time zone, not Europe/Lisbon.
 */
export function deriveDayAwareness(
  transactions: Pick<Transaction, 'created_at'>[] | null | undefined,
  missions:     Pick<Mission, 'status' | 'current_value' | 'target_value' | 'expires_at'>[] | null | undefined,
  now: Date = new Date(),
): DayAwareness {
  let latest = -Infinity
  for (const tx of transactions ?? []) {
    const ts = tx.created_at ? new Date(tx.created_at).getTime() : NaN
    if (Number.isFinite(ts) && ts > latest) latest = ts
  }

  let daysSinceLastTx: number | null = null
  if (Number.isFinite(latest)) {
    const diff = Math.round((startOfLocalDay(now) - startOfLocalDay(new Date(latest))) / MS_DAY)
    daysSinceLastTx = Math.max(0, diff)
  }

  const nowMs = now.getTime()
  const missionReady = (missions ?? []).some(m => {
    if (m.status !== 'active') return false
    const target = Number(m.target_value)
    if (!Number.isFinite(target) || target <= 0) return false
    if (!(Number(m.current_value) >= target)) return false
    if (m.expires_at && new Date(m.expires_at).getTime() <= nowMs) return false
    return true
  })

  return { daysSinceLastTx, loggedToday: daysSinceLastTx === 0, missionReady }
}

const MOOD_MESSAGE_KEYS: Record<VoltixMood, TranslationKey[]> = {
  sad:         ['voltix.mood_sad_1',         'voltix.mood_sad_2',         'voltix.mood_sad_3'],
  neutral:     ['voltix.mood_neutral_1',     'voltix.mood_neutral_2',     'voltix.mood_neutral_3'],
  happy:       ['voltix.mood_happy_1',       'voltix.mood_happy_2',       'voltix.mood_happy_3'],
  excited:     ['voltix.mood_excited_1',     'voltix.mood_excited_2',     'voltix.mood_excited_3'],
  celebrating: ['voltix.mood_celebrating_1', 'voltix.mood_celebrating_2', 'voltix.mood_celebrating_3'],
}

const HUNGRY_KEYS: TranslationKey[] = ['mascot.speak.hungry_1', 'mascot.speak.hungry_2']
const FED_KEYS:    TranslationKey[] = ['mascot.speak.fed_1', 'mascot.speak.fed_2', 'mascot.speak.fed_3']

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
        // remaining 0 = score já desbloqueou mas o pacing da evolução
        // (1 forma/dia + dias de uso mínimos) ainda não deixou subir —
        // prometer "faltam 0 pontos" seria mentira; antecipação é melhor.
        deck.push(
          prog.remaining <= 0
            ? { key: 'mascot.speak.evo_ready' }
            : { key: 'mascot.speak.next_evo', params: { n: prog.remaining } },
        )
      }
    }
  }

  // Day-aware hooks: priority above streak/forecast/mood, below hatch/evo.
  // Hungry and fed are mutually exclusive; the mission CTA sits between so a
  // returning user hears the hunger line first, then the reward waiting.
  const since = ctx.daysSinceLastTx
  if (since != null && since >= 2) {
    deck.push({
      key:    HUNGRY_KEYS[seed % HUNGRY_KEYS.length],
      params: { n: since },
    })
  }
  if (ctx.missionReady) {
    deck.push({ key: 'mascot.speak.mission_ready', href: '/missions', ctaKey: 'mascot.speak.mission_ready_cta' })
  }
  if (ctx.loggedToday) {
    deck.push({ key: FED_KEYS[seed % FED_KEYS.length] })
  }

  if (ctx.streak >= 3) {
    deck.push({ key: 'mascot.speak.streak', params: { days: ctx.streak } })
  }

  if (ctx.forecastDelta) {
    deck.push({
      key: ctx.forecastDelta.over ? 'mascot.speak.forecast_over' : 'mascot.speak.forecast_under',
      params: { amount: ctx.forecastDelta.label },
    })
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
