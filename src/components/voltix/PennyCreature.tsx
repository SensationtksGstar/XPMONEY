'use client'

/**
 * PennyCreature — female mascot counterpart to Voltix.
 *
 * 5 evolution stages with the Penny visual DNA:
 *   cream fur · coral ribbons · mustard gloves · lilac tufts · sky blue eyes
 *
 * Aims for parity with VoltixCreature: same sizes, moods, animate prop, and
 * the same idle animation stack (float / breathe / aura / sparkles). Each
 * evolution is hand-crafted SVG — no external image assets needed.
 */

import { useId } from 'react'
import type { VoltixMood } from '@/types'

type Mood = VoltixMood

/** Palette per-mood — only accents change; body fur stays cream */
interface PennyPalette {
  fur:     string          // base cream
  furShade:string          // darker cream for contour
  ribbon:  string          // coral ribbon
  glove:   string          // mustard glove
  tuft:    string          // lilac ear-tuft
  accent:  string          // aura + sparkles
  eyeA:    string          // iris light
  eyeB:    string          // iris dark
  cheek:   string
}

export const PENNY_PALETTE: Record<Mood, PennyPalette> = {
  sad: {
    fur:'#f5f0e4', furShade:'#d4cec0', ribbon:'#c48b86', glove:'#b8974a',
    tuft:'#9a8aaa', accent:'#c48b86', eyeA:'#93c5fd', eyeB:'#1d4ed8', cheek:'#e8a0a0',
  },
  neutral: {
    fur:'#f5f0e4', furShade:'#d4cec0', ribbon:'#e8958e', glove:'#d4a94a',
    tuft:'#b8a5c9', accent:'#b8a5c9', eyeA:'#6AB6D8', eyeB:'#1e4a6b', cheek:'#f4c7c0',
  },
  happy: {
    fur:'#f8f4ea', furShade:'#d7d1c3', ribbon:'#e8958e', glove:'#d4a94a',
    tuft:'#b8a5c9', accent:'#e8958e', eyeA:'#7dd3fc', eyeB:'#0369a1', cheek:'#f4c7c0',
  },
  excited: {
    fur:'#fbf8ef', furShade:'#dcd5c5', ribbon:'#f09b90', glove:'#e6b852',
    tuft:'#c9b5d6', accent:'#f09b90', eyeA:'#fde68a', eyeB:'#b45309', cheek:'#fca5a5',
  },
  celebrating: {
    fur:'#fcf9f0', furShade:'#dcd5c5', ribbon:'#f6a59a', glove:'#f0c65e',
    tuft:'#d4c2e0', accent:'#f0c65e', eyeA:'#e9d5ff', eyeB:'#7e22ce', cheek:'#fca5a5',
  },
}

export const PENNY_EVO_NAMES: Record<number, string> = {
  1: 'Pennini', 2: 'Pennito', 3: 'Penny', 4: 'Pennyara', 5: 'Pennael',
}

export const PENNY_EVO_DESCRIPTIONS: Record<number, string> = {
  1: 'Semente adormecida. Já sonha com moedas a tilintar.',
  2: 'A despertar para a sabedoria. Capa coral com bordado rúnico.',
  3: 'Forma felina desbloqueada. Luvas mustard e fitas com runas.',
  4: 'Sacerdotisa-guerreira. Visor rúnico e arco de luz.',
  5: 'Anjo ascendido. 6 asas, arco dourado, gema emerald no peito.',
}

export const PENNY_EVO_REQUIREMENTS: Record<number, string> = {
  1: 'Estado inicial',
  2: 'Score ≥ 30 ou Nível ≥ 2',
  3: 'Score ≥ 50 ou Nível ≥ 4',
  4: 'Score ≥ 70 ou Nível ≥ 6',
  5: 'Score ≥ 90 ou Nível ≥ 9',
}

// ── Shared mini-helpers ──────────────────────────────────────────────────────

function PennyEye({ cx, cy, r, palette, closed }: {
  cx: number; cy: number; r: number; palette: PennyPalette; closed?: boolean
}) {
  if (closed) {
    return (
      <path d={`M${cx-r} ${cy} Q${cx} ${cy+r*0.5} ${cx+r} ${cy}`}
        stroke="#1e293b" strokeWidth={r*0.24} strokeLinecap="round" fill="none" />
    )
  }
  return (
    <g>
      <ellipse cx={cx} cy={cy+r*0.12} rx={r*0.98} ry={r*0.72} fill="rgba(0,0,0,0.15)" />
      <circle  cx={cx} cy={cy} r={r} fill="white" />
      <ellipse cx={cx} cy={cy} rx={r*0.72} ry={r*0.82} fill={palette.eyeB} />
      <ellipse cx={cx-r*0.08} cy={cy-r*0.08} rx={r*0.48} ry={r*0.58} fill={palette.eyeA} opacity={0.85} />
      {/* Feline slit pupil */}
      <ellipse cx={cx} cy={cy+r*0.04} rx={r*0.14} ry={r*0.58} fill="#0f172a" />
      <circle  cx={cx-r*0.3} cy={cy-r*0.32} r={r*0.22} fill="white" opacity={0.95} />
      <circle  cx={cx+r*0.18} cy={cy+r*0.12} r={r*0.1}  fill="white" opacity={0.6} />
    </g>
  )
}

function PennyMouth({ cx, cy, w, mood }: { cx: number; cy: number; w: number; mood: Mood }) {
  if (mood === 'sad') return (
    <path d={`M${cx-w*0.5} ${cy+w*0.18} Q${cx} ${cy-w*0.28} ${cx+w*0.5} ${cy+w*0.18}`}
      stroke="#1e293b" strokeWidth={w*0.14} strokeLinecap="round" fill="none" />
  )
  if (mood === 'neutral') return (
    <path d={`M${cx-w*0.3} ${cy} Q${cx} ${cy+w*0.08} ${cx+w*0.3} ${cy}`}
      stroke="#1e293b" strokeWidth={w*0.14} strokeLinecap="round" fill="none" />
  )
  // happy / excited / celebrating — open mouth with fang
  return (
    <g>
      <path d={`M${cx-w*0.38} ${cy} Q${cx} ${cy+w*0.36} ${cx+w*0.38} ${cy}`}
        stroke="#1e293b" strokeWidth={w*0.14} strokeLinecap="round" fill="none" />
      {/* fang */}
      <path d={`M${cx+w*0.08} ${cy+w*0.04} L${cx+w*0.18} ${cy+w*0.22} L${cx+w*0.24} ${cy+w*0.04} Z`}
        fill="white" stroke="#1e293b" strokeWidth={w*0.05} />
    </g>
  )
}

function PennyNose({ cx, cy }: { cx: number; cy: number }) {
  return <path d={`M${cx-3} ${cy} Q${cx} ${cy+4} ${cx+3} ${cy} Z`} fill="#e8958e" />
}

function PennyCheeks({ cx, cy, rx, palette, mood }: {
  cx: number; cy: number; rx: number; palette: PennyPalette; mood: Mood
}) {
  const opacity = mood === 'celebrating' ? 0.8 : mood === 'excited' ? 0.6 : 0.45
  return (
    <>
      <ellipse cx={cx-rx*1.2} cy={cy} rx={rx*0.5} ry={rx*0.35} fill={palette.cheek} opacity={opacity} />
      <ellipse cx={cx+rx*1.2} cy={cy} rx={rx*0.5} ry={rx*0.35} fill={palette.cheek} opacity={opacity} />
    </>
  )
}

// ── Evolution 1 · Pennini (egg) ─────────────────────────────────────────────

function Evo1({ palette, uid }: { palette: PennyPalette; mood: Mood; uid: string }) {
  return (
    <svg viewBox="0 0 200 220" className="w-full h-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id={`${uid}_egg`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor={palette.fur} />
          <stop offset="100%" stopColor={palette.furShade} />
        </radialGradient>
      </defs>
      {/* Egg body */}
      <ellipse cx="100" cy="120" rx="58" ry="72" fill={`url(#${uid}_egg)`} stroke={palette.furShade} strokeWidth="2" />
      {/* Crack */}
      <path d="M62 98 L78 88 L70 80 L84 72 L78 66" stroke="#d4cec0" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="82" cy="92" rx="14" ry="4" fill="white" opacity="0.5" transform="rotate(-20 82 92)" />
      {/* Lilac ear-tufts peeking out */}
      <ellipse cx="82"  cy="58" rx="11" ry="14" fill={palette.tuft} transform="rotate(-18 82 58)" />
      <ellipse cx="118" cy="58" rx="11" ry="14" fill={palette.tuft} transform="rotate(18 118 58)" />
      {/* Coral ribbon orbiting — simulated with tilted ellipse ring */}
      <ellipse cx="100" cy="130" rx="72" ry="22" stroke={palette.ribbon} strokeWidth="4" fill="none" opacity="0.95" />
      <ellipse cx="100" cy="130" rx="72" ry="22" stroke={palette.ribbon} strokeWidth="2" fill="none" opacity="0.4"
        transform="rotate(8 100 130)" />
      {/* Closed eyes (sleeping) */}
      <path d="M85 78 Q92 82 98 78" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M102 78 Q109 82 115 78" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Small mouth */}
      <path d="M96 95 Q100 98 104 95" stroke="#1e293b" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      {/* Floating coral feathers */}
      <path d="M32 90 Q38 82 44 90 Q38 96 32 90 Z" fill={palette.ribbon} opacity="0.9"
        className="animate-mascot-feather" />
      <path d="M160 160 Q168 152 174 160 Q168 166 160 160 Z" fill={palette.ribbon} opacity="0.8"
        className="animate-mascot-feather delay-900" />
      {/* Sparkles */}
      <circle cx="40" cy="160" r="2" fill="#fde68a" className="animate-mascot-sparkle" />
      <circle cx="170" cy="110" r="1.5" fill="#fde68a" className="animate-mascot-sparkle delay-600" />
    </svg>
  )
}

// ── Evolution 2 · Pennito (In-Training) ──────────────────────────────────────

function Evo2({ palette, mood, uid }: { palette: PennyPalette; mood: Mood; uid: string }) {
  return (
    <svg viewBox="0 0 200 220" className="w-full h-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id={`${uid}_body2`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor={palette.fur} />
          <stop offset="100%" stopColor={palette.furShade} />
        </radialGradient>
      </defs>

      {/* Big floppy ears with lilac tips */}
      <path d="M52 88 Q40 60 52 40 Q70 50 72 80 Z" fill={`url(#${uid}_body2)`} stroke={palette.furShade} strokeWidth="2" />
      <path d="M148 88 Q160 60 148 40 Q130 50 128 80 Z" fill={`url(#${uid}_body2)`} stroke={palette.furShade} strokeWidth="2" />
      <path d="M52 88 Q50 72 58 60 Q62 78 62 84 Z" fill={palette.tuft} opacity="0.85" />
      <path d="M148 88 Q150 72 142 60 Q138 78 138 84 Z" fill={palette.tuft} opacity="0.85" />

      {/* Round body */}
      <ellipse cx="100" cy="128" rx="62" ry="58" fill={`url(#${uid}_body2)`} stroke={palette.furShade} strokeWidth="2.2" />

      {/* Head (overlap, slightly bigger than body) */}
      <ellipse cx="100" cy="98" rx="52" ry="50" fill={`url(#${uid}_body2)`} stroke={palette.furShade} strokeWidth="2.2" />
      <ellipse cx="85" cy="82" rx="14" ry="7" fill="white" opacity="0.22" transform="rotate(-18 85 82)" />

      {/* Coral cape around neck */}
      <path d="M64 140 Q100 148 136 140 L140 170 Q100 180 60 170 Z" fill={palette.ribbon} />
      <path d="M64 140 Q100 148 136 140" stroke={palette.ribbon} strokeWidth="1.5" fill="none" opacity="0.6" />
      {/* Bordado runas (tiny zigzag) */}
      <path d="M72 160 L78 156 L84 160 L90 156 L96 160 L102 156 L108 160 L114 156 L120 160 L126 156 L132 160"
        stroke={palette.fur} strokeWidth="1.2" fill="none" opacity="0.85" />
      {/* Gold bell clasp */}
      <circle cx="100" cy="144" r="7" fill={palette.glove} stroke="#a07a1f" strokeWidth="1.2" />
      <circle cx="100" cy="144" r="3" fill="#a07a1f" />

      {/* Paws peeking below */}
      <ellipse cx="78"  cy="180" rx="12" ry="8" fill={`url(#${uid}_body2)`} stroke={palette.furShade} strokeWidth="1.5" />
      <ellipse cx="122" cy="180" rx="12" ry="8" fill={`url(#${uid}_body2)`} stroke={palette.furShade} strokeWidth="1.5" />
      {/* Pink paw pads */}
      <circle cx="78"  cy="180" r="3" fill={palette.cheek} opacity="0.9" />
      <circle cx="122" cy="180" r="3" fill={palette.cheek} opacity="0.9" />

      {/* Face */}
      <PennyEye cx={82}  cy={96} r={10} palette={palette} />
      <PennyEye cx={118} cy={96} r={10} palette={palette} />
      <PennyNose cx={100} cy={110} />
      <PennyMouth cx={100} cy={118} w={18} mood={mood} />
      <PennyCheeks cx={100} cy={112} rx={6} palette={palette} mood={mood} />

      {/* Sparkles */}
      <circle cx="30" cy="64" r="1.5" fill="white" className="animate-mascot-sparkle" />
      <circle cx="172" cy="130" r="2" fill="#fde68a" className="animate-mascot-sparkle delay-600" />
      <circle cx="22" cy="182" r="1.5" fill="white" className="animate-mascot-sparkle delay-1200" />
    </svg>
  )
}

// ── Evolution 3 · Penny (Rookie — canonical) ─────────────────────────────────

function Evo3({ palette, mood, uid }: { palette: PennyPalette; mood: Mood; uid: string }) {
  return (
    <svg viewBox="0 0 214 240" className="w-full h-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id={`${uid}_body3`} cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor={palette.fur} />
          <stop offset="100%" stopColor={palette.furShade} />
        </radialGradient>
        <radialGradient id={`${uid}_ring3`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff7b5" />
          <stop offset="60%" stopColor={palette.glove} />
          <stop offset="100%" stopColor="#a07a1f" />
        </radialGradient>
      </defs>

      {/* Tail (behind body) with floating gold ring */}
      <path d="M178 168 Q200 150 196 120 Q190 96 172 100"
        stroke={palette.furShade} strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M178 168 Q200 150 196 120 Q190 96 172 100"
        stroke={palette.fur} strokeWidth="6" strokeLinecap="round" fill="none" />
      {/* Lilac tuft at tail tip */}
      <ellipse cx="170" cy="98" rx="8" ry="12" fill={palette.tuft} transform="rotate(25 170 98)" />
      {/* Gold ring floating */}
      <ellipse cx="188" cy="132" rx="14" ry="5" fill={`url(#${uid}_ring3)`}
        className="animate-mascot-sparkle" />
      <ellipse cx="188" cy="132" rx="14" ry="5" stroke="#a07a1f" strokeWidth="1.2" fill="none" />

      {/* Legs */}
      <path d="M82 212 L82 182 L92 180 L94 212 Z" fill={`url(#${uid}_body3)`} stroke={palette.furShade} strokeWidth="1.8" />
      <path d="M130 212 L132 180 L142 182 L142 212 Z" fill={`url(#${uid}_body3)`} stroke={palette.furShade} strokeWidth="1.8" />
      {/* Foot-gloves (mustard socks) */}
      <path d="M80 212 L96 212 L96 222 L78 222 Z" fill={palette.glove} />
      <path d="M128 212 L144 212 L144 222 L126 222 Z" fill={palette.glove} />
      <path d="M84 218 L82 220 M90 218 L90 222 M128 218 L130 222 M138 218 L138 222"
        stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" />

      {/* Body (bipedal) */}
      <path d="M78 186 Q74 140 90 118 Q107 108 124 118 Q140 140 136 186 Z"
        fill={`url(#${uid}_body3)`} stroke={palette.furShade} strokeWidth="2.2" />
      {/* Fluffy chest ruff */}
      <path d="M88 128 Q95 142 90 154 Q104 148 124 154 Q119 142 126 128 Q107 122 88 128 Z"
        fill={palette.fur} stroke={palette.furShade} strokeWidth="1.4" />

      {/* Arms with mustard gloves */}
      {/* Left arm — V gesture up */}
      <path d="M88 126 Q72 112 64 88"
        stroke={palette.furShade} strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M88 126 Q72 112 64 88"
        stroke={palette.fur} strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* Left glove (mustard with runes) */}
      <ellipse cx="62" cy="82" rx="10" ry="12" fill={palette.glove} stroke="#a07a1f" strokeWidth="1.2" />
      {/* V-fingers */}
      <path d="M58 74 L54 60 M66 74 L70 60"
        stroke={palette.glove} strokeWidth="5" strokeLinecap="round" />
      <path d="M58 74 L54 60 M66 74 L70 60"
        stroke="#a07a1f" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Right arm — relaxed at side */}
      <path d="M126 128 Q140 150 142 170"
        stroke={palette.furShade} strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M126 128 Q140 150 142 170"
        stroke={palette.fur} strokeWidth="7" strokeLinecap="round" fill="none" />
      <ellipse cx="144" cy="174" rx="11" ry="9" fill={palette.glove} stroke="#a07a1f" strokeWidth="1.2" />

      {/* Head */}
      <ellipse cx="107" cy="84" rx="44" ry="42" fill={`url(#${uid}_body3)`} stroke={palette.furShade} strokeWidth="2.2" />
      <ellipse cx="90"  cy="72" rx="16" ry="8" fill="white" opacity="0.18" transform="rotate(-18 90 72)" />

      {/* Pointed ears with lilac tufts */}
      <path d="M72 58 L62 22 L88 40 Z" fill={`url(#${uid}_body3)`} stroke={palette.furShade} strokeWidth="2" />
      <path d="M142 58 L152 22 L126 40 Z" fill={`url(#${uid}_body3)`} stroke={palette.furShade} strokeWidth="2" />
      {/* Inner ear pink */}
      <path d="M74 54 L68 34 L82 44 Z" fill={palette.cheek} opacity="0.7" />
      <path d="M140 54 L146 34 L132 44 Z" fill={palette.cheek} opacity="0.7" />
      {/* Lilac tufts peeking from ear tips */}
      <ellipse cx="62" cy="26" rx="5" ry="7" fill={palette.tuft} transform="rotate(-15 62 26)" />
      <ellipse cx="152" cy="26" rx="5" ry="7" fill={palette.tuft} transform="rotate(15 152 26)" />

      {/* Forehead runic marks (3 small triangles) */}
      <path d="M100 52 L104 56 L100 60 Z M107 50 L111 56 L107 62 Z M114 52 L110 56 L114 60 Z"
        fill={palette.furShade} opacity="0.45" />

      {/* Face */}
      <PennyEye cx={92}  cy={84} r={10} palette={palette} />
      <PennyEye cx={122} cy={84} r={10} palette={palette} />
      <PennyNose cx={107} cy={98} />
      <PennyMouth cx={107} cy={106} w={20} mood={mood} />
      <PennyCheeks cx={107} cy={100} rx={8} palette={palette} mood={mood} />

      {/* Whiskers */}
      <path d="M72 102 L50 98 M72 106 L50 108 M142 102 L164 98 M142 106 L164 108"
        stroke={palette.furShade} strokeWidth="1" strokeLinecap="round" opacity="0.7" />

      {/* Coral ribbons behind ears with runes (stream right) */}
      <path d="M86 44 Q60 70 42 104 Q28 132 38 158"
        stroke={palette.ribbon} strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.95"
        className="animate-mascot-sway" style={{ transformOrigin: '86px 44px' }} />
      <path d="M128 44 Q152 66 170 92"
        stroke={palette.ribbon} strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.95" />
      {/* Runes as tiny dashes on ribbon */}
      <path d="M56 80 L58 84 M48 96 L52 98 M42 118 L46 120 M40 140 L44 142"
        stroke="#5a3a38" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />

      {/* Sparkles */}
      <circle cx="30" cy="48" r="1.8" fill="#fde68a" className="animate-mascot-sparkle" />
      <circle cx="184" cy="52" r="1.5" fill="white" className="animate-mascot-sparkle delay-600" />
      <circle cx="184" cy="180" r="1.5" fill="#fde68a" className="animate-mascot-sparkle delay-1200" />
    </svg>
  )
}

// ── Evolution 4 · Pennyara (Champion) ────────────────────────────────────────

function Evo4({ palette, mood, uid }: { palette: PennyPalette; mood: Mood; uid: string }) {
  return (
    <svg viewBox="0 0 214 240" className="w-full h-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`${uid}_dress4`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.fur} />
          <stop offset="70%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={palette.furShade} />
        </linearGradient>
        <linearGradient id={`${uid}_hair4`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f7ecc8" />
          <stop offset="100%" stopColor="#d4bf8a" />
        </linearGradient>
      </defs>

      {/* Long platinum hair flowing behind */}
      <path d="M70 70 Q50 130 56 200 Q74 190 78 140 Z" fill={`url(#${uid}_hair4)`} stroke="#bea770" strokeWidth="1.4" />
      <path d="M144 70 Q164 130 158 200 Q140 190 136 140 Z" fill={`url(#${uid}_hair4)`} stroke="#bea770" strokeWidth="1.4" />

      {/* Dress — flowing */}
      <path d="M80 150 Q70 200 60 224 L154 224 Q144 200 134 150 Z" fill={`url(#${uid}_dress4)`} stroke={palette.furShade} strokeWidth="1.8" />
      {/* Belt buckles (3 black horizontal) */}
      <rect x="82" y="158" width="50" height="6" fill="#1a1a1a" />
      <rect x="82" y="170" width="50" height="6" fill="#1a1a1a" />
      <rect x="82" y="182" width="50" height="6" fill="#1a1a1a" />
      <circle cx="107" cy="161" r="2" fill={palette.glove} />
      <circle cx="107" cy="173" r="2" fill={palette.glove} />
      <circle cx="107" cy="185" r="2" fill={palette.glove} />

      {/* Torso (body) */}
      <path d="M80 150 Q78 120 92 104 Q107 96 122 104 Q136 120 134 150 Z"
        fill={palette.fur} stroke={palette.furShade} strokeWidth="1.8" />

      {/* Arms + gauntlets */}
      <path d="M92 110 Q74 126 58 150"
        stroke={palette.fur} strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M122 110 Q140 126 156 150"
        stroke={palette.fur} strokeWidth="10" strokeLinecap="round" fill="none" />
      {/* Gauntlets (long mustard gloves with runes) */}
      <path d="M70 138 L50 158 L56 162 L78 144 Z" fill={palette.glove} stroke="#a07a1f" strokeWidth="1.2" />
      <path d="M144 138 L164 158 L158 162 L136 144 Z" fill={palette.glove} stroke="#a07a1f" strokeWidth="1.2" />
      {/* Runes on gauntlets */}
      <path d="M58 152 L62 148 M66 156 L70 152 M148 152 L152 148 M156 156 L160 152"
        stroke="#5a3a38" strokeWidth="1.4" strokeLinecap="round" />
      {/* Black claw tips */}
      <path d="M50 158 L46 162 M54 160 L50 165 M164 158 L168 162 M160 160 L164 165"
        stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />

      {/* Star of light (casting spell) - left of body */}
      <g className="animate-mascot-sparkle" style={{ transformOrigin: '40px 160px' }}>
        <path d="M40 146 L43 156 L53 158 L44 164 L47 175 L40 168 L33 175 L36 164 L27 158 L37 156 Z"
          fill="#fef3c7" stroke="#fbbf24" strokeWidth="1.2" opacity="0.95" />
      </g>

      {/* Head (human-ish but cream) */}
      <ellipse cx="107" cy="78" rx="26" ry="30" fill={palette.fur} stroke={palette.furShade} strokeWidth="1.5" />

      {/* Lilac feline ears on top */}
      <path d="M88 54 L82 30 L100 46 Z" fill={palette.fur} stroke={palette.furShade} strokeWidth="1.5" />
      <path d="M126 54 L132 30 L114 46 Z" fill={palette.fur} stroke={palette.furShade} strokeWidth="1.5" />
      <ellipse cx="84" cy="36" rx="4" ry="6" fill={palette.tuft} transform="rotate(-15 84 36)" />
      <ellipse cx="130" cy="36" rx="4" ry="6" fill={palette.tuft} transform="rotate(15 130 36)" />

      {/* Black horizontal visor helmet */}
      <rect x="80" y="70" width="54" height="12" rx="3" fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="1" />
      <rect x="82" y="72" width="50" height="3"  rx="1" fill="#3a3a3a" />
      {/* Glowing sky-blue slit inside visor */}
      <rect x="84" y="75" width="46" height="2"  fill={palette.eyeA} opacity="0.8" />

      {/* Soft smile below */}
      <path d="M98 92 Q107 98 116 92" stroke="#1e293b" strokeWidth="1.6" strokeLinecap="round" fill="none" />

      {/* Neck bell */}
      <circle cx="107" cy="106" r="5" fill={palette.ribbon} stroke="#a3564f" strokeWidth="1" />

      {/* Coral ribbons with runes flowing */}
      <path d="M134 100 Q170 140 178 200"
        stroke={palette.ribbon} strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.95"
        className="animate-mascot-sway" style={{ transformOrigin: '134px 100px' }} />
      <path d="M80 100 Q44 140 34 200"
        stroke={palette.ribbon} strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.9" />
      {/* Runes as dashes */}
      <path d="M150 118 L153 122 M158 134 L161 138 M166 152 L169 156 M170 172 L173 176"
        stroke="#5a3a38" strokeWidth="1.4" strokeLinecap="round" />

      {/* Bare feet peeking */}
      <ellipse cx="88"  cy="226" rx="7" ry="4" fill={palette.fur} stroke={palette.furShade} strokeWidth="1" />
      <ellipse cx="126" cy="226" rx="7" ry="4" fill={palette.fur} stroke={palette.furShade} strokeWidth="1" />

      {/* Feathers floating */}
      <path d="M20 100 Q26 92 32 100 Q26 106 20 100 Z" fill={palette.ribbon} opacity="0.85"
        className="animate-mascot-feather" />
      <path d="M180 70 Q186 62 192 70 Q186 76 180 70 Z" fill={palette.ribbon} opacity="0.7"
        className="animate-mascot-feather delay-900" />
    </svg>
  )
}

// ── Evolution 5 · Pennael (Ultimate) ─────────────────────────────────────────

function Evo5({ palette, mood, uid }: { palette: PennyPalette; mood: Mood; uid: string }) {
  return (
    <svg viewBox="0 0 240 240" className="w-full h-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`${uid}_wingCoral`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={palette.ribbon} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.ribbon} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${uid}_wingLilac`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={palette.tuft} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.tuft} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${uid}_wingCream`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={palette.fur} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${uid}_robe5`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={palette.fur} />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={palette.ribbon} stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id={`${uid}_gem5`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#059669" />
        </radialGradient>
      </defs>

      {/* Back wings — 3 pairs: lilac (small, inner), cream (middle), coral (big, outer) */}
      {/* Coral outer */}
      <path d="M120 110 Q60 60 26 30 Q50 90 80 120 Z" fill={`url(#${uid}_wingCoral)`} stroke={palette.ribbon} strokeWidth="1.4" />
      <path d="M120 110 Q180 60 214 30 Q190 90 160 120 Z" fill={`url(#${uid}_wingCoral)`} stroke={palette.ribbon} strokeWidth="1.4" />
      {/* Lilac middle */}
      <path d="M120 120 Q82 80 62 62 Q72 114 94 130 Z" fill={`url(#${uid}_wingLilac)`} stroke={palette.tuft} strokeWidth="1.2" />
      <path d="M120 120 Q158 80 178 62 Q168 114 146 130 Z" fill={`url(#${uid}_wingLilac)`} stroke={palette.tuft} strokeWidth="1.2" />
      {/* Cream lower */}
      <path d="M120 140 Q100 150 70 172 Q86 180 110 168 Z" fill={`url(#${uid}_wingCream)`} stroke={palette.furShade} strokeWidth="1" />
      <path d="M120 140 Q140 150 170 172 Q154 180 130 168 Z" fill={`url(#${uid}_wingCream)`} stroke={palette.furShade} strokeWidth="1" />
      {/* Feather line details */}
      <path d="M40 52 L60 76 M50 72 L72 92 M70 96 L88 114"
        stroke={palette.ribbon} strokeWidth="1.2" opacity="0.6" fill="none" />
      <path d="M200 52 L180 76 M190 72 L168 92 M170 96 L152 114"
        stroke={palette.ribbon} strokeWidth="1.2" opacity="0.6" fill="none" />

      {/* Robe body */}
      <path d="M94 148 Q82 210 74 228 L166 228 Q158 210 146 148 Z"
        fill={`url(#${uid}_robe5)`} stroke={palette.furShade} strokeWidth="1.5" opacity="0.98" />

      {/* Torso + emerald gem on chest */}
      <path d="M96 146 Q92 122 106 112 Q120 106 134 112 Q148 122 144 146 Z"
        fill={palette.fur} stroke={palette.furShade} strokeWidth="1.5" />
      <circle cx="120" cy="126" r="7" fill={`url(#${uid}_gem5)`} stroke="#065f46" strokeWidth="1" />
      <path d="M117 123 L120 120 L123 123" stroke="white" strokeWidth="1.2" fill="none" opacity="0.8" />

      {/* Golden bow held across */}
      <path d="M52 160 Q72 150 96 156 Q120 164 144 156 Q168 150 188 160"
        stroke={palette.glove} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M52 160 Q58 166 52 172 M188 160 Q182 166 188 172"
        stroke={palette.glove} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Bow string — rune line */}
      <path d="M60 166 L180 166" stroke={palette.ribbon} strokeWidth="1.2" />
      {/* Arrow of light */}
      <path d="M120 166 L120 200" stroke="#fef3c7" strokeWidth="2" />
      <path d="M120 200 L116 194 M120 200 L124 194" stroke={palette.glove} strokeWidth="2" strokeLinecap="round" />

      {/* Long hair */}
      <path d="M94 80 Q80 140 82 200 Q102 192 102 150 Z" fill="#f7ecc8" stroke="#bea770" strokeWidth="1" opacity="0.95" />
      <path d="M146 80 Q160 140 158 200 Q138 192 138 150 Z" fill="#f7ecc8" stroke="#bea770" strokeWidth="1" opacity="0.95" />

      {/* Head */}
      <ellipse cx="120" cy="92" rx="24" ry="26" fill={palette.fur} stroke={palette.furShade} strokeWidth="1.2" />
      {/* Visor — opened vertically, glowing eye revealed */}
      <rect x="100" y="86" width="40" height="8"  rx="2" fill="#1a1a1a" />
      <rect x="100" y="86" width="40" height="2"  fill="#3a3a3a" />
      <circle cx="120" cy="90" r="3" fill={palette.eyeA} className="animate-mascot-sparkle" />

      {/* Lilac feline ears */}
      <path d="M104 70 L98 48 L114 64 Z" fill={palette.fur} stroke={palette.furShade} strokeWidth="1.2" />
      <path d="M136 70 L142 48 L126 64 Z" fill={palette.fur} stroke={palette.furShade} strokeWidth="1.2" />
      <ellipse cx="100" cy="54" rx="3.5" ry="5" fill={palette.tuft} transform="rotate(-15 100 54)" />
      <ellipse cx="140" cy="54" rx="3.5" ry="5" fill={palette.tuft} transform="rotate(15 140 54)" />

      {/* Soft smile */}
      <path d="M112 104 Q120 108 128 104" stroke="#1e293b" strokeWidth="1.3" strokeLinecap="round" fill="none" />

      {/* Falling feathers all around */}
      <path d="M14 60 Q18 56 22 60 Q18 64 14 60 Z" fill={palette.ribbon} opacity="0.85"
        className="animate-mascot-feather" />
      <path d="M220 100 Q224 96 228 100 Q224 104 220 100 Z" fill={palette.ribbon} opacity="0.75"
        className="animate-mascot-feather delay-600" />
      <path d="M30 180 Q34 176 38 180 Q34 184 30 180 Z" fill={palette.fur} opacity="0.85"
        className="animate-mascot-feather delay-1200" />
      <path d="M200 190 Q204 186 208 190 Q204 194 200 190 Z" fill={palette.tuft} opacity="0.7"
        className="animate-mascot-feather delay-900" />

      {/* Aura sparkles */}
      <circle cx="30" cy="30" r="2" fill="#fde68a" className="animate-mascot-sparkle" />
      <circle cx="210" cy="28" r="1.8" fill="white" className="animate-mascot-sparkle delay-600" />
      <circle cx="220" cy="220" r="1.5" fill="#fde68a" className="animate-mascot-sparkle delay-1200" />
    </svg>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

interface Props {
  evo: number
  mood: Mood
  className?: string
  animate?: boolean
}

export function PennyCreature({ evo, mood, className = '', animate = true }: Props) {
  const rawId  = useId()
  const uid    = rawId.replace(/[^a-zA-Z0-9]/g, '_')
  const palette = PENNY_PALETTE[mood]

  const props = { palette, mood, uid }

  const creature =
    evo >= 5 ? <Evo5 {...props} /> :
    evo === 4 ? <Evo4 {...props} /> :
    evo === 3 ? <Evo3 {...props} /> :
    evo === 2 ? <Evo2 {...props} /> :
    <Evo1 {...props} />

  if (!animate) return <div className={`relative ${className}`}>{creature}</div>

  return (
    <div className={`relative ${className} animate-mascot-float`}>
      {/* Aura pool */}
      <div
        className="absolute -bottom-2 left-1/2 w-3/5 h-6 blur-2xl rounded-full animate-mascot-aura transition-colors duration-700"
        style={{ backgroundColor: palette.accent }}
      />
      {/* Breathing inner layer */}
      <div className="animate-mascot-breathe">
        {creature}
      </div>
      {/* Ambient sparkles — upper evos */}
      {evo >= 3 && (
        <>
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-pink-200 animate-mascot-sparkle" aria-hidden />
          <span className="absolute top-6 left-3 w-1 h-1 rounded-full bg-white animate-mascot-sparkle delay-600" aria-hidden />
          <span className="absolute bottom-10 right-5 w-1 h-1 rounded-full bg-amber-200 animate-mascot-sparkle delay-1200" aria-hidden />
        </>
      )}
    </div>
  )
}
