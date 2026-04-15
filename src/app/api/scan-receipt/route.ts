import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import Anthropic                     from '@anthropic-ai/sdk'

// ── Result shape returned to the client ──────────────────────────────────────
export interface ReceiptScanResult {
  amount:        number | null
  merchant:      string | null
  date:          string | null        // YYYY-MM-DD
  description:   string | null
  category_hint: string | null        // matches our category names
  items:         { name: string; price: number }[]
  currency:      string               // default EUR
  raw_text:      string
}

const PLAN_RANK: Record<string, number> = { free: 0, plus: 1, pro: 2, family: 3 }

export async function POST(req: NextRequest) {
  // ── Demo mode — skip auth & plan gate ──
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  if (!demo) {
    // ── Auth ──
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Plan gate (Plus or higher) ──
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
    imageBase64 = body.image   // base64 string (without data: prefix)
    mimeType    = body.mimeType ?? 'image/jpeg'

    if (!imageBase64) throw new Error('missing image')
    // Strip data URL prefix if present
    if (imageBase64.startsWith('data:')) {
      const parts = imageBase64.split(',')
      imageBase64  = parts[1]
      const mime   = parts[0].match(/:(.*?);/)?.[1]
      if (mime) mimeType = mime
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // ── Check Anthropic key ──
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('xxxxxx')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  // ── Call Claude Vision ──
  const client = new Anthropic({ apiKey })

  const systemPrompt = `You are a receipt/invoice data extractor.
Extract structured information from receipt images and return ONLY valid JSON.
Available categories: Alimentação, Transporte, Saúde, Lazer, Educação, Casa, Roupas, Tecnologia, Salário, Freelance, Outros.
For category_hint, pick the closest match from the list above based on the merchant/items.
For date, use YYYY-MM-DD format. If no year visible, assume current year.
Always return the JSON object even if some fields are null.`

  const userPrompt = `Extract all receipt data from this image and return ONLY this JSON structure (no markdown, no explanation):
{
  "amount": <total amount as number or null>,
  "merchant": <store/restaurant name as string or null>,
  "date": <date as YYYY-MM-DD or null>,
  "description": <short description like "Compras Continente" or "Jantar TGI" as string or null>,
  "category_hint": <best matching category name from the list or null>,
  "items": [{"name": "<item>", "price": <price>}],
  "currency": "<3-letter currency code, default EUR>",
  "raw_text": "<all visible text on receipt, comma-separated>"
}`

  try {
    const message = await client.messages.create({
      model:      'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system:     systemPrompt,
      messages: [
        {
          role:    'user',
          content: [
            {
              type:   'image',
              source: {
                type:       'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data:       imageBase64,
              },
            },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    })

    const raw  = message.content[0].type === 'text' ? message.content[0].text : '{}'
    // Strip any markdown code blocks if model wraps in ```json
    const json = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let result: ReceiptScanResult
    try {
      result = JSON.parse(json)
    } catch {
      // If JSON parse fails return partial result
      result = {
        amount:        null,
        merchant:      null,
        date:          null,
        description:   null,
        category_hint: null,
        items:         [],
        currency:      'EUR',
        raw_text:      raw,
      }
    }

    // Sanitise amount — ensure it's a positive number
    if (result.amount !== null) {
      result.amount = Math.abs(Number(result.amount))
      if (isNaN(result.amount)) result.amount = null
    }

    return NextResponse.json({ data: result })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI error'
    console.error('[scan-receipt]', msg)

    // Friendly fallback for known AI provider errors
    const isCreditIssue   = /credit balance|insufficient|billing/i.test(msg)
    const isRateLimit     = /rate limit|429|too many/i.test(msg)
    const isAuth          = /401|invalid api key|unauthorized/i.test(msg)

    if (isCreditIssue || isRateLimit || isAuth) {
      return NextResponse.json(
        {
          error: 'Serviço de leitura de recibos temporariamente indisponível. Tenta novamente dentro de alguns minutos ou introduz os dados manualmente.',
          code:  isCreditIssue ? 'ai_unavailable' : isRateLimit ? 'ai_rate_limit' : 'ai_auth',
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: 'Não foi possível processar o recibo. Tenta novamente ou introduz manualmente.' },
      { status: 500 },
    )
  }
}
