'use client'

/**
 * MascotEvolutionCinematic — 9-second Digimon-style evolution reveal.
 *
 * Timeline (t=0..9s):
 *   0.0-1.2  Old pet rises, gentle halo forms (build-up)
 *   1.2-2.6  Pet bleaches to white silhouette, energy rings expand
 *   2.6-4.6  Flash burst, rotating particle helix (climax)
 *   4.6-6.0  New silhouette emerges from white (suspense)
 *   6.0-9.0  Celebrate — reveal + confetti + "+XP" — 3s to savour the new pet
 *
 * All layers are orchestrated with framer-motion `animate` + timed
 * `transitions`. No audio files — uses `playEvolutionSfx()` (Web Audio synth).
 *
 * Accessibility:
 *   - `role="alertdialog"` + focus trap on skip button
 *   - "Saltar →" always visible (users in a hurry are never forced to wait)
 *   - `prefers-reduced-motion` collapses to a static 400 ms fade to the final
 *     frame (message + new pet)
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { MascotCreature } from './MascotCreature'
import type { MascotGender } from '@/types'
import { EVO_DISPLAY_NAMES, EVO_XP_BONUS, type EvoStage } from '@/lib/mascotEvolution'
import { playEvolutionSfx } from '@/lib/evolutionSfx'

interface Props {
  open:     boolean
  onClose:  () => void
  gender:   MascotGender
  fromEvo:  EvoStage
  toEvo:    EvoStage
}

const TOTAL_DURATION_MS = 9000
const SKIP_FADE_MS      = 400

// Stage timings (ms from t=0). Keep in sync with the header comment.
const STAGE_TIMES = {
  bleach:    1200,
  burst:     2600,
  reveal:    4600,
  celebrate: 6000,
} as const

/** Confetti pieces — pure CSS, fire at reveal (t≈4.5s). */
interface ConfettiPiece {
  id: number
  color: string
  left: string
  delay: string
  duration: string
  size: number
}

const CONFETTI_COLORS = ['#22c55e', '#eab308', '#a855f7', '#3b82f6', '#f97316', '#ec4899', '#06b6d4', '#ffffff']

function makeConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${(i / count) * 100 + (Math.random() * 4 - 2)}%`,
    delay: `${(i * 0.03).toFixed(2)}s`,
    duration: `${1.2 + (i % 5) * 0.18}s`,
    size: i % 3 === 0 ? 8 : 6,
  }))
}

/** Energy ring — expanding circle with decaying opacity. */
function EnergyRing({ delay, color }: { delay: number; color: string }) {
  return (
    <motion.span
      aria-hidden
      initial={{ scale: 0, opacity: 0.9 }}
      animate={{ scale: 6, opacity: 0 }}
      transition={{ delay, duration: 2.0, ease: 'easeOut' }}
      className="absolute top-1/2 left-1/2 w-40 h-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
      style={{ borderColor: color, boxShadow: `0 0 40px ${color}` }}
    />
  )
}

/** Rotating particle helix — twelve dots orbiting at increasing radius. */
function ParticleHelix({ visible, color }: { visible: boolean; color: string }) {
  const dots = useMemo(() => Array.from({ length: 12 }, (_, i) => i), [])
  if (!visible) return null
  return (
    <motion.div
      aria-hidden
      className="absolute top-1/2 left-1/2 w-0 h-0"
      initial={{ opacity: 0, rotate: 0 }}
      animate={{ opacity: [0, 1, 1, 0], rotate: 1080 }}
      transition={{ duration: 2.6, ease: 'easeInOut' }}
    >
      {dots.map(i => {
        const angle = (i / dots.length) * Math.PI * 2
        return (
          <span
            key={i}
            className="absolute block w-2 h-2 rounded-full"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 12px ${color}`,
              left:  Math.cos(angle) * 140,
              top:   Math.sin(angle) * 140 * 0.5,
            }}
          />
        )
      })}
    </motion.div>
  )
}

export function MascotEvolutionCinematic({
  open, onClose, gender, fromEvo, toEvo,
}: Props) {
  const reduced = useReducedMotion()
  const [stage, setStage] = useState<'intro' | 'bleach' | 'burst' | 'reveal' | 'celebrate'>('intro')
  const [showConfetti, setShowConfetti] = useState(false)
  const skipRef = useRef<HTMLButtonElement>(null)
  const fired = useRef(false)

  const fromName = EVO_DISPLAY_NAMES[gender][fromEvo]
  const toName   = EVO_DISPLAY_NAMES[gender][toEvo]
  const xpBonus  = toEvo > fromEvo && toEvo in EVO_XP_BONUS
    ? EVO_XP_BONUS[toEvo as Exclude<EvoStage, 1>]
    : 0

  const accentColor = gender === 'penny' ? '#ec4899' : '#60a5fa'

  // Confetti pieces lazy-built once per open
  const confetti = useMemo(() => makeConfetti(36), [])

  // Orchestrate timeline. When reduced motion is set, collapse to intro→celebrate.
  useEffect(() => {
    if (!open) {
      setStage('intro')
      setShowConfetti(false)
      fired.current = false
      return
    }

    // Fire SFX once per opening (requires user gesture — the click that set open=true)
    if (!fired.current) {
      fired.current = true
      void playEvolutionSfx()
    }

    if (reduced) {
      setStage('celebrate')
      setShowConfetti(true)
      const end = setTimeout(onClose, SKIP_FADE_MS + 3500)
      return () => clearTimeout(end)
    }

    const t1 = setTimeout(() => setStage('bleach'),  STAGE_TIMES.bleach)
    const t2 = setTimeout(() => setStage('burst'),   STAGE_TIMES.burst)
    const t3 = setTimeout(() => setStage('reveal'),  STAGE_TIMES.reveal)
    const t4 = setTimeout(() => {
      setStage('celebrate')
      setShowConfetti(true)
    }, STAGE_TIMES.celebrate)
    const t5 = setTimeout(onClose, TOTAL_DURATION_MS)

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5)
    }
  }, [open, onClose, reduced])

  // Focus skip button on open for keyboard users
  useEffect(() => {
    if (open) skipRef.current?.focus()
  }, [open])

  // ESC / Enter skip
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const showOld = stage === 'intro' || stage === 'bleach'
  const showSilhouetteFrom = stage === 'bleach' || stage === 'burst'
  const showSilhouetteTo   = stage === 'burst'  || stage === 'reveal'
  const showNew            = stage === 'reveal' || stage === 'celebrate'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="evo-overlay"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="evo-title"
          className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Deep dark backdrop with radial accent */}
          <div
            aria-hidden
            className="absolute inset-0 bg-black"
            style={{
              background: `radial-gradient(circle at 50% 55%, ${accentColor}22 0%, #000 65%)`,
            }}
          />

          {/* Animated vignette pulse during burst */}
          {stage === 'burst' && !reduced && (
            <motion.div
              aria-hidden
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.3, 1, 0] }}
              transition={{ duration: 1.2, times: [0, 0.1, 0.4, 0.6, 1] }}
              style={{ background: 'white' }}
            />
          )}

          {/* Stage wrapper — 512px square scene, scales with viewport */}
          <div className="relative w-[min(88vw,520px)] aspect-square">

            {/* Energy rings during bleach + burst */}
            {(stage === 'bleach' || stage === 'burst') && !reduced && (
              <>
                <EnergyRing delay={0} color={accentColor} />
                <EnergyRing delay={0.25} color="#ffffff" />
                <EnergyRing delay={0.5} color={accentColor} />
                <EnergyRing delay={0.75} color="#ffffff" />
              </>
            )}

            {/* Rotating particle helix during burst */}
            <ParticleHelix visible={stage === 'burst' && !reduced} color={accentColor} />

            {/* Old creature — fades up, starts glowing */}
            <AnimatePresence>
              {showOld && (
                <motion.div
                  key="old"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0, y: 30, scale: 0.85 }}
                  animate={{
                    opacity: stage === 'bleach' ? 0.4 : 1,
                    y: stage === 'bleach' ? -10 : 0,
                    scale: stage === 'bleach' ? 1.05 : 1,
                    filter: stage === 'bleach' ? 'brightness(3) blur(4px)' : 'brightness(1.2)',
                  }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                >
                  <div className="w-3/4 h-3/4">
                    <MascotCreature
                      gender={gender}
                      evo={fromEvo}
                      mood="excited"
                      animate={false}
                      className="w-full h-full"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* White silhouette transition — same image but washed to pure light */}
            {(showSilhouetteFrom || showSilhouetteTo) && !reduced && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0.6] }}
                transition={{ duration: 1.2 }}
              >
                <div
                  className="w-3/4 h-3/4 flex items-center justify-center"
                  style={{ filter: 'brightness(50) saturate(0) blur(2px)' }}
                >
                  <MascotCreature
                    gender={gender}
                    evo={showSilhouetteTo ? toEvo : fromEvo}
                    mood="excited"
                    animate={false}
                    className="w-full h-full"
                  />
                </div>
              </motion.div>
            )}

            {/* New creature — scales in with bounce */}
            <AnimatePresence>
              {showNew && (
                <motion.div
                  key="new"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0, scale: reduced ? 1 : 0.5, rotate: reduced ? 0 : -8 }}
                  animate={{
                    opacity: 1,
                    scale: stage === 'celebrate' ? 1 : 1.08,
                    rotate: 0,
                  }}
                  transition={{ duration: 0.8, ease: [0.2, 1.4, 0.3, 1] }}
                >
                  <div className="w-3/4 h-3/4">
                    <MascotCreature
                      gender={gender}
                      evo={toEvo}
                      mood="celebrating"
                      animate={stage === 'celebrate'}
                      className="w-full h-full"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Celebrate layer — name + arrow + XP */}
            <AnimatePresence>
              {stage === 'celebrate' && (
                <motion.div
                  key="celebrate"
                  className="absolute inset-x-0 -bottom-2 flex flex-col items-center gap-3 px-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
                    <span>{fromName}</span>
                    <span aria-hidden>→</span>
                    <span className="text-white">{toName}</span>
                  </div>
                  <h2
                    id="evo-title"
                    className="text-3xl sm:text-4xl font-black text-white text-center drop-shadow-[0_4px_20px_rgba(255,255,255,0.25)]"
                  >
                    Parabéns! {toName} evoluiu!
                  </h2>
                  {xpBonus > 0 && (
                    <div className="inline-flex items-center gap-2 bg-yellow-500/15 border border-yellow-500/40 rounded-2xl px-5 py-2.5">
                      <span aria-hidden className="text-xl">⚡</span>
                      <span className="text-yellow-400 font-black text-lg">+{xpBonus} XP</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Confetti layer — fires at celebrate */}
          {showConfetti && (
            <div aria-hidden className="absolute inset-x-0 top-0 h-[60vh] overflow-hidden pointer-events-none">
              {confetti.map(p => (
                <span
                  key={p.id}
                  className="absolute top-0 block rounded-sm"
                  style={{
                    left:  p.left,
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Skip button — always accessible */}
          <button
            ref={skipRef}
            onClick={onClose}
            className="absolute top-6 right-6 px-4 py-2 text-sm text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 rounded-full backdrop-blur-sm transition-colors min-h-[44px]"
          >
            Saltar →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
