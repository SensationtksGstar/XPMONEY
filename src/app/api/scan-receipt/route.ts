import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { scanReceipt, AIProvidersError, type ReceiptScanResult } from '@/lib/ai'
import { getServerLocale }           from '@/lib/i18n/server'
import { isDemoMode }                from '@/lib/demo/demoGuard'
import { guardUser }                 from '@/lib/rateLimit'

// Re-export for clients
export type { ReceiptScanResult }

const PLAN_RANK: Record<string, number> = {
  free:    0,
  premium: 1,
  // legacy aliases — utilizadores migrados de tiers antigos continuam premium
  plus:    1,
  pro:     1,
  family:  1,
}

export async function POST(req: NextRequest) {
  // Safe demo check — refuses to skip auth on production unless
  // ALLOW_DEMO_IN_PROD is explicitly set (see demoGuard.ts).
  const demo   = isDemoMode()
  const locale = await getServerLocale()

  if (!demo) {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = createSupabaseAdmin()
    const { data: user } = await db
      .from('users').select('id, plan').eq('clerk_id', userId).single()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const rank = PLAN_RANK[user.plan ?? 'free'] ?? 0
    if (rank < 1) {
      return NextResponse.json(
        {
          error: locale === 'en'
            ? 'Feature available only on the Premium plan.'
            : 'Funcionalidade exclusiva do plano Premium.',
        },
        { status: 403 },
      )
    }

    // Per-user AI cost guard. Honest users scan ~5-10 receipts/day. The
    // hourly cap absorbs reasonable bursts (e.g. processing a stack of
    // receipts at the end of the month); the daily cap puts a hard ceiling
    // on what a single subscription can cost us in Gemini paid quota.
    const limited = await guardUser(user.id, 'scan-receipt', [
      { limit: 30,  windowMs: 60 * 60 * 1000 },        // 30/hour
      { limit: 100, windowMs: 24 * 60 * 60 * 1000 },   // 100/day
    ], {
      error: locale === 'en'
        ? 'Daily scan limit reached (100/day). It resets in 24h. If you genuinely need more, contact support.'
        : 'Atingiste o limite diário de scans (100/dia). Reinicia em 24h. Se precisares mesmo de mais, contacta o suporte.',
      code: 'rate_limit',
    })
    if (limited) return limited
  }

  // ── Parse body ──
  let imageBase64: string
  let mimeType: string

  try {
    const body = await req.json()
    imageBase64 = body.image
    mimeType    = body.mimeType ?? 'image/jpeg'

    if (!imageBase64) throw new Error('missing image')
    if (imageBase64.startsWith('data:')) {
      const parts = imageBase64.split(',')
      imageBase64  = parts[1]
      const mime   = parts[0].match(/:(.*?);/)?.[1]
      if (mime) mimeType = mime
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // ── Scan (cache → Gemini 2.0 → Gemini 1.5 → Groq) ──
  try {
    const result = await scanReceipt(imageBase64, mimeType, locale)

    // Expose provider + cache info in response headers for debugging/telemetry.
    // (The body shape stays the same — UI keeps reading `data`.)
    return NextResponse.json(
      { data: result.data },
      {
        headers: {
          'x-ai-provider':  result.provider,
          'x-ai-cache-hit': result.cache_hit ? '1' : '0',
        },
      },
    )
  } catch (err) {
    if (err instanceof AIProvidersError) {
      console.error('[scan-receipt] all providers failed:', err.attempts)
      if (err.kind === 'auth') {
        return NextResponse.json(
          {
            error: locale === 'en'
              ? 'AI service not configured. Please contact support.'
              : 'Serviço de IA não configurado. Contacta o suporte.',
            code: 'ai_auth',
          },
          { status: 503 },
        )
      }
      if (err.kind === 'quota') {
        return NextResponse.json(
          {
            error: locale === 'en'
              ? 'Receipt-reading service temporarily unavailable. Try again in a few minutes or enter the data manually.'
              : 'Serviço de leitura de recibos temporariamente indisponível. Tenta novamente dentro de alguns minutos ou introduz os dados manualmente.',
            code:  'ai_quota',
          },
          { status: 503 },
        )
      }
      if (err.kind === 'bad_input') {
        return NextResponse.json(
          {
            error: locale === 'en'
              ? 'Invalid or unreadable image. Try another, clearer photo.'
              : 'Imagem inválida ou ilegível. Tenta com outra foto mais nítida.',
          },
          { status: 422 },
        )
      }
    }

    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[scan-receipt]', msg)
    return NextResponse.json(
      {
        error: locale === 'en'
          ? 'Could not process the receipt. Try again or enter the data manually.'
          : 'Não foi possível processar o recibo. Tenta novamente ou introduz manualmente.',
      },
      { status: 500 },
    )
  }
}
