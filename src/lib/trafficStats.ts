import 'server-only'

/**
 * trafficStats — pull headline traffic numbers from PostHog's HogQL query
 * API for the /admin/metrics dashboard.
 *
 * IMPORTANT CAVEAT baked into every label that renders these numbers:
 * PostHog only sees visitors who ACCEPTED the cookie banner (PostHogProvider
 * is consent-gated per RGPD). It is a *consented sample*, not total traffic.
 * The authoritative all-visitors count is Vercel Web Analytics (cookieless,
 * no consent needed) — linked from the dashboard, no read API.
 *
 * Configuration (both optional — the section degrades to a setup hint):
 *   POSTHOG_PERSONAL_API_KEY  — personal API key (Settings → Personal API
 *                               keys, scope: Query read). Server-only env,
 *                               NEVER NEXT_PUBLIC_.
 *   POSTHOG_PROJECT_ID        — numeric project id (Settings → Project).
 *
 * The query host differs from the ingestion host: events go to
 * eu.i.posthog.com, queries go to eu.posthog.com — hence the '.i.' strip.
 */

export interface TrafficStats {
  configured: boolean
  /** Human-readable reason when unconfigured or the fetch failed. */
  reason?:    string
  visitors7d:   number
  visitors30d:  number
  pageviews7d:  number
  pageviews30d: number
  topPages:  Array<{ path: string; views: number }>
  referrers: Array<{ domain: string; visitors: number }>
}

const EMPTY: Omit<TrafficStats, 'configured' | 'reason'> = {
  visitors7d: 0, visitors30d: 0, pageviews7d: 0, pageviews30d: 0,
  topPages: [], referrers: [],
}

function apiHost(): string {
  const ingest = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com'
  return ingest.replace('//eu.i.', '//eu.').replace('//us.i.', '//us.')
}

async function hogql(query: string): Promise<unknown[][]> {
  const key       = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  const res = await fetch(`${apiHost()}/api/projects/${projectId}/query/`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body:    JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    signal:  AbortSignal.timeout(8000),
    cache:   'no-store',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PostHog ${res.status}: ${body.slice(0, 140)}`)
  }
  const data = await res.json() as { results?: unknown[][] }
  return data.results ?? []
}

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export async function fetchTrafficStats(): Promise<TrafficStats> {
  if (!process.env.POSTHOG_PERSONAL_API_KEY || !process.env.POSTHOG_PROJECT_ID) {
    return {
      configured: false,
      reason: 'Define POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID no Vercel para ver números PostHog aqui.',
      ...EMPTY,
    }
  }

  try {
    const [agg7, agg30, pages, refs] = await Promise.all([
      hogql(`
        SELECT count(), count(DISTINCT person_id)
        FROM events
        WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 7 DAY
      `),
      hogql(`
        SELECT count(), count(DISTINCT person_id)
        FROM events
        WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY
      `),
      hogql(`
        SELECT properties.$pathname AS path, count() AS views
        FROM events
        WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY
        GROUP BY path ORDER BY views DESC LIMIT 8
      `),
      hogql(`
        SELECT properties.$referring_domain AS ref, count(DISTINCT person_id) AS visitors
        FROM events
        WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY
          AND ref IS NOT NULL AND ref != '$direct'
        GROUP BY ref ORDER BY visitors DESC LIMIT 8
      `),
    ])

    return {
      configured:   true,
      pageviews7d:  n(agg7[0]?.[0]),
      visitors7d:   n(agg7[0]?.[1]),
      pageviews30d: n(agg30[0]?.[0]),
      visitors30d:  n(agg30[0]?.[1]),
      topPages:  (pages ?? []).map(r => ({ path: String(r[0] ?? '—'), views: n(r[1]) })),
      referrers: (refs ?? []).map(r => ({ domain: String(r[0] ?? '—'), visitors: n(r[1]) })),
    }
  } catch (err) {
    console.warn('[trafficStats] PostHog query failed:', err)
    return {
      configured: true,
      reason: `Falha a consultar PostHog: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
      ...EMPTY,
    }
  }
}
