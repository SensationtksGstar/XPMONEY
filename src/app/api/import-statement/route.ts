import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { isDemoMode, demoResponse }    from '@/lib/demo/demoGuard'
import { DEMO_CATEGORIES }             from '@/lib/demo/mockData'
import {
  parseStatement, AIProvidersError,
  type StatementParseResult, type ParsedTransaction as LibParsedTransaction,
} from '@/lib/ai'
import { getServerLocale }             from '@/lib/i18n/server'
import type { Locale }                 from '@/lib/i18n/translations'

// Extended shape used by the UI (adds `selected` for deselection flow)
export interface ParsedTransaction extends LibParsedTransaction {
  selected: boolean
}

export interface ImportStatementResult extends Omit<StatementParseResult, 'transactions'> {
  transactions: ParsedTransaction[]
}

// PDFs com muitas páginas chegam a demorar 90-120s no Gemini (especialmente
// extratos de cartão com dezenas de movimentos). Vercel Hobby clampa a 60s,
// Pro aceita até 300s — deixamos 300 para correr o máximo que o plano
// permitir e a UI tem um timeout de cliente mais generoso (240s) com aviso
// claro.
export const runtime     = 'nodejs'
export const maxDuration = 300

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

// Small ternary helper so the many inline error messages below stay scannable.
const L = (locale: Locale, pt: string, en: string) => (locale === 'en' ? en : pt)

export async function POST(req: NextRequest) {
  if (isDemoMode()) return demoResponse(DEMO_RESULT)

  const locale = await getServerLocale()

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
        error: L(locale,
          'Importação de extratos disponível apenas no plano Premium.',
          'Statement import is available only on the Premium plan.'),
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
    return NextResponse.json(
      { error: L(locale, 'Conteúdo inválido.', 'Invalid content.') },
      { status: 400 },
    )
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
        {
          error: L(locale,
            'PDF corrompido ou mal codificado. Tenta exportar o extrato de novo.',
            'Corrupted or badly encoded PDF. Try re-exporting the statement.'),
        },
        { status: 400 },
      )
    }

    // base64 is ~4/3 the size of the decoded binary
    const approxBytes = Math.floor(cleaned.length * 0.75)
    if (approxBytes > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          error: L(locale,
            'PDF demasiado grande. Máximo 3 MB. Experimenta exportar só as páginas com movimentos.',
            'PDF too large. Max 3 MB. Try exporting only the pages with transactions.'),
        },
        { status: 413 },
      )
    }
    if (approxBytes < 500) {
      return NextResponse.json(
        { error: L(locale, 'PDF vazio ou inválido.', 'Empty or invalid PDF.') },
        { status: 400 },
      )
    }
    // Quick magic-bytes check: base64 of "%PDF" starts with "JVBERi".
    if (!cleaned.startsWith('JVBERi')) {
      return NextResponse.json(
        {
          error: L(locale,
            'Ficheiro não parece ser um PDF válido.',
            'File does not look like a valid PDF.'),
        },
        { status: 400 },
      )
    }

    return runParse({ kind: 'pdf', pdfBase64: cleaned, filename }, categoryNames, locale)
  }

  // Text path
  const content = body.content
  if (!content || content.trim().length < 10) {
    return NextResponse.json(
      { error: L(locale, 'Conteúdo inválido.', 'Invalid content.') },
      { status: 400 },
    )
  }
  if (content.length > MAX_TEXT_BYTES) {
    return NextResponse.json(
      {
        error: L(locale,
          'Ficheiro demasiado grande (máx 200 KB de texto).',
          'File too large (max 200 KB of text).'),
      },
      { status: 413 },
    )
  }

  return runParse({ kind: 'text', content, filename }, categoryNames, locale)
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared parse + error translation
// ─────────────────────────────────────────────────────────────────────────────

async function runParse(
  input:
    | { kind: 'text'; content: string; filename: string }
    | { kind: 'pdf';  pdfBase64: string; filename: string },
  categoryNames: string,
  locale: Locale = 'pt',
): Promise<NextResponse> {
  try {
    const result = await parseStatement(input, categoryNames, locale)

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
      // Loud internal log so missing env vars são óbvios nos logs da Vercel
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
            // Mensagem explícita: a causa mais provável é env var mal
            // configurada. Em vez da antiga "em manutenção" genérica,
            // dizemos ao user que parece ser chave, com fallback para
            // contacto se o user não for admin.
            error: L(locale,
              'A autenticação com os providers de IA falhou. Se és admin, verifica GOOGLE_GEMINI_API_KEY e GROQ_API_KEY no Vercel. Entretanto, adiciona as transações manualmente.',
              'Authentication with the AI providers failed. If you are the admin, check GOOGLE_GEMINI_API_KEY and GROQ_API_KEY in Vercel. In the meantime, add the transactions manually.'),
            code:     'ai_auth',
            attempts: err.attempts.map(a => a.slice(0, 240)),
          },
          { status: 503 },
        )
      }
      if (err.kind === 'quota') {
        // Distinguir daily quota vs per-minute rate vs billing usando
        // FRASES completas (word boundaries), evitando falsos positivos
        // como "credentials" a accionar billing.
        const attemptsStr = err.attempts.join(' ').toLowerCase()
        const isDaily =
          /\bresource[_ ]?exhausted\b|quota.*exceeded.*day|\bdaily\s+limit\b/.test(attemptsStr)
        const isBilling =
          /\bbilling\b|\binsufficient\s+credits?\b|\bpayment\s+required\b|\bsubscription\s+(expired|required)\b/.test(attemptsStr)

        const message = isBilling
          ? L(locale,
              'A conta da IA atingiu o limite de créditos. Contacta-nos pelo formulário — vamos resolver.',
              'The AI account hit its credit limit. Contact us via the form — we will fix it.')
          : isDaily
          ? L(locale,
              'A quota diária da IA foi atingida. Reinicia à meia-noite (Pacífico) ou converte o PDF em CSV no site do banco — CSVs não consomem IA e entram de imediato.',
              'The AI daily quota has been reached. It resets at midnight (Pacific time). Alternatively, export the statement as CSV from your bank — CSVs do not consume AI quota and import instantly.')
          : L(locale,
              'Muitos pedidos ao mesmo tempo — o plano gratuito da IA tem limite por minuto. Tenta novamente daqui a 60 segundos. Se persistir, usa CSV em vez de PDF.',
              'Too many requests at once — the free AI tier has a per-minute limit. Try again in 60 seconds. If it persists, use CSV instead of PDF.')

        return NextResponse.json(
          {
            error: message,
            code:  'ai_quota',
            // Expomos os attempts truncados para debug. Cada attempt é do
            // formato "<provider>: <error>", nunca contém a API key.
            attempts: err.attempts.map(a => a.slice(0, 240)),
          },
          { status: 503 },
        )
      }

      // Outros kinds (bad_input, unknown) — auth e quota já retornaram
      // acima. Devolve mensagem + attempts para debugging.
      return NextResponse.json(
        {
          error: err.kind === 'bad_input'
            ? L(locale,
                'A IA bloqueou o conteúdo por política de segurança ou formato inválido. Verifica se o ficheiro é mesmo um extrato.',
                'The AI blocked the content due to a safety policy or invalid format. Check that the file is actually a bank statement.')
            : L(locale,
                'Não foi possível processar — todos os providers falharam. Expande "Detalhes técnicos" para ver o que cada um respondeu.',
                'Could not process — all providers failed. Expand "Technical details" to see what each one returned.'),
          code:     err.kind === 'bad_input' ? 'ai_bad_input' : 'ai_unknown',
          attempts: err.attempts.map(a => a.slice(0, 240)),
        },
        { status: err.kind === 'bad_input' ? 422 : 503 },
      )
    }

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: L(locale,
            'A IA não conseguiu interpretar o ficheiro. Verifica o formato.',
            'The AI could not interpret the file. Check the format.'),
        },
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
        {
          error: L(locale,
            'PDF protegido por palavra-passe. Remove a proteção antes de carregar.',
            'Password-protected PDF. Remove the protection before uploading.'),
        },
        { status: 422 },
      )
    }
    if (lower.includes('safety') || lower.includes('blocked')) {
      return NextResponse.json(
        {
          error: L(locale,
            'A IA bloqueou o conteúdo por política de segurança. Verifica se o PDF é mesmo um extrato bancário.',
            'The AI blocked the content due to a safety policy. Check that the PDF is actually a bank statement.'),
        },
        { status: 422 },
      )
    }
    if (lower.includes('timeout') || lower.includes('deadline')) {
      return NextResponse.json(
        {
          error: L(locale,
            'A análise demorou demasiado. Tenta um PDF mais pequeno ou com menos páginas.',
            'Analysis took too long. Try a smaller PDF or one with fewer pages.'),
        },
        { status: 504 },
      )
    }
    return NextResponse.json(
      {
        error: L(locale,
          'Não foi possível processar o extrato. Verifica o formato do ficheiro ou tenta novamente.',
          'Could not process the statement. Check the file format or try again.'),
      },
      { status: 500 },
    )
  }
}
