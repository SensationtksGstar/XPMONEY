import { auth }                 from '@clerk/nextjs/server'
import { NextResponse, NextRequest } from 'next/server'
import { createSupabaseAdmin }    from '@/lib/supabase'
import { resolveUser }            from '@/lib/resolveUser'
import { awardXP }                from '@/lib/awardXP'
import { checkAllBadges }         from '@/lib/checkAllBadges'
import { COURSES }                from '@/lib/courses'
import { z }                      from 'zod'

// Plan ranks — MUST match the constants used on the list page + scan-
// receipt gate. Duplicated here to keep this route self-contained.
const PLAN_RANK: Record<string, number> = {
  free:    0,
  premium: 1,
  plus:    1,
  pro:     1,
  family:  1,
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
  // complete to farm 250 XP. Load the user's plan and refuse if their
  // rank is below the course's required rank.
  const { data: userRow } = await db
    .from('users')
    .select('plan')
    .eq('id', internalId)
    .single()
  const userPlan = userRow?.plan ?? 'free'
  const userRank = PLAN_RANK[userPlan] ?? 0
  const reqRank  = PLAN_RANK[course.plan] ?? 1
  if (userRank < reqRank) {
    return NextResponse.json(
      { error: 'Este curso requer plano Premium.' },
      { status: 403 },
    )
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
    return NextResponse.json({
      already_awarded: true,
      xp_gained:       0,
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

  return NextResponse.json({
    already_awarded: false,
    xp_gained:       result?.xp_gained ?? 0,
    leveled_up:      result?.leveled_up ?? false,
    badges:          newBadges,
    error:           null,
  })
}
