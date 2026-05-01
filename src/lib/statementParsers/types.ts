import type { StatementParseResult } from '@/lib/ai'

/**
 * Common shape every deterministic bank parser exports. Two methods:
 *
 *   detect(): cheap fingerprint check — must be safe to call on any text,
 *             returns true if this parser is willing to try.
 *   parse():  full parse — returns null if the format is recognised but
 *             no transactions were extracted (caller falls through to AI).
 *
 * Parsers MUST return null instead of throwing when the format does not
 * match. Throwing would surface as a 500 to the user; null lets the
 * orchestrator try the next parser or fall through to AI.
 */
export interface BankParser {
  /** Stable identifier used in `provider` field of the response. */
  id:     string
  /** Human-readable bank name returned in the `bank` field. */
  bank:   string
  /** Cheap fingerprint check on raw text + filename. */
  detect: (text: string, filename: string) => boolean
  /** Full parse. Returns null when no transactions were found. */
  parse:  (text: string) => StatementParseResult | null
}
