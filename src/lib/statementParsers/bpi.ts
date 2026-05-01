import { parseDate, parseAmount, categorize, cleanDescription, hasAny, splitCsvLine } from './helpers'
import type { BankParser } from './types'
import type { ParsedTransaction } from '@/lib/ai'

/**
 * BPI parser.
 *
 * BPI almost always exports CSV with separate Débito/Crédito columns:
 *   "Data mov.";"Data valor";"Descrição";"Débito";"Crédito";"Saldo"
 *
 * The Débito column has a value when it's an expense (positive number),
 * Crédito when it's income — never both. This is more deterministic than
 * the signed-single-column variant other banks use.
 */
export const bpiParser: BankParser = {
  id:   'bpi',
  bank: 'BPI',

  detect(text, filename) {
    if (/\bbpi\b/i.test(filename)) return true
    return hasAny(
      text,
      /banco\s+bpi/i,
      /bpinet|bpi\s*net/i,
      /\bBPI\b/,
    )
  },

  parse(text) {
    const transactions: ParsedTransaction[] = []
    const lines = text.split(/\r?\n/)
    let format: 'debit-credit' | 'pdf' | null = null

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      if (!format && /;/.test(line) && /data/i.test(line) && /d[eé]bito/i.test(line) && /cr[eé]dito/i.test(line)) {
        format = 'debit-credit'
        continue
      }

      const tx = format === 'debit-credit' ? parseDebitCredit(line) : tryPdf(line)
      if (tx) {
        transactions.push(tx)
        if (!format) format = 'pdf'
      }
    }

    if (transactions.length === 0) return null

    return {
      bank:     'BPI',
      currency: 'EUR',
      total:    transactions.length,
      transactions,
    }
  },
}

function parseDebitCredit(line: string): ParsedTransaction | null {
  const parts = splitCsvLine(line, ';')
  if (parts.length < 5) return null

  const date = parseDate(parts[0]) ?? parseDate(parts[1])
  const desc = parts[2] ?? ''
  const debit  = parseAmount(parts[3] ?? '')
  const credit = parseAmount(parts[4] ?? '')

  if (!date || !desc || (!debit && !credit)) return null

  const isExpense = !!debit && debit.value > 0
  const value     = isExpense ? debit!.value : credit!.value
  const type: 'income' | 'expense' = isExpense ? 'expense' : 'income'

  return {
    date,
    description:          cleanDescription(desc),
    original_description: desc,
    amount:               value,
    type,
    category_hint:        categorize(desc, type),
  }
}

/**
 * BPI PDF text after unpdf can interleave debit/credit columns. Best
 * effort: assume two-amount lines have value-then-balance (signed value
 * dictates type).
 */
function tryPdf(line: string): ParsedTransaction | null {
  if (line.includes(';')) return parseDebitCredit(line)

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
