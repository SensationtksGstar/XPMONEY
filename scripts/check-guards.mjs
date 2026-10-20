// Route guard — corre junto com `npx tsc --noEmit` antes de cada commit.
//
//   node scripts/check-guards.mjs
//
// Desde out. 2026 o middleware é "allow-by-default" para PÁGINAS: só passam
// pelo Clerk as rotas /api/* e os prefixos do `isAppPage` em
// src/middleware.ts (o resto vai direto ao Next → página pública ou 404
// real). Isto fecha a classe de bug "Googlebot recebe 307" mas abre outra:
// uma página privada nova que ninguém acrescente ao isAppPage passava sem
// auth no middleware. Este script é a rede de segurança (tsc não apanha):
//
//   A (ERRO)  cada page.* E cada route.* (route handler fora de src/app/api)
//             em src/app/(app)/, src/app/admin/ ou src/app/reports/ tem de
//             cair num prefixo do isAppPage — senão auth() corre sem o
//             clerkMiddleware ter corrido.
//   B (ERRO)  nenhuma entrada pública (page.*, route.* fora de /api, e os
//             ficheiros-fronteira not-found/error/global-error/loading/default
//             fora das pastas privadas) — nem os layouts/templates que a
//             envolvem, nem NADA do que importa TRANSITIVAMENTE (imports
//             relativos e '@/…', incl. import() dinâmico e server actions) —
//             pode importar @clerk/nextjs: sem o clerk() a correr,
//             auth()/hooks do Clerk rebentam (ou é sinal de que a página
//             devia ser privada). `import type` é ignorado (é apagado na
//             compilação); imports dentro de comentários também.
//   C (AVISO) página pública cujo URL cai num prefixo do isAppPage (ficaria
//             atrás do login sem querer).
//   D (ERRO)  um padrão do isPublicRoute que apanhe uma página privada (ex.:
//             '/r(.*)' engoliria /reports) — exceto sign-in/sign-up.
//
// Node puro (fs/path), sem dependências.

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'src')
const APP_DIR = path.join(SRC_DIR, 'app')
const API_DIR = path.join(APP_DIR, 'api')
// argv[2] opcional: outro ficheiro de middleware (para testar o próprio guard).
const MW_FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(SRC_DIR, 'middleware.ts')

const PRIVATE_TOP = ['(app)', 'admin', 'reports'] // pastas de topo de src/app
const CLERK_SPEC  = /^@clerk\/nextjs(?:\/.*)?$/
const CODE_EXTS   = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs']

const errors   = []
const warnings = []

// ── 1. Recolhe as entradas de rota ──────────────────────────────────────
const PAGE_RE     = /^page\.(tsx|ts|jsx|js|mdx)$/
const ROUTE_RE    = /^route\.(tsx|ts|jsx|js)$/
const BOUNDARY_RE = /^(not-found|error|global-error|loading|default)\.(tsx|ts|jsx|js)$/

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (full === API_DIR) continue // /api/* passa SEMPRE pelo clerk() (deny-by-default)
      walk(full, out)
    } else if (PAGE_RE.test(entry.name))     out.push({ file: full, kind: 'page' })
    else if (ROUTE_RE.test(entry.name))      out.push({ file: full, kind: 'route' })
    else if (BOUNDARY_RE.test(entry.name))   out.push({ file: full, kind: 'boundary' })
  }
  return out
}

/** Segmentos relativos a src/app (sem o ficheiro). */
function segmentsOf(file) {
  return path.relative(APP_DIR, path.dirname(file)).split(path.sep).filter(Boolean)
}

/** URL a partir dos segmentos: remove grupos `(x)` e slots `@x`; mantém [param]. */
function urlOf(segments) {
  const kept = segments.filter(s => !/^\(.*\)$/.test(s) && !s.startsWith('@'))
  return '/' + kept.join('/')
}

const relOf = f => path.relative(ROOT, f).split(path.sep).join('/')

// ── 2. Extrai os arrays do middleware ───────────────────────────────────
const mw = fs.readFileSync(MW_FILE, 'utf8')

function extractMatcher(name) {
  const re = new RegExp(`const ${name} = createRouteMatcher\\(\\[([\\s\\S]*?)\\]\\)`)
  const m  = mw.match(re)
  if (!m) return null
  // Ignora comentários de linha antes de extrair as strings.
  const body = m[1].split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  return [...body.matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1])
}

const appPatterns    = extractMatcher('isAppPage')
const publicPatterns = extractMatcher('isPublicRoute') ?? []

if (!appPatterns || appPatterns.length === 0) {
  console.error('[check-guards] ERRO: não encontrei `const isAppPage = createRouteMatcher([...])` em src/middleware.ts')
  process.exit(1)
}

/** 'x(.*)' → { prefix: 'x' } ; literal → { exact: 'x' }. */
function toRule(pattern) {
  if (pattern.endsWith('(.*)')) {
    const p = pattern.slice(0, -4)
    return p.endsWith('/') ? { prefix: p.slice(0, -1), slash: true } : { prefix: p }
  }
  return { exact: pattern }
}

const appPrefixes = appPatterns.map(p => {
  const r = toRule(p)
  if (!r.prefix) {
    warnings.push(`isAppPage tem um padrão sem (.*): '${p}' — só apanha o URL exato`)
    return { raw: p, exact: r.exact }
  }
  return { raw: p, prefix: r.prefix }
})

function matchesAppPrefix(url) {
  return appPrefixes.find(r =>
    r.exact !== undefined
      ? url === r.exact
      : url === r.prefix || url.startsWith(r.prefix + '/'),
  )
}

/** Como o createRouteMatcher do Clerk: 'x(.*)' apanha QUALQUER coisa a começar por x. */
function publicPatternMatches(pattern, url) {
  const r = toRule(pattern)
  if (r.exact !== undefined) return url.toLowerCase() === r.exact.toLowerCase()
  const base = r.slash ? r.prefix + '/' : r.prefix
  return url.toLowerCase().startsWith(base.toLowerCase())
}

// ── 3. Grafo de imports (para a regra B transitiva) ─────────────────────
//
// Sem tokenizer (JSX com apóstrofos baralha qualquer stripper de strings):
//   - imports estáticos só contam ancorados ao início da linha
//     (`import … from`, `export … from`, `import 'x'`) → um `// import …`
//     nunca casa;
//   - import()/require() dinâmicos não contam se a linha tiver `//` antes;
//   - nada conta dentro de um bloco /* … */ que comece no início da linha
//     (JSDoc / comentários de bloco do repo).
// Falha de heurística = falso POSITIVO (falha fechado), nunca falso negativo
// num import real.

const STATIC_FROM = /^[ \t]*(import|export)[ \t]+(type[ \t]+)?[\w*{}\s,$]*?\bfrom[ \t]*['"]([^'"\n]+)['"]/gm
const SIDE_EFFECT = /^[ \t]*import[ \t]*['"]([^'"\n]+)['"]/gm
const DYNAMIC     = /\b(?:import|require)[ \t]*\([ \t]*['"]([^'"\n]+)['"]/g
const BLOCK_START = /^[ \t]*\/\*/gm

function blockCommentRanges(src) {
  const ranges = []
  for (const m of src.matchAll(BLOCK_START)) {
    const start = m.index
    if (ranges.length && start < ranges[ranges.length - 1][1]) continue
    const end = src.indexOf('*/', start + m[0].length)
    ranges.push([start, end === -1 ? src.length : end + 2])
  }
  return ranges
}

const inRanges = (ranges, i) => ranges.some(([a, b]) => i >= a && i < b)

const importCache = new Map()

/** Lista de specifiers importados (valor, não `import type`) por um ficheiro. */
function importsOf(file) {
  if (importCache.has(file)) return importCache.get(file)
  let src = ''
  try {
    src = fs.readFileSync(file, 'utf8')
  } catch (err) {
    warnings.push(`não consegui ler ${relOf(file)}: ${err.message}`)
  }
  const ranges = blockCommentRanges(src)
  const specs  = []

  for (const m of src.matchAll(STATIC_FROM)) {
    if (m[2]) continue // `import type … from` / `export type … from` — apagado na compilação
    // `import { type A, type B } from 'x'` só com tipos também é apagado.
    const clause = m[0].replace(/\bfrom[\s\S]*$/, '')
    const braces = clause.match(/\{([\s\S]*)\}/)
    const hasDefaultOrNs = /^[ \t]*(import|export)[ \t]+(?!\{)[\w*$]/.test(clause)
    if (braces && !hasDefaultOrNs) {
      const names = braces[1].split(',').map(s => s.trim()).filter(Boolean)
      if (names.length > 0 && names.every(n => /^type\s/.test(n))) continue
    }
    if (inRanges(ranges, m.index)) continue
    specs.push(m[3])
  }
  for (const m of src.matchAll(SIDE_EFFECT)) {
    if (!inRanges(ranges, m.index)) specs.push(m[1])
  }
  for (const m of src.matchAll(DYNAMIC)) {
    if (inRanges(ranges, m.index)) continue
    const lineStart = src.lastIndexOf('\n', m.index) + 1
    if (/(^|\s)\/\//.test(src.slice(lineStart, m.index))) continue
    specs.push(m[1])
  }

  importCache.set(file, specs)
  return specs
}

/** Resolve um specifier local para um ficheiro de código, ou null. */
function resolveSpec(spec, fromFile) {
  let base
  if (spec.startsWith('@/'))      base = path.join(SRC_DIR, spec.slice(2))
  else if (spec.startsWith('.'))  base = path.resolve(path.dirname(fromFile), spec)
  else return null // pacote externo

  const candidates = [base, ...CODE_EXTS.map(e => base + e), ...CODE_EXTS.map(e => path.join(base, 'index' + e))]
  for (const c of candidates) {
    try {
      if (CODE_EXTS.includes(path.extname(c)) && fs.statSync(c).isFile()) return c
    } catch { /* candidato inexistente — tenta o próximo (resolução normal) */ }
  }
  return null // .css/.json/.webp/… ou caminho partido (o tsc apanha os partidos)
}

/** BFS a partir de `entry`; devolve a cadeia até ao 1.º import do Clerk, ou null. */
function clerkChain(entry) {
  const parent = new Map([[entry, null]])
  const queue  = [entry]
  while (queue.length) {
    const file = queue.shift()
    for (const spec of importsOf(file)) {
      if (CLERK_SPEC.test(spec)) {
        const chain = [`${relOf(file)} → '${spec}'`]
        for (let p = parent.get(file); p; p = parent.get(p)) chain.unshift(relOf(p))
        return chain
      }
      const dep = resolveSpec(spec, file)
      if (dep && !parent.has(dep)) {
        parent.set(dep, file)
        queue.push(dep)
      }
    }
  }
  return null
}

// ── 4. Aplica as regras ─────────────────────────────────────────────────
const entries = walk(APP_DIR)
let privateCount = 0
let publicCount  = 0
const seenB = new Set()

for (const { file, kind } of entries) {
  const segs   = segmentsOf(file)
  const url    = urlOf(segs)
  const rel    = relOf(file)
  const isPriv = segs.length > 0 && PRIVATE_TOP.includes(segs[0])

  if (isPriv) {
    if (kind === 'boundary') continue // renderiza dentro de rotas privadas já cobertas
    privateCount++
    // Regra A
    if (!matchesAppPrefix(url)) {
      errors.push(`A: ${rel} (URL ${url}) está numa pasta privada mas NENHUM prefixo do isAppPage a cobre — acrescenta '${'/' + url.split('/')[1]}(.*)' ao isAppPage em src/middleware.ts`)
    }
    // Regra D (só páginas — os handlers são servidos no mesmo URL)
    const isAuthPage = /^\/sign-(in|up)(\/|$)/.test(url)
    if (kind === 'page' && !isAuthPage) {
      for (const p of publicPatterns) {
        if (p.startsWith('/api')) continue
        if (publicPatternMatches(p, url)) {
          errors.push(`D: o padrão público '${p}' do isPublicRoute apanha a página privada ${url} (${rel}) — usa um padrão mais estreito (ex.: '/r/(.*)' com barra)`)
        }
      }
    }
  } else {
    publicCount++
    // Regra B: a entrada + todos os layouts/templates que a envolvem, com
    // tudo o que importam transitivamente.
    const toCheck = [file]
    for (let i = segs.length; i >= 0; i--) {
      const dir = path.join(APP_DIR, ...segs.slice(0, i))
      for (const name of ['layout.tsx', 'layout.ts', 'template.tsx', 'template.ts']) {
        const f = path.join(dir, name)
        if (fs.existsSync(f)) toCheck.push(f)
      }
    }
    for (const f of toCheck) {
      const chain = clerkChain(f)
      if (!chain) continue
      const key = `${rel}|${chain.join('|')}`
      if (seenB.has(key)) continue
      seenB.add(key)
      errors.push(`B: entrada pública ${url} (${rel}, ${kind}) chega ao @clerk/nextjs via ${chain.join(' → ')} — o Clerk não corre em rotas públicas; move a rota para src/app/(app)/ ou tira o Clerk dessa cadeia`)
    }
    // Regra C
    const hit = kind !== 'boundary' && matchesAppPrefix(url)
    if (hit) {
      warnings.push(`C: entrada pública ${url} (${rel}) cai no prefixo '${hit.raw}' do isAppPage — vai exigir login`)
    }
  }
}

// ── 5. Resumo ───────────────────────────────────────────────────────────
console.log(`[check-guards] ${entries.length} entradas (${privateCount} privadas, ${publicCount} públicas) · ${importCache.size} ficheiros no grafo de imports · ${appPatterns.length} prefixos isAppPage · ${publicPatterns.length} padrões isPublicRoute`)
for (const w of warnings) console.log(`  AVISO ${w}`)
for (const e of errors)   console.log(`  ERRO  ${e}`)

if (errors.length > 0) {
  console.log(`[check-guards] FALHOU: ${errors.length} erro(s), ${warnings.length} aviso(s)`)
  process.exit(1)
}
console.log(`[check-guards] OK: 0 erros, ${warnings.length} aviso(s)`)
