import { auth, clerkClient }   from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { resolveUser }               from '@/lib/resolveUser'
import { isDemoMode }                from '@/lib/demo/demoGuard'
import { z }                         from 'zod'

/**
 * POST /api/bug-report
 *
 * Lets the user submit a bug report from Settings WITHOUT exposing the admin
 * email anywhere on the client. The row lands in the `bug_reports` table and
 * the admin reads them via the Supabase dashboard (see
 * database/bug_reports.sql).
 *
 * If the table doesn't exist yet (migration not run), we fall back to a
 * console.warn so early deploys don't 500 — the user sees a friendly "try
 * again later" message rather than a stack trace.
 *
 * Payload:
 *   { title, description, pageUrl?, appVersion? }
 * user-agent is read server-side from the request headers so a malicious
 * client can't forge it.
 */
const Schema = z.object({
  title:       z.string().trim().min(3,  'Título demasiado curto.').max(120, 'Título demasiado longo.'),
  description: z.string().trim().min(10, 'Descrição demasiado curta.').max(4000),
  pageUrl:     z.string().trim().max(500).optional(),
  appVersion:  z.string().trim().max(80).optional(),
})

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: 'Reportar bugs não está disponível no modo demo.' },
      { status: 403 },
    )
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
    return NextResponse.json({ error: first ?? 'Dados inválidos.' }, { status: 400 })
  }

  const internalId = await resolveUser(userId)
  // internalId may still be null for a brand-new Clerk user who hasn't
  // hit our /api/onboarding — log via clerk_id instead.

  // Best-effort email fetch from Clerk so the admin has a way to respond
  let email: string | null = null
  try {
    const clerk = await clerkClient()
    const u     = await clerk.users.getUser(userId)
    email       = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null
  } catch (err) {
    console.warn('[bug-report] clerk lookup failed:', err)
  }

  const db = createSupabaseAdmin()
  const { error } = await db.from('bug_reports').insert({
    user_id:     internalId ?? null,
    clerk_id:    userId,
    email,
    title:       parsed.data.title,
    description: parsed.data.description,
    page_url:    parsed.data.pageUrl ?? null,
    user_agent:  req.headers.get('user-agent')?.slice(0, 500) ?? null,
    app_version: parsed.data.appVersion ?? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
  })

  if (error) {
    // Most likely cause: the bug_reports table hasn't been created yet (the
    // SQL lives in database/bug_reports.sql — user runs it manually). Don't
    // bubble the raw PG error to the client; log it and return a friendly
    // message so the button doesn't look broken.
    console.error('[bug-report] insert failed:', error)
    const missingTable = /relation .* does not exist/i.test(error.message)
    return NextResponse.json(
      {
        error: missingTable
          ? 'Sistema de reports ainda não está disponível. Tenta novamente em breve.'
          : 'Não foi possível registar o teu report. Tenta novamente.',
      },
      { status: missingTable ? 503 : 500 },
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
