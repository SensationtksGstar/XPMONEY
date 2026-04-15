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
