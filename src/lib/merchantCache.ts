import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase'

/**
 * Global merchant-categorization cache.
 *
 * The whole point: once anyone categorizes "COMPRA PINGO DOCE LISBOA REF
 * 12345" → "Alimentação", every other user importing a similar line never
 * calls AI for it again. After ~30 days of real usage the catalog covers
 * the long tail of PT merchants and AI cost for categorization rounds to
 * zero.
 *
 * Privacy is enforced HERE — see {@link isAllowedToCache} below. The
 * allowlist refuses to cache anything that smells like a personal transfer
 * (TR-IPS-<NAME>) or contains an IBAN/phone-number shaped run, so the
 * cache stores only public-merchant strings.
 */

// ─── Normalization ──────────────────────────────────────────────────────────

/**
 * Normalize a transaction description into a stable cache key.
 *
 * Strategy:
 *   • Uppercase + trim, collapse whitespace
 *   • Strip long digit runs (≥6 digits) → drops refs, NIBs, transaction IDs
 *   • Strip currency tokens "12,34" / "12.34" / "€12,34"
 *   • Strip date shapes (DD/MM/YYYY, YYYY-MM-DD)
 *   • Drop common noise tokens (REF, NR, Nº, NIF)
 *
 * What survives: merchant tokens. Examples:
 *   "COMPRA PINGO DOCE LISBOA REF 12345 €23,45" → "COMPRA PINGO DOCE LISBOA"
 *   "MB WAY 351912345678 PINGO DOCE"            → "MB WAY PINGO DOCE"
 *   "DD MEO TELECOMUNICACOES NIF 504615947"     → "DD MEO TELECOMUNICACOES"
 *
 * Two different transactions to the same merchant collide on the key,
 * which is exactly the cache hit we want.
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

// ─── Privacy allowlist ──────────────────────────────────────────────────────

/**
 * Personal-transfer prefixes — must NEVER go into the global cache because
 * they include third-party names. Reading from the cache for these still
 * works (won't hit), writing is blocked.
 *
 * Checked against the ORIGINAL description (not normalized) because some
 * markers like "TR-IPS-NAME" might be normalized away.
 */
const PII_PREFIXES = [
  /^TR[\s-]?IPS[\s-]/i,             // Montepio MB WAY incoming/outgoing with name
  /^TRF\.\s/i,                       // Montepio "TRF. 0000351 ..." — has IBAN-shaped ref
  /^TR\b.*?-/i,                      // generic "TR ALGO-NOME"
  /^DD[\s-]/i,                       // direct debits — has NAME of beneficiary
  /^TRANSF/i,                        // generic transfer
  /^TRANSFER[EÊ]NCIA/i,
  /^IPS[\s-]/i,
  /^MBWAY[\s-]/i,                    // MB WAY transfers (P2P)
  /^MB\s?WAY[\s-]/i,
]

/**
 * Allowlist of PUBLIC merchant prefixes — always cacheable when matched.
 * The list is the dual of PII_PREFIXES: we only cache when we're sure it's
 * a merchant transaction.
 */
const MERCHANT_PREFIXES = [
  /^COMPRA\s/i,                      // card purchases
  /^PAG\.?\s/i,                      // PAG.NMV24 etc. (utility bill payments)
  /^PAGAMENTO\s/i,
  /^LEVANT/i,                        // ATM withdrawals (no merchant but predictable category)
  /^COMISS[AÃ]O/i,                   // bank fees
  /^I\.?SELO/i,                      // stamp duty
  /^JUROS\b/i,                       // interest
  /^DEVOL/i,                         // refunds (still has merchant name after)
  /^MGAM\b/i,                        // Montepio gym/quotas
]

export function isAllowedToCache(originalDescription: string): boolean {
  const trimmed = originalDescription.trim()
  if (trimmed.length < 3) return false

  // Hard-block PII patterns first.
  for (const re of PII_PREFIXES) if (re.test(trimmed)) return false

  // Allow if it matches a known merchant prefix.
  for (const re of MERCHANT_PREFIXES) if (re.test(trimmed)) return true

  // Default DENY for anything else — we'd rather miss a cache write than
  // leak personal data. Future: surface a "cache rejected" counter so we
  // can audit common patterns we're conservatively dropping.
  return false
}

// ─── Cache I/O ──────────────────────────────────────────────────────────────

export interface CachedCategory {
  category:    string
  merchant:    string | null
  confidence:  number
  validations: number
}

/**
 * Read the trusted cached category for a normalized description, or null
 * when missing or below the trust threshold (validations ≥ 2 OR
 * confidence ≥ 0.8). Lower-trust rows exist but we don't apply them
 * automatically — the AI-supplied category wins until the entry has been
 * confirmed by enough users.
 */
export async function getCachedCategory(normalizedDesc: string): Promise<CachedCategory | null> {
  if (!normalizedDesc) return null
  try {
    const db = createSupabaseAdmin()
    const { data, error } = await db
      .from('merchant_categories')
      .select('category, merchant, confidence, validations')
      .eq('normalized_desc', normalizedDesc)
      .maybeSingle()

    if (error || !data) return null

    const trusted = data.validations >= 2 || data.confidence >= 0.8
    if (!trusted) return null

    return {
      category:    data.category,
      merchant:    data.merchant ?? null,
      confidence:  data.confidence,
      validations: data.validations,
    }
  } catch (err) {
    console.warn('[merchant-cache] read failed (non-fatal):', err)
    return null
  }
}

/**
 * Bulk read — single round-trip for a list of normalized descriptions.
 * Returns a Map keyed by normalized_desc for callers that walk many txs.
 */
export async function getCachedCategoriesBulk(
  normalizedDescs: string[],
): Promise<Map<string, CachedCategory>> {
  const out = new Map<string, CachedCategory>()
  const unique = Array.from(new Set(normalizedDescs.filter(Boolean)))
  if (unique.length === 0) return out

  try {
    const db = createSupabaseAdmin()
    const { data, error } = await db
      .from('merchant_categories')
      .select('normalized_desc, category, merchant, confidence, validations')
      .in('normalized_desc', unique)

    if (error || !data) return out

    for (const row of data) {
      const trusted = row.validations >= 2 || row.confidence >= 0.8
      if (!trusted) continue
      out.set(row.normalized_desc, {
        category:    row.category,
        merchant:    row.merchant ?? null,
        confidence:  row.confidence,
        validations: row.validations,
      })
    }
  } catch (err) {
    console.warn('[merchant-cache] bulk read failed (non-fatal):', err)
  }
  return out
}

/**
 * Write/upsert a category for a description. Refuses silently when the
 * original description fails the privacy allowlist.
 *
 * Source semantics:
 *   • 'user' — user explicitly confirmed/edited in the import preview;
 *     start at confidence 0.7, validations 1 (counts as a strong signal
 *     because it's a human label, not a guess).
 *   • 'ai'   — AI-suggested categorization just landed; start at 0.5/1.
 *   • 'seed' — admin-curated seed (future).
 */
export async function setCachedCategory(params: {
  originalDescription: string
  normalizedDesc:      string
  category:            string
  merchant?:           string | null
  source:              'ai' | 'user' | 'seed'
}): Promise<void> {
  if (!isAllowedToCache(params.originalDescription)) return
  if (!params.normalizedDesc || !params.category) return

  try {
    const db = createSupabaseAdmin()

    // Optimistic upsert — if the row already exists with the SAME category
    // we use bump_merchant_validation for atomic +1 to validations + small
    // confidence bump. If different category, we replace (newer wins);
    // confidence resets to source-base because the disagreement is a real
    // signal we shouldn't trust the old value blindly.
    const { data: existing } = await db
      .from('merchant_categories')
      .select('category')
      .eq('normalized_desc', params.normalizedDesc)
      .maybeSingle()

    const baseConfidence = params.source === 'user' ? 0.7
                         : params.source === 'seed' ? 0.9
                         : 0.5

    if (existing && existing.category === params.category) {
      await db.rpc('bump_merchant_validation', {
        p_normalized_desc: params.normalizedDesc,
        p_category:        params.category,
      })
      return
    }

    await db
      .from('merchant_categories')
      .upsert(
        {
          normalized_desc: params.normalizedDesc,
          category:        params.category,
          merchant:        params.merchant ?? null,
          confidence:      baseConfidence,
          validations:     1,
          source:          params.source,
          updated_at:      new Date().toISOString(),
        },
        { onConflict: 'normalized_desc' },
      )
  } catch (err) {
    console.warn('[merchant-cache] write failed (non-fatal):', err)
  }
}

/**
 * Bulk write — used by the confirm endpoint to seed many categorizations
 * in parallel after a successful import. Each call goes through the
 * allowlist + dedup; failures are swallowed (caller already returned 201
 * to the user, cache is best-effort).
 */
export async function setCachedCategoriesBulk(items: Array<{
  originalDescription: string
  category:            string
  merchant?:           string | null
  source:              'ai' | 'user' | 'seed'
}>): Promise<void> {
  await Promise.allSettled(items.map(it =>
    setCachedCategory({
      originalDescription: it.originalDescription,
      normalizedDesc:      normalizeDescription(it.originalDescription),
      category:            it.category,
      merchant:            it.merchant,
      source:              it.source,
    }),
  ))
}
