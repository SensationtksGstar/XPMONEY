'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface Props {
  open:     boolean
  onClose:  () => void
  icon:     string        // emoji or text
  title:    string
  subtitle: string
  xp?:      number
  autoClose?: number      // ms, default 3500
}

/* ── tiny pure-CSS confetti ───────────────────────────────────── */
const CONFETTI_COLORS = [
  '#22c55e', '#eab308', '#a855f7', '#3b82f6',
  '#f97316', '#ec4899', '#06b6d4', '#ffffff',
]
const PIECES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  left: `${(i / 28) * 100}%`,
  delay: `${(i * 0.07).toFixed(2)}s`,
  duration: `${0.9 + (i % 5) * 0.18}s`,
  rotate: `${(i % 2 === 0 ? 1 : -1) * (120 + (i % 4) * 60)}deg`,
  size: i % 3 === 0 ? 8 : 6,
}))

export function CelebrationModal({
  open, onClose, icon, title, subtitle, xp, autoClose = 3500,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      timerRef.current = setTimeout(onClose, autoClose)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [open, onClose, autoClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cel-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm"
          />

          {/* Card */}
          <motion.div
            key="cel-card"
            initial={{ opacity: 0, scale: 0.7, y: 40 }}
            animate={{ opacity: 1, scale: 1,   y: 0 }}
            exit={{    opacity: 0, scale: 0.8,  y: -20 }}
            transition={{ type: 'spring', damping: 18, stiffness: 280 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="pointer-events-auto relative w-full max-w-sm bg-[#0f1829] border border-white/15 rounded-3xl p-8 text-center overflow-hidden">

              {/* Confetti */}
              <div className="absolute inset-x-0 top-0 h-40 overflow-hidden pointer-events-none">
                {PIECES.map(p => (
                  <span
                    key={p.id}
                    className="absolute top-0 block rounded-sm"
                    style={{
                      left: p.left,
                      width:  p.size,
                      height: p.size,
                      backgroundColor: p.color,
                      animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
                    }}
                  />
                ))}
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.15, duration: 0.4, times: [0, 0.7, 1] }}
                className="text-6xl mb-4 inline-block"
              >
                {icon}
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-2xl font-black text-white mb-2"
              >
                {title}
              </motion.h2>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="text-white/60 text-sm leading-relaxed mb-5"
              >
                {subtitle}
              </motion.p>

              {/* XP badge */}
              {xp && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.45, type: 'spring', stiffness: 300 }}
                  className="inline-flex items-center gap-2 bg-yellow-500/15 border border-yellow-500/30 rounded-2xl px-5 py-2.5 mb-5"
                >
                  <span className="text-xl">⚡</span>
                  <span className="text-yellow-400 font-black text-lg">+{xp} XP</span>
                </motion.div>
              )}

              {/* Close CTA */}
              <button
                onClick={onClose}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3.5 rounded-2xl transition-all active:scale-95"
              >
                Continuar →
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
