import { auth }                      from '@clerk/nextjs/server'
import { NextResponse }               from 'next/server'
import { createSupabaseAdmin }        from '@/lib/supabase'
import { PRICING_USD_PER_M }          from '@/lib/aiCostLog'

/**
 * GET /api/admin/ai-spend-today
 *
 * Quick real-time view of how much we've spent on AI providers today.
 * Used by the operator (admin) to babysit Gemini billing — the user's
 * "billing-anxiety" complaint deserves a one-glance thermometer they can
 * check before opening the Google Cloud console.
 *
 * Three windows returned: last hour, today (UTC midnight onward), last
 * 30 days. Cost is estimated locally from PRICING_USD_PER_M in lib/
 * aiCostLog — same source as /admin/metrics. NOT authoritative against
 * Google's billing, but accurate within ~5 % when Gemini is the provider
 * (their pricing is what we mirror).
 *
 * Gated by ADMIN_CLERK_ID env var; non-admins get 404 stealth (matches
 * the rest of /api/admin/* and /admin/* pages).
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!process.env.ADMIN_CLERK_ID || userId !== process.env.ADMIN_CLERK_ID) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const db   = createSupabaseAdmin()
  const now  = Date.now()
  const iso1h  = new Date(now - 60 * 60 * 1000).toISOString()
  const isoDay = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const iso30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const { data: rows } = await db
      .from('ai_calls')
      .select('model, tokens_in, tokens_out, created_at, status')
      .gte('created_at', iso30d)
      .limit(50_000)
    const all = (rows ?? []) as Array<{
      model: string; tokens_in: number; tokens_out: number
      created_at: string; status: string
    }>

    const cost = (set: typeof all) => {
      let usd = 0
      let calls = 0
      let successCalls = 0
      for (const r of set) {
        calls++
        if (r.status === 'success') successCalls++
        const p = (PRICING_USD_PER_M as Record<string, { in: number; out: number }>)[r.model]
        if (!p) continue
        usd += (r.tokens_in / 1_000_000) * p.in + (r.tokens_out / 1_000_000) * p.out
      }
      return { usd, calls, successCalls }
    }

    const hour  = cost(all.filter(r => r.created_at >= iso1h))
    const today = cost(all.filter(r => r.created_at >= isoDay))
    const month = cost(all)

    return NextResponse.json({
      data: {
        hour,
        today,
        month,
        // Project end-of-month spend assuming current daily rate holds.
        projection: today.usd * 30,
        generated_at: new Date(now).toISOString(),
      },
    })
  } catch (err) {
    // Missing migration etc. — return zeros so the dashboard still
    // renders gracefully instead of 500ing.
    console.warn('[admin/ai-spend-today] read failed:', err)
    return NextResponse.json({
      data: {
        hour:  { usd: 0, calls: 0, successCalls: 0 },
        today: { usd: 0, calls: 0, successCalls: 0 },
        month: { usd: 0, calls: 0, successCalls: 0 },
        projection: 0,
        generated_at: new Date(now).toISOString(),
        warning: 'ai_calls table not yet migrated',
      },
    })
  }
}
