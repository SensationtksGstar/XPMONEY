import { auth }                      from '@clerk/nextjs/server'
import { NextRequest, NextResponse }   from 'next/server'
import { createSupabaseAdmin }         from '@/lib/supabase'
import { isDemoMode, demoResponse }    from '@/lib/demo/demoGuard'
import { DEMO_CATEGORIES }             from '@/lib/demo/mockData'
import Anthropic                       from '@anthropic-ai/sdk'

// ── Shape returned per parsed transaction ────────────────────────────────────
export interface ParsedTransaction {
  date:                 string   // YYYY-MM-DD
  description:          string   // cleaned
  original_description: string   // raw from CSV
  amount:               number   // always positive
  type:                 'income' | 'expense'
  category_hint:        string   // matches our category names
  selected:             boolean  // UI: user can deselect before confirming
}

export interface ImportStatementResult {
  bank:         string
  currency:     string
  total:        number
  transactions: ParsedTransaction[]
}

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

export async function POST(req: NextRequest) {
  // ── Demo mode ──
  if (isDemoMode()) return demoResponse(DEMO_RESULT)

  // ── Auth ──
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Fetch categories from DB for hints ──
  const db = createSupabaseAdmin()
  const { data: user } = await db
    .from('users').select('id').eq('clerk_id', userId).single()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: cats } = await db
    .from('categories')
    .select('name')
    .or(`user_id.eq.${user.id},is_default.eq.true`)
  const categoryNames = (cats ?? DEMO_CATEGORIES).map((c: { name: string }) => c.name).join(', ')

  // ── Parse body ──
  let content:  string
  let filename: string

  try {
    const body = await req.json()
    content  = body.content  as string
    filename = body.filename as string ?? 'extrato.csv'
    if (!content || content.trim().length < 10) throw new Error('empty')
    // Safety cap — ~200KB of text is plenty for a bank statement
    if (content.length > 200_000) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx 200 KB de texto).' }, { status: 413 })
    }
  } catch {
    return NextResponse.json({ error: 'Conteúdo inválido.' }, { status: 400 })
  }

  // ── Check Anthropic key ──
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.includes('xxxxxx')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 503 })
  }

  // ── Call Claude ──
  const client = new Anthropic({ apiKey })

  const systemPrompt = `És um especialista em análise de extratos bancários portugueses.
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
- Decimais portugueses: "1.234,56" ou "1234,56" → 1234.56 (ponto é separador de milhares, vírgula é decimal)
- Decimais ingleses: "1,234.56" → 1234.56 (Wise/Revolut)
- Colunas Débito/Crédito SEPARADAS (BPI, Novobanco): valor em Débito → type="expense"; valor em Crédito → type="income"
- Coluna única com sinal: valor negativo → expense; positivo → income
- IGNORA linhas de cabeçalho, totais, saldos iniciais/finais, linhas vazias
- "amount" devolvido é SEMPRE positivo (o type determina o sinal)

── Categorização ──
Usa palavras-chave no descritivo: "PINGO", "CONTINENTE", "LIDL" → Alimentação · "GALP", "BP", "REPSOL" → Transportes ·
"EDP", "MEO", "NOS", "VODAFONE" → Casa · "NETFLIX", "SPOTIFY", "HBO" → Lazer · "FARMACIA", "CLINICA" → Saúde ·
"SALARIO", "ORDENADO", "VENCIMENTO" → Salário · "RENDA", "CONDOMINIO" → Casa · "UBER", "BOLT", "METRO" → Transportes

Devolve APENAS JSON válido (sem markdown, sem explicação, sem texto antes/depois).`

  const userPrompt = `Ficheiro: ${filename}

CONTEÚDO:
${content}

Devolve este JSON exacto:
{
  "bank": "<nome do banco identificado>",
  "currency": "<código ISO 3 letras, padrão EUR>",
  "total": <número total de transações encontradas>,
  "transactions": [
    {
      "date": "<YYYY-MM-DD>",
      "description": "<descrição limpa e legível em português>",
      "original_description": "<texto original do CSV>",
      "amount": <número positivo>,
      "type": "<income|expense>",
      "category_hint": "<categoria mais adequada de: ${categoryNames}>"
    }
  ]
}`

  try {
    const message = await client.messages.create({
      model:      'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const raw  = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const json = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed: ImportStatementResult
    try {
      const obj = JSON.parse(json)
      parsed = {
        bank:     obj.bank     ?? 'Banco desconhecido',
        currency: obj.currency ?? 'EUR',
        total:    obj.total    ?? 0,
        transactions: (obj.transactions ?? []).map((t: Omit<ParsedTransaction, 'selected'>) => ({
          ...t,
          amount:   Math.abs(Number(t.amount)) || 0,
          selected: true,
        })),
      }
    } catch {
      return NextResponse.json({ error: 'Claude não conseguiu interpretar o ficheiro. Verifica o formato.' }, { status: 422 })
    }

    return NextResponse.json({ data: parsed })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro de IA'
    console.error('[import-statement]', msg)

    // Friendly fallback for known AI provider errors
    const isCreditIssue = /credit balance|insufficient|billing/i.test(msg)
    const isRateLimit   = /rate limit|429|too many/i.test(msg)
    const isAuth        = /401|invalid api key|unauthorized/i.test(msg)

    if (isCreditIssue || isRateLimit || isAuth) {
      return NextResponse.json(
        {
          error: 'Serviço de análise de extratos temporariamente indisponível. Tenta novamente dentro de alguns minutos ou adiciona as transações manualmente.',
          code:  isCreditIssue ? 'ai_unavailable' : isRateLimit ? 'ai_rate_limit' : 'ai_auth',
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: 'Não foi possível processar o extrato. Verifica o formato do ficheiro ou tenta novamente.' },
      { status: 500 },
    )
  }
}
