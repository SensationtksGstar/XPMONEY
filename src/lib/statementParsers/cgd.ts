import { parseDate, parseAmount, categorize, cleanDescription, hasAny, splitCsvLine } from './helpers'
import type { BankParser } from './types'
import type { StatementParseResult, ParsedTransaction } from '@/lib/ai'

/**
 * Caixa Geral de Depósitos (CGD) parser.
 *
 * Known formats (per the prompt hints in lib/ai.ts):
 *   • CSV with `;` separator. Two header variants seen historically:
 *       (A) Data mov.;Data valor;Descrição;Débito;Crédito;Saldo
 *       (B) Data;Descrição;Valor;Saldo   (older / lighter export)
 *   • PDF text after unpdf extraction: tabular lines collapsed to
 *     "DD-MM-YYYY  DESCRIPTION  -45,30  2497,91" pattern (sign in amount,
 *     balance trails). Less reliable — we attempt but expect AI to take
 *     over for tricky cases.
 *
 * Returns null if the format does not match — never throws.
 */
export const cgdParser: BankParser = {
  id:   'cgd',
  bank: 'Caixa Geral de Depósitos',

  detect(text, filename) {
    if (/cgd/i.test(filename)) return true
    return hasAny(
      text,
      /caixa\s+geral\s+de\s+dep[oó]sitos/i,
      /caixadirecta/i,
      /netcaixa/i,
      /\bCGD\b/,
    )
  },

  parse(text) {
    const transactions: ParsedTransaction[] = []
    const lines = text.split(/\r?\n/)

    let headerSeen = false
    let format: 'csv-debit-credit' | 'csv-signed' | 'pdf-line' | null = null

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      // Detect format from header row (CSV)
      if (!format && /;/.test(line) && /data/i.test(line) && /(d[eé]bito|cr[eé]dito|valor|montante)/i.test(line)) {
        const cols = splitCsvLine(line, ';').map(s => s.toLowerCase())
        if (cols.some(c => /d[eé]bito/.test(c)) && cols.some(c => /cr[eé]dito/.test(c))) {
          format = 'csv-debit-credit'
        } else {
          format = 'csv-signed'
        }
        headerSeen = true
        continue
      }

      const tx = format === 'csv-debit-credit'
        ? parseCsvDebitCredit(line)
        : format === 'csv-signed'
        ? parseCsvSigned(line)
        : tryAny(line)

      if (tx) {
        transactions.push(tx)
        if (!format) format = 'pdf-line'
      }
    }

    if (transactions.length === 0) return null

    const result: StatementParseResult = {
      bank:     'Caixa Geral de Depósitos',
      currency: 'EUR',
      total:    transactions.length,
      transactions,
    }
    return result
  },
}

// ── Row parsers ─────────────────────────────────────────────────────────────

/** Header: Data mov.;Data valor;Descrição;Débito;Crédito;Saldo */
function parseCsvDebitCredit(line: string): ParsedTransaction | null {
  const parts = splitCsvLine(line, ';')
  if (parts.length < 5) return null

  const date = parseDate(parts[0]) ?? parseDate(parts[1])
  const desc = parts[2]
  const debit  = parseAmount(parts[3])
  const credit = parseAmount(parts[4])

  if (!date || !desc) return null
  if (!debit && !credit) return null

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

/** Header: Data;Descrição;Valor;Saldo (signed amount in single column) */
function parseCsvSigned(line: string): ParsedTransaction | null {
  const parts = splitCsvLine(line, ';')
  if (parts.length < 3) return null

  const date   = parseDate(parts[0])
  const desc   = parts[1]
  const amount = parseAmount(parts[2])

  if (!date || !desc || !amount) return null

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

/**
 * PDF text fallback. unpdf collapses tabular layouts to single lines like:
 *   "15-04-2025 PINGO DOCE LISBOA -45,30 2497,91"
 *   "15-04-2025 SALARIO ABRIL 1500,00 2543,21"
 *
 * Two amounts trail the description: the movement value (signed) then the
 * running balance. We capture only the first amount as the transaction;
 * the running balance is discarded.
 *
 * False positives: lines that happen to start with a date and end with
 * two amounts but aren't transactions. Mitigated by parseAmount returning
 * null for malformed strings, and by callers requiring at least one valid
 * row to declare a hit.
 */
function tryAny(line: string): ParsedTransaction | null {
  // Try CSV variants first (cheap)
  if (line.includes(';')) {
    return parseCsvDebitCredit(line) ?? parseCsvSigned(line)
  }

  // PDF line: date + description + amount + balance
  const m = line.match(/^(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s+(.+?)\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s*$/)
  if (!m) return null

  const date   = parseDate(m[1])
  const desc   = m[2].trim()
  const amount = parseAmount(m[3])

  if (!date || !desc || !amount) return null
  // Sanity: the description shouldn't look like another number
  if (/^[\d.,]+$/.test(desc)) return null

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
