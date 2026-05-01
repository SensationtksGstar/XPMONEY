import { parseDate, parseAmount, categorize, cleanDescription, hasAny, splitCsvLine } from './helpers'
import type { BankParser } from './types'
import type { StatementParseResult, ParsedTransaction } from '@/lib/ai'

/**
 * Millennium BCP parser.
 *
 * CSV format hints (real exports vary slightly between online banking and
 * mobile app):
 *   • `;` separator
 *   • Header includes "Data mov.", "Data valor", "Descritivo" / "Descrição",
 *     and either "Valor" (signed) or "Débito"+"Crédito" pair.
 *   • Excel exports occasionally use "," as separator when locale is EN.
 *
 * PDF: "Banco Comercial Português" or "Millennium" appears at the top.
 * Transaction rows follow the same date-desc-amount-balance shape.
 */
export const millenniumParser: BankParser = {
  id:   'millennium',
  bank: 'Millennium BCP',

  detect(text, filename) {
    if (/millennium|bcp\b/i.test(filename)) return true
    return hasAny(
      text,
      /millennium\s*bcp/i,
      /banco\s+comercial\s+portugu[eê]s/i,
      /\bmillennium\b/i,
    )
  },

  parse(text) {
    const transactions: ParsedTransaction[] = []
    const lines = text.split(/\r?\n/)
    let format: 'debit-credit' | 'signed' | 'pdf' | null = null
    let separator: ';' | ',' | '\t' = ';'

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      if (!format && /data/i.test(line) && /(descritivo|descri[çc][aã]o)/i.test(line)) {
        if      (line.includes(';'))  separator = ';'
        else if (line.includes('\t')) separator = '\t'
        else                          separator = ','
        const cols = splitCsvLine(line, separator).map(s => s.toLowerCase())
        format = cols.some(c => /d[eé]bito/.test(c)) && cols.some(c => /cr[eé]dito/.test(c))
          ? 'debit-credit'
          : 'signed'
        continue
      }

      const tx = format === 'debit-credit'
        ? parseDebitCredit(line, separator)
        : format === 'signed'
        ? parseSigned(line, separator)
        : tryGeneric(line)

      if (tx) {
        transactions.push(tx)
        if (!format) format = 'pdf'
      }
    }

    if (transactions.length === 0) return null

    return {
      bank:     'Millennium BCP',
      currency: 'EUR',
      total:    transactions.length,
      transactions,
    }
  },
}

function parseDebitCredit(line: string, sep: ';' | ',' | '\t'): ParsedTransaction | null {
  const parts = splitCsvLine(line, sep)
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

function parseSigned(line: string, sep: ';' | ',' | '\t'): ParsedTransaction | null {
  const parts = splitCsvLine(line, sep)
  // Expecting at least: Data, Descritivo, Valor (saldo optional)
  if (parts.length < 3) return null

  // Some Millennium exports include "Data mov." + "Data valor" before the
  // descriptive column — allow for that by trying column 0 then 1.
  let date = parseDate(parts[0])
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

function tryGeneric(line: string): ParsedTransaction | null {
  if (line.includes(';')) {
    return parseDebitCredit(line, ';') ?? parseSigned(line, ';')
  }

  // PDF line: date + description + amount + balance
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
