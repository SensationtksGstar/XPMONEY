import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { resolveUser }                 from '@/lib/resolveUser'
import { toNumber, parseBoundedInt }    from '@/lib/safeNumber'

/**
 * GET /api/networth/history?days=180 — the user's net-worth snapshots over
 * the last N days, oldest→newest, for the /contas trend chart.
 *
 * Degrades to an empty list when the `net_worth_snapshots` table doesn't
 * exist yet (migration not applied) — never 500s the page.
 */

export interface NetWorthPoint {
  date:        string   // YYYY-MM-DD
  net:         number
  assets:      number
  liabilities: number
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json<{ data: NetWorthPoint[] }>({ data: [] })

  const days = parseBoundedInt(new URL(req.url).searchParams.get('days'), { default: 180, min: 7, max: 730 })
  const from = new Date(Date.now() - days * 86_400_000).toISOString().split('T')[0]

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('net_worth_snapshots')
    .select('snapshot_date, net, assets, liabilities')
    .eq('user_id', internalId)
    .gte('snapshot_date', from)
    .order('snapshot_date', { ascending: true })

  if (error) {
    // Missing table → empty, anything else → log but still empty (the chart
    // is non-critical; it must never break the Património page).
    if (!/relation .* does not exist/i.test(error.message)) {
      console.warn('[networth/history] query failed:', error.message)
    }
    return NextResponse.json<{ data: NetWorthPoint[] }>({ data: [] })
  }

  const points: NetWorthPoint[] = (data ?? []).map(r => ({
    date:        r.snapshot_date as string,
    net:         toNumber(r.net),
    assets:      toNumber(r.assets),
    liabilities: toNumber(r.liabilities),
  }))

  return NextResponse.json<{ data: NetWorthPoint[] }>({ data: points })
}
