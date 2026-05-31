import fs from 'node:fs'

const lines = fs.readFileSync('src/lib/i18n/translations.ts', 'utf8').split(/\r?\n/)

// Find block boundaries dynamically
const enStart = lines.findIndex(l => /^export const en\b/.test(l))
if (enStart < 0) { console.error('EN block not found'); process.exit(1) }

function parse(from, to) {
  const map = {}
  for (let i = from; i < to; i++) {
    const m = lines[i].match(/^\s*'([^'\\]+)':\s*(.*)$/)
    if (!m) continue
    const placeholders = [...m[2].matchAll(/\{(\w+)\}/g)].map(x => x[1]).sort()
    map[m[1]] = placeholders.join(',')
  }
  return map
}

const pt = parse(0, enStart)
const en = parse(enStart, lines.length)

let mismatches = 0
let enMissing = 0
for (const k of Object.keys(pt)) {
  if (en[k] === undefined) { enMissing++; continue }
  if (pt[k] !== en[k]) {
    console.log(`PLACEHOLDER MISMATCH: ${k} | pt:[${pt[k]}] en:[${en[k]}]`)
    mismatches++
  }
}
console.log('---')
console.log(`PT keys: ${Object.keys(pt).length} | EN keys: ${Object.keys(en).length} | EN-missing(fallback to PT): ${enMissing} | placeholder mismatches: ${mismatches}`)
