import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual }           from 'node:crypto'
import { stripe }                    from '@/lib/stripe'
import { notifyAdmin, escapeHtml }   from '@/lib/email'
import { getAllSlugs }               from '@/lib/blog'

// =============================================================================
//  Vigia — daily production watchdog (Vercel Cron, 07:00 UTC, vercel.json)
// =============================================================================
//
//  Every serious incident in this project was found weeks or months late:
//  the whole blog 307→/sign-in for crawlers, the Stripe webhook endpoint
//  auto-disabled (no events delivered), RESEND_API_KEY present but EMPTY,
//  the Clerk dev instance in production. This route re-checks those once a
//  day and emails the admin (notifyAdmin — no-op when Resend is missing)
//  when anything fails, cutting time-to-detect to < 24 h.
//
//  Auth: Bearer CRON_SECRET (same pattern as /api/notifications/send).
//  Public in the middleware via '/api/cron/(.*)' — this route authenticates
//  itself.
//
//  NEVER logs or returns env VALUES — only presence / length / kind.
// =============================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SITE_URL   = (process.env.VIGIA_SITE_URL ?? 'https://xp-money.com').replace(/\/+$/, '')
const SITE_HOST  = new URL(SITE_URL).host
const TIMEOUT_MS = 8_000
const CRAWLER_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

interface Check { name: string; ok: boolean; detail: string }

function authorised(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  // Refuse undefined/empty/short secrets: an empty secret compared with
  // "Bearer " would turn the endpoint public.
  if (!cronSecret || cronSecret.length < 20) return false
  const a = Buffer.from(req.headers.get('authorization') ?? '')
  const b = Buffer.from(`Bearer ${cronSecret}`)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** fetch with an 8 s AbortController timeout, never following redirects
 *  (a 307→/sign-in must FAIL the check, not be followed to a 200). */
async function probe(path: string): Promise<Response> {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(SITE_URL + path, {
      redirect: 'manual',
      cache:    'no-store',
      signal:   ctrl.signal,
      headers:  { 'User-Agent': CRAWLER_UA, Accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
    })
  } finally {
    clearTimeout(timer)
  }
}

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: timeout ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    p.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Last x-vercel-id seen on a probe response (for the region check). */
let lastVercelId = ''

async function expectStatus(name: string, path: string, expected: number): Promise<Check> {
  const res = await probe(path)
  const vid = res.headers.get('x-vercel-id')
  if (vid) lastVercelId = vid
  // Drain the body so the socket is released.
  await res.arrayBuffer().catch((err: unknown) => {
    console.warn('[vigia] body drain failed:', path, errMsg(err))
  })
  const loc = res.headers.get('location')
  return {
    name,
    ok:     res.status === expected,
    detail: `${path} → ${res.status}${loc ? ` (location: ${loc})` : ''}${res.status === expected ? '' : ` — esperado ${expected}`}`,
  }
}

/** OG image of a public share page: 200 + image/png (a 307 or an HTML error
 *  page means WhatsApp/Facebook previews silently break). */
async function expectPng(name: string, path: string): Promise<Check> {
  const res = await probe(path)
  await res.arrayBuffer().catch((err: unknown) => {
    console.warn('[vigia] body drain failed:', path, errMsg(err))
  })
  const type = res.headers.get('content-type') ?? ''
  const ok   = res.status === 200 && type.startsWith('image/png')
  return { name, ok, detail: `${path} → ${res.status} ${type || '(sem content-type)'}${ok ? '' : ' — esperado 200 image/png'}` }
}

/** First blog slug: from the filesystem when it's bundled into this lambda,
 *  else parsed from the live sitemap (content/ may not be traced here). */
async function firstBlogSlug(): Promise<string | null> {
  try {
    const slugs = getAllSlugs()
    if (slugs.length > 0) return slugs[0]
  } catch (err) {
    console.warn('[vigia] getAllSlugs failed, falling back to sitemap:', errMsg(err))
  }
  const res  = await probe('/sitemap.xml')
  const xml  = await res.text()
  const m    = xml.match(/<loc>[^<]*\/blog\/([^<\/]+)<\/loc>/)
  return m ? decodeURIComponent(m[1]) : null
}

async function checkBlogArticle(): Promise<Check> {
  const slug = await firstBlogSlug()
  if (!slug) return { name: 'crawler:/blog/<artigo>', ok: false, detail: 'nenhum artigo encontrado (fs nem sitemap)' }
  return expectStatus('crawler:/blog/<artigo>', `/blog/${encodeURIComponent(slug)}`, 200)
}

function checkClerkLive(): Check {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  const kind = !pk ? 'ausente' : pk.startsWith('pk_live_') ? 'live' : 'NÃO live (instância de desenvolvimento)'
  return { name: 'clerk:production-instance', ok: pk.startsWith('pk_live_'), detail: `publishable key: ${kind}` }
}

function checkRegion(): Check {
  const region = process.env.VERCEL_REGION ?? ''
  const ok = region ? region === 'fra1' : lastVercelId.includes('fra1')
  return {
    name:   'vercel:region-fra1',
    ok,
    detail: `VERCEL_REGION=${region || '(n/d)'} · x-vercel-id=${lastVercelId || '(n/d)'}`,
  }
}

async function checkStripeWebhook(): Promise<Check> {
  const name = 'stripe:webhook-endpoint'
  const key  = process.env.STRIPE_SECRET_KEY ?? ''
  if (!key || key.includes('placeholder')) {
    return { name, ok: false, detail: 'STRIPE_SECRET_KEY não configurada — check não executado' }
  }
  const list = await withTimeout(
    stripe.webhookEndpoints.list({ limit: 10 }, { timeout: TIMEOUT_MS }),
    'stripe.webhookEndpoints.list',
  )
  const ours = list.data.filter(ep => {
    try {
      const host = new URL(ep.url).host
      return host === SITE_HOST || host.endsWith(`.${SITE_HOST}`)
    } catch { return false }
  })
  const disabled = ours.filter(ep => ep.status === 'disabled')
  const enabled  = ours.filter(ep => ep.status === 'enabled')
  const ok = disabled.length === 0 && enabled.length > 0
  return {
    name,
    ok,
    detail: `${SITE_HOST}: ${enabled.length} enabled, ${disabled.length} disabled`
      + (disabled.length ? ` (${disabled.map(ep => ep.id).join(', ')})` : '')
      + (enabled.length === 0 ? ' — nenhum endpoint ativo: nenhum evento é entregue' : ''),
  }
}

function checkResend(): Check {
  const len = (process.env.RESEND_API_KEY ?? '').trim().length
  return {
    name:   'env:RESEND_API_KEY',
    ok:     len > 0,
    detail: len > 0 ? `presente (${len} chars)` : 'ausente ou VAZIA — emails não saem',
  }
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  lastVercelId = ''

  const pages = ['/', '/blog', '/termos', '/sitemap.xml', '/robots.txt', '/ads.txt']
  const tasks: Array<{ name: string; run: () => Promise<Check> }> = [
    ...pages.map(p => ({ name: `crawler:${p}`, run: () => expectStatus(`crawler:${p}`, p, 200) })),
    { name: 'crawler:/blog/<artigo>', run: checkBlogArticle },
    { name: 'http:404', run: () => expectStatus('http:404', `/vigia-${Date.now()}`, 404) },
    // Partilha pública (/p/*): conjuntos fechados → 200 dentro, 404 fora.
    { name: 'share:/p/evo/voltix-3', run: () => expectStatus('share:/p/evo/voltix-3', '/p/evo/voltix-3', 200) },
    { name: 'share:/p/streak/7',     run: () => expectStatus('share:/p/streak/7', '/p/streak/7', 200) },
    { name: 'share:/p/streak/8',     run: () => expectStatus('share:/p/streak/8', '/p/streak/8', 404) },
    { name: 'share:/p/streak/7/og',  run: () => expectPng('share:/p/streak/7/og', '/p/streak/7/opengraph-image') },
    { name: 'stripe:webhook-endpoint', run: checkStripeWebhook },
  ]

  const settled = await Promise.allSettled(tasks.map(t => t.run()))
  const checks: Check[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: tasks[i].name, ok: false, detail: `erro: ${errMsg(r.reason)}` },
  )
  // Sync checks (region runs after the probes so it can read x-vercel-id).
  checks.push(checkClerkLive(), checkRegion(), checkResend())

  const failed = checks.filter(c => !c.ok)
  const ok     = failed.length === 0

  let alerted = false
  if (!ok) {
    console.warn('[vigia] checks failed:', failed.map(c => c.name).join(', '))
    const rows = checks.map(c =>
      `<li><strong>${c.ok ? 'OK' : 'FALHOU'}</strong> · ${escapeHtml(c.name)} — ${escapeHtml(c.detail)}</li>`,
    ).join('')
    const res = await notifyAdmin({
      subject: failed.length === 1 ? '[vigia] 1 check falhou' : `[vigia] ${failed.length} checks falharam`,
      html:    `<p>Vigia diário de ${escapeHtml(SITE_URL)} — ${failed.length}/${checks.length} checks falharam.</p><ul>${rows}</ul>`,
    })
    alerted = res.ok
    if (!res.ok) console.warn('[vigia] admin alert not sent:', res.reason)
  }

  return NextResponse.json({ ok, alerted, checks })
}
