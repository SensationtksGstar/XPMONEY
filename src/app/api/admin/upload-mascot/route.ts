/**
 * Admin upload endpoint — drops a mascot asset on disk and immediately runs
 * the sharp pipeline so the app starts serving it from /mascot/<gender>/<n>.webp
 * on the next page load.
 *
 * DEV-ONLY. Writes to `public/` which is read-only on Vercel serverless, so
 * we refuse to run in production. Flow for the user:
 *
 *   1. Generate 11 mascot renders on Leonardo.ai (prompts in docs)
 *   2. Drag them into /admin/mascot-upload
 *   3. Commit the resulting files in public/mascot/ + public/mascot/raw/
 *
 * Request: multipart/form-data
 *   gender : 'voltix' | 'penny'
 *   evo    : '1'..'6'
 *   file   : image/png | image/jpeg | image/webp (ideally with alpha channel)
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync }       from 'node:fs'
import { join }             from 'node:path'
import sharp                from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 30

const CANVAS    = 512
const INNER     = 480
const PADDING   = (CANVAS - INNER) / 2
const WEBP_Q    = 88

function isValidGender(g: string): g is 'voltix' | 'penny' {
  return g === 'voltix' || g === 'penny'
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Upload disabled in production — run this locally, commit assets to git.' },
      { status: 403 },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'multipart/form-data expected' }, { status: 400 })
  }

  const gender = String(form.get('gender') ?? '')
  const evoRaw = String(form.get('evo') ?? '')
  const file   = form.get('file')

  if (!isValidGender(gender)) {
    return NextResponse.json({ error: 'gender must be "voltix" or "penny"' }, { status: 400 })
  }
  const evo = Number.parseInt(evoRaw, 10)
  if (!Number.isFinite(evo) || evo < 1 || evo > 6) {
    return NextResponse.json({ error: 'evo must be 1..6' }, { status: 400 })
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'file missing' }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'file too large (max 20 MB)' }, { status: 413 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())

  // Paths
  const pub = join(process.cwd(), 'public')
  const rawDir = join(pub, 'mascot', 'raw', gender)
  const outDir = join(pub, 'mascot', gender)
  if (!existsSync(rawDir)) await mkdir(rawDir, { recursive: true })
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true })

  // 1. Save the raw input as-is
  const rawExt  = file.type === 'image/jpeg' ? 'jpg'
                : file.type === 'image/webp' ? 'webp'
                : 'png'
  const rawPath = join(rawDir, `${evo}.${rawExt}`)
  await writeFile(rawPath, bytes)

  // 2. Process with sharp → trim → fit 480×480 → extend to 512×512 → webp
  let outKb = 0
  let hadAlpha = true
  try {
    const meta = await sharp(bytes).metadata()
    hadAlpha = !!meta.hasAlpha

    const processed = await sharp(bytes)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
      .resize(INNER, INNER, {
        fit:        'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel:     'lanczos3',
      })
      .extend({
        top: PADDING, bottom: PADDING, left: PADDING, right: PADDING,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: WEBP_Q, effort: 6, alphaQuality: 100 })
      .toBuffer()

    const outPath = join(outDir, `${evo}.webp`)
    await writeFile(outPath, processed)
    outKb = +(processed.length / 1024).toFixed(1)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      error: 'sharp pipeline failed',
      detail: msg,
      saved_raw: `/mascot/raw/${gender}/${evo}.${rawExt}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    gender,
    evo,
    raw:      `/mascot/raw/${gender}/${evo}.${rawExt}`,
    webp:     `/mascot/${gender}/${evo}.webp`,
    size_kb:  outKb,
    had_alpha: hadAlpha,
    warning:  hadAlpha ? null
      : 'Input has no alpha channel — remove background first (Leonardo Canvas → Background Remover)',
  })
}
