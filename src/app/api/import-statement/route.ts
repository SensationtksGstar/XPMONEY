import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { isDemoMode, demoResponse }    from '@/lib/demo/demoGuard'
import { DEMO_CATEGORIES }             from '@/lib/demo/mockData'
import {
  parseStatement, AIProvidersError,
  type StatementParseResult, type ParsedTransaction as LibParsedTransaction,
} from '@/lib/ai'

// Extended shape used by the UI (adds `selected` for deselection flow)
export interface ParsedTransaction extends LibParsedTransaction {
  selected: boolean
}

export interface ImportStatementResult extends Omit<StatementParseResult, 'transactions'> {
  transactions: ParsedTransaction[]
}

// PDFs can take 30-45s on Gemini for multi-page documents.
export const runtime     = 'nodejs'
export const maxDuration = 60

// ── Plan gating: Premium can import statements ──────────────────────────────
const PLAN_RANK: Record<string, number> = {
  free:    0,
  premium: 1,
  // legacy aliases — grandfathered accounts continue working
  plus:    1,
  pro:     1,
  family:  1,
}

// Text (CSV/TSV/TXT) limits — small, parsed instantly
const MAX_TEXT_BYTES = 200_000
// PDF limits — Vercel Serverless Functions cap the request body at 4.5 MB.
// Base64 inflates the raw bytes by ~33%, plus JSON wrap overhead. A 3 MB PDF
// becomes ~4 MB base64 → ~4.1 MB JSON, safely under the Vercel edge cap.
// Raising this past 3 MB causes Vercel to return a 413 HTML page, which
// Safari's res.json() then rejects with "The string did not match the
// expected pattern" — cryptic and unhelpful for the user.
const MAX_PDF_BYTES  = 3_000_000

// ── Demo mock ────────────────────────────────────────────────────────────────
const DEMO_RESULT: ImportStatementResult = {
  bank:     'Millennium BCP (demonstração)',
  currency: 'EUR',
  total:    12,
  transactions: [
    { date: new Date().toISOString().split('T')[0], description: 'Salário Abril',        original_description: 'TRANSF SALARIO ABR/2026', amount: 1850,  type: 'income',  category_hint: 'Salário',      selected: true },
    { date: new Date().toISOString().split('T')[0], description: 'Supermercado Pingo',   original_description: 'COMPRA PINGO DOCE',       amount: 67.50, type: 'expense', category_hint: 'Alimentação',  selected: true },
    { date: new Date().toISOString().split('T')[0], description: 'Passe Mensal Metro',   original_description: 'CARREGAMENTO VIVA VIAGEM',amount: 42,    type: 'expense', category_hint: 'Transportes',  selected: true },
    { date: new Date().toISOString().split('T')[0], description: 'Netflix',              original_description: 'NETFLIX.COM',             amount: 15.99, type: 'expense', category_hint: 'Lazer',        selected: true },
    { date: new Date().toISOString().split('T')[0], description: 'Renda Apartamento',    original_description: 'TRF RENDA APARTAMENTO',   amount: 650,   type: 'expense', category_hint: 'Casa',         selected: true },
  ],
}

interface RequestBody {
  /** Raw text content (CSV/TSV/TXT). Mutually exclusive with `pdfBase64`. */
  content?:    string
  /** Base64-encoded PDF (no data-url prefix). Mutually exclusive with `content`. */
  pdfBase64?:  string
  filename?:   string
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) return demoResponse(DEMO_RESULT)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseAdmin()

  // Probe with .maybeSingle() — a fresh user won't have a row yet and
  // .single() throws PGRST116 (500 to the client).
  const { data: user } = await db
    .from('users').select('id, plan').eq('clerk_id', userId).maybeSingle()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Plan gate — Plus or higher. Matches /api/scan-receipt.
  const rank = PLAN_RANK[user.plan ?? 'free'] ?? 0
  if (rank < 1) {
    return NextResponse.json(
      {
        error: 'Importação de extratos disponível apenas no plano Premium.',
        code:  'plan_required',
      },
      { status: 403 },
    )
  }

  const { data: cats } = await db
    .from('categories')
    .select('name')
    .or(`user_id.eq.${user.id},is_default.eq.true`)
  const categoryNames = (cats ?? DEMO_CATEGORIES).map((c: { name: string }) => c.name).join(', ')

  // ── Parse body ──
  let body: RequestBody
  try {
    body = await req.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Conteúdo inválido.' }, { status: 400 })
  }

  const filename = (body.filename ?? 'extrato').slice(0, 120)

  // PDF path — `pdfBase64` wins if both are supplied
  if (body.pdfBase64) {
    // Strip data-url prefix + any whitespace/newlines that some clients inject
    // (FileReader in older Safari adds CRLF every 76 chars).
    const afterComma = body.pdfBase64.includes(',')
      ? body.pdfBase64.split(',').pop() ?? ''
      : body.pdfBase64
    const cleaned = afterComma.replace(/\s+/g, '')

    // Validate base64 charset — Gemini rejects invalid base64 with a cryptic
    // 400, better to catch it here with a clear message.
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
      return NextResponse.json(
        { error: 'PDF corrompido ou mal codificado. Tenta exportar o extrato de novo.' },
        { status: 400 },
      )
    }

    // base64 is ~4/3 the size of the decoded binary
    const approxBytes = Math.floor(cleaned.length * 0.75)
    if (approxBytes > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: 'PDF demasiado grande. Máximo 3 MB. Experimenta exportar só as páginas com movimentos.' },
        { status: 413 },
      )
    }
    if (approxBytes < 500) {
      return NextResponse.json(
        { error: 'PDF vazio ou inválido.' },
        { status: 400 },
      )
    }
    // Quick magic-bytes check: base64 of "%PDF" starts with "JVBERi".
    if (!cleaned.startsWith('JVBERi')) {
      return NextResponse.json(
        { error: 'Ficheiro não parece ser um PDF válido.' },
        { status: 400 },
      )
    }

    return runParse({ kind: 'pdf', pdfBase64: cleaned, filename }, categoryNames)
  }

  // Text path
  const content = body.content
  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: 'Conteúdo inválido.' }, { status: 400 })
  }
  if (content.length > MAX_TEXT_BYTES) {
    return NextResponse.json(
      { error: 'Ficheiro demasiado grande (máx 200 KB de texto).' },
      { status: 413 },
    )
  }

  return runParse({ kind: 'text', content, filename }, categoryNames)
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared parse + error translation
// ─────────────────────────────────────────────────────────────────────────────

async function runParse(
  input:
    | { kind: 'text'; content: string; filename: string }
    | { kind: 'pdf';  pdfBase64: string; filename: string },
  categoryNames: string,
): Promise<NextResponse> {
  try {
    const result = await parseStatement(input, categoryNames)

    const withSelected: ImportStatementResult = {
      ...result.data,
      transactions: result.data.transactions.map(t => ({ ...t, selected: true })),
    }

    return NextResponse.json(
      { data: withSelected },
      {
        headers: {
          'x-ai-provider':  result.provider,
          'x-ai-cache-hit': '0',
        },
      },
    )
  } catch (err) {
    if (err instanceof AIProvidersError) {
      // Loud internal log so missing env vars are obvious in Vercel logs
      console.error('[import-statement] all providers failed:', {
        kind:     err.kind,
        attempts: err.attempts,
        hint:     err.kind === 'auth'
          ? 'Set GOOGLE_GEMINI_API_KEY (or GROQ_API_KEY) in Vercel env vars.'
          : undefined,
      })
      if (err.kind === 'auth') {
        return NextResponse.json(
          {
            // User-facing: don't expose "not configured" — sounds broken. Treat
            // as temporary, suggest a workaround so they aren't blocked.
            error: 'Análise de extratos em manutenção. Volta dentro de momentos ou adiciona as transações manualmente.',
            code:  'ai_auth',
          },
          { status: 503 },
        )
      }
      if (err.kind === 'quota') {
        return NextResponse.json(
          {
            error: 'Serviço de análise de extratos temporariamente indisponível. Tenta novamente dentro de alguns minutos ou adiciona as transações manualmente.',
            code:  'ai_quota',
          },
          { status: 503 },
        )
      }
    }

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'A IA não conseguiu interpretar o ficheiro. Verifica o formato.' },
        { status: 422 },
      )
    }

    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[import-statement] unexpected failure:', msg, err)

    // Surface specific, actionable messages for the most common failures
    // instead of the opaque generic one. The cryptic "string did not match
    // the expected pattern" the user was seeing came from Vercel returning an
    // HTML 413 page that the client then tried to res.json().
    const lower = msg.toLowerCase()
    if (lower.includes('encrypted') || lower.includes('password')) {
      return NextResponse.json(
        { error: 'PDF protegido por palavra-passe. Remove a proteção antes de carregar.' },
        { status: 422 },
      )
    }
    if (lower.includes('safety') || lower.includes('blocked')) {
      return NextResponse.json(
        { error: 'A IA bloqueou o conteúdo por política de segurança. Verifica se o PDF é mesmo um extrato bancário.' },
        { status: 422 },
      )
    }
    if (lower.includes('timeout') || lower.includes('deadline')) {
      return NextResponse.json(
        { error: 'A análise demorou demasiado. Tenta um PDF mais pequeno ou com menos páginas.' },
        { status: 504 },
      )
    }
    return NextResponse.json(
      { error: 'Não foi possível processar o extrato. Verifica o formato do ficheiro ou tenta novamente.' },
      { status: 500 },
    )
  }
}
