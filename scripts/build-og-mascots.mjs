// Gera os PNGs das mascotes usados pelas OG images das páginas de partilha
// (/p/evo/[slug]/opengraph-image.tsx).
//
//   node scripts/build-og-mascots.mjs
//
// Porquê: o next/og (Satori/resvg) NÃO descodifica WebP de forma fiável, e a
// arte oficial só existe em public/mascot/<gender>/<n>.webp. Este script
// converte as formas 2..6 de cada mascote (o ovo, forma 1, nunca é partilhado
// — só se partilha uma evolução) para PNG 400×400 com alfa, paleta quantizada
// para ficar ≤ ~120 kB cada (as OG pesadas são ignoradas pelo WhatsApp).
//
// Saída: public/mascot/og/<gender>-<n>.png — COMMITADOS (o build do Vercel
// não corre este script; a OG lê-os do filesystem). Voltar a correr sempre
// que a arte das mascotes for re-cortada (junto com o bump de
// MASCOT_ASSET_VER em MascotCreature.tsx).
//
// Cache-bust: o public/sw.js serve imagens cache-first. No fim, o script
// escreve src/app/p/_lib/ogVersion.ts com um hash do conteúdo dos 10 PNGs
// (MASCOT_OG_VER); a página /p/evo/[slug] usa-o como ?v=. Um re-corte muda
// o hash sozinho — commitar ogVersion.ts junto com os PNGs.
//
// Usa o `sharp` que já é dependência de runtime (rota de upload de mascotes).

import fs   from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'public', 'mascot')
const OUT_DIR = path.join(SRC_DIR, 'og')

const GENDERS  = ['voltix', 'penny']
const STAGES   = [2, 3, 4, 5, 6]
const SIZE     = 400
const MAX_KB   = 120

fs.mkdirSync(OUT_DIR, { recursive: true })

let failed = 0
const hash = createHash('sha1')

for (const gender of GENDERS) {
  for (const n of STAGES) {
    const src = path.join(SRC_DIR, gender, `${n}.webp`)
    const out = path.join(OUT_DIR, `${gender}-${n}.png`)
    if (!fs.existsSync(src)) {
      console.error(`✗ falta a arte: ${path.relative(ROOT, src)}`)
      failed++
      continue
    }

    // Tenta primeiro com mais cores; desce até caber no orçamento.
    let buf  = null
    for (const colours of [256, 192, 128, 96, 64]) {
      buf = await sharp(src)
        .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ palette: true, colours, quality: 90, effort: 10, compressionLevel: 9 })
        .toBuffer()
      if (buf.length <= MAX_KB * 1024) break
    }

    fs.writeFileSync(out, buf)
    hash.update(`${gender}-${n}:`).update(buf)
    const kb = (buf.length / 1024).toFixed(1)
    const flag = buf.length > MAX_KB * 1024 ? '  ⚠ acima do orçamento' : ''
    console.log(`✓ ${path.relative(ROOT, out)}  ${kb} kB${flag}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} ficheiro(s) em falta.`)
  process.exit(1)
}

const ver     = hash.digest('hex').slice(0, 10)
const verFile = path.join(ROOT, 'src', 'app', 'p', '_lib', 'ogVersion.ts')
fs.writeFileSync(verFile, [
  '// GERADO por scripts/build-og-mascots.mjs — não editar à mão.',
  '// Hash do conteúdo de public/mascot/og/*.png: cache-bust (?v=) da arte das',
  '// páginas /p/evo/* (o service worker serve imagens cache-first).',
  `export const MASCOT_OG_VER = '${ver}'`,
  '',
].join('\n'))
console.log(`✓ ${path.relative(ROOT, verFile)}  MASCOT_OG_VER=${ver}`)
