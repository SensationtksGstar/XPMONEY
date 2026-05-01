import { parseDate, parseAmount, categorize, cleanDescription, hasAny, splitCsvLine } from './helpers'
import type { BankParser } from './types'
import type { ParsedTransaction } from '@/lib/ai'

/**
 * Crédito Agrícola + Moey parser.
 *
 * Moey is the digital-first bank in the Crédito Agrícola group, sharing
 * the underlying core-banking export formats. One parser handles both —
 * fingerprints catch either brand name (or both, since CA-issued
 * statements often co-brand with "moey!").
 *
 * Format hints (typical PT bank — same family as CGD/Millennium/BPI):
 *   • CSV with `;` separator
 *   • Columns vary; commonly:
 *       Data;Descrição;Valor;Saldo                 (signed amount)
 *       Data Mov.;Data Valor;Descrição;Valor;Saldo (signed amount)
 *       Data;Descrição;Débito;Crédito;Saldo        (separate columns)
 *   • PDF: tabular date-desc-amount-balance lines after unpdf extraction
 */
export const creditoAgricolaParser: BankParser = {
  id:   'credito-agricola',
  bank: 'Crédito Agrícola',

  detect(text, filename) {
    if (/(moey|cred[ií]to[\s-]?agr[ií]col|\bca[\s-]?m[uú]tuo)/i.test(filename)) return true
    return hasAny(
      text,
      /cr[eé]dito\s+agr[ií]cola/i,
      /\bca[\s-]?m[uú]tuo\b/i,
      /\bmoey\b/i,
      /moey!/i,
      /caixa\s+de\s+cr[eé]dito\s+agr[ií]cola/i,
    )
  },

  parse(text) {
    const transactions: ParsedTransaction[] = []
    const lines = text.split(/\r?\n/)
    let format: 'debit-credit' | 'signed' | 'pdf' | null = null
    let separator: ';' | ',' | '\t' = ';'

    // Detected bank label — "moey" sometimes appears alone, sometimes
    // alongside "Crédito Agrícola". Use whichever first surfaced so the
    // preview header matches what the user expects to see.
    let detectedBank: 'Moey' | 'Crédito Agrícola' = 'Crédito Agrícola'
    if (/\bmoey\b/i.test(text)) detectedBank = 'Moey'

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      if (!format && /data/i.test(line) && /(descri[çc][aã]o|descritivo)/i.test(line)) {
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
      bank:     detectedBank,
      currency: 'EUR',
      total:    transactions.length,
      transactions,
    }
  },
}

function parseDebitCredit(line: string, sep: ';' | ',' | '\t'): ParsedTransaction | null {
  const parts = splitCsvLine(line, sep)
  if (parts.length < 4) return null

  // Two layouts seen: 4-col (Data;Descricao;Debito;Credito[;Saldo]) and
  // 5-col with leading "Data Valor" (Data Mov.;Data Valor;Desc;Deb;Cred[;Sal]).
  let date    = parseDate(parts[0])
  let descIdx = 1, debIdx = 2, credIdx = 3
  if (!date) {
    date    = parseDate(parts[1])
    descIdx = 2; debIdx = 3; credIdx = 4
  }
  if (!date) return null

  const desc   = parts[descIdx] ?? ''
  const debit  = parseAmount(parts[debIdx]  ?? '')
  const credit = parseAmount(parts[credIdx] ?? '')

  if (!desc || (!debit && !credit)) return null

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
  if (parts.length < 3) return null

  // Tolerate leading "Data Valor" column when present.
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

function tryGeneric(line: string): ParsedTransaction | null {
  if (line.includes(';')) {
    return parseDebitCredit(line, ';') ?? parseSigned(line, ';')
  }

  // PDF line shape: date + description + amount + balance
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
