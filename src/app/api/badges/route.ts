import { auth }              from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users').select('id').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ data: [], error: null })

  const { data, error } = await db
    .from('user_badges')
    .select('*, badge:badges(*)')
    .eq('user_id', user.id)
    .order('earned_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], error: null })
}
