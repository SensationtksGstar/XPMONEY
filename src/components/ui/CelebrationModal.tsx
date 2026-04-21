'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n/LocaleProvider'

interface Props {
  open:       boolean
  onClose:    () => void
  icon:       string        // emoji or text
  title:      string
  subtitle:   string
  xp?:        number
  autoClose?: number | false // ms before auto-dismiss, or false to disable
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
  open, onClose, icon, title, subtitle, xp, autoClose = 4500,
}: Props) {
  const t = useT()
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  // Countdown bar — updates every 50ms, pauses on hover
  useEffect(() => {
    if (!open || !autoClose || paused) return

    const start = Date.now() - elapsed
    const interval = setInterval(() => {
      const now = Date.now() - start
      setElapsed(now)
      if (now >= autoClose) {
        clearInterval(interval)
        onClose()
      }
    }, 50)
    return () => clearInterval(interval)
  }, [open, autoClose, onClose, paused, elapsed])

  // Reset elapsed when modal re-opens
  useEffect(() => {
    if (open) setElapsed(0)
  }, [open])

  // Keyboard: ESC to close, Enter to dismiss
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current)
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const progress = autoClose ? Math.min(100, (elapsed / autoClose) * 100) : 0

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
      />

      {/* Card */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-6 pointer-events-none">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="celebration-title"
          aria-describedby="celebration-subtitle"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="pointer-events-auto relative w-full max-w-sm bg-[#0f1829] border border-white/15 rounded-3xl p-8 text-center overflow-hidden animate-fade-in-up"
        >
          {/* Confetti */}
          <div className="absolute inset-x-0 top-0 h-40 overflow-hidden pointer-events-none" aria-hidden="true">
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

          {/* Close — larger touch target */}
          <button
            onClick={onClose}
            aria-label={t('celebration.close_aria')}
            className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-white/30 hover:text-white rounded-full hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon */}
          <div className="text-6xl mb-4 inline-block" aria-hidden="true">
            {icon}
          </div>

          {/* Title */}
          <h2 id="celebration-title" className="text-2xl font-black text-white mb-2">
            {title}
          </h2>

          {/* Subtitle */}
          <p id="celebration-subtitle" className="text-white/60 text-sm leading-relaxed mb-5">
            {subtitle}
          </p>

          {/* XP badge */}
          {xp && (
            <div className="inline-flex items-center gap-2 bg-yellow-500/15 border border-yellow-500/30 rounded-2xl px-5 py-2.5 mb-5">
              <span className="text-xl" aria-hidden="true">⚡</span>
              <span className="text-yellow-400 font-black text-lg">+{xp} XP</span>
            </div>
          )}

          {/* Close CTA */}
          <button
            onClick={onClose}
            className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3.5 rounded-2xl transition-all active:scale-95 min-h-[44px]"
            autoFocus
          >
            {t('celebration.continue')}
          </button>

          {/* Countdown progress bar — bottom of card, gives user spatial awareness */}
          {autoClose && (
            <div
              className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 overflow-hidden"
              aria-hidden="true"
            >
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-[50ms] ease-linear"
                style={{ width: `${100 - progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
