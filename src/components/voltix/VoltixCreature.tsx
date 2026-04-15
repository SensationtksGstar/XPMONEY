'use client'

/**
 * VoltixCreature v2 — premium SVG financial pet
 *
 * Upgrades over v1:
 *  - radialGradient 3-stop on every body/head (3D sphere effect)
 *  - linearGradient on wings (translucent fade)
 *  - feGaussianBlur glow on tail tips, aura rings, armor badges
 *  - Eyes: sclera → iris gradient → pupil → dual specular highlights + eyebrows
 *  - Mouth: open cavity with teeth + tongue on celebrating/excited
 *  - Cheeks: rosy blush with sparkle dot on celebrating
 *  - Coin scales / armor plates with per-scale highlights
 *  - useId() scoped gradient IDs (safe for multi-instance renders)
 */

import { useId } from 'react'
import type { VoltixMood } from '@/types'

type Mood = VoltixMood
interface C { body: string; shade: string; light: string; accent: string }

export const MOOD_PALETTE: Record<Mood, C> = {
  sad:         { body:'#ef4444', shade:'#b91c1c', light:'#fca5a5', accent:'#f87171' },
  neutral:     { body:'#64748b', shade:'#334155', light:'#cbd5e1', accent:'#94a3b8' },
  happy:       { body:'#22c55e', shade:'#15803d', light:'#86efac', accent:'#4ade80' },
  excited:     { body:'#f59e0b', shade:'#92400e', light:'#fde68a', accent:'#fbbf24' },
  celebrating: { body:'#a855f7', shade:'#6b21a8', light:'#e9d5ff', accent:'#c084fc' },
}

export const EVO_NAMES: Record<number, string> = {
  1: 'Cointinho', 2: 'Moedix', 3: 'Vaultix', 4: 'Aurion', 5: 'Legendrix',
}

export const EVO_DESCRIPTIONS: Record<number, string> = {
  1: 'Recrutinha das finanças. Mal nasceu mas já sabe o que é um €.',
  2: 'A crescer! Já tem coins nas orelhas e uma jóia na testa.',
  3: 'Forma dragão desbloqueada. Escamas de moeda e asas de raio.',
  4: 'Campeão coroado. Armadura de ouro e aura de riqueza.',
  5: 'LENDÁRIO. Asas abertas, coroa real, aura de abundância total.',
}

export const EVO_REQUIREMENTS: Record<number, string> = {
  1: 'Estado inicial',
  2: 'Score ≥ 30 ou Nível ≥ 2',
  3: 'Score ≥ 50 ou Nível ≥ 4',
  4: 'Score ≥ 70 ou Nível ≥ 6',
  5: 'Score ≥ 90 ou Nível ≥ 9',
}

/* ── Iris colors per mood ──────────────────────────────────────────── */
const IRIS_COLORS: Record<Mood, [string, string]> = {
  sad:         ['#93c5fd', '#1d4ed8'],
  neutral:     ['#94a3b8', '#334155'],
  happy:       ['#86efac', '#15803d'],
  excited:     ['#fde68a', '#b45309'],
  celebrating: ['#e9d5ff', '#7e22ce'],
}

/* ── Iris gradient def (place inside SVG <defs>) ───────────────────── */
function IrisDef({ mood, uid }: { mood: Mood; uid: string }) {
  const [light, dark] = IRIS_COLORS[mood]
  return (
    <radialGradient id={`${uid}_iris`} cx="40%" cy="35%" r="60%">
      <stop offset="0%" stopColor={light} />
      <stop offset="100%" stopColor={dark} />
    </radialGradient>
  )
}

/* ── Eye helper ─────────────────────────────────────────────────────── */
function Eyes({ mood, lx, ly, rx, ry, r = 9, uid }: {
  mood: Mood; lx: number; ly: number; rx: number; ry: number; r?: number; uid: string
}) {
  const irisR  = r * 0.68
  const pupilR = r * 0.42

  const Ball = ({ cx, cy }: { cx: number; cy: number }) => (
    <g>
      {/* shadow under */}
      <ellipse cx={cx} cy={cy + r * 0.14} rx={r * 1.05} ry={r * 0.78} fill="rgba(0,0,0,0.2)" />
      {/* sclera */}
      <circle cx={cx} cy={cy} r={r} fill="white" />
      {/* iris */}
      <circle cx={cx} cy={cy} r={irisR} fill={`url(#${uid}_iris)`} />
      {/* pupil */}
      <circle cx={cx} cy={cy + r * 0.06} r={pupilR} fill="#0f172a" />
      {/* main specular */}
      <circle cx={cx - r * 0.27} cy={cy - r * 0.3} r={r * 0.25} fill="white" opacity={0.95} />
      {/* secondary specular */}
      <circle cx={cx + r * 0.18} cy={cy + r * 0.1} r={r * 0.12} fill="white" opacity={0.55} />
    </g>
  )

  const Brow = ({ cx, cy, sad }: { cx: number; cy: number; sad?: boolean }) => sad ? (
    <>
      <path d={`M${cx-r} ${cy-r*1.04} Q${cx} ${cy-r*1.42} ${cx+r} ${cy-r*0.78}`}
        stroke="#475569" strokeWidth={r*0.22} strokeLinecap="round" fill="none" />
    </>
  ) : (
    <path d={`M${cx-r*0.75} ${cy-r*1.1} Q${cx} ${cy-r*1.42} ${cx+r*0.75} ${cy-r*1.1}`}
      stroke="#1e293b" strokeWidth={r*0.18} strokeLinecap="round" fill="none" />
  )

  if (mood === 'sad') return (
    <g>
      <Ball cx={lx} cy={ly} /><Ball cx={rx} cy={ry} />
      <Brow cx={lx} cy={ly} sad /><Brow cx={rx} cy={ry} sad />
      {/* mirror sad brow on right (flipped) */}
      <path d={`M${rx-r} ${ry-r*0.78} Q${rx} ${ry-r*1.42} ${rx+r} ${ry-r*1.04}`}
        stroke="#475569" strokeWidth={r*0.22} strokeLinecap="round" fill="none" />
      {/* teardrop */}
      <path d={`M${lx+2} ${ly+r*0.78} Q${lx+5} ${ly+r*1.55} ${lx+2} ${ly+r*2.02} Q${lx-1} ${ly+r*1.55} ${lx+2} ${ly+r*0.78}`}
        fill="#93c5fd" opacity={0.9} />
    </g>
  )

  if (mood === 'neutral') return (
    <g>
      <Ball cx={lx} cy={ly} /><Ball cx={rx} cy={ry} />
      <path d={`M${lx-r} ${ly-r*0.06} Q${lx} ${ly-r*0.52} ${lx+r} ${ly-r*0.06}`}
        fill="rgba(71,85,105,0.72)" />
      <path d={`M${rx-r} ${ry-r*0.06} Q${rx} ${ry-r*0.52} ${rx+r} ${ry-r*0.06}`}
        fill="rgba(71,85,105,0.72)" />
    </g>
  )

  if (mood === 'celebrating') return (
    <g>
      <Ball cx={lx} cy={ly} /><Ball cx={rx} cy={ry} />
      <Brow cx={lx} cy={ly} /><Brow cx={rx} cy={ry} />
      {([[lx, ly], [rx, ry]] as [number, number][]).flatMap(([ex, ey], i) =>
        [0, 72, 144, 216, 288].map(a => (
          <line key={`cel${i}_${a}`}
            x1={ex + Math.cos(a*Math.PI/180)*r*1.2}
            y1={ey + Math.sin(a*Math.PI/180)*r*1.2}
            x2={ex + Math.cos(a*Math.PI/180)*r*1.6}
            y2={ey + Math.sin(a*Math.PI/180)*r*1.6}
            stroke="#fbbf24" strokeWidth={r*0.18} strokeLinecap="round" opacity={0.75}
          />
        ))
      )}
    </g>
  )

  if (mood === 'excited') return (
    <g>
      <Ball cx={lx} cy={ly} /><Ball cx={rx} cy={ry} />
      <path d={`M${lx-r*0.85} ${ly-r*1.22} Q${lx} ${ly-r*1.62} ${lx+r*0.85} ${ly-r*1.22}`}
        stroke="#1e293b" strokeWidth={r*0.22} strokeLinecap="round" fill="none" />
      <path d={`M${rx-r*0.85} ${ry-r*1.22} Q${rx} ${ry-r*1.62} ${rx+r*0.85} ${ry-r*1.22}`}
        stroke="#1e293b" strokeWidth={r*0.22} strokeLinecap="round" fill="none" />
    </g>
  )

  // happy (default)
  return (
    <g>
      <Ball cx={lx} cy={ly} /><Ball cx={rx} cy={ry} />
      <Brow cx={lx} cy={ly} /><Brow cx={rx} cy={ry} />
    </g>
  )
}

/* ── Mouth helper ────────────────────────────────────────────────────── */
function Mouth({ mood, cx, cy, w = 18 }: { mood: Mood; cx: number; cy: number; w?: number }) {
  if (mood === 'sad') return (
    <path d={`M${cx - w*0.5} ${cy+w*0.18} Q${cx} ${cy-w*0.28} ${cx + w*0.5} ${cy+w*0.18}`}
      stroke="#1e293b" strokeWidth={w*0.14} strokeLinecap="round" fill="none" />
  )
  if (mood === 'neutral') return (
    <path d={`M${cx - w*0.44} ${cy+w*0.04} Q${cx} ${cy+w*0.1} ${cx + w*0.44} ${cy+w*0.04}`}
      stroke="#1e293b" strokeWidth={w*0.14} strokeLinecap="round" fill="none" />
  )
  if (mood === 'celebrating') return (
    <g>
      <path d={`M${cx-w*0.5} ${cy} Q${cx} ${cy+w*0.64} ${cx+w*0.5} ${cy}`} fill="#1e293b" />
      <path d={`M${cx-w*0.5} ${cy} L${cx-w*0.5} ${cy+w*0.18} L${cx-w*0.18} ${cy+w*0.18} L${cx-w*0.18} ${cy} L${cx+w*0.18} ${cy} L${cx+w*0.18} ${cy+w*0.18} L${cx+w*0.5} ${cy+w*0.18} L${cx+w*0.5} ${cy}`}
        fill="white" opacity={0.92} />
      <ellipse cx={cx} cy={cy+w*0.44} rx={w*0.22} ry={w*0.14} fill="#f87171" />
    </g>
  )
  if (mood === 'excited') return (
    <g>
      <path d={`M${cx-w*0.48} ${cy} Q${cx} ${cy+w*0.56} ${cx+w*0.48} ${cy}`} fill="#1e293b" />
      <path d={`M${cx-w*0.48} ${cy} L${cx-w*0.48} ${cy+w*0.15} L${cx-w*0.22} ${cy+w*0.15} L${cx-w*0.22} ${cy} L${cx+w*0.22} ${cy} L${cx+w*0.22} ${cy+w*0.15} L${cx+w*0.48} ${cy+w*0.15} L${cx+w*0.48} ${cy}`}
        fill="white" opacity={0.92} />
    </g>
  )
  return (
    <path d={`M${cx-w*0.48} ${cy} Q${cx} ${cy+w*0.48} ${cx+w*0.48} ${cy}`}
      stroke="#1e293b" strokeWidth={w*0.14} strokeLinecap="round" fill="none" />
  )
}

/* ── Cheeks ──────────────────────────────────────────────────────────── */
function Cheeks({ mood, lx, ly, rx, ry, r = 10 }: {
  mood: Mood; lx: number; ly: number; rx: number; ry: number; r?: number
}) {
  if (mood === 'sad' || mood === 'neutral') return null
  const op = mood === 'celebrating' ? 0.55 : 0.4
  return (
    <>
      <ellipse cx={lx} cy={ly} rx={r} ry={r*0.58} fill="rgba(248,113,113,0.55)" opacity={op} />
      <ellipse cx={rx} cy={ry} rx={r} ry={r*0.58} fill="rgba(248,113,113,0.55)" opacity={op} />
      {mood === 'celebrating' && (
        <>
          <circle cx={lx + r*0.55} cy={ly - r*0.4} r={r*0.15} fill="white" opacity={0.85} />
          <circle cx={rx + r*0.55} cy={ry - r*0.4} r={r*0.15} fill="white" opacity={0.85} />
        </>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EVO 1 — COINTINHO  (baby coin sprite)
══════════════════════════════════════════════════════════════════════ */
function Evo1({ c, mood, uid }: { c: C; mood: Mood; uid: string }) {
  return (
    <svg viewBox="0 0 122 150" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <IrisDef mood={mood} uid={uid} />
        <radialGradient id={`${uid}_e1b`} cx="34%" cy="28%" r="70%">
          <stop offset="0%"   stopColor={c.light} />
          <stop offset="52%"  stopColor={c.body}  />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <radialGradient id={`${uid}_e1rim`} cx="30%" cy="22%" r="80%">
          <stop offset="0%"   stopColor={c.body}  />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <filter id={`${uid}_e1g`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="59" cy="144" rx="30" ry="4.5" fill="black" opacity="0.13" />

      {/* Lightning bolt tail */}
      <path d="M72 112 L88 94 L78 94 L91 76"
        stroke={c.shade} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M72 112 L88 94 L78 94 L91 76"
        stroke={c.accent} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="91" cy="76" r="4" fill={c.accent} opacity="0.65" filter={`url(#${uid}_e1g)`} />

      {/* Body — 3D coin sphere */}
      <circle cx="57" cy="86" r="42" fill={`url(#${uid}_e1b)`} />
      {/* Metallic rim */}
      <circle cx="57" cy="86" r="42" stroke={`url(#${uid}_e1rim)`} strokeWidth="4.5" fill="none" />
      {/* Inner detail ring */}
      <circle cx="57" cy="86" r="38" stroke="white" strokeWidth="0.8" strokeOpacity="0.18" fill="none" />
      {/* Specular highlight patch */}
      <ellipse cx="43" cy="70" rx="14" ry="8.5" fill="white" opacity="0.14" transform="rotate(-20 43 70)" />

      {/* € chest symbol */}
      <text x="57" y="98" textAnchor="middle" fontSize="28" fontWeight="900"
        fill="white" fillOpacity="0.5" fontFamily="Georgia,serif">€</text>

      {/* Face */}
      <Eyes mood={mood} lx={40} ly={74} rx={74} ry={74} r={11} uid={uid} />
      <Mouth mood={mood} cx={57} cy={96} w={23} />
      <Cheeks mood={mood} lx={24} ly={85} rx={90} ry={85} r={9} />

      {/* Arms — chubby stubs */}
      <ellipse cx="16" cy="93" rx="11.5" ry="7" fill={`url(#${uid}_e1b)`} stroke={c.shade} strokeWidth="1.5" />
      <ellipse cx="98" cy="93" rx="11.5" ry="7" fill={`url(#${uid}_e1b)`} stroke={c.shade} strokeWidth="1.5" />

      {/* Feet */}
      <ellipse cx="43" cy="127" rx="16" ry="10" fill={c.shade} opacity="0.3" />
      <ellipse cx="71" cy="127" rx="16" ry="10" fill={c.shade} opacity="0.3" />
      <ellipse cx="43" cy="125" rx="16" ry="9.5" fill={`url(#${uid}_e1b)`} />
      <ellipse cx="71" cy="125" rx="16" ry="9.5" fill={`url(#${uid}_e1b)`} />
      {/* Toes */}
      {[35, 43, 51].map(x => <circle key={x} cx={x} cy={133} r={3.8} fill={c.body} stroke={c.shade} strokeWidth="1.2" />)}
      {[63, 71, 79].map(x => <circle key={x} cx={x} cy={133} r={3.8} fill={c.body} stroke={c.shade} strokeWidth="1.2" />)}
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EVO 2 — MOEDIX  (coin ears, gem, tiny wings)
══════════════════════════════════════════════════════════════════════ */
function Evo2({ c, mood, uid }: { c: C; mood: Mood; uid: string }) {
  return (
    <svg viewBox="0 0 150 174" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <IrisDef mood={mood} uid={uid} />
        <radialGradient id={`${uid}_e2b`} cx="34%" cy="28%" r="70%">
          <stop offset="0%"   stopColor={c.light} />
          <stop offset="52%"  stopColor={c.body}  />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <radialGradient id={`${uid}_e2coin`} cx="35%" cy="30%" r="65%">
          <stop offset="0%"   stopColor={c.light} />
          <stop offset="60%"  stopColor={c.body}  />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <radialGradient id={`${uid}_e2gem`} cx="32%" cy="26%" r="68%">
          <stop offset="0%"   stopColor="white"   stopOpacity="0.9" />
          <stop offset="38%"  stopColor={c.accent}/>
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <linearGradient id={`${uid}_e2wing`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={c.body}  stopOpacity="0.88" />
          <stop offset="65%"  stopColor={c.shade} stopOpacity="0.55" />
          <stop offset="100%" stopColor={c.shade} stopOpacity="0.18" />
        </linearGradient>
      </defs>

      <ellipse cx="75" cy="168" rx="35" ry="5.5" fill="black" opacity="0.12" />

      {/* Coin ears */}
      {([{ cx: 22, cy: 76 }, { cx: 128, cy: 76 }] as {cx:number;cy:number}[]).map(({ cx, cy }, i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={19} fill={c.shade} />
          <circle cx={cx} cy={cy} r={15} fill={`url(#${uid}_e2coin)`} />
          <circle cx={cx} cy={cy} r={15} stroke="white" strokeWidth="0.8" strokeOpacity="0.22" fill="none" />
          <ellipse cx={cx-3} cy={cy-4} rx={5} ry={3} fill="white" opacity="0.14" transform={`rotate(-20 ${cx-3} ${cy-4})`} />
          <text x={cx} y={cy+4} textAnchor="middle" fontSize="11" fontWeight="bold"
            fill="white" fillOpacity="0.65" fontFamily="Georgia,serif">€</text>
        </g>
      ))}

      {/* Tiny wings (behind body) */}
      <path d="M31 114 Q8 88 18 64 Q24 86 31 110Z" fill={`url(#${uid}_e2wing)`} />
      <path d="M119 114 Q142 88 132 64 Q126 86 119 110Z" fill={`url(#${uid}_e2wing)`} />
      <path d="M31 112 Q12 90 20 68" stroke={c.accent} strokeWidth="1.2" opacity="0.4" fill="none" />
      <path d="M119 112 Q138 90 130 68" stroke={c.accent} strokeWidth="1.2" opacity="0.4" fill="none" />

      {/* Body */}
      <ellipse cx="75" cy="104" rx="46" ry="54" fill={`url(#${uid}_e2b)`} />
      <ellipse cx="75" cy="104" rx="46" ry="54" stroke={c.shade} strokeWidth="2.2" fill="none" />
      <ellipse cx="60" cy="84" rx="17" ry="9.5" fill="white" opacity="0.11" transform="rotate(-18 60 84)" />

      {/* Forehead gem */}
      <circle cx="75" cy="58" r="14" fill={c.shade} />
      <circle cx="75" cy="58" r="11.5" fill={`url(#${uid}_e2gem)`} />
      <circle cx="75" cy="58" r="11.5" stroke="white" strokeWidth="1" strokeOpacity="0.32" fill="none" />
      {/* Gem facet lines */}
      <path d="M69 53 L75 49 L81 53 L81 63 L75 67 L69 63Z"
        stroke="white" strokeWidth="0.6" strokeOpacity="0.28" fill="none" />
      <circle cx="71" cy="54" r="2.2" fill="white" opacity="0.6" />

      {/* Face */}
      <Eyes mood={mood} lx={55} ly={90} rx={95} ry={90} r={13} uid={uid} />
      <Mouth mood={mood} cx={75} cy={116} w={27} />
      <Cheeks mood={mood} lx={34} ly={103} rx={116} ry={103} r={11} />

      {/* Legs */}
      <ellipse cx="52" cy="154" rx="18" ry="11.5" fill={c.shade} opacity="0.28" />
      <ellipse cx="98" cy="154" rx="18" ry="11.5" fill={c.shade} opacity="0.28" />
      <ellipse cx="52" cy="152" rx="18" ry="11" fill={`url(#${uid}_e2b)`} />
      <ellipse cx="98" cy="152" rx="18" ry="11" fill={`url(#${uid}_e2b)`} />
      {[43, 52, 61].map(x => <circle key={x} cx={x} cy={161} r={4.8} fill={c.body} stroke={c.shade} strokeWidth="1.4" />)}
      {[89, 98, 107].map(x => <circle key={x} cx={x} cy={161} r={4.8} fill={c.body} stroke={c.shade} strokeWidth="1.4" />)}
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EVO 3 — VAULTIX  (dragon, wings, coin scales, lightning tail)
══════════════════════════════════════════════════════════════════════ */
function Evo3({ c, mood, uid }: { c: C; mood: Mood; uid: string }) {
  return (
    <svg viewBox="0 0 174 210" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <IrisDef mood={mood} uid={uid} />
        <radialGradient id={`${uid}_e3b`} cx="34%" cy="28%" r="70%">
          <stop offset="0%"   stopColor={c.light} />
          <stop offset="52%"  stopColor={c.body}  />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <radialGradient id={`${uid}_e3h`} cx="38%" cy="30%" r="68%">
          <stop offset="0%"   stopColor={c.light} />
          <stop offset="48%"  stopColor={c.body}  />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <radialGradient id={`${uid}_e3badge`} cx="34%" cy="26%" r="68%">
          <stop offset="0%"   stopColor="white"    stopOpacity="0.72" />
          <stop offset="38%"  stopColor={c.accent} />
          <stop offset="100%" stopColor={c.shade}  />
        </radialGradient>
        <linearGradient id={`${uid}_e3wL`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={c.body}  stopOpacity="0.93" />
          <stop offset="58%"  stopColor={c.shade} stopOpacity="0.65" />
          <stop offset="100%" stopColor={c.shade} stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={`${uid}_e3wR`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={c.body}  stopOpacity="0.93" />
          <stop offset="58%"  stopColor={c.shade} stopOpacity="0.65" />
          <stop offset="100%" stopColor={c.shade} stopOpacity="0.15" />
        </linearGradient>
        <filter id={`${uid}_e3g`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <ellipse cx="87" cy="203" rx="44" ry="7" fill="black" opacity="0.14" />

      {/* Wings */}
      <path d="M43 122 Q6 80 14 40 L26 64 L42 46 L49 86 L43 122Z" fill={`url(#${uid}_e3wL)`} />
      <path d="M131 122 Q168 80 160 40 L148 64 L132 46 L125 86 L131 122Z" fill={`url(#${uid}_e3wR)`} />
      {/* Wing veins */}
      {(
        [
          ["M43 120 Q18 86 18 50 L28 68 L40 54", "M43 104 Q22 82 22 64", "M43 88 Q30 76 30 68"],
          ["M131 120 Q156 86 156 50 L146 68 L134 54", "M131 104 Q152 82 152 64", "M131 88 Q144 76 144 68"],
        ] as string[][]
      ).map((paths, wi) => paths.map((d, pi) => (
        <path key={`w${wi}v${pi}`} d={d} stroke={c.accent}
          strokeWidth={1.6 - pi*0.38} opacity={0.48 - pi*0.1} fill="none" />
      )))}
      <path d="M43 120 Q20 88 18 46 L26 62 L40 50 L45 84 L43 120Z" fill={c.light} opacity="0.1" />
      <path d="M131 120 Q154 88 156 46 L148 62 L134 50 L129 84 L131 120Z" fill={c.light} opacity="0.1" />

      {/* Body */}
      <ellipse cx="87" cy="142" rx="45" ry="58" fill={`url(#${uid}_e3b)`} />
      {/* Coin scales — 3 rows with per-scale highlight */}
      {(
        [
          [72,120],[87,113],[102,120],
          [64,136],[79,129],[95,129],[110,136],
          [72,153],[87,160],[102,153],
        ] as [number,number][]
      ).map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={10} ry={6.8}
            fill={c.shade} opacity={0.4} stroke={c.accent} strokeWidth="0.7" strokeOpacity="0.45" />
          <ellipse cx={x-2} cy={y-2} rx={4.2} ry={2.5} fill={c.light} opacity="0.16" />
        </g>
      ))}
      <ellipse cx="87" cy="142" rx="45" ry="58" stroke={c.shade} strokeWidth="2.5" fill="none" />

      {/* Chest badge */}
      <circle cx="87" cy="126" r="19" fill={`url(#${uid}_e3badge)`} filter={`url(#${uid}_e3g)`} />
      <circle cx="87" cy="126" r="19" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
      <circle cx="87" cy="126" r="12.5" stroke="white" strokeWidth="0.7" strokeOpacity="0.18" fill="none" />
      <text x="87" y="133" textAnchor="middle" fontSize="17" fontWeight="900"
        fill="white" fontFamily="Georgia,serif">€</text>

      {/* Head */}
      <ellipse cx="87" cy="72" rx="38" ry="37" fill={`url(#${uid}_e3h)`} />
      <ellipse cx="87" cy="72" rx="38" ry="37" stroke={c.shade} strokeWidth="2.5" fill="none" />
      <ellipse cx="73" cy="58" rx="14" ry="8.5" fill="white" opacity="0.12" transform="rotate(-16 73 58)" />

      {/* Dragon head spikes */}
      <path d="M63 44 L56 20 L66 40Z" fill={c.shade} />
      <path d="M63 44 L56 20 L66 40Z" stroke={c.accent} strokeWidth="0.8" strokeOpacity="0.45" fill="none" />
      <path d="M87 38 L84 13 L95 36Z" fill={c.accent} />
      <path d="M87 38 L84 13 L95 36Z" stroke="white" strokeWidth="0.7" strokeOpacity="0.3" fill="none" />
      <path d="M111 44 L118 20 L108 40Z" fill={c.shade} />
      <path d="M111 44 L118 20 L108 40Z" stroke={c.accent} strokeWidth="0.8" strokeOpacity="0.45" fill="none" />

      {/* Face */}
      <Eyes mood={mood} lx={68} ly={68} rx={106} ry={68} r={13.5} uid={uid} />
      <Mouth mood={mood} cx={87} cy={94} w={29} />
      <Cheeks mood={mood} lx={48} ly={80} rx={126} ry={80} r={11} />

      {/* Lightning tail */}
      <path d="M87 194 L70 172 L81 172 L62 152"
        stroke={c.shade} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M87 194 L70 172 L81 172 L62 152"
        stroke={c.accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="62" cy="152" r="4.5" fill={c.accent} opacity="0.6" filter={`url(#${uid}_e3g)`} />

      {/* Feet */}
      <ellipse cx="58" cy="192" rx="19" ry="12" fill={`url(#${uid}_e3b)`} />
      <ellipse cx="116" cy="192" rx="19" ry="12" fill={`url(#${uid}_e3b)`} />
      {[48, 58, 68].map(x => <path key={x} d={`M${x} 200 Q${x-2} 207 ${x-5} 204`}
        stroke={c.shade} strokeWidth="2.4" strokeLinecap="round" fill="none" />)}
      {[106, 116, 126].map(x => <path key={x} d={`M${x} 200 Q${x-2} 207 ${x-5} 204`}
        stroke={c.shade} strokeWidth="2.4" strokeLinecap="round" fill="none" />)}
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EVO 4 — AURION  (crowned champion, coin armor, aura rings)
══════════════════════════════════════════════════════════════════════ */
function Evo4({ c, mood, uid }: { c: C; mood: Mood; uid: string }) {
  return (
    <svg viewBox="0 0 196 230" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <IrisDef mood={mood} uid={uid} />
        <radialGradient id={`${uid}_e4b`} cx="34%" cy="28%" r="70%">
          <stop offset="0%"   stopColor={c.light} />
          <stop offset="52%"  stopColor={c.body}  />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <radialGradient id={`${uid}_e4h`} cx="38%" cy="30%" r="68%">
          <stop offset="0%"   stopColor={c.light} />
          <stop offset="48%"  stopColor={c.body}  />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <radialGradient id={`${uid}_e4armor`} cx="36%" cy="28%" r="66%">
          <stop offset="0%"   stopColor="white"    stopOpacity="0.62" />
          <stop offset="35%"  stopColor={c.accent} />
          <stop offset="100%" stopColor={c.shade}  />
        </radialGradient>
        <linearGradient id={`${uid}_e4crown`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={c.light}  />
          <stop offset="50%"  stopColor={c.accent} />
          <stop offset="100%" stopColor={c.shade}  />
        </linearGradient>
        <linearGradient id={`${uid}_e4wL`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={c.body}  stopOpacity="0.95" />
          <stop offset="58%"  stopColor={c.shade} stopOpacity="0.68" />
          <stop offset="100%" stopColor={c.shade} stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={`${uid}_e4wR`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={c.body}  stopOpacity="0.95" />
          <stop offset="58%"  stopColor={c.shade} stopOpacity="0.68" />
          <stop offset="100%" stopColor={c.shade} stopOpacity="0.18" />
        </linearGradient>
        <filter id={`${uid}_e4aura`} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id={`${uid}_e4g`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Aura rings */}
      <circle cx="98" cy="115" r="85" stroke={c.accent} strokeWidth="1"   opacity="0.12" filter={`url(#${uid}_e4aura)`} />
      <circle cx="98" cy="115" r="73" stroke={c.accent} strokeWidth="1.5" opacity="0.18" filter={`url(#${uid}_e4aura)`} />
      <ellipse cx="98" cy="224" rx="50" ry="6.5" fill="black" opacity="0.14" />

      {/* Large wings */}
      <path d="M44 140 Q4 94 10 38 L26 68 L42 48 L49 90 L44 140Z" fill={`url(#${uid}_e4wL)`} />
      <path d="M152 140 Q192 94 186 38 L170 68 L154 48 L147 90 L152 140Z" fill={`url(#${uid}_e4wR)`} />
      {(
        [
          ["M44 138 Q18 100 16 52 L28 72 L40 58","M44 120 Q24 94 22 70","M44 104 Q32 88 32 76"],
          ["M152 138 Q178 100 180 52 L168 72 L156 58","M152 120 Q172 94 174 70","M152 104 Q164 88 164 76"],
        ] as string[][]
      ).map((paths, wi) => paths.map((d, pi) => (
        <path key={`w${wi}v${pi}`} d={d} stroke={c.accent}
          strokeWidth={2 - pi*0.42} opacity={0.5 - pi*0.1} fill="none" />
      )))}
      <path d="M44 138 Q20 104 16 50 L26 66 L40 52 L46 86 L44 138Z" fill={c.light} opacity="0.1" />
      <path d="M152 138 Q176 104 180 50 L170 66 L156 52 L150 86 L152 138Z" fill={c.light} opacity="0.1" />

      {/* Body */}
      <ellipse cx="98" cy="154" rx="51" ry="63" fill={`url(#${uid}_e4b)`} />
      {/* Chest armor */}
      <path d="M62 138 Q98 128 134 138 L136 160 Q98 170 60 160Z" fill={c.shade} opacity="0.42" />
      <circle cx="98" cy="146" r="23" fill={`url(#${uid}_e4armor)`} filter={`url(#${uid}_e4g)`} />
      <circle cx="98" cy="146" r="23" stroke="white" strokeWidth="2" strokeOpacity="0.28" fill="none" />
      <circle cx="98" cy="146" r="15" stroke="white" strokeWidth="0.8" strokeOpacity="0.18" fill="none" />
      <text x="98" y="153" textAnchor="middle" fontSize="20" fontWeight="900"
        fill="white" fontFamily="Georgia,serif">€</text>
      <path d="M66 164 Q98 155 130 164" stroke={c.shade} strokeWidth="2"   strokeDasharray="5 3" opacity="0.55" fill="none" />
      <path d="M68 174 Q98 165 128 174" stroke={c.shade} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.38" fill="none" />
      <ellipse cx="98" cy="154" rx="51" ry="63" stroke={c.shade} strokeWidth="2.5" fill="none" />

      {/* Head */}
      <ellipse cx="98" cy="80" rx="41" ry="39" fill={`url(#${uid}_e4h)`} />
      <ellipse cx="98" cy="80" rx="41" ry="39" stroke={c.shade} strokeWidth="2.5" fill="none" />
      <ellipse cx="83" cy="66" rx="16" ry="9" fill="white" opacity="0.12" transform="rotate(-15 83 66)" />

      {/* Crown */}
      <path d="M60 56 L60 32 L74 48 L85 26 L98 44 L111 26 L122 48 L136 32 L136 56Z"
        fill={`url(#${uid}_e4crown)`} />
      <path d="M60 56 L136 56" stroke={c.shade} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M60 56 L60 32 L74 48 L85 26 L98 44 L111 26 L122 48 L136 32 L136 56Z"
        stroke={c.shade} strokeWidth="1.5" fill="none" />
      {/* Crown gems — 3 */}
      {(
        [
          { x: 85,  y: 28, fill: '#60a5fa' },
          { x: 98,  y: 46, fill: c.accent  },
          { x: 111, y: 28, fill: '#f472b6' },
        ] as {x:number;y:number;fill:string}[]
      ).map(({ x, y, fill: gFill }, i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={7} fill="white" opacity={0.95} />
          <circle cx={x} cy={y} r={4.5} fill={gFill} />
          <circle cx={x-1.5} cy={y-2} r={1.8} fill="white" opacity={0.72} />
        </g>
      ))}

      {/* Face */}
      <Eyes mood={mood} lx={78} ly={76} rx={118} ry={76} r={14.5} uid={uid} />
      <Mouth mood={mood} cx={98} cy={103} w={31} />
      <Cheeks mood={mood} lx={56} ly={88} rx={140} ry={88} r={12} />

      {/* Lightning tail */}
      <path d="M98 214 L78 190 L90 190 L70 168"
        stroke={c.shade} strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M98 214 L78 190 L90 190 L70 168"
        stroke={c.accent} strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />

      {/* Feet */}
      <ellipse cx="66" cy="210" rx="22" ry="13.5" fill={`url(#${uid}_e4b)`} />
      <ellipse cx="130" cy="210" rx="22" ry="13.5" fill={`url(#${uid}_e4b)`} />
      {[54, 66, 78].map(x => <path key={x} d={`M${x} 220 Q${x-2} 228 ${x-5} 225`}
        stroke={c.shade} strokeWidth="3" strokeLinecap="round" fill="none" />)}
      {[118, 130, 142].map(x => <path key={x} d={`M${x} 220 Q${x-2} 228 ${x-5} 225`}
        stroke={c.shade} strokeWidth="3" strokeLinecap="round" fill="none" />)}
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EVO 5 — LEGENDRIX  (legendary — spread wings, royal crown, full aura)
══════════════════════════════════════════════════════════════════════ */
function Evo5({ c, mood, uid }: { c: C; mood: Mood; uid: string }) {
  return (
    <svg viewBox="0 0 214 250" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <IrisDef mood={mood} uid={uid} />
        <radialGradient id={`${uid}_e5b`} cx="34%" cy="28%" r="70%">
          <stop offset="0%"   stopColor={c.light} />
          <stop offset="52%"  stopColor={c.body}  />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <radialGradient id={`${uid}_e5h`} cx="38%" cy="30%" r="68%">
          <stop offset="0%"   stopColor={c.light} />
          <stop offset="48%"  stopColor={c.body}  />
          <stop offset="100%" stopColor={c.shade} />
        </radialGradient>
        <radialGradient id={`${uid}_e5armor`} cx="36%" cy="28%" r="66%">
          <stop offset="0%"   stopColor="white"    stopOpacity="0.65" />
          <stop offset="35%"  stopColor={c.accent} />
          <stop offset="100%" stopColor={c.shade}  />
        </radialGradient>
        <radialGradient id={`${uid}_e5coin`} cx="34%" cy="28%" r="64%">
          <stop offset="0%"   stopColor={c.light}  />
          <stop offset="100%" stopColor={c.accent} />
        </radialGradient>
        <linearGradient id={`${uid}_e5crown`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={c.light}  />
          <stop offset="50%"  stopColor={c.accent} />
          <stop offset="100%" stopColor={c.shade}  />
        </linearGradient>
        <linearGradient id={`${uid}_e5wL`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={c.body}  stopOpacity="0.96" />
          <stop offset="55%"  stopColor={c.shade} stopOpacity="0.7"  />
          <stop offset="100%" stopColor={c.shade} stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={`${uid}_e5wR`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={c.body}  stopOpacity="0.96" />
          <stop offset="55%"  stopColor={c.shade} stopOpacity="0.7"  />
          <stop offset="100%" stopColor={c.shade} stopOpacity="0.15" />
        </linearGradient>
        <filter id={`${uid}_e5aura`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id={`${uid}_e5g`} x="-55%" y="-55%" width="210%" height="210%">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Triple aura rings */}
      <circle cx="107" cy="125" r="100" stroke={c.accent} strokeWidth="0.8" opacity="0.08" filter={`url(#${uid}_e5aura)`} />
      <circle cx="107" cy="125" r="86"  stroke={c.accent} strokeWidth="1.2" opacity="0.13" filter={`url(#${uid}_e5aura)`} />
      <circle cx="107" cy="125" r="72"  stroke={c.accent} strokeWidth="1.8" opacity="0.18" filter={`url(#${uid}_e5aura)`} />
      <ellipse cx="107" cy="244" rx="56" ry="6.5" fill="black" opacity="0.14" />

      {/* Floating coins */}
      <circle cx="22"  cy="60"  r="10" fill={`url(#${uid}_e5coin)`} filter={`url(#${uid}_e5g)`} opacity="0.88" />
      <text x="22"  y="65"  textAnchor="middle" fontSize="8"   fontWeight="bold" fill="white">€</text>
      <circle cx="192" cy="54"  r="9"  fill={`url(#${uid}_e5coin)`} filter={`url(#${uid}_e5g)`} opacity="0.8"  />
      <text x="192" y="59"  textAnchor="middle" fontSize="7"   fontWeight="bold" fill="white">€</text>
      <circle cx="15"  cy="166" r="7.5" fill={`url(#${uid}_e5coin)`} opacity="0.55" />
      <circle cx="199" cy="162" r="7.5" fill={`url(#${uid}_e5coin)`} opacity="0.55" />

      {/* Crystal shards */}
      <path d="M180 92 L186 80 L192 92 L186 104Z" fill={c.light} opacity="0.72" />
      <path d="M180 92 L186 80 L192 92Z"          fill="white"   opacity="0.28" />
      <path d="M22 88 L28 76 L34 88 L28 100Z"     fill={c.light} opacity="0.68" />
      <path d="M22 88 L28 76 L34 88Z"             fill="white"   opacity="0.28" />
      <path d="M174 152 L179 142 L184 152 L179 162Z" fill={c.light} opacity="0.45" />

      {/* Spread wings */}
      <path d="M48 146 Q6 96 8 30 L24 62 L40 42 L52 86 L48 146Z"   fill={`url(#${uid}_e5wL)`} />
      <path d="M166 146 Q208 96 206 30 L190 62 L174 42 L162 86 L166 146Z" fill={`url(#${uid}_e5wR)`} />
      {(
        [
          ["M48 144 Q22 106 14 56 L26 78 L40 62","M48 126 Q26 100 22 74","M48 108 Q32 94 30 80","M48 90 Q38 82 36 72"],
          ["M166 144 Q192 106 200 56 L188 78 L174 62","M166 126 Q188 100 192 74","M166 108 Q182 94 184 80","M166 90 Q176 82 178 72"],
        ] as string[][]
      ).map((paths, wi) => paths.map((d, pi) => (
        <path key={`w${wi}v${pi}`} d={d} stroke={c.accent}
          strokeWidth={2.1 - pi*0.4} opacity={0.52 - pi*0.08} fill="none" />
      )))}
      <path d="M48 144 Q24 108 14 52 L24 70 L40 56 L50 90 L48 144Z" fill={c.light} opacity="0.1" />
      <path d="M166 144 Q190 108 200 52 L190 70 L174 56 L164 90 L166 144Z" fill={c.light} opacity="0.1" />

      {/* Body */}
      <ellipse cx="107" cy="166" rx="56" ry="68" fill={`url(#${uid}_e5b)`} />
      {/* Legendary armor breastplate */}
      <path d="M62 150 Q107 138 152 150 L154 172 Q107 184 60 172Z" fill={c.shade} opacity="0.38" />
      <circle cx="107" cy="158" r="27" fill={`url(#${uid}_e5armor)`} filter={`url(#${uid}_e5g)`} />
      <circle cx="107" cy="158" r="27" stroke="white" strokeWidth="2"   strokeOpacity="0.3" fill="none" />
      <circle cx="107" cy="158" r="18" stroke="white" strokeWidth="0.8" strokeOpacity="0.18" fill="none" />
      <text x="107" y="166" textAnchor="middle" fontSize="23" fontWeight="900"
        fill="white" fontFamily="Georgia,serif">€</text>
      {([170, 182, 193] as number[]).map((y, i) => (
        <path key={y}
          d={`M${70-i*2} ${y} Q107 ${y-10} ${144+i*2} ${y}`}
          stroke={c.shade} strokeWidth="1.5" strokeDasharray="5 3"
          opacity={0.44 - i*0.1} fill="none" />
      ))}
      <ellipse cx="107" cy="166" rx="56" ry="68" stroke={c.shade} strokeWidth="2.5" fill="none" />

      {/* Head */}
      <ellipse cx="107" cy="86" rx="45" ry="43" fill={`url(#${uid}_e5h)`} />
      <ellipse cx="107" cy="86" rx="45" ry="43" stroke={c.shade} strokeWidth="2.5" fill="none" />
      <ellipse cx="90"  cy="70" rx="18" ry="10" fill="white" opacity="0.12" transform="rotate(-15 90 70)" />

      {/* Royal crown */}
      <path d="M64 62 L64 34 L80 52 L92 26 L107 46 L122 26 L134 52 L150 34 L150 62Z"
        fill={`url(#${uid}_e5crown)`} />
      <path d="M64 62 L150 62" stroke={c.shade} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M64 62 L64 34 L80 52 L92 26 L107 46 L122 26 L134 52 L150 34 L150 62Z"
        stroke={c.shade} strokeWidth="1.8" fill="none" />
      {/* Crown gems — 5 */}
      {(
        [
          { x: 92,  y: 28, fill: '#60a5fa' },
          { x: 107, y: 48, fill: c.accent  },
          { x: 122, y: 28, fill: '#f472b6' },
          { x: 78,  y: 46, fill: '#34d399' },
          { x: 136, y: 46, fill: '#fb923c' },
        ] as {x:number;y:number;fill:string}[]
      ).map(({ x, y, fill: gFill }, i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={7.5} fill="white" opacity={0.95} />
          <circle cx={x} cy={y} r={4.8} fill={gFill} />
          <circle cx={x-2} cy={y-2} r={1.9} fill="white" opacity={0.72} />
        </g>
      ))}

      {/* Face */}
      <Eyes mood={mood} lx={88} ly={84} rx={126} ry={84} r={15.5} uid={uid} />
      <Mouth mood={mood} cx={107} cy={113} w={35} />
      <Cheeks mood={mood} lx={62} ly={98} rx={152} ry={98} r={13} />

      {/* Energy burst (celebrating / excited) */}
      {(mood === 'celebrating' || mood === 'excited') &&
        [0,36,72,108,144,180,216,252,288,324].map(a => (
          <line key={a}
            x1={107 + Math.cos(a*Math.PI/180)*58}
            y1={166 + Math.sin(a*Math.PI/180)*66}
            x2={107 + Math.cos(a*Math.PI/180)*78}
            y2={166 + Math.sin(a*Math.PI/180)*86}
            stroke={c.accent} strokeWidth="2.2" strokeLinecap="round" opacity={0.65}
          />
        ))
      }

      {/* Lightning tail */}
      <path d="M107 230 L86 206 L98 206 L76 182"
        stroke={c.shade} strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M107 230 L86 206 L98 206 L76 182"
        stroke={c.accent} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="76" cy="182" r="5.5" fill={c.accent} opacity="0.65" filter={`url(#${uid}_e5g)`} />

      {/* Feet */}
      <ellipse cx="72"  cy="226" rx="25" ry="15" fill={`url(#${uid}_e5b)`} />
      <ellipse cx="142" cy="226" rx="25" ry="15" fill={`url(#${uid}_e5b)`} />
      {[57, 70, 83].map(x => <path key={x} d={`M${x} 237 Q${x-2} 246 ${x-6} 242`}
        stroke={c.shade} strokeWidth="3.5" strokeLinecap="round" fill="none" />)}
      {[127, 140, 153].map(x => <path key={x} d={`M${x} 237 Q${x-2} 246 ${x-6} 242`}
        stroke={c.shade} strokeWidth="3.5" strokeLinecap="round" fill="none" />)}
    </svg>
  )
}

/* ── Main export ─────────────────────────────────────────────────────── */
interface Props {
  evo: number
  mood: Mood
  className?: string
  animate?: boolean
}

export function VoltixCreature({ evo, mood, className = '', animate = true }: Props) {
  const rawId = useId()
  const uid   = rawId.replace(/[^a-zA-Z0-9]/g, '_')
  const c     = MOOD_PALETTE[mood]

  const props = { c, mood, uid }

  const creature =
    evo >= 5 ? <Evo5 {...props} /> :
    evo === 4 ? <Evo4 {...props} /> :
    evo === 3 ? <Evo3 {...props} /> :
    evo === 2 ? <Evo2 {...props} /> :
    <Evo1 {...props} />

  if (!animate) return <div className={`relative ${className}`}>{creature}</div>

  return (
    <div
      className={`relative ${className}`}
      style={{ animation: 'voltixFloat 3s ease-in-out infinite' }}
    >
      {/* Mood glow pool */}
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/5 h-6 blur-2xl rounded-full opacity-50 transition-colors duration-700"
        style={{ backgroundColor: c.body }}
      />
      {creature}
    </div>
  )
}
