import fs from 'node:fs'
import { execSync } from 'node:child_process'

// 1. Build key -> Set(placeholders) from the PT block of the dict.
const dict = fs.readFileSync('src/lib/i18n/translations.ts', 'utf8').split(/\r?\n/)
const enStart = dict.findIndex(l => /^export const en\b/.test(l))
const keyPlaceholders = {}
for (let i = 0; i < enStart; i++) {
  const m = dict[i].match(/^\s*'([^'\\]+)':\s*(.*)$/)
  if (!m) continue
  keyPlaceholders[m[1]] = new Set([...m[2].matchAll(/\{(\w+)\}/g)].map(x => x[1]))
}

// 2. Gather all .tsx/.ts files under src.
const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', { encoding: 'utf8' })
  .split('\n').filter(Boolean)

// 3. For each t('key', { ... }) call (single object, no nested braces), compare
//    the passed param names against the key's placeholders.
const callRe = /\bt\(\s*'([^']+)'\s*,\s*\{([^{}]*)\}/g
let problems = 0
let checked = 0
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  let m
  while ((m = callRe.exec(src))) {
    const key = m[1]
    const body = m[2]
    const ph = keyPlaceholders[key]
    if (!ph) continue // key not in PT dict (e.g. dynamic) — skip
    checked++
    const params = new Set(
      body.split(',').map(p => p.trim()).filter(Boolean).map(p => {
        const colon = p.indexOf(':')
        return (colon >= 0 ? p.slice(0, colon) : p).trim()
      }).filter(x => /^\w+$/.test(x)),
    )
    const missing = [...ph].filter(p => !params.has(p))     // placeholder with no arg
    const extra   = [...params].filter(p => !ph.has(p))     // arg with no placeholder
    if (missing.length || extra.length) {
      console.log(`${f}\n  t('${key}') placeholders={${[...ph]}} passed={${[...params]}}` +
        (missing.length ? ` MISSING_ARG=[${missing}]` : '') +
        (extra.length ? ` EXTRA_ARG=[${extra}]` : ''))
      problems++
    }
  }
}
console.log('---')
console.log(`interpolated t() calls checked: ${checked} | problems: ${problems}`)
