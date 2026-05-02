import 'server-only'
import type { ParsedTransaction } from '@/lib/ai'

/**
 * Self-transfer detection.
 *
 * PT bank statements (Montepio especially, with its tight MB WAY
 * integration) record BOTH sides of an intra-account / MB WAY top-up:
 *
 *   2026-03-04  TRF. 0000351 00912724608         160,00-   (outgoing)
 *   2026-03-04  TR-IPS-BRUNO DUARTE MENDES COR   160,00+   (incoming)
 *
 * To the user this is a single net-zero movement (he just refilled his
 * own MB WAY balance). To naïve aggregation it's €160 of income AND €160
 * of expense, inflating both totals by an equal amount.
 *
 * Detection rule (deterministic, no AI):
 *   1. Pick incoming entries whose description's name token matches the
 *      user's own name (uppercase + ascii-fold + token match — accounts
 *      for the bank's truncation, e.g. "BRUNO DUARTE MENDES COR" vs
 *      "Bruno Duarte Mendes Correia").
 *   2. For each, find an outgoing entry on the SAME date with the SAME
 *      amount whose description starts with "TRF" / "TRANSF" /
 *      "TRANSFERÊNCIA" (the outgoing leg of the same move).
 *   3. When the pair is found, mark BOTH transactions as
 *      `category_hint = 'Transferência'`. Downstream dashboard widgets
 *      treat that category as net-zero (excluded from income / expense
 *      totals).
 *
 * Greedy matching: each outgoing leg can only be paired once, so a user
 * with multiple €50 moves on the same day all pair correctly with their
 * respective incoming legs. Unmatched entries fall through unchanged.
 *
 * Conservative by default: when the user's name is empty/unknown we
 * skip detection entirely. Worse to mis-categorize a legit incoming
 * transfer from a friend than to leave a self-transfer un-flagged.
 */

const TRANSFER_CATEGORY = 'Transferência'

/** Strip diacritics, uppercase, collapse whitespace. */
function normName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Tokens of the user's name we'll require to appear (in order is enough,
 * not strict adjacency) inside an incoming description for it to be
 * considered "self-incoming". We use first + last name for the strongest
 * signal — middle names are often dropped by the bank's truncation.
 */
function nameMatchTokens(fullName: string): string[] {
  const tokens = normName(fullName).split(' ').filter(t => t.length >= 3)
  if (tokens.length === 0) return []
  if (tokens.length === 1) return [tokens[0]]
  // First + last — best signal across truncation variants.
  return [tokens[0], tokens[tokens.length - 1]]
}

/**
 * True when the description (already in NFD-stripped uppercase) contains
 * the user's name signal.
 *
 * Tuned for real Montepio truncation: their statement field cuts long
 * surnames hard — "CORREIA" appears as "COR", "MARQUES" as "MARQ", etc.
 * Strategy:
 *   • First name: require the FULL token (BRUNO must appear as "BRUNO",
 *     not just "BRU" — that's risky enough to match BRUNA / BRUMA).
 *   • Last name: 3-char prefix OK ("COR" matches "CORREIA"). Three chars
 *     is short, but combined with the first-name match the chance of a
 *     real-world false positive is essentially zero — we'd need a
 *     transfer description that contains BRUNO + COR... by coincidence,
 *     which doesn't happen in PT-bank statements.
 */
function descriptionMatchesName(descNorm: string, requiredTokens: string[]): boolean {
  if (requiredTokens.length === 0) return false
  if (requiredTokens.length === 1) {
    return descNorm.includes(requiredTokens[0])
  }
  const [first, last] = requiredTokens
  const lastProbe = last.slice(0, 3)
  return descNorm.includes(first) && descNorm.includes(lastProbe)
}

/** Outgoing-transfer-prefix detector. */
function isOutgoingTransfer(desc: string): boolean {
  const d = desc.trimStart().toUpperCase()
  return d.startsWith('TRF')        // Montepio "TRF. 0000351 ..."
      || d.startsWith('TRANSF')     // generic "TRANSFERÊNCIA"
      || d.startsWith('TR ')        // some banks use "TR <id>"
}

export interface SelfTransferStats {
  matched:        number
  totalAmount:    number
}

/**
 * Walk the transactions, detect self-transfer pairs, and reassign their
 * category_hint to 'Transferência'. Returns a stats object so callers
 * can surface "X movements were detected as self-transfers" feedback.
 *
 * NOTE: mutates the input array in place AND returns it for convenience.
 */
export function detectSelfTransfers(
  transactions: ParsedTransaction[],
  userFullName: string | null,
): { transactions: ParsedTransaction[]; stats: SelfTransferStats } {
  const stats: SelfTransferStats = { matched: 0, totalAmount: 0 }
  if (!userFullName) return { transactions, stats }

  const tokens = nameMatchTokens(userFullName)
  if (tokens.length === 0) return { transactions, stats }

  // Build a lookup of available (unpaired) outgoing-TRF entries indexed
  // by `date|amount`. Each list entry holds the source array index so
  // we can mutate the original after pairing.
  const outgoingByKey = new Map<string, number[]>()
  transactions.forEach((tx, i) => {
    if (tx.type !== 'expense') return
    if (!isOutgoingTransfer(tx.original_description ?? tx.description)) return
    const key = `${tx.date}|${tx.amount.toFixed(2)}`
    const list = outgoingByKey.get(key) ?? []
    list.push(i)
    outgoingByKey.set(key, list)
  })

  // For every incoming whose description matches the user's name, try to
  // pair it with an outgoing of same date/amount. Greedy pop from the
  // outgoing pool so each outgoing leg is consumed only once.
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]
    if (tx.type !== 'income') continue

    const descNorm = normName(tx.original_description ?? tx.description)
    if (!descriptionMatchesName(descNorm, tokens)) continue

    const key  = `${tx.date}|${tx.amount.toFixed(2)}`
    const list = outgoingByKey.get(key)
    if (!list || list.length === 0) continue

    const outIdx = list.shift()!
    if (list.length === 0) outgoingByKey.delete(key)

    transactions[i].category_hint      = TRANSFER_CATEGORY
    transactions[i].type               = 'transfer'
    transactions[outIdx].category_hint = TRANSFER_CATEGORY
    transactions[outIdx].type          = 'transfer'
    stats.matched++
    stats.totalAmount += tx.amount
  }

  return { transactions, stats }
}
