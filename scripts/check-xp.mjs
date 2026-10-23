// Golden-case guard for the XP level math (src/lib/xpLevel.ts) and for the
// SQL mirror in database/award_xp_rpc_2026_10.sql.
//
// Run: node --experimental-strip-types scripts/check-xp.mjs
//
// Why: o XP passou a ser incrementado por uma função Postgres (award_xp) que
// recalcula o nível com uma lista de limiares PRÓPRIA (o SQL não lê o TS).
// Se alguém mudar os LEVELS em src/types/index.ts e esquecer o ARRAY do SQL,
// o nível guardado diverge do que a UI mostra — e o tsc não vê nada disto.
// Este script compara as três fontes (LEVELS, SQL, algoritmo) e fixa os
// casos-ouro do clamp a 0 e da deteção de level-up.
//
// xpLevel.ts must keep ONLY `import type` (types are stripped); a runtime
// '@/…' alias import would make this script fail to load.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { levelForXP, applyXPDelta, isRpcUnavailable, XP_TOTAL_MAX } from '../src/lib/xpLevel.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── 1. Limiares: TS (LEVELS) vs SQL (xp_level_for) ─────────────────────────
console.log('Limiares')

const typesSrc = readFileSync(join(root, 'src/types/index.ts'), 'utf8')
const levelsBlock = typesSrc.match(/export const LEVELS[^=]*=\s*\[([\s\S]*?)\n\]/)
check('LEVELS encontrado em src/types/index.ts', !!levelsBlock)
const levelRows = levelsBlock
  ? [...levelsBlock[1].matchAll(/number:\s*(\d+)\s*,[^}]*?xp_required:\s*(\d+)/g)]
      .map(m => ({ number: Number(m[1]), xp: Number(m[2]) }))
  : []
const tsThresholds = levelRows.map(r => r.xp)

check('LEVELS tem 20 níveis', levelRows.length === 20, `tem ${levelRows.length}`)
check('LEVELS numerados 1..N sem buracos (o SQL conta limiares)',
  levelRows.every((r, i) => r.number === i + 1),
  levelRows.map(r => r.number).join(','))
check('LEVELS começa em 0 XP', tsThresholds[0] === 0)
check('LEVELS estritamente crescente',
  tsThresholds.every((x, i) => i === 0 || x > tsThresholds[i - 1]))

const sqlSrc = readFileSync(join(root, 'database/award_xp_rpc_2026_10.sql'), 'utf8')
const sqlArr = sqlSrc.match(/ARRAY\[([\d,\s]+)\]::integer\[\]/)
check('ARRAY de limiares encontrado no SQL', !!sqlArr)
const sqlThresholds = sqlArr ? sqlArr[1].split(',').map(s => Number(s.trim())) : []
check('SQL == LEVELS (mesmos limiares, mesma ordem)', same(sqlThresholds, tsThresholds),
  `SQL ${sqlThresholds.join(',')} vs TS ${tsThresholds.join(',')}`)

// ── 2. levelForXP: casos-ouro + equivalência com getLevelFromXP ────────────
console.log('levelForXP')

const golden = [
  [0, 1], [199, 1], [200, 2], [499, 2], [500, 3], [1000, 4], [15999, 9],
  [16000, 10], [20999, 10], [21000, 11], [91999, 18], [92000, 19],
  [99999, 19], [100000, 20], [5_000_000, 20], [-5, 1], [NaN, 1],
]
for (const [xp, lvl] of golden) {
  const got = levelForXP(xp, tsThresholds)
  check(`levelForXP(${xp}) = ${lvl}`, got === lvl, `deu ${got}`)
}

// Algoritmo de referência = getLevelFromXP (gamification.ts), reescrito aqui
// porque gamification.ts tem imports de runtime com alias.
function referenceLevel(totalXP) {
  let current = levelRows[0]
  for (const l of levelRows) {
    if (totalXP >= l.xp) current = l
    else break
  }
  return current.number
}
let mismatch = null
for (let xp = 0; xp <= 101_000; xp += 1) {
  if (levelForXP(xp, tsThresholds) !== referenceLevel(xp)) { mismatch = xp; break }
}
check('levelForXP == getLevelFromXP em 0..101000', mismatch === null, `diverge em ${mismatch}`)

// ── 3. applyXPDelta: soma, clamp, level-up ─────────────────────────────────
console.log('applyXPDelta')

const t = tsThresholds
check('ganho simples sem level-up',
  same(applyXPDelta(100, 1, 15, t),
    { xp_gained: 15, xp_total: 115, level: 1, previous_level: 1, leveled_up: false }))
check('ganho que cruza 200 → level-up 1→2',
  same(applyXPDelta(190, 1, 15, t),
    { xp_gained: 15, xp_total: 205, level: 2, previous_level: 1, leveled_up: true }))
check('salto de vários níveis (bónus grande)',
  same(applyXPDelta(400, 2, 3000, t),
    { xp_gained: 3000, xp_total: 3400, level: 5, previous_level: 2, leveled_up: true }))
check('reversão normal (DELETE de transação, -15)',
  same(applyXPDelta(100, 1, -15, t),
    { xp_gained: -15, xp_total: 85, level: 1, previous_level: 1, leveled_up: false }))
check('reversão com clamp a 0 (só tinha 10)',
  same(applyXPDelta(10, 1, -15, t),
    { xp_gained: -10, xp_total: 0, level: 1, previous_level: 1, leveled_up: false }))
check('reversão com xp_total já a 0 → delta 0',
  applyXPDelta(0, 1, -15, t).xp_gained === 0 && applyXPDelta(0, 1, -15, t).xp_total === 0)
check('reversão abaixo de um limiar desce o nível (nível = f(total))',
  same(applyXPDelta(205, 2, -15, t),
    { xp_gained: -15, xp_total: 190, level: 1, previous_level: 2, leveled_up: false }))
check('nível guardado null → derivado do total antigo',
  applyXPDelta(600, null, 10, t).previous_level === 3)
check('nível guardado desatualizado (backfill) → level-up na próxima atribuição',
  same(applyXPDelta(1200, 2, 25, t),
    { xp_gained: 25, xp_total: 1225, level: 4, previous_level: 2, leveled_up: true }))
check('teto do INTEGER do Postgres',
  applyXPDelta(XP_TOTAL_MAX - 5, 20, 100, t).xp_total === XP_TOTAL_MAX
    && applyXPDelta(XP_TOTAL_MAX - 5, 20, 100, t).xp_gained === 5)
check('total antigo inválido conta como 0',
  applyXPDelta(NaN, null, 25, t).xp_total === 25)

// ── 4. isRpcUnavailable: só cai no fallback quando nada foi escrito ────────
console.log('isRpcUnavailable')

check('PGRST202 → fallback', isRpcUnavailable({ code: 'PGRST202', message: 'x' }))
check('42883 → fallback', isRpcUnavailable({ code: '42883', message: 'x' }))
check('42501 → fallback', isRpcUnavailable({ code: '42501', message: 'x' }))
check('mensagem "Could not find the function public.award_xp" → fallback',
  isRpcUnavailable({ code: '', message: 'Could not find the function public.award_xp(p_amount, p_reason, p_user_id) in the schema cache' }))
check('erro dentro da função (22023) → SEM fallback', !isRpcUnavailable({ code: '22023', message: 'x' }))
check('erro de rede sem código → SEM fallback', !isRpcUnavailable({ message: 'TypeError: fetch failed' }))
check('sem erro → SEM fallback', !isRpcUnavailable(null))

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll XP checks passed.')
