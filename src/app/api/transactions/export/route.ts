import { auth }                from '@clerk/nextjs/server'
import { NextResponse }         from 'next/server'
import { createSupabaseAdmin }   from '@/lib/supabase'
import { resolveUser }           from '@/lib/resolveUser'
import { toNumber }              from '@/lib/safeNumber'
import { getServerLocale }       from '@/lib/i18n/server'

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
  const { data, error } = await db
    .from('transactions')
    .select('date, description, amount, type, category:category_id(name), account:account_id(name)')
    .eq('user_id', internalId)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    date: string
    description: string | null
    amount: unknown
    type: 'income' | 'expense' | 'transfer'
    category: { name: string | null } | Array<{ name: string | null }> | null
    account:  { name: string | null } | Array<{ name: string | null }> | null
  }
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

  const headers = en
    ? ['Date', 'Description', 'Category', 'Type', 'Amount (EUR)', 'Account']
    : ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (EUR)', 'Conta']

  const typeLabel = (t: Row['type']): string => {
    if (en) return t === 'income' ? 'Income' : t === 'transfer' ? 'Transfer' : 'Expense'
    return t === 'income' ? 'Receita' : t === 'transfer' ? 'Transferência' : 'Despesa'
  }

  const lines: string[] = [headers.map(csvField).join(',')]
  for (const r of (data ?? []) as unknown as Row[]) {
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

  // BOM so Excel opens UTF-8 (accented PT text) correctly on double-click.
  const csv = '﻿' + lines.join('\r\n')
  const filename = `xpmoney-transactions-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
    },
  })
}
