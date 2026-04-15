import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { scanReceipt, AIProvidersError, type ReceiptScanResult } from '@/lib/ai'

// Re-export for clients
export type { ReceiptScanResult }

const PLAN_RANK: Record<string, number> = { free: 0, plus: 1, pro: 2, family: 3 }

export async function POST(req: NextRequest) {
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

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
        { error: 'Funcionalidade exclusiva do plano Plus ou superior.' },
        { status: 403 },
      )
    }
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
    const result = await scanReceipt(imageBase64, mimeType)

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
          { error: 'Serviço de IA não configurado. Contacta o suporte.', code: 'ai_auth' },
          { status: 503 },
        )
      }
      if (err.kind === 'quota') {
        return NextResponse.json(
          {
            error: 'Serviço de leitura de recibos temporariamente indisponível. Tenta novamente dentro de alguns minutos ou introduz os dados manualmente.',
            code:  'ai_quota',
          },
          { status: 503 },
        )
      }
      if (err.kind === 'bad_input') {
        return NextResponse.json(
          { error: 'Imagem inválida ou ilegível. Tenta com outra foto mais nítida.' },
          { status: 422 },
        )
      }
    }

    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[scan-receipt]', msg)
    return NextResponse.json(
      { error: 'Não foi possível processar o recibo. Tenta novamente ou introduz manualmente.' },
      { status: 500 },
    )
  }
}
