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
  if (isDemoMode()) return demoResponse(DEMO_RESULT)

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    if (content.length > 200_000) {
      return NextResponse.json({ error: 'Ficheiro demasiado grande (máx 200 KB de texto).' }, { status: 413 })
    }
  } catch {
    return NextResponse.json({ error: 'Conteúdo inválido.' }, { status: 400 })
  }

  // ── Parse (Gemini 2.0 → Gemini 1.5 → Groq) ──
  try {
    const result = await parseStatement(content, filename, categoryNames)

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
      console.error('[import-statement] all providers failed:', err.attempts)
      if (err.kind === 'auth') {
        return NextResponse.json(
          { error: 'Serviço de IA não configurado. Contacta o suporte.', code: 'ai_auth' },
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

    // Parse failures from the library — treat as unreadable file
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'A IA não conseguiu interpretar o ficheiro. Verifica o formato.' },
        { status: 422 },
      )
    }

    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[import-statement]', msg)
    return NextResponse.json(
      { error: 'Não foi possível processar o extrato. Verifica o formato do ficheiro ou tenta novamente.' },
      { status: 500 },
    )
  }
}
