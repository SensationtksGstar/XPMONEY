import { auth }              from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50)

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ data: [], error: null })

  const db = createSupabaseAdmin()

  const { data, error } = await db
    .from('xp_history')
    .select('id, amount, reason, earned_at')
    .eq('user_id', internalId)
    .order('earned_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], error: null })
}
