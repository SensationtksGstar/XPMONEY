/**
 * AI provider abstraction for XP Money.
 *
 * Features:
 *  - SHA-256 hash-based cache for receipt scans (Supabase `ai_receipt_cache`)
 *  - Multi-provider fallback chain for resilience (most capable → lighter):
 *      1. Gemini 2.5 Flash   (primary — thinking model, best quality, free tier)
 *      2. Gemini 2.0 Flash   (secondary — fast non-thinking fallback)
 *      3. Groq Llama 4 Scout 17B (vision) / Llama 3.3 70B (text) — free tier
 *  - Exponential backoff retry (3 attempts) on 429 / quota errors
 *  - Consistent JSON output via model-specific JSON mode
 *
 * Public API:
 *   - scanReceipt(imageBase64, mimeType)        → ReceiptScanResult
 *   - parseStatement(content, filename, categoryNames) → StatementParseResult
 */

import { createHash }            from 'crypto'
import { GoogleGenerativeAI }    from '@google/generative-ai'
import { createSupabaseAdmin }   from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptScanResult {
  amount:        number | null
  merchant:      string | null
  date:          string | null
  description:   string | null
  category_hint: string | null
  items:         { name: string; price: number }[]
  currency:      string
  raw_text:      string
}

export interface ParsedTransaction {
  date:                 string
  description:          string
  original_description: string
  amount:               number
  type:                 'income' | 'expense'
  category_hint:        string
}

export interface StatementParseResult {
  bank:         string
  currency:     string
  total:        number
  transactions: ParsedTransaction[]
}

export interface AIResult<T> {
  data:        T
  provider:    string
  cache_hit:   boolean
  attempts:    string[]
}

export class AIProvidersError extends Error {
  constructor(public readonly attempts: string[], public readonly kind: 'quota' | 'auth' | 'bad_input' | 'unknown') {
    super(`All AI providers failed (${kind}): ${attempts.join(' | ')}`)
  }
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const RECEIPT_PROMPT = `És um extrator de dados de recibos/facturas portuguesas.
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

function buildStatementPrompt(content: string, filename: string, categoryNames: string): string {
  return `És um especialista em análise de extratos bancários portugueses.
Recebes o conteúdo bruto de um ficheiro CSV ou TXT exportado de um banco português.
A tua tarefa é identificar o banco, fazer parse de TODAS as transações e categorizá-las.

── Bancos comuns e formatos ──
- CGD (Caixa): CSV separado por ponto-e-vírgula, colunas Data/Descrição/Valor/Saldo
- Millennium BCP: CSV/Excel, colunas Data/Descritivo/Valor/Saldo
- BPI: CSV com ";" como separador, colunas "Data mov.", "Data valor", "Descrição", "Débito", "Crédito", "Saldo"
- Santander: CSV, colunas Data/Descrição/Montante/Saldo
- Novobanco / Montepio / Activobank: formato semelhante a BPI (Débito/Crédito separados)
- Wise / Revolut / N26: CSV em inglês, colunas "Date", "Description", "Amount"

── Regras de parsing ──
- Datas: aceita DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD — converte SEMPRE para YYYY-MM-DD
- Decimais PT: "1.234,56" ou "1234,56" → 1234.56 (ponto é milhares, vírgula é decimal)
- Decimais EN: "1,234.56" → 1234.56 (Wise/Revolut)
- Colunas Débito/Crédito SEPARADAS: valor em Débito → type="expense"; Crédito → type="income"
- Coluna única com sinal: negativo → expense; positivo → income
- IGNORA linhas de cabeçalho, totais, saldos iniciais/finais, linhas vazias
- "amount" é SEMPRE positivo (o type determina o sinal)

── Categorização ──
"PINGO","CONTINENTE","LIDL" → Alimentação · "GALP","BP","REPSOL" → Transportes ·
"EDP","MEO","NOS","VODAFONE" → Casa · "NETFLIX","SPOTIFY","HBO" → Lazer · "FARMACIA","CLINICA" → Saúde ·
"SALARIO","ORDENADO","VENCIMENTO" → Salário · "RENDA","CONDOMINIO" → Casa · "UBER","BOLT","METRO" → Transportes

Ficheiro: ${filename}

CONTEÚDO:
${content}

Devolve APENAS este JSON (sem markdown, sem texto extra):
{
  "bank": "<nome do banco identificado>",
  "currency": "<código ISO 3 letras, padrão EUR>",
  "total": <número total>,
  "transactions": [
    {
      "date": "<YYYY-MM-DD>",
      "description": "<descrição limpa em português>",
      "original_description": "<texto original>",
      "amount": <número positivo>,
      "type": "<income|expense>",
      "category_hint": "<categoria de: ${categoryNames}>"
    }
  ]
}`
}

// ── Keys ─────────────────────────────────────────────────────────────────────

function getGeminiKey(): string | null {
  const k =
    process.env.GOOGLE_GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY
  return k && !k.includes('xxxxxx') ? k : null
}

function getGroqKey(): string | null {
  const k = process.env.GROQ_API_KEY
  return k && !k.includes('xxxxxx') ? k : null
}

// ── Error classification ─────────────────────────────────────────────────────

function classifyError(msg: string): 'quota' | 'auth' | 'bad_input' | 'unknown' {
  if (/quota|resource[_ ]?exhausted|429|rate|billing|credit/i.test(msg)) return 'quota'
  if (/401|403|api[_ ]?key|unauthenticated|permission/i.test(msg))       return 'auth'
  if (/invalid.*?image|unsupported.*?mime|safety|400/i.test(msg))         return 'bad_input'
  return 'unknown'
}

// ── Retry with exponential backoff on quota errors ───────────────────────────

async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg  = err instanceof Error ? err.message : String(err)
      const kind = classifyError(msg)
      // Only retry quota/rate issues; auth and bad-input are permanent
      if (kind !== 'quota' || attempt === maxAttempts) throw err
      const delay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 500
      console.warn(`[ai:${label}] attempt ${attempt} quota-limited, retrying in ${Math.round(delay)}ms`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr ?? new Error('retry exhausted')
}

// ── JSON sanitiser ───────────────────────────────────────────────────────────

function stripJsonFence(raw: string): string {
  return raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

function normaliseReceipt(raw: string): ReceiptScanResult {
  const cleaned = stripJsonFence(raw)
  try {
    const parsed = JSON.parse(cleaned) as Partial<ReceiptScanResult>
    const amount = parsed.amount == null ? null : Math.abs(Number(parsed.amount))
    return {
      amount:        amount != null && !isNaN(amount) ? amount : null,
      merchant:      parsed.merchant      ?? null,
      date:          parsed.date          ?? null,
      description:   parsed.description   ?? null,
      category_hint: parsed.category_hint ?? null,
      items:         Array.isArray(parsed.items) ? parsed.items : [],
      currency:      parsed.currency      ?? 'EUR',
      raw_text:      parsed.raw_text      ?? '',
    }
  } catch {
    return {
      amount: null, merchant: null, date: null, description: null,
      category_hint: null, items: [], currency: 'EUR', raw_text: raw,
    }
  }
}

function normaliseStatement(raw: string): StatementParseResult {
  const cleaned = stripJsonFence(raw)
  const obj = JSON.parse(cleaned)
  return {
    bank:     obj.bank     ?? 'Banco desconhecido',
    currency: obj.currency ?? 'EUR',
    total:    obj.total    ?? 0,
    transactions: (obj.transactions ?? []).map((t: ParsedTransaction) => ({
      ...t,
      amount: Math.abs(Number(t.amount)) || 0,
    })),
  }
}

// ── Gemini provider ──────────────────────────────────────────────────────────

async function geminiVision(
  apiKey: string, model: string, imageBase64: string, mimeType: string,
): Promise<ReceiptScanResult> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const m = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature:      0.1,
      // 2.5 Flash is a thinking model: reasoning tokens are counted in the
      // output budget. Keep headroom so the JSON actually gets emitted.
      maxOutputTokens:  4096,
    },
  })
  const result = await m.generateContent([
    RECEIPT_PROMPT,
    { inlineData: { data: imageBase64, mimeType } },
  ])
  return normaliseReceipt(result.response.text())
}

async function geminiText(
  apiKey: string, model: string, prompt: string,
): Promise<StatementParseResult> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const m = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature:      0.1,
      // Statements can be long and 2.5 thinking tokens add overhead on top of
      // the JSON output — budget generously so we never truncate the array.
      maxOutputTokens:  16_384,
    },
  })
  const result = await m.generateContent(prompt)
  return normaliseStatement(result.response.text())
}

// ── Groq provider (OpenAI-compatible endpoint) ───────────────────────────────

interface GroqResponse {
  choices: { message: { content: string } }[]
  error?:  { message: string }
}

async function groqVision(
  apiKey: string, imageBase64: string, mimeType: string,
): Promise<ReceiptScanResult> {
  // Llama 4 Scout — current Groq vision-capable model (replaces deprecated
  // llama-3.2-90b-vision-preview which was removed in late 2025).
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role:    'user',
          content: [
            { type: 'text',      text: RECEIPT_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature:     0.1,
      max_tokens:      1024,
    }),
  })

  const json = await res.json() as GroqResponse
  if (!res.ok || json.error) {
    throw new Error(`Groq ${res.status}: ${json.error?.message ?? 'unknown'}`)
  }
  return normaliseReceipt(json.choices[0].message.content)
}

async function groqText(apiKey: string, prompt: string): Promise<StatementParseResult> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model:           'llama-3.3-70b-versatile',
      messages:        [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature:     0.1,
      max_tokens:      8192,
    }),
  })

  const json = await res.json() as GroqResponse
  if (!res.ok || json.error) {
    throw new Error(`Groq ${res.status}: ${json.error?.message ?? 'unknown'}`)
  }
  return normaliseStatement(json.choices[0].message.content)
}

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_DAYS = 30

export function hashImage(base64: string): string {
  return createHash('sha256').update(base64).digest('hex')
}

async function getCachedReceipt(hash: string): Promise<ReceiptScanResult | null> {
  try {
    const db = createSupabaseAdmin()
    const { data, error } = await db
      .from('ai_receipt_cache')
      .select('result, created_at')
      .eq('image_hash', hash)
      .maybeSingle()

    if (error || !data) return null

    const ageDays = (Date.now() - new Date(data.created_at).getTime()) / 86_400_000
    if (ageDays > CACHE_TTL_DAYS) return null

    // Fire-and-forget hit counter bump
    db.rpc('bump_ai_cache_hit', { p_hash: hash })
      .then(() => {})
      .then(null, (err: unknown) => console.warn('[ai-cache] bump failed:', err))

    return data.result as ReceiptScanResult
  } catch (err) {
    // Cache miss on any error — never let cache failures break scans
    console.warn('[ai-cache] read failed (non-fatal):', err)
    return null
  }
}

async function setCachedReceipt(
  hash: string, result: ReceiptScanResult, provider: string,
): Promise<void> {
  try {
    const db = createSupabaseAdmin()
    await db.from('ai_receipt_cache').upsert(
      {
        image_hash:  hash,
        result:      result as unknown as Record<string, unknown>,
        provider,
        last_hit_at: new Date().toISOString(),
      },
      { onConflict: 'image_hash' },
    )
  } catch (err) {
    console.warn('[ai-cache] write failed (non-fatal):', err)
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function scanReceipt(
  imageBase64: string, mimeType: string,
): Promise<AIResult<ReceiptScanResult>> {
  // 1) Cache lookup
  const hash   = hashImage(imageBase64)
  const cached = await getCachedReceipt(hash)
  if (cached) {
    return { data: cached, provider: 'cache', cache_hit: true, attempts: [] }
  }

  // 2) Provider chain
  const geminiKey = getGeminiKey()
  const groqKey   = getGroqKey()
  const attempts: string[] = []

  if (!geminiKey && !groqKey) {
    throw new AIProvidersError(['no-provider-configured'], 'auth')
  }

  // 2a) Gemini 2.5 Flash — most capable (thinking model, best OCR quality)
  if (geminiKey) {
    try {
      const data = await withRetry(
        () => geminiVision(geminiKey, 'gemini-2.5-flash', imageBase64, mimeType),
        'gemini-2.5-flash',
      )
      await setCachedReceipt(hash, data, 'gemini-2.5-flash')
      return { data, provider: 'gemini-2.5-flash', cache_hit: false, attempts }
    } catch (err) {
      attempts.push(`gemini-2.5-flash: ${err instanceof Error ? err.message : err}`)
    }

    // 2b) Gemini 2.0 Flash — non-thinking fallback (different quota pool)
    try {
      const data = await withRetry(
        () => geminiVision(geminiKey, 'gemini-2.0-flash', imageBase64, mimeType),
        'gemini-2.0-flash',
      )
      await setCachedReceipt(hash, data, 'gemini-2.0-flash')
      return { data, provider: 'gemini-2.0-flash', cache_hit: false, attempts }
    } catch (err) {
      attempts.push(`gemini-2.0-flash: ${err instanceof Error ? err.message : err}`)
    }
  }

  // 2c) Groq Llama 4 Scout 17B Vision
  if (groqKey) {
    try {
      const data = await withRetry(
        () => groqVision(groqKey, imageBase64, mimeType),
        'groq-vision',
      )
      await setCachedReceipt(hash, data, 'groq-llama-4-scout')
      return { data, provider: 'groq-llama-4-scout', cache_hit: false, attempts }
    } catch (err) {
      attempts.push(`groq-vision: ${err instanceof Error ? err.message : err}`)
    }
  }

  // All providers exhausted
  const kind = classifyError(attempts.join(' | '))
  throw new AIProvidersError(attempts, kind)
}

export async function parseStatement(
  content: string, filename: string, categoryNames: string,
): Promise<AIResult<StatementParseResult>> {
  const prompt = buildStatementPrompt(content, filename, categoryNames)

  const geminiKey = getGeminiKey()
  const groqKey   = getGroqKey()
  const attempts: string[] = []

  if (!geminiKey && !groqKey) {
    throw new AIProvidersError(['no-provider-configured'], 'auth')
  }

  if (geminiKey) {
    // Primary: Gemini 2.5 Flash — reasoning helps with ambiguous bank rows
    try {
      const data = await withRetry(
        () => geminiText(geminiKey, 'gemini-2.5-flash', prompt),
        'gemini-2.5-flash',
      )
      return { data, provider: 'gemini-2.5-flash', cache_hit: false, attempts }
    } catch (err) {
      attempts.push(`gemini-2.5-flash: ${err instanceof Error ? err.message : err}`)
    }

    // Secondary: Gemini 2.0 Flash — separate quota pool on the same key
    try {
      const data = await withRetry(
        () => geminiText(geminiKey, 'gemini-2.0-flash', prompt),
        'gemini-2.0-flash',
      )
      return { data, provider: 'gemini-2.0-flash', cache_hit: false, attempts }
    } catch (err) {
      attempts.push(`gemini-2.0-flash: ${err instanceof Error ? err.message : err}`)
    }
  }

  if (groqKey) {
    try {
      const data = await withRetry(
        () => groqText(groqKey, prompt),
        'groq-llama-3.3',
      )
      return { data, provider: 'groq-llama-3.3', cache_hit: false, attempts }
    } catch (err) {
      attempts.push(`groq-llama-3.3: ${err instanceof Error ? err.message : err}`)
    }
  }

  const kind = classifyError(attempts.join(' | '))
  throw new AIProvidersError(attempts, kind)
}
