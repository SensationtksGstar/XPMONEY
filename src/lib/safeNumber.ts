/**
 * Safely parse a value into a finite number.
 * Returns `fallback` when the value is null, undefined, empty string,
 * non-numeric, NaN, or ±Infinity.
 *
 * Postgres returns `numeric` columns as strings, so the common
 * `Number(row.amount)` pattern is silently unsafe.
 */
export function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Parse an amount string that may use either PT ("1.234,56") or EN
 * ("1,234.56") decimal conventions, plus the short forms "12.34" /
 * "12,34". Returns NaN on failure.
 *
 * Movido para safeNumber.ts (de TransactionForm.tsx) para ser reutilizado
 * na feature Kill Debt e futuras que aceitem input decimal PT-PT.
 */
export function parseAmountLocale(raw: string): number {
  const trimmed = raw.trim().replace(/\s+/g, '')
  if (!trimmed) return NaN
  const lastDot   = trimmed.lastIndexOf('.')
  const lastComma = trimmed.lastIndexOf(',')
  let normalised: string
  if (lastDot === -1 && lastComma === -1) {
    normalised = trimmed
  } else if (lastComma > lastDot) {
    // PT: comma is decimal, dots are thousands
    normalised = trimmed.replace(/\./g, '').replace(',', '.')
  } else {
    // EN: dot is decimal, commas are thousands
    normalised = trimmed.replace(/,/g, '')
  }
  const n = Number(normalised)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Parse a URL query string into a bounded integer.
 *
 * @example
 *   parseBoundedInt(searchParams.get('limit'), { default: 50, min: 1, max: 200 })
 */
export function parseBoundedInt(
  raw: string | null | undefined,
  opts: { default: number; min?: number; max?: number },
): number {
  const n = toNumber(raw, opts.default)
  const int = Math.trunc(n)
  if (opts.min !== undefined && int < opts.min) return opts.min
  if (opts.max !== undefined && int > opts.max) return opts.max
  return int
}
