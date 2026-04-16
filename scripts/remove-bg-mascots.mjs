#!/usr/bin/env node
/**
 * Mascot background removal — XP Money
 *
 * Uses @imgly/background-removal-node (ONNX U²-Net, runs locally, no API key)
 * to strip the studio backdrop from each raw mascot render, producing clean
 * PNGs with alpha=0 everywhere except the character silhouette.
 *
 * Flow:
 *   1. Read  public/mascot/raw/<gender>/<n>.png  (opaque background)
 *   2. Run   @imgly/background-removal-node     (~200 MB model, first run only)
 *   3. Write public/mascot/raw-clean/<gender>/<n>.png (transparent bg)
 *
 * After this script, run:
 *   node scripts/process-mascot.mjs all
 * but pointing at raw-clean instead of raw (or swap raw → raw-clean once
 * you're happy with the output).
 *
 * Usage:
 *   node scripts/remove-bg-mascots.mjs
 *
 * First run downloads the model (~90-200 MB) to node_modules/.cache/imgly.
 * Subsequent runs are instant.
 */

import { removeBackground } from '@imgly/background-removal-node'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const RAW_DIR   = join('public', 'mascot', 'raw')
const CLEAN_DIR = join('public', 'mascot', 'raw-clean')
const GENDERS   = ['voltix', 'penny']

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', cyan: '\x1b[36m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m',
}

/**
 * Remove background from a single PNG file.
 * @param {string} inputPath
 * @param {string} outputPath
 */
async function clean(inputPath, outputPath) {
  const buf  = await readFile(inputPath)
  const blob = new Blob([buf], { type: 'image/png' })
  // model: 'medium' is the default (80 MB, fast). 'large' is heavier but
  // slightly better edges. 'small' is fastest and lightest. For our studio
  // renders 'medium' is plenty — characters have clean silhouettes already.
  const out = await removeBackground(blob, {
    output: { format: 'image/png', quality: 1 },
    // debug: true,
  })
  const arr = new Uint8Array(await out.arrayBuffer())
  await writeFile(outputPath, Buffer.from(arr))
  return arr.length
}

async function main() {
  console.log(`${c.bold}${c.cyan}\n━━ Mascot background removal ━━${c.reset}`)
  console.log(`${c.dim}first run may download ~90 MB model into node_modules/.cache/imgly${c.reset}\n`)

  let total = 0, ok = 0
  const started = Date.now()

  for (const gender of GENDERS) {
    const inDir  = join(RAW_DIR, gender)
    const outDir = join(CLEAN_DIR, gender)
    if (!existsSync(inDir)) {
      console.log(`${c.yellow}[skip] ${gender}: no raw folder${c.reset}`)
      continue
    }
    await mkdir(outDir, { recursive: true })

    const files = (await readdir(inDir))
      .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
      .sort()

    console.log(`${c.bold}${gender.toUpperCase()}${c.reset} — ${files.length} files`)
    for (const file of files) {
      total++
      const inP  = join(inDir, file)
      // Force .png output regardless of input extension
      const outP = join(outDir, file.replace(/\.(jpe?g|webp)$/i, '.png'))
      const t0 = Date.now()
      try {
        const bytes = await clean(inP, outP)
        const kb = (bytes / 1024).toFixed(1)
        const ms = Date.now() - t0
        console.log(`  ${c.green}✓${c.reset} ${file} → ${outP} ${c.dim}${kb} KB in ${ms}ms${c.reset}`)
        ok++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`  ${c.red}✗${c.reset} ${file}: ${msg}`)
      }
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(
    `\n${c.bold}${c.green}done${c.reset} — ${ok}/${total} cleaned in ${secs}s`,
  )
  console.log(
    `${c.dim}next:${c.reset} swap ${c.cyan}public/mascot/raw${c.reset} with ${c.cyan}public/mascot/raw-clean${c.reset} and run ${c.cyan}node scripts/process-mascot.mjs all${c.reset}\n`,
  )
}

main().catch(err => {
  console.error(`${c.red}fatal:${c.reset}`, err)
  process.exit(1)
})
