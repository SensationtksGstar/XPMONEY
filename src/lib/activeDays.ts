import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Dias ATIVOS reais de um utilizador — a evidência de uso que pauta a
 * evolução da mascote (EVO_MIN_ACTIVE_DAYS) e, no futuro, convites/coortes.
 *
 * Fonte: o ledger `xp_history` (carimbo `earned_at` = hora do SERVIDOR),
 * contando as reasons que só nascem de uma visita real:
 *   - `daily_login`            — check-in diário (/api/daily-checkin)
 *   - `transaction_registered` — POST /api/transactions (awardXP)
 * Um dia = data civil em Europe/Lisbon.
 *
 * NUNCA usar `transactions.date`: essa data vem do extrato ou do cliente, e
 * um import Premium de 3 meses fabricava ~90 "dias ativos" num só dia
 * (era o que lifetimeActiveDays fazia até outubro 2026).
 *
 * Pagina de 1000 em 1000 (o PostgREST corta silenciosamente aos 1000) até
 * 5000 rows ou até atingir `stopAt` dias distintos. Erros → console.warn e
 * devolve o que já contou (0 no 1.º erro) — fail closed para a evolução.
 */

const ACTIVE_REASONS = ['daily_login', 'transaction_registered'] as const
const PAGE      = 1000
const MAX_ROWS  = 5000

const lisbonDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Lisbon',
  year: 'numeric', month: '2-digit', day: '2-digit',
})

export async function activeDaysSince(
  db:     SupabaseClient,
  userId: string,
  opts?:  { since?: string; stopAt?: number },
): Promise<number> {
  if (!userId) return 0
  const stopAt = opts?.stopAt && opts.stopAt > 0 ? opts.stopAt : Infinity
  const days   = new Set<string>()

  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    let q = db
      .from('xp_history')
      .select('earned_at, reason')
      .eq('user_id', userId)
      .in('reason', [...ACTIVE_REASONS])
    if (opts?.since) q = q.gte('earned_at', opts.since)

    const { data, error } = await q
      .order('earned_at', { ascending: false })
      .range(from, from + PAGE - 1)

    if (error) {
      console.warn('[activeDaysSince] probe failed:', error.message)
      return from === 0 ? 0 : days.size
    }
    const rows = (data ?? []) as Array<{ earned_at: string | null }>
    for (const r of rows) {
      if (!r.earned_at) continue
      const d = new Date(r.earned_at)
      if (Number.isNaN(d.getTime())) continue
      days.add(lisbonDay.format(d))
      if (days.size >= stopAt) return days.size
    }
    if (rows.length < PAGE) break
  }
  return days.size
}
