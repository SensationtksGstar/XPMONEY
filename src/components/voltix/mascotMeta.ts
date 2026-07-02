/**
 * mascotMeta — palettes + evolution copy for both mascots, extracted from
 * VoltixCreature/PennyCreature (June 2026 perf audit).
 *
 * Why this file exists: the SVG components are ~45 KB / ~33 KB of source and
 * only render as an onError FALLBACK when a mascot WebP 404s — in production
 * they're dead weight. But VoltixWidget and /voltix imported MOOD_PALETTE
 * from VoltixCreature, anchoring the whole SVG module into the dashboard
 * bundle. Consumers that only need colours/names import from here (~2 KB);
 * the SVGs themselves are lazy-loaded inside MascotCreature's fallback path.
 */

import type { VoltixMood } from '@/types'

type Mood = VoltixMood

export interface MascotPaletteC { body: string; shade: string; light: string; accent: string }

/**
 * Mood palette — Apple-style polish (May 2026).
 *
 * v1 used pure Tailwind 500-shade colors (red-500, green-500, etc.) which
 * read as cartoony / amateur because they're maximum-saturation primaries.
 * v2 desaturates and adds cool undertones to every stop so the mascot
 * looks like polished sea-glass / frosted gem rather than a Saturday-
 * morning sticker.
 *
 * Recipe per mood: ~10-15 % less saturation, ~5-10 % cooler hue shift,
 * `light` brought closer to `body` so the radial gradient reads as a
 * single-material highlight (not a paint stripe). `shade` darkened with
 * a slate cast so the underside feels weighted.
 */
export const MOOD_PALETTE: Record<Mood, MascotPaletteC> = {
  // Slate-blue melancholic — Apple's actual "sad" cue is cool, not red.
  sad:         { body:'#7a8db5', shade:'#3e4d6b', light:'#c8d3e6', accent:'#a8b6d2' },
  // Platinum / brushed-titanium — Apple's neutral grey cast.
  neutral:     { body:'#7c8694', shade:'#3a4150', light:'#d5dae2', accent:'#9ba4b1' },
  // Muted sage — happy without screaming "kindergarten green".
  happy:       { body:'#5fb37b', shade:'#2c6741', light:'#bce0c8', accent:'#86c79c' },
  // Warm honey amber — celebratory but rich, not neon.
  excited:     { body:'#e0a951', shade:'#86541a', light:'#f6dfaa', accent:'#ecc079' },
  // Dusty lilac — Apple's "premium festive" purple.
  celebrating: { body:'#a98cd1', shade:'#5e3f87', light:'#dec8ed', accent:'#c4abdd' },
}

export const EVO_NAMES: Record<number, string> = {
  1: 'Voltini', 2: 'Voltito', 3: 'Voltix', 4: 'Voltaryon', 5: 'Magnavoltix', 6: 'Imperivoltix',
}

export const EVO_DESCRIPTIONS: Record<number, string> = {
  1: 'Ovo-bebé elétrico. Mal nasceu e já sabe o que é um €.',
  2: 'A crescer. Ainda chibi mas já com faíscas nos dedos.',
  3: 'Forma dragão desbloqueada. Escamas safira e raios cianos.',
  4: 'Campeão armado. Peitoral dourado e aura elétrica azul.',
  5: 'Divindade do trovão. Quatro asas e capa de plasma elétrico.',
  6: 'Lenda cósmica. Seis asas de galáxia e coroa imperial.',
}

export const EVO_REQUIREMENTS: Record<number, string> = {
  1: 'Estado inicial',
  2: 'Score ≥ 35',
  3: 'Score ≥ 55',
  4: 'Score ≥ 72',
  5: 'Score ≥ 85',
  6: 'Score ≥ 95',
}

/** Palette per-mood — only accents change; body fur stays cream */
export interface PennyPalette {
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
  1: 'Pennini', 2: 'Pennito', 3: 'Penny', 4: 'Pennyara', 5: 'Pennael', 6: 'Seraphenny',
}

export const PENNY_EVO_DESCRIPTIONS: Record<number, string> = {
  1: 'Semente adormecida. Já sonha com moedas a tilintar.',
  2: 'A despertar para a sabedoria. Capa coral com bordado rúnico.',
  3: 'Forma felina desbloqueada. Luvas mustard e fitas com runas.',
  4: 'Sacerdotisa-guerreira. Visor rúnico e arco de luz.',
  5: 'Anjo ascendido. 6 asas, arco dourado, gema emerald no peito.',
  6: 'Forma seráfica cósmica. Aura divina e asas de luz estelar.',
}

export const PENNY_EVO_REQUIREMENTS: Record<number, string> = {
  1: 'Estado inicial',
  2: 'Score ≥ 35',
  3: 'Score ≥ 55',
  4: 'Score ≥ 72',
  5: 'Score ≥ 85',
  6: 'Score ≥ 95',
}
