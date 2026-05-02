import { categorize, cleanDescription, hasAny, splitCsvLine, parseAmount, parseDate } from './helpers'
import type { BankParser } from './types'
import type { ParsedTransaction } from '@/lib/ai'

/**
 * Banco Montepio (Caixa Económica Montepio Geral) parser.
 *
 * REAL extracted-text shape (validated against a 5-page production PDF):
 *
 *   1. unpdf flattens every page into one continuous string — there are
 *      NO line breaks between rows. We cannot iterate line-by-line.
 *   2. Each transaction is shaped:
 *        DT.MOV (YYYY-MM-DD)  DT.VAL (YYYY-MM-DD)  DESCRIÇÃO  MONTANTE±  SALDO±
 *      where ± is the sign GLUED to the number, e.g. "20,00-" "400,00+".
 *   3. The transaction list is bookended by:
 *        header  ... MOEDA  Saldo Inicial <amount>± EUR
 *        body    ... DT.MOVIM. DT.VALOR DESCRIÇÃO MONTANTE SALDO MOEDA
 *        footer  ... Saldo Final <amount>± EUR
 *      We trim noise outside [Saldo Inicial, Saldo Final] when we can find
 *      that pair; otherwise we fall back to the whole text and let the
 *      regex filter naturally.
 *   4. CSV path stays available for the rare user who exports CSV from
 *      Net24 (separate Débito/Crédito columns).
 */
export const montepioParser: BankParser = {
  id:   'montepio',
  bank: 'Montepio',

  detect(text, filename) {
    if (/montepio/i.test(filename)) return true
    return hasAny(
      text,
      /caixa\s+econ[oó]mica\s+montepio/i,
      /montepio\s+geral/i,
      /\bbanco\s+montepio\b/i,
      /\bmontepio\b/i,
      /montepio24/i,
      /bancomontepio\.pt/i,
      /\bMPIOPTPL\b/,    // Montepio's BIC/SWIFT — rock-solid fingerprint
    )
  },

  parse(text) {
    // Try CSV first (rare but cheap to detect)
    const csvResult = tryCsv(text)
    if (csvResult && csvResult.length > 0) {
      return {
        bank:     'Montepio',
        currency: 'EUR',
        total:    csvResult.length,
        transactions: csvResult,
      }
    }

    const transactions = parsePdfStream(text)
    if (transactions.length === 0) return null

    return {
      bank:     'Montepio',
      currency: 'EUR',
      total:    transactions.length,
      transactions,
    }
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF stream parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global regex over the flattened PDF text. Each match is a full transaction.
 *
 * Anchors:
 *   - Two ISO dates back-to-back at the start (DT.MOV  DT.VAL).
 *   - Description: lazy capture, anything that's NOT the start of the next
 *     "YYYY-MM-DD YYYY-MM-DD" pair.
 *   - Amount and balance: digits with optional thousands dot, comma decimal,
 *     followed by '+' (credit) or '-' (debit) GLUED to the number.
 *
 * The lookahead `(?=\s+\d{4}-\d{2}-\d{2}\s+\d{4}-\d{2}-\d{2}|\s*Saldo\s+Final|\s*Pág\.|$)`
 * tells the lazy `.+?` where to stop — at the next transaction OR a known
 * footer marker OR end-of-string. Without the lookahead the lazy match is
 * unstable on amounts that contain "+/-" within description tokens (rare but
 * we've seen merchants like "MA B BANHEIRA").
 */
const TX_RE = /(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})([+\-])\s+(\d{1,3}(?:\.\d{3})*,\d{2})([+\-])(?=\s+\d{4}-\d{2}-\d{2}\s+\d{4}-\d{2}-\d{2}|\s*Saldo\s+Final|\s*Pág\.|\s*EUR|\s*$)/g

function parsePdfStream(rawText: string): ParsedTransaction[] {
  // Trim aggressive — collapse all whitespace runs to single spaces so the
  // regex doesn't trip on interior newlines/tabs in some PDF dialects.
  const text = rawText.replace(/\s+/g, ' ')

  // Try to scope to [Saldo Inicial, Saldo Final] when both markers are
  // present. This kills false positives from the FD ORDENADO / Juros
  // Devedores tables further down the document, which also have date+amount
  // shapes but are NOT transactions.
  const inicialIdx = text.search(/Saldo\s+Inicial/i)
  const finalIdx   = text.search(/Saldo\s+Final/i)
  const scoped     = (inicialIdx >= 0 && finalIdx > inicialIdx)
    ? text.slice(inicialIdx, finalIdx)
    : text

  const out: ParsedTransaction[] = []
  let m: RegExpExecArray | null
  TX_RE.lastIndex = 0

  while ((m = TX_RE.exec(scoped)) !== null) {
    const [, dtMov, , descRaw, amountStr, amountSign /*, balanceStr, balanceSign*/] = m

    // Drop column-header pseudo-matches like "DT.MOVIM. DT.VALOR DESCRIÇÃO ..."
    // These don't match because they have no ISO dates, so we're safe — but
    // belt-and-braces guard against malformed dates.
    const date = parseDate(dtMov)
    if (!date) continue

    // Description cleanup: lots of internal whitespace from the PDF flatten.
    const desc = descRaw.replace(/\s+/g, ' ').trim()
    if (!desc || desc.length < 2) continue

    const amount = parseFloat(amountStr.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(amount) || amount === 0) continue

    const type: 'income' | 'expense' = amountSign === '+' ? 'income' : 'expense'

    out.push({
      date,
      description:          cleanDescription(desc),
      original_description: desc,
      amount,
      type,
      category_hint:        categorize(desc, type),
    })
  }

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV path (Net24 export, rare)
// ─────────────────────────────────────────────────────────────────────────────

function tryCsv(text: string): ParsedTransaction[] | null {
  // Net24 CSV: ; separator, Débito/Crédito columns
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return null

  // Detect header
  const headerIdx = lines.findIndex(l =>
    /;/.test(l) && /data/i.test(l) && /(d[eé]bito|cr[eé]dito|valor|montante)/i.test(l),
  )
  if (headerIdx === -1) return null

  const header     = splitCsvLine(lines[headerIdx], ';').map(s => s.toLowerCase())
  const debitIdx   = header.findIndex(c => /d[eé]bito/.test(c))
  const creditIdx  = header.findIndex(c => /cr[eé]dito/.test(c))
  const descIdx    = header.findIndex(c => /(descritivo|descri[çc][aã]o)/.test(c))
  const dateIdx    = header.findIndex(c => /data/.test(c))

  if (dateIdx < 0 || descIdx < 0) return null
  if (debitIdx < 0 && creditIdx < 0) return null

  const out: ParsedTransaction[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i], ';')
    if (parts.length < 3) continue

    const date = parseDate(parts[dateIdx])
    const desc = parts[descIdx] ?? ''
    if (!date || !desc) continue

    const debit  = debitIdx  >= 0 ? parseAmount(parts[debitIdx]  ?? '') : null
    const credit = creditIdx >= 0 ? parseAmount(parts[creditIdx] ?? '') : null
    if (!debit && !credit) continue

    const isExpense = !!debit && debit.value > 0
    const value     = isExpense ? debit!.value : credit!.value
    const type: 'income' | 'expense' = isExpense ? 'expense' : 'income'

    out.push({
      date,
      description:          cleanDescription(desc),
      original_description: desc,
      amount:               value,
      type,
      category_hint:        categorize(desc, type),
    })
  }

  return out.length > 0 ? out : null
}
