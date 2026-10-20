import { auth }                from '@clerk/nextjs/server'
import { NextResponse }         from 'next/server'
import { createSupabaseAdmin }   from '@/lib/supabase'
import { resolveUser }           from '@/lib/resolveUser'
import { toNumber }              from '@/lib/safeNumber'
import { getServerLocale }       from '@/lib/i18n/server'
import { fetchAll }              from '@/lib/fetchAll'
import { streamText }            from '@/lib/streamText'

/**
 * GET /api/transactions/export — download every transaction as a CSV
 * (date · description · category · type · amount · account). For Excel /
 * backup / accountant use. Streams with Content-Disposition: attachment.
 *
 * Distinct from /api/account/export (full RGPD JSON of all tables) — this is
 * the focused, spreadsheet-friendly view people actually open in Excel.
 *
 * RFC 4180 quoting: every field is wrapped in double quotes with internal
 * quotes doubled, so descriptions containing commas / quotes / newlines (very
 * common in bank statements) never corrupt the columns.
 */

function csvField(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const internalId = await resolveUser(userId)
  if (!internalId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const locale = await getServerLocale()
  const en = locale === 'en'

  const db = createSupabaseAdmin()

  type Row = {
    date: string
    description: string | null
    amount: unknown
    type: 'income' | 'expense' | 'transfer'
    category: { name: string | null } | Array<{ name: string | null }> | null
    account:  { name: string | null } | Array<{ name: string | null }> | null
  }
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

  // Paginated: PostgREST silently caps a select at 1000 rows, and with the
  // newest-first order that cap dropped the OLDEST history from the CSV.
  // Stable order (date desc + id) so pages never overlap or skip rows.
  let data: Row[]
  let truncated: boolean
  try {
    const res = await fetchAll<Row>(async (from, to) => {
      const { data: page, error } = await db.from('transactions')
        .select('date, description, amount, type, category:category_id(name), account:account_id(name)')
        .eq('user_id', internalId)
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)
      return { data: page as unknown as Row[] | null, error }
    })
    data = res.rows
    truncated = res.truncated
  } catch (err) {
    console.warn('[transactions/export] read failed:', err)
    return NextResponse.json({ error: en ? 'Could not read your transactions.' : 'Não foi possível ler as tuas transações.' }, { status: 500 })
  }
  if (truncated) console.warn(`[transactions/export] truncated at ${data.length} rows`)

  const headers = en
    ? ['Date', 'Description', 'Category', 'Type', 'Amount (EUR)', 'Account']
    : ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (EUR)', 'Conta']

  const typeLabel = (t: Row['type']): string => {
    if (en) return t === 'income' ? 'Income' : t === 'transfer' ? 'Transfer' : 'Expense'
    return t === 'income' ? 'Receita' : t === 'transfer' ? 'Transferência' : 'Despesa'
  }

  const lines: string[] = [headers.map(csvField).join(',')]
  for (const r of data) {
    const cat = one(r.category)?.name ?? ''
    const acc = one(r.account)?.name ?? ''
    // Amount: 2 decimals with a dot (Excel/standard); the Type column carries
    // income vs expense so the figure stays unsigned.
    const amount = toNumber(r.amount).toFixed(2)
    lines.push([
      csvField(r.date),
      csvField(r.description ?? ''),
      csvField(cat),
      csvField(typeLabel(r.type)),
      csvField(amount),
      csvField(acc),
    ].join(','))
  }

  // The CSV is downloaded via a plain <a href>, so no client code ever reads
  // the X-Export-Truncated header — say it INSIDE the file too, as a final
  // single-field row (newest-first order means the missing rows are the oldest).
  if (truncated) {
    lines.push(csvField(en
      ? `# Export limited to the ${data.length} most recent transactions — older ones are not included. Contact us for the full history.`
      : `# Exportação limitada às ${data.length} transações mais recentes — as mais antigas não estão incluídas. Contacta-nos para o histórico completo.`))
  }

  // BOM so Excel opens UTF-8 (accented PT text) correctly on double-click.
  const csv = '﻿' + lines.join('\r\n')
  const filename = `xpmoney-transactions-${new Date().toISOString().split('T')[0]}.csv`

  // Streamed: 50k rows sit right at Vercel's 4.5 MB buffered-body limit (413).
  return new NextResponse(streamText(csv), {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
      ...(truncated ? { 'X-Export-Truncated': String(data.length) } : {}),
    },
  })
}
