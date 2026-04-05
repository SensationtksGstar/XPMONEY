'use client'

/**
 * VoltixCreature — SVG-based evolving financial pet
 *
 * 5 evolution stages, each visually distinct:
 *  1. Cointinho  — baby coin creature
 *  2. Moedix     — growing with coin ears & gem
 *  3. Vaultix    — dragon with wings & coin scales
 *  4. Aurion     — crowned champion with armor
 *  5. Legendrix  — legendary with spread wings & aura
 *
 * Mood changes eyes, mouth, cheeks and body color.
 */

import { motion } from 'framer-motion'
import type { VoltixMood } from '@/types'

type Mood = VoltixMood

interface C {
  body: string; shade: string; light: string; accent: string
}

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

/* ── Eye helper ────────────────────────────────────────────────────── */
function Eyes({ mood, lx, ly, rx, ry, r = 9 }: {
  mood: Mood; lx: number; ly: number; rx: number; ry: number; r?: number
}) {
  const white = (
    <>
      <circle cx={lx} cy={ly} r={r} fill="white" />
      <circle cx={rx} cy={ry} r={r} fill="white" />
    </>
  )

  if (mood === 'sad') return (
    <g>
      {white}
      <circle cx={lx} cy={ly + 1.5} r={r * 0.55} fill="#1e293b" />
      <circle cx={rx} cy={ry + 1.5} r={r * 0.55} fill="#1e293b" />
      {/* Sad brow lids */}
      <path d={`M${lx - r} ${ly - r * 0.2} Q${lx} ${ly - r + 1} ${lx + r} ${ly - r * 0.2}`}
        fill="rgba(0,0,0,0.28)" />
      <path d={`M${rx - r} ${ry - r * 0.2} Q${rx} ${ry - r + 1} ${rx + r} ${ry - r * 0.2}`}
        fill="rgba(0,0,0,0.28)" />
      {/* Teardrop */}
      <ellipse cx={lx + 2} cy={ly + r + 3} rx={2.5} ry={3.5} fill="#93c5fd" opacity={0.85} />
    </g>
  )

  if (mood === 'neutral') return (
    <g>
      {white}
      <circle cx={lx} cy={ly} r={r * 0.6} fill="#1e293b" />
      <circle cx={rx} cy={ry} r={r * 0.6} fill="#1e293b" />
      <circle cx={lx - r * 0.27} cy={ly - r * 0.27} r={r * 0.18} fill="white" />
      <circle cx={rx - r * 0.27} cy={ry - r * 0.27} r={r * 0.18} fill="white" />
      {/* Half-closed lids */}
      <rect x={lx - r} y={ly - r} width={r * 2} height={r * 0.55}
        fill="rgba(100,116,139,0.75)" rx={2} />
      <rect x={rx - r} y={ry - r} width={r * 2} height={r * 0.55}
        fill="rgba(100,116,139,0.75)" rx={2} />
    </g>
  )

  if (mood === 'celebrating') return (
    <g>
      {white}
      {[{ x: lx, y: ly }, { x: rx, y: ry }].map(({ x, y }, i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r * 0.72} fill="#fbbf24" />
          {[0, 60, 120, 180, 240, 300].map(a => (
            <line key={a}
              x1={x} y1={y}
              x2={x + Math.cos(a * Math.PI / 180) * r * 0.62}
              y2={y + Math.sin(a * Math.PI / 180) * r * 0.62}
              stroke="#fbbf24" strokeWidth={1.8} strokeLinecap="round" opacity={0.5}
            />
          ))}
          <circle cx={x - r * 0.27} cy={y - r * 0.27} r={r * 0.22} fill="white" opacity={0.9} />
        </g>
      ))}
    </g>
  )

  if (mood === 'excited') return (
    <g>
      {white}
      <circle cx={lx} cy={ly} r={r * 0.65} fill="#1e293b" />
      <circle cx={rx} cy={ry} r={r * 0.65} fill="#1e293b" />
      <circle cx={lx - r * 0.28} cy={ly - r * 0.28} r={r * 0.22} fill="white" />
      <circle cx={rx - r * 0.28} cy={ry - r * 0.28} r={r * 0.22} fill="white" />
      <circle cx={lx + r * 0.22} cy={ly + r * 0.1} r={r * 0.13} fill="white" opacity={0.65} />
      <circle cx={rx + r * 0.22} cy={ry + r * 0.1} r={r * 0.13} fill="white" opacity={0.65} />
    </g>
  )

  // happy (default)
  return (
    <g>
      {white}
      <circle cx={lx} cy={ly} r={r * 0.6} fill="#1e293b" />
      <circle cx={rx} cy={ry} r={r * 0.6} fill="#1e293b" />
      <circle cx={lx - r * 0.28} cy={ly - r * 0.28} r={r * 0.2} fill="white" />
      <circle cx={rx - r * 0.28} cy={ry - r * 0.28} r={r * 0.2} fill="white" />
    </g>
  )
}

/* ── Mouth helper ──────────────────────────────────────────────────── */
function Mouth({ mood, cx, cy, w = 18 }: { mood: Mood; cx: number; cy: number; w?: number }) {
  if (mood === 'sad')
    return <path d={`M${cx - w / 2} ${cy + 3} Q${cx} ${cy - w / 3.5} ${cx + w / 2} ${cy + 3}`}
      stroke="#1e293b" strokeWidth={2.5} strokeLinecap="round" fill="none" />
  if (mood === 'neutral')
    return <line x1={cx - w / 2} y1={cy} x2={cx + w / 2} y2={cy}
      stroke="#1e293b" strokeWidth={2.5} strokeLinecap="round" />
  if (mood === 'celebrating') return (
    <g>
      <path d={`M${cx - w / 2} ${cy} Q${cx} ${cy + w * 0.55} ${cx + w / 2} ${cy}`}
        fill="#1e293b" />
      <line x1={cx - w / 4} y1={cy} x2={cx - w / 4} y2={cy + w / 4} stroke="white" strokeWidth={1.8} />
      <line x1={cx} y1={cy} x2={cx} y2={cy + w / 4} stroke="white" strokeWidth={1.8} />
      <line x1={cx + w / 4} y1={cy} x2={cx + w / 4} y2={cy + w / 4} stroke="white" strokeWidth={1.8} />
    </g>
  )
  return <path d={`M${cx - w / 2} ${cy} Q${cx} ${cy + w * 0.5} ${cx + w / 2} ${cy}`}
    stroke="#1e293b" strokeWidth={2.5} strokeLinecap="round" fill="none" />
}

/* ── Cheeks ────────────────────────────────────────────────────────── */
function Cheeks({ mood, lx, ly, rx, ry }: { mood: Mood; lx: number; ly: number; rx: number; ry: number }) {
  if (mood === 'sad' || mood === 'neutral') return null
  return (
    <>
      <ellipse cx={lx} cy={ly} rx={9} ry={5.5} fill="rgba(255,130,130,0.32)" />
      <ellipse cx={rx} cy={ry} rx={9} ry={5.5} fill="rgba(255,130,130,0.32)" />
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EVO 1 — COINTINHO (baby coin, ~100px)
══════════════════════════════════════════════════════════════════════ */
function Evo1({ c, mood }: { c: C; mood: Mood }) {
  return (
    <svg viewBox="0 0 120 138" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Ground shadow */}
      <ellipse cx="60" cy="132" rx="28" ry="5" fill="black" opacity="0.12" />

      {/* Lightning bolt tail */}
      <path d="M70 108 L82 92 L75 92 L85 76"
        stroke={c.shade} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M70 108 L82 92 L75 92 L85 76"
        stroke={c.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Body */}
      <circle cx="57" cy="83" r="40" fill={c.body} />
      {/* Bottom shade */}
      <ellipse cx="57" cy="108" rx="30" ry="16" fill={c.shade} opacity="0.42" />
      {/* Top highlight */}
      <ellipse cx="43" cy="65" rx="15" ry="9" fill={c.light} opacity="0.3" />
      {/* Coin rim */}
      <circle cx="57" cy="83" r="40" stroke={c.shade} strokeWidth="3" fill="none" />

      {/* € on chest */}
      <text x="57" y="95" textAnchor="middle" fontSize="22" fontWeight="bold"
        fill="white" fillOpacity="0.75" fontFamily="Georgia, serif">€</text>

      {/* Eyes */}
      <Eyes mood={mood} lx={42} ly={71} rx={72} ry={71} r={10} />
      <Mouth mood={mood} cx={57} cy={90} w={20} />
      <Cheeks mood={mood} lx={27} ly={82} rx={87} ry={82} />

      {/* Arms */}
      <ellipse cx="18" cy="91" rx="10" ry="6" fill={c.body} stroke={c.shade} strokeWidth="2" />
      <ellipse cx="96" cy="91" rx="10" ry="6" fill={c.body} stroke={c.shade} strokeWidth="2" />

      {/* Feet */}
      <ellipse cx="45" cy="122" rx="14" ry="8" fill={c.shade} opacity="0.75" />
      <ellipse cx="69" cy="122" rx="14" ry="8" fill={c.shade} opacity="0.75" />
      <ellipse cx="45" cy="120" rx="14" ry="7.5" fill={c.body} />
      <ellipse cx="69" cy="120" rx="14" ry="7.5" fill={c.body} />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EVO 2 — MOEDIX (coin ears, gem, tiny wings)
══════════════════════════════════════════════════════════════════════ */
function Evo2({ c, mood }: { c: C; mood: Mood }) {
  return (
    <svg viewBox="0 0 140 162" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="70" cy="156" rx="33" ry="6" fill="black" opacity="0.12" />

      {/* Coin ears */}
      <circle cx="22" cy="72" r="17" fill={c.shade} />
      <circle cx="118" cy="72" r="17" fill={c.shade} />
      <circle cx="22" cy="72" r="13" fill={c.body} />
      <circle cx="118" cy="72" r="13" fill={c.body} />
      <circle cx="22" cy="72" r="13" stroke={c.shade} strokeWidth="1.5" fill="none" />
      <circle cx="118" cy="72" r="13" stroke={c.shade} strokeWidth="1.5" fill="none" />
      <text x="22" y="76" textAnchor="middle" fontSize="11" fontWeight="bold"
        fill="white" fillOpacity="0.65" fontFamily="Georgia,serif">€</text>
      <text x="118" y="76" textAnchor="middle" fontSize="11" fontWeight="bold"
        fill="white" fillOpacity="0.65" fontFamily="Georgia,serif">€</text>

      {/* Body */}
      <ellipse cx="70" cy="96" rx="43" ry="50" fill={c.body} />
      <ellipse cx="70" cy="130" rx="33" ry="18" fill={c.shade} opacity="0.4" />
      <ellipse cx="54" cy="74" rx="17" ry="10" fill={c.light} opacity="0.27" />
      <ellipse cx="70" cy="96" rx="43" ry="50" stroke={c.shade} strokeWidth="2.5" fill="none" />

      {/* Coin gem forehead */}
      <circle cx="70" cy="54" r="11" fill={c.shade} />
      <circle cx="70" cy="54" r="9" fill={c.accent} />
      <circle cx="70" cy="54" r="9" stroke="white" strokeWidth="1.2" strokeOpacity="0.4" fill="none" />
      <text x="70" y="58" textAnchor="middle" fontSize="8" fontWeight="bold"
        fill="white" fontFamily="Georgia,serif">€</text>

      {/* Tiny wings */}
      <path d="M28 106 Q8 82 20 60 Q28 86 28 106Z" fill={c.shade} opacity="0.8" />
      <path d="M112 106 Q132 82 120 60 Q112 86 112 106Z" fill={c.shade} opacity="0.8" />
      <path d="M28 104 Q12 84 22 66 Q26 88 28 104Z" fill={c.light} opacity="0.22" />
      <path d="M112 104 Q128 84 118 66 Q114 88 112 104Z" fill={c.light} opacity="0.22" />

      {/* Eyes */}
      <Eyes mood={mood} lx={52} ly={84} rx={88} ry={84} r={11.5} />
      <Mouth mood={mood} cx={70} cy={108} w={24} />
      <Cheeks mood={mood} lx={32} ly={96} rx={108} ry={96} />

      {/* Legs */}
      <ellipse cx="50" cy="144" rx="16" ry="10" fill={c.shade} opacity="0.75" />
      <ellipse cx="90" cy="144" rx="16" ry="10" fill={c.shade} opacity="0.75" />
      <ellipse cx="50" cy="142" rx="16" ry="9.5" fill={c.body} />
      <ellipse cx="90" cy="142" rx="16" ry="9.5" fill={c.body} />
      {/* Toes */}
      {[42, 50, 58].map(x => <circle key={x} cx={x} cy={150} r={4.5} fill={c.body} stroke={c.shade} strokeWidth="1.5" />)}
      {[82, 90, 98].map(x => <circle key={x} cx={x} cy={150} r={4.5} fill={c.body} stroke={c.shade} strokeWidth="1.5" />)}
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EVO 3 — VAULTIX (dragon, wings, coin scales, lightning tail)
══════════════════════════════════════════════════════════════════════ */
function Evo3({ c, mood }: { c: C; mood: Mood }) {
  return (
    <svg viewBox="0 0 162 196" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="81" cy="189" rx="40" ry="7" fill="black" opacity="0.14" />

      {/* Wings */}
      <path d="M38 115 Q6 76 16 42 Q26 68 40 86 L38 115Z" fill={c.shade} opacity="0.88" />
      <path d="M124 115 Q156 76 146 42 Q136 68 122 86 L124 115Z" fill={c.shade} opacity="0.88" />
      {/* Wing membrane lines */}
      <path d="M38 112 Q14 80 18 52" stroke={c.accent} strokeWidth="1.5" opacity="0.45" />
      <path d="M38 100 Q20 76 22 62" stroke={c.accent} strokeWidth="1" opacity="0.3" />
      <path d="M124 112 Q148 80 144 52" stroke={c.accent} strokeWidth="1.5" opacity="0.45" />
      <path d="M124 100 Q142 76 140 62" stroke={c.accent} strokeWidth="1" opacity="0.3" />
      {/* Wing highlights */}
      <path d="M38 110 Q18 82 20 52 L28 68 L38 52 L38 80 Z" fill={c.light} opacity="0.14" />
      <path d="M124 110 Q144 82 142 52 L134 68 L124 52 L124 80 Z" fill={c.light} opacity="0.14" />

      {/* Body */}
      <ellipse cx="81" cy="130" rx="42" ry="54" fill={c.body} />
      {/* Coin scales */}
      {[
        [68,112],[82,105],[96,112],
        [62,126],[76,119],[90,119],[104,126],
        [68,140],[82,147],[96,140],
      ].map(([x,y],i) => (
        <ellipse key={i} cx={x} cy={y} rx={8.5} ry={6}
          fill={c.shade} opacity={0.32} stroke={c.accent} strokeWidth="0.8" strokeOpacity={0.4} />
      ))}
      <ellipse cx="81" cy="158" rx="32" ry="20" fill={c.shade} opacity="0.38" />
      <ellipse cx="81" cy="130" rx="42" ry="54" stroke={c.shade} strokeWidth="2.5" fill="none" />

      {/* Chest coin badge */}
      <circle cx="81" cy="118" r="16" fill={c.accent} opacity="0.85" />
      <circle cx="81" cy="118" r="16" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
      <text x="81" y="124" textAnchor="middle" fontSize="16" fontWeight="bold"
        fill="white" fontFamily="Georgia,serif">€</text>

      {/* Head */}
      <ellipse cx="81" cy="68" rx="35" ry="33" fill={c.body} />
      <ellipse cx="67" cy="55" rx="15" ry="9" fill={c.light} opacity="0.27" />
      <ellipse cx="81" cy="68" rx="35" ry="33" stroke={c.shade} strokeWidth="2.5" fill="none" />

      {/* Dragon head spikes */}
      <path d="M60 40 L55 18 L65 36Z" fill={c.shade} />
      <path d="M81 35 L79 12 L88 32Z" fill={c.accent} />
      <path d="M102 40 L107 18 L97 36Z" fill={c.shade} />

      {/* Eyes */}
      <Eyes mood={mood} lx={64} ly={64} rx={98} ry={64} r={12.5} />
      <Mouth mood={mood} cx={81} cy={86} w={26} />
      <Cheeks mood={mood} lx={44} ly={75} rx={118} ry={75} />

      {/* Lightning tail */}
      <path d="M81 182 L66 162 L76 162 L60 142"
        stroke={c.shade} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M81 182 L66 162 L76 162 L60 142"
        stroke={c.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Feet */}
      <ellipse cx="54" cy="178" rx="17" ry="10" fill={c.body} />
      <ellipse cx="108" cy="178" rx="17" ry="10" fill={c.body} />
      {[46, 54, 62].map(x => <path key={x} d={`M${x} 185 L${x - 2} 192`}
        stroke={c.shade} strokeWidth="2.5" strokeLinecap="round" />)}
      {[100, 108, 116].map(x => <path key={x} d={`M${x} 185 L${x - 2} 192`}
        stroke={c.shade} strokeWidth="2.5" strokeLinecap="round" />)}
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EVO 4 — AURION (crowned champion, large wings, coin armor, aura)
══════════════════════════════════════════════════════════════════════ */
function Evo4({ c, mood }: { c: C; mood: Mood }) {
  return (
    <svg viewBox="0 0 184 216" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Aura rings */}
      <circle cx="92" cy="108" r="80" stroke={c.accent} strokeWidth="1" opacity="0.13" />
      <circle cx="92" cy="108" r="68" stroke={c.accent} strokeWidth="1.5" opacity="0.18" />
      <ellipse cx="92" cy="210" rx="46" ry="7" fill="black" opacity="0.14" />

      {/* Large wings */}
      <path d="M42 130 Q4 85 12 32 L26 62 L40 46 L46 82 L42 130Z" fill={c.shade} />
      <path d="M142 130 Q180 85 172 32 L158 62 L144 46 L138 82 L142 130Z" fill={c.shade} />
      {/* Wing detail */}
      <path d="M42 126 Q16 90 18 46 L28 68 L38 54" stroke={c.accent} strokeWidth="2" opacity="0.5" />
      <path d="M42 112 Q22 84 24 58" stroke={c.accent} strokeWidth="1.5" opacity="0.35" />
      <path d="M142 126 Q168 90 166 46 L156 68 L146 54" stroke={c.accent} strokeWidth="2" opacity="0.5" />
      <path d="M142 112 Q162 84 160 58" stroke={c.accent} strokeWidth="1.5" opacity="0.35" />
      {/* Wing highlights */}
      <path d="M42 128 Q20 92 18 48 L28 64 L40 50 L44 80 L42 128Z" fill={c.light} opacity="0.14" />
      <path d="M142 128 Q164 92 166 48 L156 64 L144 50 L140 80 L142 128Z" fill={c.light} opacity="0.14" />

      {/* Body */}
      <ellipse cx="92" cy="144" rx="47" ry="58" fill={c.body} />
      {/* Coin armor plate */}
      <ellipse cx="92" cy="132" rx="28" ry="24" fill={c.shade} opacity="0.55" />
      <circle cx="92" cy="128" r="20" fill={c.accent} />
      <circle cx="92" cy="128" r="20" stroke="white" strokeWidth="2" strokeOpacity="0.35" fill="none" />
      <circle cx="92" cy="128" r="13" fill={c.shade} opacity="0.45" />
      <text x="92" y="134" textAnchor="middle" fontSize="18" fontWeight="bold"
        fill="white" fontFamily="Georgia,serif">€</text>
      {/* Armor lines */}
      <path d="M64 152 Q92 144 120 152" stroke={c.shade} strokeWidth="2" strokeDasharray="5 3" />
      <path d="M66 163 Q92 156 118 163" stroke={c.shade} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
      <ellipse cx="92" cy="174" rx="36" ry="24" fill={c.shade} opacity="0.32" />
      <ellipse cx="92" cy="144" rx="47" ry="58" stroke={c.shade} strokeWidth="2.5" fill="none" />

      {/* Head */}
      <ellipse cx="92" cy="74" rx="37" ry="36" fill={c.body} />
      <ellipse cx="76" cy="60" rx="16" ry="9" fill={c.light} opacity="0.27" />
      <ellipse cx="92" cy="74" rx="37" ry="36" stroke={c.shade} strokeWidth="2.5" fill="none" />

      {/* Crown */}
      <path d="M58 50 L58 28 L70 42 L80 22 L92 38 L104 22 L114 42 L126 28 L126 50Z"
        fill={c.accent} />
      <path d="M58 50 L126 50" stroke={c.shade} strokeWidth="2" />
      <path d="M58 50 L58 28 L70 42 L80 22 L92 38 L104 22 L114 42 L126 28 L126 50Z"
        stroke={c.shade} strokeWidth="1.5" fill="none" />
      {/* Crown gems */}
      <circle cx="80" cy="24" r="5.5" fill="white" opacity="0.95" />
      <circle cx="92" cy="40" r="5.5" fill="white" opacity="0.95" />
      <circle cx="104" cy="24" r="5.5" fill="white" opacity="0.95" />
      <circle cx="80" cy="24" r="3" fill={c.accent} opacity="0.8" />
      <circle cx="92" cy="40" r="3" fill={c.accent} opacity="0.8" />
      <circle cx="104" cy="24" r="3" fill={c.accent} opacity="0.8" />

      {/* Eyes */}
      <Eyes mood={mood} lx={74} ly={70} rx={110} ry={70} r={13} />
      <Mouth mood={mood} cx={92} cy={94} w={28} />
      <Cheeks mood={mood} lx={52} ly={82} rx={132} ry={82} />

      {/* Lightning tail */}
      <path d="M92 200 L74 178 L86 178 L66 156"
        stroke={c.shade} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M92 200 L74 178 L86 178 L66 156"
        stroke={c.accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Feet */}
      <ellipse cx="64" cy="198" rx="20" ry="12" fill={c.body} />
      <ellipse cx="120" cy="198" rx="20" ry="12" fill={c.body} />
      {[54, 64, 74].map(x => <path key={x} d={`M${x} 206 L${x - 2} 214`}
        stroke={c.shade} strokeWidth="3" strokeLinecap="round" />)}
      {[110, 120, 130].map(x => <path key={x} d={`M${x} 206 L${x - 2} 214`}
        stroke={c.shade} strokeWidth="3" strokeLinecap="round" />)}
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════
   EVO 5 — LEGENDRIX (legendary — spread wings, full crown, aura, gems)
══════════════════════════════════════════════════════════════════════ */
function Evo5({ c, mood }: { c: C; mood: Mood }) {
  return (
    <svg viewBox="0 0 202 234" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Multi-ring aura */}
      <circle cx="101" cy="117" r="95" stroke={c.accent} strokeWidth="1" opacity="0.1" />
      <circle cx="101" cy="117" r="82" stroke={c.accent} strokeWidth="1.2" opacity="0.15" />
      <circle cx="101" cy="117" r="70" stroke={c.accent} strokeWidth="1.8" opacity="0.13" />
      <ellipse cx="101" cy="228" rx="50" ry="7" fill="black" opacity="0.14" />

      {/* Floating coins */}
      <circle cx="26" cy="52" r="8" fill={c.accent} opacity="0.72" />
      <text x="26" y="56" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">€</text>
      <circle cx="176" cy="46" r="7" fill={c.accent} opacity="0.65" />
      <text x="176" y="50" textAnchor="middle" fontSize="6" fontWeight="bold" fill="white">€</text>
      <circle cx="18" cy="152" r="6" fill={c.accent} opacity="0.5" />
      <circle cx="184" cy="148" r="6" fill={c.accent} opacity="0.5" />

      {/* Diamonds */}
      <path d="M168 82 L174 74 L180 82 L174 90Z" fill={c.light} opacity="0.62" />
      <path d="M22 78 L28 70 L34 78 L28 86Z" fill={c.light} opacity="0.58" />
      <path d="M164 136 L169 129 L174 136 L169 143Z" fill={c.light} opacity="0.42" />

      {/* Spread wings */}
      <path d="M44 134 Q4 84 8 26 L22 58 L38 40 L48 76 L44 134Z" fill={c.shade} />
      <path d="M158 134 Q198 84 194 26 L180 58 L164 40 L154 76 L158 134Z" fill={c.shade} />
      {/* Wing veins */}
      <path d="M44 130 Q18 94 14 50 L26 72 L40 56" stroke={c.accent} strokeWidth="2" opacity="0.52" />
      <path d="M44 115 Q22 86 20 62" stroke={c.accent} strokeWidth="1.5" opacity="0.38" />
      <path d="M44 100 Q28 80 28 70" stroke={c.accent} strokeWidth="1" opacity="0.28" />
      <path d="M158 130 Q184 94 188 50 L176 72 L162 56" stroke={c.accent} strokeWidth="2" opacity="0.52" />
      <path d="M158 115 Q180 86 182 62" stroke={c.accent} strokeWidth="1.5" opacity="0.38" />
      {/* Wing highlights */}
      <path d="M44 132 Q22 96 16 44 L28 62 L42 46 L46 78 L44 132Z" fill={c.light} opacity="0.14" />
      <path d="M158 132 Q180 96 186 44 L174 62 L160 46 L156 78 L158 132Z" fill={c.light} opacity="0.14" />

      {/* Body */}
      <ellipse cx="101" cy="154" rx="50" ry="62" fill={c.body} />

      {/* Legendary chest armor */}
      <path d="M62 140 Q101 128 140 140 L140 158 Q101 170 62 158Z" fill={c.accent} opacity="0.72" />
      <circle cx="101" cy="144" r="22" fill={c.accent} />
      <circle cx="101" cy="144" r="22" stroke="white" strokeWidth="2" strokeOpacity="0.4" fill="none" />
      <circle cx="101" cy="144" r="14" fill={c.shade} opacity="0.48" />
      <text x="101" y="151" textAnchor="middle" fontSize="18" fontWeight="bold"
        fill="white" fontFamily="Georgia,serif">€</text>
      {/* Armor detail lines */}
      {[162, 173, 183].map((y, i) => (
        <path key={y} d={`M${68 - i * 2} ${y} Q101 ${y - 9} ${134 + i * 2} ${y}`}
          stroke={c.shade} strokeWidth="1.5" strokeDasharray="5 3" opacity={0.48 - i * 0.1} />
      ))}
      <ellipse cx="101" cy="182" rx="40" ry="30" fill={c.shade} opacity="0.3" />
      <ellipse cx="101" cy="154" rx="50" ry="62" stroke={c.shade} strokeWidth="2.5" fill="none" />

      {/* Head */}
      <ellipse cx="101" cy="78" rx="40" ry="38" fill={c.body} />
      <ellipse cx="84" cy="63" rx="17" ry="10" fill={c.light} opacity="0.27" />
      <ellipse cx="101" cy="78" rx="40" ry="38" stroke={c.shade} strokeWidth="2.5" fill="none" />

      {/* Royal crown */}
      <path d="M62 54 L62 28 L76 44 L88 20 L101 38 L114 20 L126 44 L140 28 L140 54Z"
        fill={c.accent} />
      <path d="M62 54 L140 54" stroke={c.shade} strokeWidth="2.5" />
      <path d="M62 54 L62 28 L76 44 L88 20 L101 38 L114 20 L126 44 L140 28 L140 54Z"
        stroke={c.shade} strokeWidth="1.5" fill="none" />
      {/* Crown gems */}
      {[88, 101, 114].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={i === 1 ? 40 : 22} r={6} fill="white" opacity={0.95} />
          <circle cx={x} cy={i === 1 ? 40 : 22} r={3.5} fill={c.accent} opacity={0.85} />
        </g>
      ))}

      {/* Eyes */}
      <Eyes mood={mood} lx={82} ly={76} rx={120} ry={76} r={14} />
      <Mouth mood={mood} cx={101} cy={102} w={30} />
      <Cheeks mood={mood} lx={58} ly={88} rx={144} ry={88} />

      {/* Energy burst lines (excited/celebrating) */}
      {(mood === 'celebrating' || mood === 'excited') &&
        [0, 40, 80, 120, 160, 200, 240, 280, 320].map(a => (
          <line key={a}
            x1={101 + Math.cos(a * Math.PI / 180) * 50}
            y1={154 + Math.sin(a * Math.PI / 180) * 58}
            x2={101 + Math.cos(a * Math.PI / 180) * 70}
            y2={154 + Math.sin(a * Math.PI / 180) * 78}
            stroke={c.accent} strokeWidth="1.8" strokeLinecap="round" opacity={0.58}
          />
        ))
      }

      {/* Lightning tail */}
      <path d="M101 214 L82 190 L94 190 L72 168"
        stroke={c.shade} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M101 214 L82 190 L94 190 L72 168"
        stroke={c.accent} strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />

      {/* Feet */}
      <ellipse cx="68" cy="212" rx="22" ry="13" fill={c.body} />
      <ellipse cx="134" cy="212" rx="22" ry="13" fill={c.body} />
      {[56, 66, 76].map(x => <path key={x} d={`M${x} 221 L${x - 2} 229`}
        stroke={c.shade} strokeWidth="3.5" strokeLinecap="round" />)}
      {[122, 132, 142].map(x => <path key={x} d={`M${x} 221 L${x - 2} 229`}
        stroke={c.shade} strokeWidth="3.5" strokeLinecap="round" />)}
    </svg>
  )
}

/* ── Main export ───────────────────────────────────────────────────── */
interface Props {
  evo: number
  mood: Mood
  className?: string
  animate?: boolean
}

export function VoltixCreature({ evo, mood, className = '', animate = true }: Props) {
  const c = MOOD_PALETTE[mood]
  const props = { c, mood }

  const creature =
    evo >= 5 ? <Evo5 {...props} /> :
    evo === 4 ? <Evo4 {...props} /> :
    evo === 3 ? <Evo3 {...props} /> :
    evo === 2 ? <Evo2 {...props} /> :
    <Evo1 {...props} />

  if (!animate) return <div className={`relative ${className}`}>{creature}</div>

  return (
    <motion.div
      className={`relative ${className}`}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Glow pool */}
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/5 h-6 blur-2xl rounded-full opacity-50 transition-colors duration-700"
        style={{ backgroundColor: c.body }}
      />
      {creature}
    </motion.div>
  )
}
