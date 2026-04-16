/**
 * Runtime-synthesized evolution SFX — no audio files needed.
 *
 * Plays a two-part jingle when the pet evolves:
 *   1. Whoosh  (0-400 ms) — pink-ish noise through a sweeping band-pass filter.
 *      Emulates the build-up you hear in a Pokémon capture sound.
 *   2. Chime   (400-900 ms) — ascending C-E-G triangle arpeggio with a short
 *      triangle harmony on the root. Crystalline, bright, "you did it" feel.
 *
 * Design constraints:
 *   - Zero bytes of assets. Generated via Web Audio API each call.
 *   - Silently no-ops if AudioContext isn't available or user has
 *     prefers-reduced-motion (treating motion reduction as an audio-reduction
 *     signal too, which is the conservative accessible default).
 *   - Browsers require a user gesture before audio plays. The caller is
 *     expected to invoke this from inside a click/evolution trigger so the
 *     context resumes cleanly.
 */

type MaybeCtx = AudioContext | null

let sharedCtx: MaybeCtx = null

function getCtx(): MaybeCtx {
  if (typeof window === 'undefined') return null
  if (sharedCtx) return sharedCtx
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    sharedCtx = new Ctor()
    return sharedCtx
  } catch {
    return null
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** 400 ms noise burst, band-pass swept from 400 Hz → 2.5 kHz. */
function playWhoosh(ctx: AudioContext, t0: number) {
  const duration = 0.4
  // Generate a short pink-ish noise buffer
  const frames = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  // Cheap 1-pole filtered white noise → mild low-pass flavour
  let last = 0
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1
    last = last * 0.85 + white * 0.15
    data[i] = last
  }

  const src = ctx.createBufferSource()
  src.buffer = buffer

  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 3
  bp.frequency.setValueAtTime(400, t0)
  bp.frequency.exponentialRampToValueAtTime(2500, t0 + duration)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.08)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  src.connect(bp).connect(gain).connect(ctx.destination)
  src.start(t0)
  src.stop(t0 + duration + 0.02)
}

/** Triangle note with soft attack + exponential release. */
function playTone(ctx: AudioContext, freq: number, t0: number, dur: number, peak = 0.18) {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, t0)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/**
 * Fires the evolution jingle. Safe to call from any click/effect handler.
 * Returns a Promise that resolves when the sound has finished (useful if the
 * caller wants to sequence something after it — rarely needed).
 */
export async function playEvolutionSfx(): Promise<void> {
  if (prefersReducedMotion()) return
  const ctx = getCtx()
  if (!ctx) return

  try {
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    /* ignore — some browsers reject until first gesture */
  }

  const now = ctx.currentTime + 0.02

  // Whoosh: 0 → 400 ms
  playWhoosh(ctx, now)

  // Chime arpeggio: C5 (523) – E5 (659) – G5 (784) over 420 ms, starting at 380 ms
  const chimeStart = now + 0.38
  playTone(ctx, 523.25, chimeStart + 0.00, 0.28, 0.22)
  playTone(ctx, 659.25, chimeStart + 0.09, 0.30, 0.22)
  playTone(ctx, 783.99, chimeStart + 0.18, 0.55, 0.26)
  // Harmony: C4 root, longer sustain, quieter
  playTone(ctx, 261.63, chimeStart + 0.00, 0.70, 0.10)

  // Sparkle: B5 + D6 tail at the end to sell "complete"
  playTone(ctx, 987.77, chimeStart + 0.40, 0.35, 0.18)
  playTone(ctx, 1174.66, chimeStart + 0.48, 0.40, 0.18)

  await new Promise(res => setTimeout(res, 1100))
}
