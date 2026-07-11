import { auth }                from '@clerk/nextjs/server'
import { NextResponse }        from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase'
import { resolveUser }         from '@/lib/resolveUser'

/**
 * GET /api/certificates/[courseId] — o certificado persistido do próprio
 * user para um curso. Devolve { data: { code, issued_at } | null }.
 * Fallback runtime: tabela `certificates` ausente (pré-migração
 * certificates_2026_07.sql) → data:null, nunca 500 — a UI mantém o código
 * derivado legacy sem URL de verificação.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await params

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()
  const { data, error } = await db
    .from('certificates')
    .select('code, issued_at')
    .eq('user_id', internalId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (error) {
    console.warn('[certificates] read failed (pré-migração?):', error.message)
    return NextResponse.json({ data: null, error: null })
  }

  return NextResponse.json({ data: data ?? null, error: null })
}
