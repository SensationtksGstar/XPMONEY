import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { calculateXPProgress }       from '@/lib/gamification'
import { isDemoMode, demoResponse }  from '@/lib/demo/demoGuard'
import { DEMO_XP }                   from '@/lib/demo/mockData'

export async function GET() {
  if (isDemoMode()) return demoResponse(DEMO_XP)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  // maybeSingle — a brand-new user may not yet have an xp_progress row
  const { data } = await db
    .from('xp_progress')
    .select('*')
    .eq('user_id', internalId)
    .maybeSingle()

  if (!data) return NextResponse.json({ data: null, error: null })

  const progress = calculateXPProgress(data.xp_total)
  return NextResponse.json({ data: { ...data, ...progress }, error: null })
}

// SEM POST. O endpoint aceitava {amount, reason} arbitrários de QUALQUER
// utilizador autenticado (até 100.000 XP por chamada, sem rate-limit) e
// nenhum componente do cliente o usava — superfície de exploit pura, morta
// na auditoria de julho 2026. Todos os awards legítimos acontecem
// server-side nos call sites (transactions, goals, daily-checkin, courses,
// missions) via awardXP(). Se um fluxo futuro precisar de dar XP a partir
// do cliente, reintroduzir com whitelist de reasons e valores fixos no
// servidor — nunca com amount vindo do body.
