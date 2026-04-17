/**
 * process-new-mascots.mjs
 *
 * One-shot utility to ingest the user-supplied mascot assets from
 * C:\Users\HP\Desktop\xp mascotes into the repo:
 *
 *   1. Convert each cleaned SVG (per evolution) into a 512×512 WebP on
 *      transparent background, writing to public/mascot/<gender>/<n>.webp.
 *   2. Copy the evolution MP4s into public/mascot/<gender>/evo-<n>.mp4
 *      (1..5 transitions between 6 stages).
 *   3. Convert the Dragon Coin PNG (HELPBOT/…png) into a rounded 256×256
 *      WebP at public/dragon-coin.webp for use inside the FAB.
 *
 * Run once:  node scripts/process-new-mascots.mjs
 *
 * This file is intentionally ESM + zero-arg so it can live in /scripts
 * without needing a tsconfig entry. `sharp` is already a runtime dep of
 * the app (mascot upload route), so no extra install is needed.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(process.cwd())
const SRC  = 'C:\\Users\\HP\\Desktop\\xp mascotes'
const OUT  = path.join(ROOT, 'public', 'mascot')

// ── Evolution mapping ────────────────────────────────────────────────
// The code expects files named 1.webp..6.webp per gender. Ordering by
// narrative stage: egg/baby → final form.
const VOLTIX_STAGES = [
  { n: 1, svg: 'MASCULINO/SVG/VOLTINI SVG.svg'       }, // egg / baby
  { n: 2, svg: 'MASCULINO/SVG/VOLTITO SVG.svg'       },
  { n: 3, svg: 'MASCULINO/SVG/VOLTIX SVG.svg'        },
  { n: 4, svg: 'MASCULINO/SVG/VOLTARYON SVG.svg'     },
  { n: 5, svg: 'MASCULINO/SVG/IMPERIVOLTIX SVG.svg'  },
  { n: 6, svg: 'MASCULINO/SVG/MAGNAVOLTIX SVG.svg'   },
]

const PENNY_STAGES = [
  { n: 1, svg: 'FEMININO/SVG/PENNINI SVG.svg'     }, // egg / baby
  { n: 2, svg: 'FEMININO/SVG/PENNITO SVG.svg'     },
  { n: 3, svg: 'FEMININO/SVG/PENNY SVG.svg'       },
  { n: 4, svg: 'FEMININO/SVG/PENNYARA SVG.svg'    },
  { n: 5, svg: 'FEMININO/SVG/PENNAEL SVG.svg'     },
  { n: 6, svg: 'FEMININO/SVG/SERAPHENNY SVG.svg'  },
]

// ── Helpers ──────────────────────────────────────────────────────────
async function svgToWebp(srcAbs, outAbs, size = 512) {
  await fs.mkdir(path.dirname(outAbs), { recursive: true })
  // density: high so the rasterised SVG is crisp at 512.
  await sharp(srcAbs, { density: 384 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 92, effort: 5 })
    .toFile(outAbs)
}

async function copyFile(srcAbs, outAbs) {
  await fs.mkdir(path.dirname(outAbs), { recursive: true })
  await fs.copyFile(srcAbs, outAbs)
}

async function pngToWebp(srcAbs, outAbs, size) {
  await fs.mkdir(path.dirname(outAbs), { recursive: true })
  await sharp(srcAbs)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90, effort: 5 })
    .toFile(outAbs)
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🔥 Processing new mascot assets…')

  // 1. SVG → WebP per stage
  for (const [gender, stages] of [['voltix', VOLTIX_STAGES], ['penny', PENNY_STAGES]]) {
    for (const { n, svg } of stages) {
      const src = path.join(SRC, svg.replace(/\//g, path.sep))
      const out = path.join(OUT, gender, `${n}.webp`)
      try {
        await svgToWebp(src, out)
        console.log(`  ✓ ${gender}/${n}.webp`)
      } catch (err) {
        console.error(`  ✗ ${gender}/${n}.webp — ${err.message}`)
      }
    }
  }

  // 2. Copy evolution MP4s (5 transitions per gender)
  const VIDEOS = [
    { gender: 'voltix', folder: 'MASCULINO/VIDEO EVOLUCAO', prefix: 'VOLTIX EVO' },
    { gender: 'penny',  folder: 'FEMININO/VIDEO EVOLUCAO',  prefix: 'PENNY EVO'  },
  ]
  for (const { gender, folder, prefix } of VIDEOS) {
    for (let i = 1; i <= 5; i++) {
      const src = path.join(SRC, folder.replace(/\//g, path.sep), `${prefix} ${i}.mp4`)
      const out = path.join(OUT, gender, `evo-${i}.mp4`)
      try {
        await copyFile(src, out)
        const stat = await fs.stat(out)
        console.log(`  ✓ ${gender}/evo-${i}.mp4 (${(stat.size / 1024 / 1024).toFixed(1)} MB)`)
      } catch (err) {
        console.error(`  ✗ ${gender}/evo-${i}.mp4 — ${err.message}`)
      }
    }
  }

  // 3. Dragon Coin helpbot → WebP for FAB
  try {
    const src = path.join(SRC, 'HELPBOT', 'Gemini_Generated_Image_46ic0d46ic0d46ic.png')
    const out = path.join(ROOT, 'public', 'dragon-coin.webp')
    await pngToWebp(src, out, 256)
    console.log('  ✓ public/dragon-coin.webp')
  } catch (err) {
    console.error(`  ✗ dragon-coin.webp — ${err.message}`)
  }

  console.log('✅ Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
