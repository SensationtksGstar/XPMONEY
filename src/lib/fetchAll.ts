/**
 * fetchAll — paginate past PostgREST's silent 1000-row cap.
 *
 * Supabase/PostgREST caps every select at `max-rows` (1000 by default) and
 * returns the truncated page WITHOUT an error. Any query over a table that
 * grows per user (transactions, xp_history, …) must therefore page with
 * `.range(from, to)` until a short page comes back.
 *
 * The caller builds the query and MUST give it a stable order (e.g.
 * `.order('date', { ascending: false }).order('id')`) — without it, rows can
 * shift between pages and appear twice / go missing.
 *
 *   const { rows, truncated } = await fetchAll((from, to) =>
 *     db.from('transactions').select('*').eq('user_id', uid)
 *       .order('date', { ascending: false }).order('id')
 *       .range(from, to))
 *
 * `max` is a hard ceiling so a runaway table can't blow the lambda's memory;
 * when it's hit `truncated` is true and the caller should tell the user.
 * Errors are thrown (the caller decides between 500 and a `_warnings` entry).
 */
export interface FetchAllOptions {
  /** Page size — keep ≤ the PostgREST max-rows (1000). */
  size?: number
  /** Hard ceiling on total rows fetched. */
  max?: number
}

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  opts: FetchAllOptions = {},
): Promise<{ rows: T[]; truncated: boolean }> {
  const size = opts.size ?? 1000
  const max  = opts.max  ?? 50_000
  const rows: T[] = []

  for (let from = 0; from < max; from += size) {
    const to = Math.min(from + size, max) - 1
    const { data, error } = await page(from, to)
    if (error) throw error
    const batch = data ?? []
    rows.push(...batch)
    // A short (or empty) page means we've read everything.
    if (batch.length < to - from + 1) return { rows, truncated: false }
  }

  // Every page came back full up to the ceiling → there may be more rows.
  return { rows, truncated: true }
}
