import { auth }                 from '@clerk/nextjs/server'
import { NextResponse, NextRequest } from 'next/server'
import { randomBytes }            from 'node:crypto'
import { createSupabaseAdmin }    from '@/lib/supabase'
import { resolveUser }            from '@/lib/resolveUser'
import { awardXP }                from '@/lib/awardXP'
import { checkAllBadges }         from '@/lib/checkAllBadges'
import { COURSES }                from '@/lib/courses'
import { fetchPlanRow }           from '@/lib/plan'
import { z }                      from 'zod'

/**
 * Garante o certificado persistido (tabela `certificates`, migração
 * certificates_2026_07.sql). Idempotente: se já existe, devolve o code
 * ORIGINAL (o código é permanente — nunca re-gerado). Fallback runtime:
 * tabela ausente (42P01) → devolve null e a UI mantém o código derivado
 * legacy sem URL de verificação.
 */
async function ensureCertificate(
  db:         ReturnType<typeof createSupabaseAdmin>,
  internalId: string,
  courseId:   string,
): Promise<{ code: string; issued_at: string } | null> {
  try {
    const { data: existing, error: readErr } = await db
      .from('certificates')
      .select('code, issued_at')
      .eq('user_id', internalId)
      .eq('course_id', courseId)
      .maybeSingle()
    if (readErr) {
      console.warn('[courses/complete] certificates read failed (pré-migração?):', readErr.message)
      return null
    }
    if (existing) return existing

    // Nome para o /verify mostrar (primeiro nome + inicial — privacidade).
    const { data: userRow } = await db
      .from('users').select('name').eq('id', internalId).maybeSingle()

    const code = `XPM-${randomBytes(5).toString('hex').toUpperCase()}`
    const { data: inserted, error: insErr } = await db
      .from('certificates')
      .insert({ user_id: internalId, course_id: courseId, code, user_name: userRow?.name ?? null })
      .select('code, issued_at')
      .single()
    if (insErr) {
      // Corrida (unique user_id+course_id) → re-lê o vencedor.
      const { data: raced } = await db
        .from('certificates')
        .select('code, issued_at')
        .eq('user_id', internalId)
        .eq('course_id', courseId)
        .maybeSingle()
      if (raced) return raced
      console.warn('[courses/complete] certificate insert failed:', insErr.message)
      return null
    }
    return inserted
  } catch (err) {
    console.warn('[courses/complete] ensureCertificate failed:', err)
    return null
  }
}

/**
 * Course completion XP award — called once a user passes the 100 %-quiz.
 *
 * Idempotent: guards against duplicate awards by checking `xp_history` for an
 * existing `course_completed_<id>` row. This matters because course progress
 * lives in localStorage (see `src/lib/courses.ts`), which means the client
 * can legitimately re-trigger "complete" when the user re-enters a finished
 * course. We don't want that to farm XP.
 *
 * Balance:
 *   - 250 XP per passed course — meaningful (roughly ~1.5 levels at low levels,
 *     ~0.5 a level higher up) but not cheaper than daily engagement.
 *   - Requires 100 % on the quiz (enforced client-side in the course page and
 *     re-checked here via `quizScore`).
 *
 * Payload:
 *   { quizScore: number (0..100) }
 *
 * The endpoint trusts `quizScore` only as a "this attempt passed" signal —
 * we double-check it's 100 before awarding. The course content itself is
 * static (`COURSES` array) so no server-side question validation is possible
 * today without migrating questions + answers to the DB.
 */
const COMPLETE_XP = 250

const BodySchema = z.object({
  quizScore: z.number().int().min(0).max(100),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: courseId } = await params
  const course = COURSES.find(c => c.id === courseId)
  if (!course) return NextResponse.json({ error: 'Curso não encontrado.' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  // Certificate threshold is 100% — reject anything lower
  if (parsed.data.quizScore < 100) {
    return NextResponse.json(
      { error: 'O certificado exige 100% no quiz.' },
      { status: 400 },
    )
  }

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const db = createSupabaseAdmin()

  // SERVER-SIDE PLAN GATE — closes the hole where a free user could
  // bypass the UI lock and POST directly to /api/courses/<premium-id>/
  // complete to farm 250 XP. Effective plan via src/lib/plan.ts — the raw
  // `users.plan` read used before ignored `premium_until`, so an EXPIRED
  // Annual Pass kept unlocking premium courses (June 2026 audit). Free
  // courses skip the lookup entirely.
  if (course.plan !== 'free') {
    const planRow = await fetchPlanRow(db, 'id', internalId)
    if (!(planRow?.isPremium ?? false)) {
      return NextResponse.json(
        { error: 'Este curso requer plano Premium.' },
        { status: 403 },
      )
    }
  }

  const reason = `course_completed_${courseId}`

  // Idempotency guard — if we've already paid XP for this course, short-circuit
  const { data: existing } = await db
    .from('xp_history')
    .select('id')
    .eq('user_id', internalId)
    .eq('reason',  reason)
    .limit(1)
    .maybeSingle()

  if (existing) {
    // XP já pago — mas garante o certificado na mesma (users que concluíram
    // antes da migração da tabela ganham o code real na primeira re-visita).
    const certificate = await ensureCertificate(db, internalId, courseId)
    return NextResponse.json({
      already_awarded: true,
      xp_gained:       0,
      certificate,
      error:           null,
    })
  }

  const result = await awardXP(db, internalId, COMPLETE_XP, reason)

  // Finishing a course can unlock `academy_master` once the last course is
  // done. Fire the full recheck here rather than coding an `allCompleted`
  // condition inline — keeps the "what unlocks this badge" logic in one
  // place (checkAllBadges.ts).
  let newBadges: Awaited<ReturnType<typeof checkAllBadges>> = []
  try {
    newBadges = await checkAllBadges(db, internalId)
  } catch (err) {
    console.warn('[courses/complete] badge check failed (non-fatal):', err)
  }

  const certificate = await ensureCertificate(db, internalId, courseId)

  return NextResponse.json({
    already_awarded: false,
    xp_gained:       result?.xp_gained ?? 0,
    leveled_up:      result?.leveled_up ?? false,
    badges:          newBadges,
    certificate,
    error:           null,
  })
}
