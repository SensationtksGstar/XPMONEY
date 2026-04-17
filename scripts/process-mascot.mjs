#!/usr/bin/env node
/**
 * Mascot asset pipeline — XP Money
 *
 * Takes raw Leonardo.ai / generator outputs with transparent background and
 * produces brand-ready 512×512 WebP assets, consistent across all 6 stages.
 *
 * What it does (in order):
 *   1. Trim transparent padding (tight fit around character)
 *   2. Resize to fit 480×480 preserving aspect ratio
 *   3. Extend canvas to 512×512 with 16px transparent margin (safe area)
 *   4. Convert to WebP 88 % (target < 80 KB per asset)
 *
 * Assumes input is already background-removed PNG (use Leonardo Canvas
 * → Background Remover before dropping here).
 *
 * Input  : public/mascot/raw-clean/<voltix|penny>/<1..6>.png  (alpha-matted)
 * Output : public/mascot/<voltix|penny>/<stage>.webp
 *
 * Usage:
 *   node scripts/process-mascot.mjs voltix
 *   node scripts/process-mascot.mjs penny
 *   node scripts/process-mascot.mjs all
 */

import sharp from 'sharp'
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'
import { existsSync } from 'node:fs'

// ── Config ───────────────────────────────────────────────────────────────────
const CANVAS     = 512
const INNER      = 480            // character fits inside this box; 16 px margin
const PADDING    = (CANVAS - INNER) / 2
const WEBP_Q     = 88
const MAX_STAGES = 6
const GENDERS    = ['voltix', 'penny']

const c = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  bold:   '\x1b[1m',
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Process a single raw image into a brand-ready WebP.
 * @param {string} inputPath  - path to raw transparent PNG
 * @param {string} outputPath - path to output .webp
 * @returns {Promise<{kb: number, width: number, height: number}>}
 */
async function processOne(inputPath, outputPath) {
  const raw = await readFile(inputPath)

  // Quick sanity check: input must have alpha channel
  const meta = await sharp(raw).metadata()
  if (!meta.hasAlpha) {
    throw new Error(
      `input has no alpha channel — run through Leonardo Canvas → Background Remover first`,
    )
  }

  // 1a. Pre-process alpha: hard-clip low-alpha fringe pixels (halos left by
  //     imperfect background removal — typically alpha ~15–35) before any
  //     resize. We extract the alpha channel, threshold it to a crisp matte,
  //     then re-join so edges stay solid through the downscale.
  const cleanAlpha = await sharp(raw)
    .extractChannel('alpha')
    .threshold(40)                // alpha ≥40 → 255, else 0
    .toBuffer()
  const withCleanAlpha = await sharp(raw)
    .removeAlpha()
    .joinChannel(cleanAlpha)
    .png()
    .toBuffer()

  const buffer = await sharp(withCleanAlpha)
    // 1b. Tight trim around fully-opaque pixels (alpha now binary 0/255).
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
    // 2. Fit inside 480×480 preserving aspect, centered
    .resize(INNER, INNER, {
      fit:        'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel:     'lanczos3',      // highest-quality downscale
    })
    // 3. Extend with 16 px transparent margin → final 512×512
    .extend({
      top:        PADDING,
      bottom:     PADDING,
      left:       PADDING,
      right:      PADDING,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    // 4. Compress to WebP
    .webp({ quality: WEBP_Q, effort: 6, alphaQuality: 100 })
    .toBuffer()

  await writeFile(outputPath, buffer)
  return {
    kb:     +(buffer.length / 1024).toFixed(1),
    width:  CANVAS,
    height: CANVAS,
  }
}

async function processGender(gender) {
  // Prefer the alpha-matted `raw-clean` (output of remove-bg-mascots.mjs).
  // Fall back to `raw` so the script still works if the bg-removal pass
  // hasn't been run. `raw/` is likely to have opaque backgrounds and will
  // fail the hasAlpha check below — which is the correct loud failure mode.
  const rawCleanDir = join('public', 'mascot', 'raw-clean', gender)
  const rawDir = existsSync(rawCleanDir)
    ? rawCleanDir
    : join('public', 'mascot', 'raw', gender)
  const outDir = join('public', 'mascot', gender)

  if (!existsSync(rawDir)) {
    console.log(`${c.dim}[skip] ${gender}: no raw folder at ${rawDir}${c.reset}`)
    return { processed: 0, total: 0 }
  }

  await mkdir(outDir, { recursive: true })

  const files = (await readdir(rawDir))
    .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
    .sort()

  if (files.length === 0) {
    console.log(`${c.yellow}[empty] ${gender}: drop 1.png .. 6.png in ${rawDir}${c.reset}`)
    return { processed: 0, total: 0 }
  }

  console.log(`\n${c.bold}${c.cyan}━━ ${gender.toUpperCase()} ━━${c.reset}`)

  let ok = 0
  for (const file of files) {
    const stage = parseInt(basename(file, extname(file)), 10)
    if (isNaN(stage) || stage < 1 || stage > MAX_STAGES) {
      console.log(`  ${c.yellow}⊘ ${file} skipped (filename must be 1..${MAX_STAGES})${c.reset}`)
      continue
    }

    const inPath  = join(rawDir, file)
    const outPath = join(outDir, `${stage}.webp`)

    try {
      const { kb } = await processOne(inPath, outPath)
      const status = kb > 100
        ? `${c.yellow}(heavy: ${kb} KB)${c.reset}`
        : `${c.dim}${kb} KB${c.reset}`
      console.log(`  ${c.green}✓${c.reset} stage ${stage} → ${outPath} ${status}`)
      ok++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ${c.red}✗ stage ${stage} failed:${c.reset} ${msg}`)
    }
  }

  // Check for missing stages
  const present = new Set()
  for (const f of await readdir(outDir)) {
    const s = parseInt(basename(f, extname(f)), 10)
    if (!isNaN(s)) present.add(s)
  }
  const missing = []
  for (let s = 1; s <= MAX_STAGES; s++) if (!present.has(s)) missing.push(s)
  if (missing.length > 0) {
    console.log(
      `  ${c.yellow}⚠  missing stages: ${missing.join(', ')}${c.reset}`,
    )
  }

  return { processed: ok, total: files.length }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2]
  const targets =
    arg === 'all'           ? GENDERS :
    GENDERS.includes(arg)   ? [arg] :
                              null

  if (!targets) {
    console.log(`
${c.bold}XP Money — mascot asset pipeline${c.reset}

${c.dim}Usage:${c.reset}
  node scripts/process-mascot.mjs voltix
  node scripts/process-mascot.mjs penny
  node scripts/process-mascot.mjs all

${c.dim}Steps:${c.reset}
  1. Generate art on Leonardo.ai (6 stages per mascot)
  2. Open each in Canvas → Background Remover → Download PNG
  3. Rename to 1.png, 2.png, …, 6.png
  4. Drop into public/mascot/raw/voltix/ (or penny/)
  5. Run this script → outputs to public/mascot/voltix/*.webp
`)
    process.exit(arg ? 1 : 0)
  }

  const started = Date.now()
  let grand = { processed: 0, total: 0 }

  for (const g of targets) {
    const r = await processGender(g)
    grand.processed += r.processed
    grand.total     += r.total
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(
    `\n${c.bold}${c.green}done${c.reset} — ${grand.processed}/${grand.total} assets in ${secs}s\n`,
  )
}

main().catch(err => {
  console.error(`${c.red}fatal:${c.reset}`, err)
  process.exit(1)
})
