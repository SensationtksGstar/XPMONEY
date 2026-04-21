import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { z }                         from 'zod'
import { guardRequest }              from '@/lib/rateLimit'

/**
 * POST /api/contact-message
 *
 * Público — não requer sessão. Recebe uma mensagem de contacto da landing
 * (ou de /contacto) e grava em `bug_reports` com `type='contact'` para que
 * o admin a veja em /admin/bugs junto com os bug reports.
 *
 * Porquê reutilizar `bug_reports` em vez de criar nova tabela:
 *   - Mesmo fluxo (user → admin, email admin nunca exposto)
 *   - Mesmo dashboard (/admin/bugs) já faz a triagem
 *   - Menos DDL para o utilizador correr
 *
 * Só precisa de UMA coluna nova: `type text not null default 'bug'`. Se a
 * coluna não existir ainda, caímos em silêncio e gravamos sem — o dashboard
 * continua a funcionar e a mensagem não se perde.
 */

const Schema = z.object({
  email:   z.string().trim().email('Email inválido.').max(200),
  name:    z.string().trim().max(120).optional(),
  subject: z.string().trim().min(3, 'Assunto demasiado curto.').max(120),
  message: z.string().trim().min(10, 'Mensagem demasiado curta.').max(4000),
  // Simple honeypot field — bots fill visible fields + hidden ones. If
  // this is non-empty, pretend success but drop the message.
  website: z.string().max(0).optional(),
})

export async function POST(req: NextRequest) {
  // Public endpoint → prime spam-flood target. Two-tier limit:
  // 3 messages / 5 min (burst) + 20 / day (sustained). The honeypot below
  // still catches the dumbest bots; this keeps the sophisticated ones
  // from writing 10k rows into bug_reports in a few seconds.
  const limited = guardRequest(req, 'contact-message', [
    { limit: 3,  windowMs: 5  * 60 * 1000 },
    { limit: 20, windowMs: 24 * 60 * 60 * 1000 },
  ])
  if (limited) return limited

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0]
    return NextResponse.json({ error: first ?? 'Dados inválidos.' }, { status: 400 })
  }

  // Honeypot filled → bot. Return 200 so they don't retry, but don't write.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ success: true }, { status: 201 })
  }

  const db = createSupabaseAdmin()

  // Two attempts: first with `type`, then without (in case column missing).
  const basePayload = {
    user_id:     null,
    clerk_id:    null,
    email:       parsed.data.email,
    title:       `[Contacto] ${parsed.data.subject}`,
    description: parsed.data.name
      ? `De: ${parsed.data.name}\n\n${parsed.data.message}`
      : parsed.data.message,
    page_url:    req.headers.get('referer')?.slice(0, 500) ?? null,
    user_agent:  req.headers.get('user-agent')?.slice(0, 500) ?? null,
    app_version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
  }

  let { error } = await db.from('bug_reports').insert({ ...basePayload, type: 'contact' })

  if (error && /column .* type/i.test(error.message)) {
    // Older migration — retry without the type column.
    const retry = await db.from('bug_reports').insert(basePayload)
    error = retry.error
  }

  if (error) {
    console.error('[contact-message] insert failed:', error)
    const missingTable = /relation .* does not exist/i.test(error.message)
    return NextResponse.json(
      {
        error: missingTable
          ? 'Sistema de contacto temporariamente indisponível. Tenta novamente em breve.'
          : 'Não conseguimos registar a tua mensagem. Tenta de novo.',
      },
      { status: missingTable ? 503 : 500 },
    )
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
