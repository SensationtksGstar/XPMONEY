import { auth }                    from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin }       from '@/lib/supabase'
import { GoogleGenerativeAI }        from '@google/generative-ai'

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
    if (imageBase64.startsWith('data:')) {
      const parts = imageBase64.split(',')
      imageBase64  = parts[1]
      const mime   = parts[0].match(/:(.*?);/)?.[1]
      if (mime) mimeType = mime
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // ── Check Gemini key (fallback to GOOGLE_API_KEY for flexibility) ──
  const apiKey =
    process.env.GOOGLE_GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY
  if (!apiKey || apiKey.includes('xxxxxx')) {
    return NextResponse.json(
      { error: 'GOOGLE_GEMINI_API_KEY não configurada no servidor.' },
      { status: 503 },
    )
  }

  // ── Call Gemini Vision ──
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature:      0.1,
      maxOutputTokens:  1024,
    },
  })

  const prompt = `És um extrator de dados de recibos/facturas.
Categorias disponíveis: Alimentação, Transporte, Saúde, Lazer, Educação, Casa, Roupas, Tecnologia, Salário, Freelance, Outros.
Para category_hint, escolhe a categoria mais adequada com base no comerciante/itens.
Para date, usa formato YYYY-MM-DD. Se não houver ano visível, assume o ano actual.

Devolve APENAS este JSON (sem markdown, sem texto extra):
{
  "amount": <total como número, ou null>,
  "merchant": <nome da loja/restaurante, ou null>,
  "date": <"YYYY-MM-DD" ou null>,
  "description": <descrição curta como "Compras Continente" ou "Jantar TGI", ou null>,
  "category_hint": <nome da categoria da lista, ou null>,
  "items": [{"name": "<item>", "price": <preço>}],
  "currency": "<código ISO 3 letras, padrão EUR>",
  "raw_text": "<todo o texto visível, separado por vírgulas>"
}`

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data:     imageBase64,
          mimeType: mimeType,
        },
      },
    ])

    const raw  = result.response.text()
    const json = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed: ReceiptScanResult
    try {
      parsed = JSON.parse(json)
    } catch {
      parsed = {
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

    // Sanitise amount — ensure positive number
    if (parsed.amount !== null) {
      parsed.amount = Math.abs(Number(parsed.amount))
      if (isNaN(parsed.amount)) parsed.amount = null
    }

    return NextResponse.json({ data: parsed })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI error'
    console.error('[scan-receipt]', msg)

    // Friendly fallback for known AI provider errors
    const isQuota     = /quota|resource[_ ]?exhausted|429|rate|billing|credit/i.test(msg)
    const isAuth      = /401|403|api[_ ]?key|unauthenticated|permission/i.test(msg)
    const isBadInput  = /invalid.*?image|unsupported.*?mime|safety/i.test(msg)

    if (isQuota || isAuth) {
      return NextResponse.json(
        {
          error: 'Serviço de leitura de recibos temporariamente indisponível. Tenta novamente dentro de alguns minutos ou introduz os dados manualmente.',
          code:  isQuota ? 'ai_quota' : 'ai_auth',
        },
        { status: 503 },
      )
    }
    if (isBadInput) {
      return NextResponse.json(
        { error: 'Imagem inválida ou ilegível. Tenta com outra foto mais nítida.' },
        { status: 422 },
      )
    }

    return NextResponse.json(
      { error: 'Não foi possível processar o recibo. Tenta novamente ou introduz manualmente.' },
      { status: 500 },
    )
  }
}
