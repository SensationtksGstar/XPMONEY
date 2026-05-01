/**
 * AI provider abstraction for XP-Money.
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
import { jsonrepair }            from 'jsonrepair'
import { createSupabaseAdmin }   from '@/lib/supabase'
import type { Locale }           from '@/lib/i18n/translations'

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
//
// IMPORTANT — locale policy for AI categorisation
// ────────────────────────────────────────────────
// The `category_hint` that the model returns is later matched against category
// names stored in the database. Those names are **user data** (seeded in PT:
// "Alimentação", "Transportes" …) and MUST NOT be renamed per-locale — a rename
// would break historical transactions that reference them.
//
// Consequence: even for EN users the prompts still instruct the model to emit
// the PT category names verbatim. The UI translates them at render time via the
// translation layer. What the EN prompt *does* change:
//   - The instruction language is English (better adherence for EN-biased
//     training sets like Llama).
//   - The cleaned `description` field is emitted in English so the receipt/
//     statement preview is intelligible to the user.
// Keep this contract if you edit the prompts.

const RECEIPT_PROMPT_PT = `És um extrator de dados de recibos/facturas portuguesas.
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

// EN variant — behaviourally identical. Categories stay in PT (stored in DB,
// see note at top of section). `description` is emitted in English.
const RECEIPT_PROMPT_EN = `You are a data extractor for Portuguese receipts and invoices.
Available categories (Portuguese — output them VERBATIM in the PT form, do NOT translate): Alimentação, Transporte, Saúde, Lazer, Educação, Casa, Roupas, Tecnologia, Salário, Freelance, Outros.
For category_hint, pick the closest semantic match from the list above based on the merchant/items, and output the Portuguese name exactly as written.
For date, use format YYYY-MM-DD. If no year is visible, assume the current year.

Return ONLY this JSON (no markdown, no extra text):
{
  "amount": <total as number, or null>,
  "merchant": <store/restaurant name, or null>,
  "date": <"YYYY-MM-DD" or null>,
  "description": <short English description such as "Groceries at Continente" or "Dinner at TGI", or null>,
  "category_hint": <one of the Portuguese category names above, or null>,
  "items": [{"name": "<item>", "price": <price>}],
  "currency": "<ISO 3-letter code, default EUR>",
  "raw_text": "<all visible text, comma-separated>"
}`

function buildReceiptPrompt(locale: Locale = 'pt'): string {
  return locale === 'en' ? RECEIPT_PROMPT_EN : RECEIPT_PROMPT_PT
}

function buildStatementInstructionsPT(filename: string, categoryNames: string): string {
  return `És um especialista em análise de extratos bancários portugueses.
Recebes um ficheiro exportado de um banco (CSV/TXT/TSV com texto bruto, ou um PDF scan do extrato).
A tua tarefa é identificar o banco, fazer parse de TODAS as transações e categorizá-las.

── Bancos comuns e formatos ──
- CGD (Caixa): CSV separado por ponto-e-vírgula, colunas Data/Descrição/Valor/Saldo · PDF com logo Caixa
- Millennium BCP: CSV/Excel, colunas Data/Descritivo/Valor/Saldo · PDF com logo Millennium
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
- Em PDFs: cada linha de movimento tipicamente tem Data, Descrição e Valor (pode ter sinal ou estar em colunas separadas)
- IGNORA linhas de cabeçalho, totais, saldos iniciais/finais, linhas vazias, páginas em branco
- "amount" é SEMPRE positivo (o type determina o sinal)

── Categorização ──
"PINGO","CONTINENTE","LIDL" → Alimentação · "GALP","BP","REPSOL" → Transportes ·
"EDP","MEO","NOS","VODAFONE" → Casa · "NETFLIX","SPOTIFY","HBO" → Lazer · "FARMACIA","CLINICA" → Saúde ·
"SALARIO","ORDENADO","VENCIMENTO" → Salário · "RENDA","CONDOMINIO" → Casa · "UBER","BOLT","METRO" → Transportes

Ficheiro: ${filename}

Devolve APENAS este JSON (sem markdown, sem texto extra):
{
  "bank": "<nome do banco identificado>",
  "currency": "<código ISO 3 letras, padrão EUR>",
  "total": <número total de transações>,
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

// EN variant — same behaviour. Categories are still matched against PT DB
// names (see note at top of section). Cleaned descriptions go out in English.
function buildStatementInstructionsEN(filename: string, categoryNames: string): string {
  return `You are an expert in parsing Portuguese bank statements.
You receive a file exported from a bank (CSV/TXT/TSV as raw text, or a PDF scan of the statement).
Your task is to identify the bank, parse EVERY transaction and categorise them.

── Common banks and formats ──
- CGD (Caixa): CSV with semicolon separator, columns Data/Descrição/Valor/Saldo · PDF with Caixa logo
- Millennium BCP: CSV/Excel, columns Data/Descritivo/Valor/Saldo · PDF with Millennium logo
- BPI: CSV with ";" separator, columns "Data mov.", "Data valor", "Descrição", "Débito", "Crédito", "Saldo"
- Santander: CSV, columns Data/Descrição/Montante/Saldo
- Novobanco / Montepio / Activobank: format similar to BPI (Débito/Crédito as separate columns)
- Wise / Revolut / N26: English CSV, columns "Date", "Description", "Amount"

── Parsing rules ──
- Dates: accept DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD — ALWAYS convert to YYYY-MM-DD
- PT decimals: "1.234,56" or "1234,56" → 1234.56 (dot is thousands separator, comma is decimal)
- EN decimals: "1,234.56" → 1234.56 (Wise/Revolut)
- SEPARATE Débito/Crédito columns: value in Débito → type="expense"; Crédito → type="income"
- Single signed column: negative → expense; positive → income
- In PDFs: each movement row typically has Date, Description and Amount (may be signed or in separate columns)
- IGNORE header rows, totals, opening/closing balances, empty lines, blank pages
- "amount" is ALWAYS positive (the type determines the sign)

── Categorisation ──
"PINGO","CONTINENTE","LIDL" → Alimentação · "GALP","BP","REPSOL" → Transportes ·
"EDP","MEO","NOS","VODAFONE" → Casa · "NETFLIX","SPOTIFY","HBO" → Lazer · "FARMACIA","CLINICA" → Saúde ·
"SALARIO","ORDENADO","VENCIMENTO" → Salário · "RENDA","CONDOMINIO" → Casa · "UBER","BOLT","METRO" → Transportes
(Category names above are in Portuguese — output them VERBATIM, DO NOT translate to English.)

File: ${filename}

Return ONLY this JSON (no markdown, no extra text):
{
  "bank": "<identified bank name>",
  "currency": "<ISO 3-letter code, default EUR>",
  "total": <total number of transactions>,
  "transactions": [
    {
      "date": "<YYYY-MM-DD>",
      "description": "<cleaned description in English>",
      "original_description": "<original text, unchanged>",
      "amount": <positive number>,
      "type": "<income|expense>",
      "category_hint": "<one of (Portuguese, verbatim): ${categoryNames}>"
    }
  ]
}`
}

function buildStatementInstructions(
  filename: string, categoryNames: string, locale: Locale = 'pt',
): string {
  return locale === 'en'
    ? buildStatementInstructionsEN(filename, categoryNames)
    : buildStatementInstructionsPT(filename, categoryNames)
}

function buildStatementPromptWithContent(
  content: string, filename: string, categoryNames: string, locale: Locale = 'pt',
): string {
  const header = locale === 'en' ? 'CONTENT' : 'CONTEÚDO'
  return `${buildStatementInstructions(filename, categoryNames, locale)}

${header}:
${content}`
}

// ── Keys ─────────────────────────────────────────────────────────────────────

/**
 * Extrai texto puro de um PDF codificado em base64, usando `unpdf` (wrapper
 * serverless-friendly do pdfjs-dist).
 *
 * Usado como fallback quando o pipeline nativo do Gemini (vision) falha por
 * quota — o texto extraído localmente é depois enviado para qualquer
 * provider de texto (Gemini 2.5 text OU Groq Llama), cujo pool de quota é
 * diferente do pool de vision.
 *
 * Limitações conhecidas:
 *   - PDFs scanned/images (sem camada de texto) devolvem string vazia. Se
 *     detectarmos <50 chars, registamos e deixamos o chain continuar
 *     (eventualmente com erro claro ao user).
 *   - Dynamic import — unpdf traz pdfjs-dist que é pesado. Não carregamos
 *     no cold start dos outros endpoints.
 */
async function extractPdfText(pdfBase64: string): Promise<string> {
  // Decodificar base64 → Uint8Array
  const bin = Buffer.from(pdfBase64, 'base64')
  const bytes = new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength)

  // unpdf: importado dinamicamente para não inflar o cold start de outros endpoints
  const { extractText } = await import('unpdf')
  const result = await extractText(bytes, { mergePages: true })
  const text = (result as { text?: unknown }).text
  if (typeof text === 'string') return text
  if (Array.isArray(text)) return text.join('\n')
  return ''
}

/**
 * Promise.race wrapper que rejeita após `ms` se a promessa original não
 * resolver. NÃO cancela o trabalho subjacente (o SDK do Gemini não expõe
 * AbortSignal em generateContent), apenas pára a espera para o chain
 * conseguir continuar para o próximo provider.
 *
 * Sem isto, uma chamada Gemini que demore 120s+ encadeada com fallbacks
 * empurra o tempo total acima dos 240s do AbortController do cliente, e o
 * user vê "ultrapassou 4 minutos" sem feedback útil.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: timeout after ${ms}ms`))
    }, ms)
    p.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

// Limite suave de texto extraído de PDF antes de enviar para a IA. Acima
// disto (~30k tokens só de input + ainda mais para output), Gemini fica
// minutos a processar e muitas vezes trunca ou estoira o budget do cliente.
// Melhor recusar logo com instrução clara — extratos anuais grandes devem
// ser divididos por mês ou exportados em CSV.
const PDF_TEXT_HARD_LIMIT = 120_000

// Per-provider call timeout. Texto path: 3 calls × 60s = 180s, ainda 60s
// abaixo do AbortController do cliente (240s). Vision path (mais raro): 2
// calls × 60s = 120s.
const PROVIDER_CALL_TIMEOUT_MS = 60_000

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

/**
 * Classifica um erro textual num dos quatro kinds. A ordem das verificações
 * importa — auth vai primeiro porque mensagens como "invalid credentials"
 * continham a substring "credit" e o regex antigo classificava-as como
 * 'quota', mostrando ao user "limite de créditos atingido" quando na
 * verdade era uma chave errada.
 *
 * Regras:
 *   - Usa word boundaries (`\b`) onde a substring for ambígua (credit,
 *     rate, etc). "Credentials" já não dispara 'quota'.
 *   - Auth antes de quota: a maioria dos providers devolve 401/403 com
 *     palavras que podiam ser confundidas com quota ("rate limiter auth
 *     required", etc).
 *   - "Insufficient credits" é legítimo de billing, mas só disparamos
 *     billing com frase completa (não só "credit").
 */
function classifyError(msg: string): 'quota' | 'auth' | 'bad_input' | 'unknown' {
  // Auth PRIMEIRO — mensagens "invalid api key", "unauthenticated", 401/403
  if (/\b(401|403)\b|\bapi[_ -]?key\b|unauthenticated|invalid[_ ]?(credential|api[_ -]?key)|\bpermission\s+denied\b/i.test(msg)) {
    return 'auth'
  }
  // Quota / rate-limit — frases distintivas
  if (/\bquota\b|resource[_ ]?exhausted|\b429\b|\brate[_ -]?limit|\bbilling\b|\binsufficient\s+(credits?|balance)\b|\bover\s+limit\b/i.test(msg)) {
    return 'quota'
  }
  if (/invalid.*?image|unsupported.*?mime|\bsafety\b|\b400\b/i.test(msg)) {
    return 'bad_input'
  }
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

/**
 * Tenta fazer parse de JSON possivelmente malformado vindo dum LLM.
 *
 * Razão: os modelos de chat (especialmente Gemini 2.5) falham em escapar
 * aspas dentro de descrições de transações, o que faz `JSON.parse` dar
 * "Expected double-quoted property name at position X". O jsonrepair
 * consegue recuperar destes casos (aspas não escapadas, trailing commas,
 * comentários, chaves sem aspas, strings em single-quote, etc).
 *
 * Ordem:
 *   1. Remove fences markdown (```json ... ```)
 *   2. Corta lixo antes do primeiro { e depois do último }
 *   3. JSON.parse directo (caminho rápido — LLM bem comportado)
 *   4. jsonrepair + JSON.parse (fallback robusto)
 *
 * Atira a exceção original se ambos falharem.
 */
function safeJsonParse<T = unknown>(raw: string): T {
  const cleaned = stripJsonFence(raw)

  // Crop a qualquer preâmbulo/epílogo textual do LLM — alguns modelos
  // insistem em escrever "Aqui está o JSON:" antes, mesmo quando em
  // JSON mode. Procuramos { ... } ou [ ... ] e ignoramos o resto.
  const firstBrace = Math.min(
    ...[cleaned.indexOf('{'), cleaned.indexOf('[')].filter(i => i >= 0),
  )
  const lastBrace = Math.max(
    cleaned.lastIndexOf('}'),
    cleaned.lastIndexOf(']'),
  )
  const trimmed = firstBrace >= 0 && lastBrace > firstBrace
    ? cleaned.slice(firstBrace, lastBrace + 1)
    : cleaned

  try {
    return JSON.parse(trimmed) as T
  } catch (firstErr) {
    try {
      const repaired = jsonrepair(trimmed)
      return JSON.parse(repaired) as T
    } catch {
      // Se jsonrepair também falhar, relança o erro original — mais
      // informativo para o classifier.
      throw firstErr
    }
  }
}

function normaliseReceipt(raw: string): ReceiptScanResult {
  try {
    const parsed = safeJsonParse<Partial<ReceiptScanResult>>(raw)
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
  const obj = safeJsonParse<{
    bank?:         string
    currency?:     string
    total?:        number
    transactions?: ParsedTransaction[]
  }>(raw)
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
  prompt: string,
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
    prompt,
    { inlineData: { data: imageBase64, mimeType } },
  ])
  return normaliseReceipt(result.response.text())
}

async function geminiText(
  apiKey: string, model: string, prompt: string,
): Promise<StatementParseResult> {
  const genAI = new GoogleGenerativeAI(apiKey)
  // Extratos reais podem ter 150-300 transações num único mês (conta
  // activa com débitos frequentes). Cada transação em JSON ocupa ~100
  // tokens → 300 × 100 = 30k tokens só de output. A 16k anterior
  // truncava → jsonrepair recuperava apenas o fragmento inicial
  // válido → user via "só 7 transações de 178". Gemini 2.5 Flash
  // aceita até 65536 output tokens; 2.0 Flash clampa automaticamente
  // a 8192 que é o seu máximo.
  const maxTokens = model.startsWith('gemini-2.5') ? 65_536 : 8192
  const m = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature:      0.1,
      maxOutputTokens:  maxTokens,
    },
  })
  const result    = await m.generateContent(prompt)
  const finishReason = result.response.candidates?.[0]?.finishReason
  if (finishReason === 'MAX_TOKENS') {
    console.warn(`[ai:${model}] response truncated at MAX_TOKENS — PDF pode ter mais transações do que o modelo conseguiu listar`)
  }
  return normaliseStatement(result.response.text())
}

/**
 * Gemini PDF statement parser — sends the PDF as inline binary data
 * usando maxOutputTokens dinâmico: 65k para 2.5 Flash, 8k para 2.0. O
 * PDF pode conter 150-300 transações que ultrapassam o budget antigo.
 * alongside the instructions. Both 2.5 Flash and 2.0 Flash can read PDFs
 * natively up to ~20 MB (we clamp at 8 MB server-side for speed/cost).
 */
async function geminiPdfStatement(
  apiKey: string, model: string, pdfBase64: string, instructions: string,
): Promise<StatementParseResult> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const maxTokens = model.startsWith('gemini-2.5') ? 65_536 : 8192
  const m = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature:      0.1,
      maxOutputTokens:  maxTokens,
    },
  })
  const result = await m.generateContent([
    instructions,
    { inlineData: { data: pdfBase64, mimeType: 'application/pdf' } },
  ])
  const finishReason = result.response.candidates?.[0]?.finishReason
  if (finishReason === 'MAX_TOKENS') {
    console.warn(`[ai:${model}] PDF response truncated — muitas transações para caber na resposta. Considera dividir o PDF por quinzena.`)
  }
  return normaliseStatement(result.response.text())
}

// ── Groq provider (OpenAI-compatible endpoint) ───────────────────────────────

interface GroqResponse {
  choices: { message: { content: string } }[]
  error?:  { message: string }
}

async function groqVision(
  apiKey: string, imageBase64: string, mimeType: string, prompt: string,
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
            { type: 'text',      text: prompt },
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
  /**
   * Groq é stricto em `response_format: json_object` — se o prompt for
   * muito longo (extratos grandes geram prompts de ~15k tokens) ou se
   * o modelo não estiver 100% confiante em produzir JSON válido,
   * devolve 400 "Failed to generate JSON. Please adjust your prompt.".
   *
   * Estratégia: primeiro tentar com json_object (força o modelo a
   * output estrito). Se falhar com 400, retry SEM json_object mas com
   * instrução reforçada no prompt — o safeJsonParse vai recuperar o
   * JSON mesmo que venha embrulhado em prosa.
   */
  const callGroq = async (useJsonMode: boolean): Promise<string> => {
    const extraInstr = useJsonMode
      ? ''
      : '\n\n❗ Responde APENAS com o JSON válido, sem texto antes nem depois, sem blocos de código, sem explicações.'
    const body: Record<string, unknown> = {
      model:       'llama-3.3-70b-versatile',
      messages:    [{ role: 'user', content: prompt + extraInstr }],
      temperature: 0.1,
      // Extratos longos precisam de muito output — llama-3.3 aceita 32k
      max_tokens:  32_768,
    }
    if (useJsonMode) body.response_format = { type: 'json_object' }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const json = await res.json() as GroqResponse
    if (!res.ok || json.error) {
      const msg = json.error?.message ?? 'unknown'
      const err = new Error(`Groq ${res.status}: ${msg}`)
      // Marcar erros de json_mode para distinguir de auth/quota no caller
      if (res.status === 400 && /generate json|json.*failed/i.test(msg)) {
        (err as Error & { isJsonModeError?: boolean }).isJsonModeError = true
      }
      throw err
    }
    return json.choices[0].message.content
  }

  try {
    return normaliseStatement(await callGroq(true))
  } catch (err) {
    if ((err as Error & { isJsonModeError?: boolean }).isJsonModeError) {
      console.warn('[ai:groq] json_object mode failed, retrying without it')
      return normaliseStatement(await callGroq(false))
    }
    throw err
  }
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
  imageBase64: string, mimeType: string, locale: Locale = 'pt',
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
  const receiptPrompt = buildReceiptPrompt(locale)

  if (!geminiKey && !groqKey) {
    throw new AIProvidersError(['no-provider-configured'], 'auth')
  }

  // 2a) Gemini 2.5 Flash — most capable (thinking model, best OCR quality)
  if (geminiKey) {
    try {
      const data = await withRetry(
        () => geminiVision(geminiKey, 'gemini-2.5-flash', imageBase64, mimeType, receiptPrompt),
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
        () => geminiVision(geminiKey, 'gemini-2.0-flash', imageBase64, mimeType, receiptPrompt),
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
        () => groqVision(groqKey, imageBase64, mimeType, receiptPrompt),
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

/**
 * Parse a bank statement — accepts either raw text (CSV/TSV/TXT) or a PDF.
 * When `pdfBase64` is supplied, only Gemini providers are tried (Groq's text
 * models don't read PDFs). Falls through to Groq as a text-only fallback when
 * the input is textual.
 */
export async function parseStatement(
  input:
    | { kind: 'text'; content: string; filename: string }
    | { kind: 'pdf';  pdfBase64: string; filename: string },
  categoryNames: string,
  locale: Locale = 'pt',
): Promise<AIResult<StatementParseResult>> {
  const instructions = buildStatementInstructions(input.filename, categoryNames, locale)

  const geminiKey = getGeminiKey()
  const groqKey   = getGroqKey()
  const attempts: string[] = []

  if (!geminiKey && !groqKey) {
    throw new AIProvidersError(['no-provider-configured'], 'auth')
  }

  // ── PDF path: TEXT FIRST, vision só se texto falhar (April 2026) ──
  //
  // Reordenação (abril 2026): extratos bancários modernos são PDFs com
  // camada de texto (pesquisáveis). Usar unpdf para extrair texto e
  // depois enviar via texto é MUITO melhor do que vision porque:
  //   1. Input muito menor (texto << base64 de imagem) → mais rápido
  //   2. Output não compete com tokens de imagem → menos trunca em
  //      extratos longos (150-300 transações)
  //   3. Mais resiliente a tabelas mal formatadas — o texto já vem
  //      linearizado pelo unpdf
  //   4. Vision só é essencial para PDFs scanned (sem camada de texto)
  //
  // Chain para PDFs com texto:
  //   1) unpdf → Gemini 2.5 text (ideal — quality, 65k tokens)
  //   2) unpdf → Gemini 2.0 text (mesmo quota pool, fallback de modelo)
  //   3) unpdf → Groq Llama (quota totalmente diferente, 32k tokens)
  //
  // Fallback vision (se texto não for extraível):
  //   4) Gemini 2.5 vision (para scanned PDFs)
  //   5) Gemini 2.0 vision
  if (input.kind === 'pdf') {
    if (!geminiKey && !groqKey) {
      throw new AIProvidersError(['pdf-no-providers'], 'auth')
    }

    // Tentar extracção de texto PRIMEIRO
    let extractedText: string | null = null
    try {
      extractedText = await extractPdfText(input.pdfBase64)
    } catch (err) {
      attempts.push(`unpdf-extract: ${err instanceof Error ? err.message : err}`)
    }

    // Pre-flight: PDFs com >120k chars de texto extraído são extratos
    // anuais ou consolidados de múltiplas contas — Gemini demora 3-5 min e
    // muitas vezes trunca a resposta. Recusamos logo com mensagem clara
    // em vez de fazer o user esperar 4 min para ver "ultrapassou o tempo".
    if (extractedText && extractedText.length > PDF_TEXT_HARD_LIMIT) {
      throw new Error(
        `STATEMENT_TOO_LARGE: extracted ${extractedText.length} chars — split PDF by month or use CSV`,
      )
    }

    // Caminho texto — preferido
    if (extractedText && extractedText.trim().length > 50) {
      const textPrompt = buildStatementPromptWithContent(extractedText, input.filename, categoryNames, locale)

      if (geminiKey) {
        try {
          const data = await withRetry(
            () => withTimeout(
              geminiText(geminiKey, 'gemini-2.5-flash', textPrompt),
              PROVIDER_CALL_TIMEOUT_MS, 'gemini-2.5-flash-text',
            ),
            'gemini-2.5-flash-text',
          )
          return { data, provider: 'gemini-2.5-flash-text', cache_hit: false, attempts }
        } catch (err) {
          attempts.push(`gemini-2.5-flash-text: ${err instanceof Error ? err.message : err}`)
        }

        try {
          const data = await withRetry(
            () => withTimeout(
              geminiText(geminiKey, 'gemini-2.0-flash', textPrompt),
              PROVIDER_CALL_TIMEOUT_MS, 'gemini-2.0-flash-text',
            ),
            'gemini-2.0-flash-text',
          )
          return { data, provider: 'gemini-2.0-flash-text', cache_hit: false, attempts }
        } catch (err) {
          attempts.push(`gemini-2.0-flash-text: ${err instanceof Error ? err.message : err}`)
        }
      }

      if (groqKey) {
        try {
          const data = await withRetry(
            () => withTimeout(
              groqText(groqKey, textPrompt),
              PROVIDER_CALL_TIMEOUT_MS, 'groq-llama-text',
            ),
            'groq-llama-text',
          )
          return { data, provider: 'groq-llama-text', cache_hit: false, attempts }
        } catch (err) {
          attempts.push(`groq-llama-text: ${err instanceof Error ? err.message : err}`)
        }
      }
    } else if (extractedText != null) {
      attempts.push(`unpdf-extract: too-little-text (${extractedText.trim().length} chars) — scanned PDF?`)
    }

    // Fallback vision — só se texto falhou ou PDF é scanned
    if (geminiKey) {
      try {
        const data = await withRetry(
          () => withTimeout(
            geminiPdfStatement(geminiKey, 'gemini-2.5-flash', input.pdfBase64, instructions),
            PROVIDER_CALL_TIMEOUT_MS, 'gemini-2.5-flash-vision',
          ),
          'gemini-2.5-flash-vision',
        )
        return { data, provider: 'gemini-2.5-flash-vision', cache_hit: false, attempts }
      } catch (err) {
        attempts.push(`gemini-2.5-flash-vision: ${err instanceof Error ? err.message : err}`)
      }

      try {
        const data = await withRetry(
          () => withTimeout(
            geminiPdfStatement(geminiKey, 'gemini-2.0-flash', input.pdfBase64, instructions),
            PROVIDER_CALL_TIMEOUT_MS, 'gemini-2.0-flash-vision',
          ),
          'gemini-2.0-flash-vision',
        )
        return { data, provider: 'gemini-2.0-flash-vision', cache_hit: false, attempts }
      } catch (err) {
        attempts.push(`gemini-2.0-flash-vision: ${err instanceof Error ? err.message : err}`)
      }
    }

    const kind = classifyError(attempts.join(' | '))
    throw new AIProvidersError(attempts, kind)
  }

  // ── Text path: Gemini → Gemini 2.0 → Groq ──
  const prompt = buildStatementPromptWithContent(input.content, input.filename, categoryNames, locale)

  // Se o conteúdo é grande (>500 chars) provavelmente há movimentos reais —
  // um resultado com 0 transações indica que a IA falhou no parsing, não que
  // o extrato está vazio. Nesse caso damos uma nova tentativa com o próximo
  // provider. Para conteúdos muito curtos confiamos na resposta.
  const contentLikelyHasData = input.content.length > 500
  const EMPTY_RESULT_HINT = 'zero-transactions-despite-content'
  let bestEmpty: StatementParseResult | null = null  // guardamos o último vazio caso nenhum provider dê resultado

  if (geminiKey) {
    try {
      const data = await withRetry(
        () => withTimeout(
          geminiText(geminiKey, 'gemini-2.5-flash', prompt),
          PROVIDER_CALL_TIMEOUT_MS, 'gemini-2.5-flash',
        ),
        'gemini-2.5-flash',
      )
      if (data.transactions.length > 0 || !contentLikelyHasData) {
        return { data, provider: 'gemini-2.5-flash', cache_hit: false, attempts }
      }
      bestEmpty = data
      attempts.push(`gemini-2.5-flash: ${EMPTY_RESULT_HINT}`)
    } catch (err) {
      attempts.push(`gemini-2.5-flash: ${err instanceof Error ? err.message : err}`)
    }

    try {
      const data = await withRetry(
        () => withTimeout(
          geminiText(geminiKey, 'gemini-2.0-flash', prompt),
          PROVIDER_CALL_TIMEOUT_MS, 'gemini-2.0-flash',
        ),
        'gemini-2.0-flash',
      )
      if (data.transactions.length > 0 || !contentLikelyHasData) {
        return { data, provider: 'gemini-2.0-flash', cache_hit: false, attempts }
      }
      bestEmpty = data
      attempts.push(`gemini-2.0-flash: ${EMPTY_RESULT_HINT}`)
    } catch (err) {
      attempts.push(`gemini-2.0-flash: ${err instanceof Error ? err.message : err}`)
    }
  }

  if (groqKey) {
    try {
      const data = await withRetry(
        () => withTimeout(
          groqText(groqKey, prompt),
          PROVIDER_CALL_TIMEOUT_MS, 'groq-llama-3.3',
        ),
        'groq-llama-3.3',
      )
      if (data.transactions.length > 0 || !contentLikelyHasData) {
        return { data, provider: 'groq-llama-3.3', cache_hit: false, attempts }
      }
      bestEmpty = data
      attempts.push(`groq-llama-3.3: ${EMPTY_RESULT_HINT}`)
    } catch (err) {
      attempts.push(`groq-llama-3.3: ${err instanceof Error ? err.message : err}`)
    }
  }

  // Se todos devolveram vazio, ainda é melhor retornar o melhor vazio (com
  // o "bank" detectado) do que lançar erro — o frontend mostra mensagem
  // específica. Só lança se houve erros reais em todos os providers.
  if (bestEmpty && attempts.every(a => a.includes(EMPTY_RESULT_HINT))) {
    console.warn('[ai:parseStatement] all providers returned 0 transactions — content preview:',
      input.content.slice(0, 400))
    return { data: bestEmpty, provider: 'all-empty', cache_hit: false, attempts }
  }

  const kind = classifyError(attempts.join(' | '))
  throw new AIProvidersError(attempts, kind)
}
