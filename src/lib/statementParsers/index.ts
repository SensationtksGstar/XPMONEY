/**
 * Deterministic bank-statement parsers — orchestrator.
 *
 * Runs BEFORE the AI chain in `/api/import-statement`. Top-5 PT banks
 * (CGD, Millennium, BPI, Santander, Revolut) cover the majority of CSV
 * exports without burning a single AI token. Falls through to AI when:
 *   - No parser fingerprints the format
 *   - A parser fingerprints but extracts 0 transactions (likely PDF
 *     layout it couldn't read deterministically)
 *
 * Receipt scans (`/api/scan-receipt`) are NOT touched — those still go
 * to AI because image OCR is hard to do deterministically and per-receipt
 * cost is negligible.
 */

import { extractPdfText } from '@/lib/ai'
import type { StatementParseResult } from '@/lib/ai'
import type { BankParser } from './types'
import { cgdParser }        from './cgd'
import { millenniumParser } from './millennium'
import { bpiParser }        from './bpi'
import { santanderParser }  from './santander'
import { revolutParser }    from './revolut'

const PARSERS: BankParser[] = [
  // Order matters only for ties — most banks have unique fingerprints.
  // Revolut goes earlier because its CSV header is in English and could
  // accidentally match nothing in the PT-bank set.
  revolutParser,
  cgdParser,
  millenniumParser,
  bpiParser,
  santanderParser,
]

export interface DeterministicResult {
  result:   StatementParseResult
  provider: string  // e.g. "deterministic:cgd"
}

/**
 * Try every registered parser in order. Returns the first one that
 * fingerprints AND extracts ≥1 transaction. Returns null otherwise so
 * the caller can fall through to AI.
 *
 * For PDFs: extracts text via unpdf first (reused from lib/ai). If text
 * extraction yields nothing (scanned PDF), returns null immediately —
 * scanned PDFs need vision, not regex.
 */
export async function tryDeterministicParse(
  input: { kind: 'text'; content: string;   filename: string }
       | { kind: 'pdf';  pdfBase64: string; filename: string },
): Promise<DeterministicResult | null> {
  let text: string
  if (input.kind === 'pdf') {
    try {
      text = await extractPdfText(input.pdfBase64)
    } catch (err) {
      console.warn('[statement-parsers] pdf text extraction failed:', err)
      return null
    }
    if (!text || text.trim().length < 50) {
      // Scanned PDF — only AI vision can read this
      return null
    }
  } else {
    text = input.content
  }

  for (const parser of PARSERS) {
    if (!parser.detect(text, input.filename)) continue
    try {
      const result = parser.parse(text)
      if (result && result.transactions.length > 0) {
        return { result, provider: `deterministic:${parser.id}` }
      }
    } catch (err) {
      // A parser throwing is a bug — log and try the next one rather
      // than 500ing the whole import.
      console.warn(`[statement-parsers] ${parser.id} threw — falling through:`, err)
    }
  }

  return null
}
