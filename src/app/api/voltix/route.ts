import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getVoltixMoodFromScore } from '@/types'
import { isDemoMode, demoResponse } from '@/lib/demo/demoGuard'
import { DEMO_VOLTIX }              from '@/lib/demo/mockData'

export async function GET() {
  if (isDemoMode()) return demoResponse(DEMO_VOLTIX)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users').select('id').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ data: null, error: null })

  // Obter estado Voltix
  const { data: voltix } = await db
    .from('voltix_states').select('*').eq('user_id', user.id).single()

  // Sincronizar humor com score atual
  if (voltix) {
    const { data: score } = await db
      .from('financial_scores')
      .select('score')
      .eq('user_id', user.id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single()

    if (score) {
      const mood = getVoltixMoodFromScore(score.score)
      if (mood !== voltix.mood) {
        await db.from('voltix_states')
          .update({ mood, last_interaction: new Date().toISOString() })
          .eq('user_id', user.id)
        voltix.mood = mood
      }
    }
  }

  return NextResponse.json({ data: voltix ?? null, error: null })
}
