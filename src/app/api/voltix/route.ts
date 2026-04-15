import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveUser }         from '@/lib/resolveUser'
import { getVoltixMoodFromScore } from '@/types'
import { isDemoMode, demoResponse } from '@/lib/demo/demoGuard'
import { DEMO_VOLTIX }              from '@/lib/demo/mockData'

export async function GET() {
  if (isDemoMode()) return demoResponse(DEMO_VOLTIX)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: null, error: null })

  const db = createSupabaseAdmin()

  // Fetch voltix + latest score in parallel
  const [voltixRes, scoreRes] = await Promise.all([
    db.from('voltix_states').select('*').eq('user_id', internalId).single(),
    db.from('financial_scores').select('score').eq('user_id', internalId)
      .order('calculated_at', { ascending: false }).limit(1).single(),
  ])

  const voltix = voltixRes.data
  if (!voltix) return NextResponse.json({ data: null, error: null })

  // Sync mood with score if needed
  if (scoreRes.data) {
    const mood = getVoltixMoodFromScore(scoreRes.data.score)
    if (mood !== voltix.mood) {
      await db.from('voltix_states')
        .update({ mood, last_interaction: new Date().toISOString() })
        .eq('user_id', internalId)
      voltix.mood = mood
    }
  }

  return NextResponse.json({ data: voltix, error: null })
}
