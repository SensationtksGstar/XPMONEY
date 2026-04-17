import { auth }                     from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { z }                         from 'zod'

/**
 * POST /api/admin/bug-status
 *
 * Updates the triage status of a bug report. Admin-only — gated by the
 * `ADMIN_CLERK_ID` env var (same guard used by /admin/bugs). Any other user
 * gets a 404 so they can't probe for the endpoint.
 *
 * When moving to 'resolved' or 'wontfix' we stamp `resolved_at` so we keep
 * an audit trail without needing a separate history table.
 *
 * Body: { id: uuid, status: 'new'|'triaged'|'resolved'|'wontfix' }
 */
const Schema = z.object({
  id:     z.string().uuid(),
  status: z.enum(['new', 'triaged', 'resolved', 'wontfix']),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Same gate as the page: wrong or missing env → pretend the endpoint doesn't exist.
  if (!process.env.ADMIN_CLERK_ID || userId !== process.env.ADMIN_CLERK_ID) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
    return NextResponse.json({ error: first ?? 'Dados inválidos.' }, { status: 400 })
  }

  const { id, status } = parsed.data
  const isTerminal = status === 'resolved' || status === 'wontfix'

  const db = createSupabaseAdmin()
  const { error } = await db
    .from('bug_reports')
    .update({
      status,
      resolved_at: isTerminal ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) {
    console.error('[bug-status] update failed:', error)
    return NextResponse.json({ error: 'Falha ao atualizar.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
