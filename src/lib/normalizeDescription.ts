/**
 * normalizeDescription — collapse a bank-statement description to its stable
 * merchant tokens, stripping amounts, dates, references and punctuation noise.
 *
 * Lives in its own module (no 'server-only', no IO) because it's shared by
 * BOTH worlds: the server-only merchant cache (src/lib/merchantCache.ts) and
 * the isomorphic spend-forecast math (src/lib/spendForecast.ts), whose types
 * and formatters are imported by client components — importing it from
 * merchantCache dragged `server-only` into the client graph and broke the
 * build (July 2026).
 *
 * What survives: merchant tokens. Examples:
 *   "COMPRA PINGO DOCE LISBOA REF 12345 €23,45" → "COMPRA PINGO DOCE LISBOA"
 *   "MB WAY 351912345678 PINGO DOCE"            → "MB WAY PINGO DOCE"
 *   "DD MEO TELECOMUNICACOES NIF 504615947"     → "DD MEO TELECOMUNICACOES"
 */
export function normalizeDescription(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g, ' ')      // dates
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')                        // ISO dates
    .replace(/€\s?\d+[,.]\d{2}/g, ' ')                             // €12,34
    .replace(/\b\d+[,.]\d{2}\b/g, ' ')                             // 12,34
    .replace(/\b\d{6,}\b/g, ' ')                                   // long IDs/refs
    .replace(/\b(REF|NR|N[ºO]|NIF|N\.?I\.?F\.?|FACT)\b\.?/g, ' ')  // boilerplate tokens
    .replace(/[^\w\s&.\-]/g, ' ')                                  // punctuation noise
    .replace(/\s+/g, ' ')
    .trim()
}
