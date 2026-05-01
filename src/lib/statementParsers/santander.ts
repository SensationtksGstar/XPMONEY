import { parseDate, parseAmount, categorize, cleanDescription, hasAny, splitCsvLine } from './helpers'
import type { BankParser } from './types'
import type { ParsedTransaction } from '@/lib/ai'

/**
 * Santander Totta parser.
 *
 * Format hints:
 *   • CSV with `;` separator (sometimes `,` on EN locale)
 *   • Header: Data;Descrição;Montante;Saldo  (single signed column)
 *   • Some exports also have: Data Op.;Data Val.;Descrição;Valor;Saldo
 *   • PDF has "Banco Santander" or "Santander Totta" in headers
 */
export const santanderParser: BankParser = {
  id:   'santander',
  bank: 'Santander',

  detect(text, filename) {
    if (/santander/i.test(filename)) return true
    return hasAny(
      text,
      /banco\s+santander/i,
      /santander\s+totta/i,
      /\bsantander\b/i,
    )
  },

  parse(text) {
    const transactions: ParsedTransaction[] = []
    const lines = text.split(/\r?\n/)
    let format: 'csv' | 'pdf' | null = null
    let separator: ';' | ',' | '\t' = ';'

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      if (!format && /data/i.test(line) && /(montante|valor|descri[çc][aã]o)/i.test(line)) {
        if      (line.includes(';'))  separator = ';'
        else if (line.includes('\t')) separator = '\t'
        else                          separator = ','
        format = 'csv'
        continue
      }

      const tx = format === 'csv' ? parseCsv(line, separator) : tryPdf(line)
      if (tx) {
        transactions.push(tx)
        if (!format) format = 'pdf'
      }
    }

    if (transactions.length === 0) return null

    return {
      bank:     'Santander',
      currency: 'EUR',
      total:    transactions.length,
      transactions,
    }
  },
}

function parseCsv(line: string, sep: ';' | ',' | '\t'): ParsedTransaction | null {
  const parts = splitCsvLine(line, sep)
  if (parts.length < 3) return null

  // Try col[0] for date; if that fails, col[1] (in case it's "Data Op.;Data Val.;...")
  let date    = parseDate(parts[0])
  let descIdx = 1, amountIdx = 2
  if (!date) {
    date = parseDate(parts[1])
    descIdx = 2; amountIdx = 3
  }
  if (!date) return null

  const desc   = parts[descIdx] ?? ''
  const amount = parseAmount(parts[amountIdx] ?? '')
  if (!desc || !amount) return null

  const type: 'income' | 'expense' = amount.sign === -1 ? 'expense' : 'income'

  return {
    date,
    description:          cleanDescription(desc),
    original_description: desc,
    amount:               amount.value,
    type,
    category_hint:        categorize(desc, type),
  }
}

function tryPdf(line: string): ParsedTransaction | null {
  if (line.includes(';')) return parseCsv(line, ';')

  const m = line.match(/^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(.+?)\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s*$/)
  if (!m) return null

  const date   = parseDate(m[1])
  const desc   = m[2].trim()
  const amount = parseAmount(m[3])
  if (!date || !desc || !amount || /^[\d.,]+$/.test(desc)) return null

  const type: 'income' | 'expense' = amount.sign === -1 ? 'expense' : 'income'

  return {
    date,
    description:          cleanDescription(desc),
    original_description: desc,
    amount:               amount.value,
    type,
    category_hint:        categorize(desc, type),
  }
}
