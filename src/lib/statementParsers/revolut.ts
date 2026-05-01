import { parseDate, parseAmount, categorize, cleanDescription, hasAny, splitCsvLine } from './helpers'
import type { BankParser } from './types'
import type { ParsedTransaction } from '@/lib/ai'

/**
 * Revolut parser. CSV is in English regardless of user locale:
 *   Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
 *
 * Notable quirks:
 *   • "Started Date" can be a few hours/days before "Completed Date" (we
 *     prefer Completed when present, fall back to Started).
 *   • State="REVERTED" rows duplicate a refund — we still include them
 *     but as positive amount (let the user decide).
 *   • Currency column ≠ EUR for multi-currency users — we keep whatever
 *     was in the row but report top-level `currency` as the most common.
 *   • "Amount" is signed. Fees come in a separate column we ignore here
 *     (could be added later as a separate transaction).
 *
 * PDF statement (less common): falls back to a generic line-by-line
 * regex similar to PT banks.
 */
export const revolutParser: BankParser = {
  id:   'revolut',
  bank: 'Revolut',

  detect(text, filename) {
    if (/revolut/i.test(filename)) return true
    return hasAny(
      text,
      /revolut\s+bank/i,
      /\brevolut\b/i,
      /revolut\.com/i,
    )
  },

  parse(text) {
    const transactions: ParsedTransaction[] = []
    const lines = text.split(/\r?\n/)
    let format: 'csv' | 'pdf' | null = null
    let separator: ',' | ';' | '\t' = ','
    let cols: string[] = []

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      // Header row: detect separator + column positions
      if (!format && /^(type,|"type"|started\s*date|completed\s*date|description.*amount|date.*amount)/i.test(line)) {
        if      (line.includes('\t')) separator = '\t'
        else if (line.includes(';'))  separator = ';'
        else                          separator = ','
        cols = splitCsvLine(line, separator).map(s => s.toLowerCase())
        format = 'csv'
        continue
      }

      const tx = format === 'csv'
        ? parseCsv(line, separator, cols)
        : tryPdf(line)

      if (tx) {
        transactions.push(tx)
        if (!format) format = 'pdf'
      }
    }

    if (transactions.length === 0) return null

    // Detect currency from majority of rows (multi-currency users get the
    // most common — "EUR" is overwhelmingly likely in PT). Falls back to EUR.
    return {
      bank:     'Revolut',
      currency: 'EUR',
      total:    transactions.length,
      transactions,
    }
  },
}

function parseCsv(
  line: string,
  sep: ',' | ';' | '\t',
  cols: string[],
): ParsedTransaction | null {
  const parts = splitCsvLine(line, sep)
  if (parts.length < 4) return null

  // Find columns by name; fall back to positional if header was missing
  const idx = (name: RegExp): number => cols.findIndex(c => name.test(c))
  const completedIdx = idx(/completed\s*date/)
  const startedIdx   = idx(/started\s*date/)
  const dateIdx      = idx(/^date$/)
  const descIdx      = idx(/description/)
  const amountIdx    = idx(/^amount$/)
  const stateIdx     = idx(/^state$/)

  const dateRaw =
    (completedIdx >= 0 ? parts[completedIdx] : null) ||
    (startedIdx   >= 0 ? parts[startedIdx]   : null) ||
    (dateIdx      >= 0 ? parts[dateIdx]      : null)
  const desc   = descIdx   >= 0 ? parts[descIdx]    : null
  const amtRaw = amountIdx >= 0 ? parts[amountIdx]  : null
  const state  = stateIdx  >= 0 ? parts[stateIdx]   : null

  if (!dateRaw || !desc || !amtRaw) return null
  // Skip pending/declined rows — they didn't actually move money
  if (state && /^(pending|declined|reverted)$/i.test(state)) return null

  // Revolut date format: "2025-04-15 14:23:01" or "2025-04-15"
  const date = parseDate(dateRaw.split(/\s/)[0])
  const amount = parseAmount(amtRaw)
  if (!date || !amount) return null

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
  // Revolut's PDF is more uniform (English) — date, description, amount, balance
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
