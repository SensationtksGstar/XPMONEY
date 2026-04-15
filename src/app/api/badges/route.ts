import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveUser }         from '@/lib/resolveUser'
import { isDemoMode, demoResponse } from '@/lib/demo/demoGuard'
import { DEMO_BADGES }              from '@/lib/demo/mockData'

export async function GET() {
  if (isDemoMode()) return demoResponse(DEMO_BADGES)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: [], error: null })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('user_badges').select('*, badge:badges(*)').eq('user_id', internalId)
    .order('earned_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], error: null })
}
