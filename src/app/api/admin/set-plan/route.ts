/**
 * ADMIN-ONLY endpoint — set any user's plan for testing.
 * Protected by ADMIN_SECRET env var.
 *
 * POST /api/admin/set-plan
 * Body: { secret: string, email: string, plan: 'free'|'plus'|'pro' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { z }                         from 'zod'

const Schema = z.object({
  secret: z.string(),
  email:  z.string().email(),
  plan:   z.enum(['free', 'plus', 'pro', 'family']),
})

export async function POST(req: NextRequest) {
  const body   = await req.json()
  const parsed = Schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const adminSecret = process.env.ADMIN_SECRET ?? 'xpmoney-admin-2024'
  if (parsed.data.secret !== adminSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('users')
    .update({ plan: parsed.data.plan })
    .eq('email', parsed.data.email)
    .select('id, email, plan')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, user: data })
}
