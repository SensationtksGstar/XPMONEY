import { auth }                  from '@clerk/nextjs/server'
import { notFound, redirect }   from 'next/navigation'
import { createSupabaseAdmin }  from '@/lib/supabase'
import { fetchTrafficStats }    from '@/lib/trafficStats'

/**
 * /admin/metrics — internal SaaS-metrics dashboard.
 *
 * Gating: same pattern as /admin/bugs — `ADMIN_CLERK_ID` env var. Anyone
 * else gets a 404 (the page "doesn't exist" for them).
 *
 * Defensive: every secondary query (subscriptions, ai_receipt_cache,
 * stripe_events, xp_progress) is wrapped in try/catch and surfaces inline
 * warnings instead of crashing — this admin page must never blank out
 * because a downstream migration hasn't been applied.
 *
 * Limitations baked into the math (documented in the UI footer too):
 *   - We can't distinguish monthly vs yearly subscribers from the DB
 *     (the `subscriptions` table has no `cycle` column). Everyone is
 *     treated as monthly → MRR is OVER-estimated when yearly users exist.
 *   - AI cost estimate is per-user ballpark; only the cache table is
 *     authoritative (and only for receipts, not statement parsing).
 *   - Churn uses current-premium as the denominator (we'd need a
 *     historical snapshot for "active 30d ago"). Under-estimates churn
 *     while the user base is growing.
 */

export const metadata = { title: 'Admin · Metrics' }
export const dynamic  = 'force-dynamic'

// ── Pricing & cost constants ────────────────────────────────────────────────
// We're under the Art. 53.º CIVA isenção regime — no IVA carved out of the
// €4,99. The price the customer pays IS our gross revenue. If we ever cross
// the €15k/year threshold and move to the standard regime, switch back to
// `VAT_RATE = 0.23` and `PRICE_NET_OF_VAT = PRICE_GROSS / (1 + VAT_RATE)`,
// and re-enable the "− IVA" line in the margin breakdown below.
const PRICE_GROSS_MONTHLY = 4.99
const PRICE_NET_OF_VAT    = PRICE_GROSS_MONTHLY  // no VAT under isenção
const STRIPE_FEE_PCT      = 0.015                // EU cards
const STRIPE_FEE_FIX      = 0.25
const STRIPE_FEE_PER_TX   = PRICE_NET_OF_VAT * STRIPE_FEE_PCT + STRIPE_FEE_FIX

// Per-user/month infra ballpark (Supabase Pro €25 / ~500 users +
// Clerk free tier + Vercel free tier). Refine when scaling.
const INFRA_COST_PER_USER  = 0.10
// Premium user AI usage average (5-10 scans + 0-1 statement per month)
const AI_COST_PER_PREMIUM  = 0.50
// Cost of a single receipt scan we'd otherwise have paid (for cache savings)
const AI_COST_PER_SCAN_EUR = 0.0005

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString('pt-PT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
function eur(n: number, decimals = 2): string { return `€${fmtNum(n, decimals)}` }
function pct(n: number, decimals = 1): string { return `${fmtNum(n * 100, decimals)}%` }

// ── Data loader ─────────────────────────────────────────────────────────────
interface MetricsBundle {
  totals:     { users: number; free: number; premium: number; activeSubs: number }
  growth:     { signups7d: number; signups30d: number }
  engagement: { tx7d: number; tx30d: number; dau7d: number; mau30d: number }
  ai:         { cacheEntries: number; cacheHits: number }
  aiCalls:    {
    total30d:        number
    success30d:      number
    error30d:        number
    timeout30d:      number
    quota30d:        number
    auth30d:         number
    avgLatencyMs:    number
    p95LatencyMs:    number
    tokensIn30d:     number
    tokensOut30d:    number
    estCostUsd30d:   number
    parseStatement:  number
    scanReceipt:     number
    cacheHitsLogged: number
    // Spend thermometer (last 1h / today / month-to-date) so the operator
    // can babysit Gemini billing in real time without opening the GCP
    // console. Cost values are in USD (Gemini bills USD).
    spendHourUsd:    number
    spendTodayUsd:   number
    spendMtdUsd:     number
    callsHour:       number
    callsToday:      number
  }
  merchantCache: {
    entries:     number
    trusted:     number   // validations >= 2 OR confidence >= 0.8
    seededLast7: number
  }
  stripe:     { events30d: number; cancellations30d: number; checkouts30d: number }
  warnings:   string[]
}

async function loadMetrics(): Promise<MetricsBundle> {
  const db   = createSupabaseAdmin()
  const warnings: string[] = []
  const now  = Date.now()
  const day  = 86_400_000
  const iso7  = new Date(now -  7 * day).toISOString()
  const iso30 = new Date(now - 30 * day).toISOString()

  const totals     = { users: 0, free: 0, premium: 0, activeSubs: 0 }
  const growth     = { signups7d: 0, signups30d: 0 }
  const engagement = { tx7d: 0, tx30d: 0, dau7d: 0, mau30d: 0 }
  const ai         = { cacheEntries: 0, cacheHits: 0 }
  const aiCalls    = {
    total30d:        0, success30d: 0, error30d: 0, timeout30d: 0, quota30d: 0, auth30d: 0,
    avgLatencyMs:    0, p95LatencyMs: 0,
    tokensIn30d:     0, tokensOut30d: 0, estCostUsd30d: 0,
    parseStatement:  0, scanReceipt: 0, cacheHitsLogged: 0,
    spendHourUsd: 0, spendTodayUsd: 0, spendMtdUsd: 0,
    callsHour: 0, callsToday: 0,
  }
  const merchantCache = { entries: 0, trusted: 0, seededLast7: 0 }
  const stripe     = { events30d: 0, cancellations30d: 0, checkouts30d: 0 }

  // Users — totals + plan split + signup velocity. The `users` table is
  // load-bearing; if this fails, the whole page is meaningless, so let it
  // throw rather than silently zeroing out.
  const { count: userCount } = await db
    .from('users').select('id', { count: 'exact', head: true })
  const { count: premiumCount } = await db
    .from('users').select('id', { count: 'exact', head: true }).eq('plan', 'premium')
  totals.users   = userCount    ?? 0
  totals.premium = premiumCount ?? 0
  totals.free    = totals.users - totals.premium

  const { count: c7 } = await db
    .from('users').select('id', { count: 'exact', head: true }).gte('created_at', iso7)
  const { count: c30 } = await db
    .from('users').select('id', { count: 'exact', head: true }).gte('created_at', iso30)
  growth.signups7d  = c7  ?? 0
  growth.signups30d = c30 ?? 0

  // Stripe-active subscription count — separate from `users.plan` because
  // webhook lag can make them temporarily disagree. Difference ≈ migration
  // friction or webhook outage.
  try {
    const { count } = await db
      .from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active')
    totals.activeSubs = count ?? 0
  } catch (err) {
    warnings.push(`subscriptions: ${err instanceof Error ? err.message : 'indisponível'}`)
  }

  // Engagement — transactions in window + DAU/MAU
  try {
    const { count: tx7 } = await db
      .from('transactions').select('id', { count: 'exact', head: true }).gte('created_at', iso7)
    const { count: tx30 } = await db
      .from('transactions').select('id', { count: 'exact', head: true }).gte('created_at', iso30)
    engagement.tx7d  = tx7  ?? 0
    engagement.tx30d = tx30 ?? 0
  } catch (err) {
    warnings.push(`transactions: ${err instanceof Error ? err.message : 'indisponível'}`)
  }

  // DAU/MAU via xp_progress.last_activity_at — bumped on every meaningful
  // interaction (not just transactions), so it's a closer "active user" proxy.
  try {
    const { count: dau } = await db
      .from('xp_progress').select('user_id', { count: 'exact', head: true })
      .gte('last_activity_at', iso7)
    const { count: mau } = await db
      .from('xp_progress').select('user_id', { count: 'exact', head: true })
      .gte('last_activity_at', iso30)
    engagement.dau7d  = dau ?? 0
    engagement.mau30d = mau ?? 0
  } catch (err) {
    warnings.push(`xp_progress: ${err instanceof Error ? err.message : 'indisponível'}`)
  }

  // AI cache stats — entries = receipts billed historically; sum of
  // hit_counts > entries = scans saved by serving from cache.
  try {
    const { count: entries } = await db
      .from('ai_receipt_cache').select('image_hash', { count: 'exact', head: true })
    const { data: rows } = await db
      .from('ai_receipt_cache').select('hit_count').limit(10_000)
    ai.cacheEntries = entries ?? 0
    // hit_count starts at 1 per row; subtract entries to get the "saved" count.
    const totalHits = (rows ?? []).reduce(
      (s, r) => s + ((r as { hit_count: number | null }).hit_count ?? 0), 0,
    )
    ai.cacheHits = Math.max(0, totalHits - ai.cacheEntries)
  } catch (err) {
    warnings.push(`ai_receipt_cache: ${err instanceof Error ? err.message : 'indisponível'}`)
  }

  // Stripe webhook events — health + churn proxy.
  try {
    const { data: events } = await db
      .from('stripe_events').select('event_type').gte('received_at', iso30).limit(10_000)
    const list = (events ?? []) as { event_type: string }[]
    stripe.events30d        = list.length
    stripe.cancellations30d = list.filter(e => e.event_type === 'customer.subscription.deleted').length
    stripe.checkouts30d     = list.filter(e => e.event_type === 'checkout.session.completed').length
  } catch (err) {
    warnings.push(`stripe_events: ${err instanceof Error ? err.message : 'indisponível'}`)
  }

  // AI cost log (ai_calls table — migration: database/ai_calls_2026_05.sql).
  // Pulls last 30d of provider invocations to compute cost, latency
  // distribution, success/error breakdown. Defensive: missing migration
  // produces a warning, page keeps rendering.
  try {
    const { data: calls } = await db
      .from('ai_calls')
      .select('model, status, latency_ms, tokens_in, tokens_out, operation, cache_hit, created_at')
      .gte('created_at', iso30)
      .limit(50_000)
    const list = (calls ?? []) as Array<{
      model: string; status: string; latency_ms: number;
      tokens_in: number; tokens_out: number; operation: string; cache_hit: boolean
      created_at: string
    }>
    aiCalls.total30d   = list.length
    aiCalls.success30d = list.filter(c => c.status === 'success').length
    aiCalls.error30d   = list.filter(c => c.status === 'error').length
    aiCalls.timeout30d = list.filter(c => c.status === 'timeout').length
    aiCalls.quota30d   = list.filter(c => c.status === 'quota').length
    aiCalls.auth30d    = list.filter(c => c.status === 'auth').length
    aiCalls.parseStatement = list.filter(c => c.operation === 'parse-statement').length
    aiCalls.scanReceipt    = list.filter(c => c.operation === 'scan-receipt').length
    aiCalls.cacheHitsLogged = list.filter(c => c.cache_hit).length

    // Latency p50 / p95 — only over successful, non-cache calls
    const realLatencies = list
      .filter(c => c.status === 'success' && !c.cache_hit && c.latency_ms > 0)
      .map(c => c.latency_ms)
      .sort((a, b) => a - b)
    if (realLatencies.length > 0) {
      const sum = realLatencies.reduce((s, v) => s + v, 0)
      aiCalls.avgLatencyMs = Math.round(sum / realLatencies.length)
      aiCalls.p95LatencyMs = realLatencies[Math.floor(realLatencies.length * 0.95)] ?? 0
    }

    // Token totals + estimated USD cost via the per-model price table in
    // src/lib/aiCostLog.ts. Inline mirror to avoid pulling the helper into
    // a server component.
    const PRICES: Record<string, { in: number; out: number }> = {
      'gemini-2.5-flash':         { in: 0.075, out: 0.30 },
      'gemini-2.5-flash-text':    { in: 0.075, out: 0.30 },
      'gemini-2.5-flash-vision':  { in: 0.075, out: 0.30 },
      'gemini-2.0-flash':         { in: 0.10,  out: 0.40 },
      'gemini-2.0-flash-text':    { in: 0.10,  out: 0.40 },
      'gemini-2.0-flash-vision':  { in: 0.10,  out: 0.40 },
      'llama-3.3-70b-versatile':  { in: 0.59,  out: 0.79 },
      'groq-vision':              { in: 0.34,  out: 0.34 },
      'cache':                    { in: 0,     out: 0 },
    }
    // Time-window thresholds for the spend thermometer. UTC throughout —
    // matches Postgres timestamptz semantics, no timezone surprises.
    const iso1h = new Date(now - 60 * 60 * 1000).toISOString()
    // Today = month-to-date "today" defined as last 24h; matches the
    // operator's intuition ("what did I spend in the last day") better
    // than a UTC-midnight reset (we serve a PT user, midnight UTC = 01:00
    // PT, would confuse).
    const isoToday = new Date(now - 24 * 60 * 60 * 1000).toISOString()

    for (const c of list) {
      aiCalls.tokensIn30d  += c.tokens_in  ?? 0
      aiCalls.tokensOut30d += c.tokens_out ?? 0
      const p = PRICES[c.model]
      const callCost = p
        ? (c.tokens_in  / 1_000_000) * p.in + (c.tokens_out / 1_000_000) * p.out
        : 0
      aiCalls.estCostUsd30d += callCost
      aiCalls.spendMtdUsd   += callCost

      if (c.created_at >= iso1h)  { aiCalls.spendHourUsd  += callCost; aiCalls.callsHour++  }
      if (c.created_at >= isoToday) { aiCalls.spendTodayUsd += callCost; aiCalls.callsToday++ }
    }
  } catch (err) {
    warnings.push(`ai_calls: ${err instanceof Error ? err.message : 'indisponível'}`)
  }

  // Merchant cache — entries + trust ratio.
  try {
    const { count: entries } = await db
      .from('merchant_categories').select('normalized_desc', { count: 'exact', head: true })
    const { data: trustedRows } = await db
      .from('merchant_categories')
      .select('normalized_desc')
      .or('validations.gte.2,confidence.gte.0.8')
      .limit(50_000)
    const { count: seeded } = await db
      .from('merchant_categories')
      .select('normalized_desc', { count: 'exact', head: true })
      .gte('created_at', iso7)

    merchantCache.entries     = entries ?? 0
    merchantCache.trusted     = (trustedRows ?? []).length
    merchantCache.seededLast7 = seeded ?? 0
  } catch (err) {
    warnings.push(`merchant_categories: ${err instanceof Error ? err.message : 'indisponível'}`)
  }

  return { totals, growth, engagement, ai, aiCalls, merchantCache, stripe, warnings }
}

// ── Page ────────────────────────────────────────────────────────────────────
export default async function AdminMetricsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!process.env.ADMIN_CLERK_ID || userId !== process.env.ADMIN_CLERK_ID) notFound()

  // Traffic (PostHog) + business metrics (Supabase) are independent — parallel.
  const [m, traffic] = await Promise.all([loadMetrics(), fetchTrafficStats()])

  // ── Derived metrics ──
  // Under Art. 53.º CIVA isenção: PRICE_NET_OF_VAT === PRICE_GROSS_MONTHLY.
  // MRR is the full €4,99 per Premium user; no IVA portion to carve out.
  const mrr  = m.totals.premium * PRICE_NET_OF_VAT
  const arr  = mrr * 12
  const arpu = m.totals.premium > 0 ? PRICE_NET_OF_VAT : 0
  const conversionRate = m.totals.users > 0 ? m.totals.premium / m.totals.users : 0

  // Margin (monthly)
  const grossRevenue  = m.totals.premium * PRICE_GROSS_MONTHLY
  const stripeFees    = m.totals.premium * STRIPE_FEE_PER_TX
  const aiCost        = m.totals.premium * AI_COST_PER_PREMIUM
  const infraCost     = m.totals.users * INFRA_COST_PER_USER
  const netMargin     = mrr - stripeFees - aiCost - infraCost
  const grossMarginPct = mrr > 0 ? netMargin / mrr : 0

  // AI cache savings
  const aiCostSaved  = m.ai.cacheHits * AI_COST_PER_SCAN_EUR
  const cacheHitRate = m.ai.cacheEntries + m.ai.cacheHits > 0
    ? m.ai.cacheHits / (m.ai.cacheEntries + m.ai.cacheHits)
    : 0

  // Churn — see file-header note about why this is approximate
  const churn30d = m.totals.premium > 0
    ? m.stripe.cancellations30d / m.totals.premium
    : 0

  // Stickiness DAU/MAU
  const stickiness = m.engagement.mau30d > 0
    ? m.engagement.dau7d / m.engagement.mau30d
    : 0

  // Subscription drift — when this is non-zero, webhooks are out of sync
  const subDrift = m.totals.premium - m.totals.activeSubs

  return (
    <main className="min-h-screen bg-surface-0 text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Métricas</h1>
            <p className="text-white/50 text-sm mt-0.5">
              Snapshot · {new Date().toLocaleString('pt-PT', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <a href="/admin/setup" className="text-white/60 hover:text-white">Setup →</a>
            <a href="/admin/bugs"  className="text-white/60 hover:text-white">Bugs →</a>
            <a href="/dashboard"   className="text-white/60 hover:text-white">← Dashboard</a>
          </div>
        </header>

        {m.warnings.length > 0 && (
          <section className="bg-orange-500/5 border border-orange-500/30 rounded-xl p-4">
            <h2 className="font-semibold text-orange-300 text-sm mb-1.5">
              ⚙ Tabelas em falta ou indisponíveis
            </h2>
            <ul className="text-xs text-white/70 space-y-0.5 font-mono">
              {m.warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
            <p className="text-[11px] text-white/50 mt-2">
              Estas secções aparecerão a zero. Aplica as migrações em <code>database/*.sql</code> via Supabase SQL Editor.
            </p>
          </section>
        )}

        {/* ── AI Spend thermometer (operator anxiety relief) ──
            Top-of-page glance at how much Gemini billing we've consumed
            in the last hour, last 24h, and the last 30d. Colour shifts
            from emerald → amber → red as the today figure approaches
            warning thresholds. Pure estimate from local PRICING_USD_
            PER_M — accurate within ~5 % for Gemini Flash; cross-check
            against Google Cloud billing weekly. */}
        {(() => {
          // Thresholds (USD). Easy to tune as confidence grows.
          const WARN_TODAY  = 1.0
          const ALERT_TODAY = 5.0

          const todayUsd = m.aiCalls.spendTodayUsd
          const tier =
            todayUsd >= ALERT_TODAY ? 'alert'
              : todayUsd >= WARN_TODAY ? 'warn'
              : 'ok'

          const tone = {
            ok:    { ring: 'border-emerald-500/30 bg-emerald-500/5',  text: 'text-emerald-300', dot: 'bg-emerald-400' },
            warn:  { ring: 'border-amber-500/40  bg-amber-500/8',     text: 'text-amber-300',   dot: 'bg-amber-400'   },
            alert: { ring: 'border-red-500/50    bg-red-500/10',      text: 'text-red-300',     dot: 'bg-red-400'     },
          }[tier]

          return (
            <section className={`${tone.ring} border rounded-xl p-4`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${tone.dot} animate-pulse`} />
                  <h2 className={`font-semibold text-sm ${tone.text}`}>
                    AI spend (Gemini estimado)
                  </h2>
                </div>
                <a
                  href="https://console.cloud.google.com/billing/budgets"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-white/50 hover:text-white"
                >
                  Google Cloud Billing →
                </a>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40">Última hora</p>
                  <p className="text-lg font-bold font-mono">${m.aiCalls.spendHourUsd.toFixed(4)}</p>
                  <p className="text-[11px] text-white/40">{m.aiCalls.callsHour} calls</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40">Últimas 24h</p>
                  <p className={`text-lg font-bold font-mono ${tone.text}`}>${todayUsd.toFixed(4)}</p>
                  <p className="text-[11px] text-white/40">{m.aiCalls.callsToday} calls</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40">Últimos 30d</p>
                  <p className="text-lg font-bold font-mono">${m.aiCalls.spendMtdUsd.toFixed(4)}</p>
                  <p className="text-[11px] text-white/40">{m.aiCalls.total30d} calls</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40">Projecção mês</p>
                  <p className="text-lg font-bold font-mono text-white/80">${(todayUsd * 30).toFixed(2)}</p>
                  <p className="text-[11px] text-white/40">se ritmo de hoje mantiver</p>
                </div>
              </div>
              <p className="text-[11px] text-white/40 mt-3 leading-relaxed">
                Estimativa local a partir da tabela <code>ai_calls</code> × <code>PRICING_USD_PER_M</code>. Tipicamente dentro de ~5 % do real para Gemini Flash (autoridade é a factura Google Cloud). Verde abaixo de ${WARN_TODAY}/dia · amarelo ≥ ${WARN_TODAY} · vermelho ≥ ${ALERT_TODAY}. Hard caps no app: 2/h + 5/dia + 30/mês por user (import-statement), 10/h + 30/dia + 100/mês (scan-receipt).
              </p>
            </section>
          )
        })()}

        {/* ── Top KPIs ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="MRR"      value={eur(mrr)}      hint="receita mensal recorrente (regime isenção, sem IVA)" />
          <KpiCard label="ARR"      value={eur(arr)}      hint="MRR × 12" />
          <KpiCard label="ARPU"     value={eur(arpu)}     hint="receita por user pago" />
          <KpiCard label="Conversão" value={pct(conversionRate)} hint={`${m.totals.premium} / ${m.totals.users} users`} />
        </section>

        {/* ── Tráfego & aquisição ──
            Duas fontes com papéis diferentes:
            · Vercel Web Analytics — TODOS os visitantes (cookieless, sem
              consentimento necessário) = o número autoritativo. Sem API de
              leitura → link para o dashboard.
            · PostHog — só visitantes que ACEITARAM cookies (consent-gated)
              = amostra para comportamento (páginas, referrers), nunca o
              total. Aparece quando POSTHOG_PERSONAL_API_KEY +
              POSTHOG_PROJECT_ID estão definidos. */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-semibold text-white/90">🌐 Tráfego & aquisição</h2>
            <a
              href="https://vercel.com/sensationtksgstars-projects/xp-money/analytics"
              target="_blank"
              rel="noreferrer"
              className="text-xs bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg px-3 py-1.5 font-semibold"
            >
              Visitantes totais → Vercel Analytics ↗
            </a>
          </div>

          {!traffic.configured ? (
            <p className="text-xs text-white/50 leading-relaxed">
              {traffic.reason} A chave é um <em>personal API key</em> do PostHog
              (Settings → Personal API Keys, scope <code>Query Read</code>);
              o project id numérico está em Settings → Project.
            </p>
          ) : traffic.reason ? (
            <p className="text-xs text-orange-300/90 leading-relaxed">{traffic.reason}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <KpiCard label="Visitantes 7d"  value={fmtNum(traffic.visitors7d)}   hint="PostHog — amostra consentida" />
                <KpiCard label="Visitantes 30d" value={fmtNum(traffic.visitors30d)}  hint="PostHog — amostra consentida" />
                <KpiCard label="Pageviews 7d"   value={fmtNum(traffic.pageviews7d)}  hint="PostHog — amostra consentida" />
                <KpiCard label="Pageviews 30d"  value={fmtNum(traffic.pageviews30d)} hint="PostHog — amostra consentida" />
              </div>
              <div className="grid lg:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/40 mb-1.5">Top páginas (30d)</p>
                  <div className="space-y-1">
                    {traffic.topPages.length === 0 && <p className="text-xs text-white/40">sem dados ainda</p>}
                    {traffic.topPages.map(p => (
                      <Row key={p.path} label={p.path} value={fmtNum(p.views)} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/40 mb-1.5">Referrers (30d)</p>
                  <div className="space-y-1">
                    {traffic.referrers.length === 0 && <p className="text-xs text-white/40">sem dados ainda (ou tudo direto)</p>}
                    {traffic.referrers.map(r => (
                      <Row key={r.domain} label={r.domain} value={fmtNum(r.visitors)} />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Quick links — os dashboards externos que compõem o cockpit. */}
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
            <ExtLink href="https://vercel.com/sensationtksgstars-projects/xp-money/analytics" label="Vercel Analytics" />
            <ExtLink href="https://vercel.com/sensationtksgstars-projects/xp-money/speed-insights" label="Speed Insights" />
            <ExtLink href="https://eu.posthog.com" label="PostHog" />
            <ExtLink href="https://search.google.com/search-console" label="Search Console" />
            <ExtLink href="https://www.bing.com/webmasters" label="Bing Webmaster" />
            <ExtLink href="https://dashboard.stripe.com" label="Stripe" />
          </div>
        </section>

        {/* ── Crescimento ── */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="font-semibold mb-3 text-white/90">Crescimento</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label="Total users"   value={fmtNum(m.totals.users)} />
            <Row label="Free"          value={fmtNum(m.totals.free)} />
            <Row label="Premium"       value={fmtNum(m.totals.premium)} />
            <Row label="Subs Stripe activas" value={fmtNum(m.totals.activeSubs)} />
            <Row label="Signups 7 dias"  value={fmtNum(m.growth.signups7d)} />
            <Row label="Signups 30 dias" value={fmtNum(m.growth.signups30d)} />
            {subDrift !== 0 && (
              <Row
                label="⚠ Drift users.plan vs Stripe"
                value={String(subDrift)}
                accent="orange"
              />
            )}
          </div>
        </section>

        {/* ── Receita & Margem ── */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="font-semibold mb-3 text-white/90">
            Receita & margem (mês actual, estimativa)
          </h2>
          <div className="space-y-1.5 text-sm font-mono">
            <Line label="Receita bruta (mensal)"      value={`+${eur(grossRevenue)}`} />
            <Line label="− Stripe fees (1,5% + €0,25)" value={`−${eur(stripeFees)}`}    muted />
            <Line label="− AI estimado (≈€0,50/Premium)" value={`−${eur(aiCost)}`}      muted />
            <Line label="− Infra (Supabase + Clerk + Vercel rateado)" value={`−${eur(infraCost)}`} muted />
            <div className="border-t border-white/10 mt-2 pt-2">
              <Line label="Margem líquida"    value={eur(netMargin)} bold />
              <Line label="Margem bruta (% MRR)" value={pct(grossMarginPct)} bold />
            </div>
          </div>
          <p className="text-[11px] text-white/40 mt-3 leading-relaxed">
            Regime de isenção de IVA Art. 53.º CIVA — €4,99 é receita bruta inteira, sem IVA a entregar. Limiar: €15.000/ano facturado (≈250 Premium ano-todo) → passa a regime normal.
            <br />Assume todos os Premium em ciclo mensal. Subscritores anuais (€39,99/ano) são contabilizados como €4,99/mês — sobre-estima MRR. Adicionar coluna <code>cycle</code> a <code>subscriptions</code> resolve.
          </p>
        </section>

        {/* ── AI cache ── */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="font-semibold mb-3 text-white/90">AI receipt cache (poupança)</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label="Entries no cache"  value={fmtNum(m.ai.cacheEntries)} />
            <Row label="Hits servidos"     value={fmtNum(m.ai.cacheHits)} />
            <Row label="Hit rate"          value={pct(cacheHitRate)} />
            <Row label="Custo poupado est." value={eur(aiCostSaved, 4)} />
          </div>
          <p className="text-[11px] text-white/40 mt-3">
            Só conta scans de recibos. Parsing de extratos não é cacheado — não está incluído.
          </p>
        </section>

        {/* ── AI calls observability (30d) ── */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="font-semibold mb-3 text-white/90">
            AI calls — últimos 30 dias
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label="Total chamadas"     value={fmtNum(m.aiCalls.total30d)} />
            <Row label="Sucesso"            value={fmtNum(m.aiCalls.success30d)} />
            <Row label="Cache hits servidos" value={fmtNum(m.aiCalls.cacheHitsLogged)} />
            <Row label="Custo USD estimado" value={`$${m.aiCalls.estCostUsd30d.toFixed(4)}`} />

            <Row label="parse-statement"    value={fmtNum(m.aiCalls.parseStatement)} />
            <Row label="scan-receipt"       value={fmtNum(m.aiCalls.scanReceipt)} />
            <Row label="Latência média"     value={`${fmtNum(m.aiCalls.avgLatencyMs)} ms`} />
            <Row label="Latência p95"       value={`${fmtNum(m.aiCalls.p95LatencyMs)} ms`} />

            <Row label="Tokens IN"          value={fmtNum(m.aiCalls.tokensIn30d)} />
            <Row label="Tokens OUT"         value={fmtNum(m.aiCalls.tokensOut30d)} />
            <Row label="Erros"              value={fmtNum(m.aiCalls.error30d + m.aiCalls.timeout30d + m.aiCalls.quota30d + m.aiCalls.auth30d)} />
            <Row
              label="Quota / Auth"
              value={`${m.aiCalls.quota30d} / ${m.aiCalls.auth30d}`}
              accent={m.aiCalls.quota30d + m.aiCalls.auth30d > 0 ? 'orange' : undefined}
            />
          </div>
          <p className="text-[11px] text-white/40 mt-3 leading-relaxed">
            Observabilidade real por chamada (tabela <code>ai_calls</code>) — preço estimado pelo modelo. Latência é só sucessos não-cache. Aplica <code>database/ai_calls_2026_05.sql</code> no Supabase para activar.
          </p>
        </section>

        {/* ── Merchant cache ── */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="font-semibold mb-3 text-white/90">
            Merchant cache (categorização global)
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label="Entries totais"      value={fmtNum(m.merchantCache.entries)} />
            <Row label="Entries trusted"     value={fmtNum(m.merchantCache.trusted)} hint="validations ≥ 2 OU confidence ≥ 0,8" />
            <Row label="Trust ratio"         value={
              m.merchantCache.entries > 0
                ? pct(m.merchantCache.trusted / m.merchantCache.entries)
                : '—'
            } />
            <Row label="Seeded últimos 7d"   value={fmtNum(m.merchantCache.seededLast7)} />
          </div>
          <p className="text-[11px] text-white/40 mt-3 leading-relaxed">
            Categorias confirmadas pelos users na preview de import são guardadas globalmente (privacy-allowlisted — não armazena transferências pessoais). Próximo user com a mesma descrição já vê a categoria correcta sem chamar IA. Aplica <code>database/merchant_categories_2026_05.sql</code>.
          </p>
        </section>

        {/* ── Engagement ── */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="font-semibold mb-3 text-white/90">Engagement</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label="Transações 7d"  value={fmtNum(m.engagement.tx7d)} />
            <Row label="Transações 30d" value={fmtNum(m.engagement.tx30d)} />
            <Row label="DAU (7d)"       value={fmtNum(m.engagement.dau7d)} />
            <Row label="MAU (30d)"      value={fmtNum(m.engagement.mau30d)} />
            <Row label="Stickiness"     value={pct(stickiness)} hint="DAU / MAU — saudável > 20%" />
          </div>
        </section>

        {/* ── Stripe & churn ── */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="font-semibold mb-3 text-white/90">Stripe webhooks & churn</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
            <Row label="Eventos 30d"           value={fmtNum(m.stripe.events30d)} />
            <Row label="Checkouts completos"   value={fmtNum(m.stripe.checkouts30d)} />
            <Row label="Cancelamentos 30d"     value={fmtNum(m.stripe.cancellations30d)} />
            <Row label="Churn estimado"        value={pct(churn30d)} hint="canc. ÷ Premium actual" />
          </div>
          {m.totals.premium > 0 && churn30d === 0 && m.stripe.cancellations30d === 0 && (
            <p className="text-[11px] text-emerald-400/80 mt-3">
              ✓ Zero cancelamentos nos últimos 30 dias.
            </p>
          )}
        </section>

        {/* ── Pendente / aguarda dados ── */}
        <section className="bg-white/[0.02] border border-dashed border-white/10 rounded-xl p-5">
          <h2 className="font-semibold mb-2 text-white/60 text-sm">
            Sem dados suficientes ainda
          </h2>
          <ul className="text-sm text-white/50 space-y-1">
            <li>• <strong>CAC</strong> — precisa de input manual de gasto em marketing (a adicionar)</li>
            <li>• <strong>LTV</strong> — fórmula = ARPU ÷ churn; precisa ≥3 meses de churn estável</li>
            <li>• <strong>NRR</strong> — só faz sentido com tier Premium+ ou upgrades intra-plano</li>
            <li>• <strong>Rule of 40</strong> — soma crescimento MoM + margem; calculável daqui a 60 dias</li>
            <li>• <strong>Burn rate</strong> — precisa input manual de custos fixos</li>
          </ul>
        </section>
      </div>
    </main>
  )
}

// ── Tiny presentational helpers ─────────────────────────────────────────────
function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 text-white/70 hover:text-white"
    >
      {label} ↗
    </a>
  )
}

function KpiCard(
  { label, value, hint }: { label: string; value: string; hint?: string },
) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-xs uppercase tracking-wider text-white/40">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-white/40 mt-0.5">{hint}</p>}
    </div>
  )
}

function Row(
  { label, value, hint, accent }:
  { label: string; value: string; hint?: string; accent?: 'orange' },
) {
  return (
    <div className="flex justify-between items-baseline gap-3 min-w-0">
      <span className="text-white/60 truncate">{label}</span>
      <span className={
        'font-semibold tabular-nums shrink-0 ' +
        (accent === 'orange' ? 'text-orange-300' : 'text-white')
      }>
        {value}
        {hint && <span className="block text-[11px] text-white/40 font-normal text-right">{hint}</span>}
      </span>
    </div>
  )
}

function Line(
  { label, value, muted, bold }:
  { label: string; value: string; muted?: boolean; bold?: boolean },
) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className={muted ? 'text-white/40' : bold ? 'text-white' : 'text-white/70'}>
        {label}
      </span>
      <span className={
        'tabular-nums shrink-0 ' +
        (muted ? 'text-white/40' : bold ? 'text-white font-bold' : 'text-white')
      }>{value}</span>
    </div>
  )
}
