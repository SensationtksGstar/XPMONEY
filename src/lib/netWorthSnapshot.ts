import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeNetWorth } from '@/lib/netWorth'
import type { AccountType } from '@/types'

/**
 * Records (upserts) today's net-worth snapshot for a user. Called after any
 * account balance change (create / update / delete) so the /contas trend
 * chart has data points at every moment the user updated their balances —
 * no cron needed.
 *
 * Fully best-effort: it recomputes from the current accounts and never
 * throws into the caller. If the `net_worth_snapshots` table doesn't exist
 * yet (migration not applied), it silently no-ops — the account write that
 * triggered it must still succeed.
 *
 * `today` is passed in by the caller (computed per-request) so this stays a
 * pure-ish helper and the date matches the request's timezone handling.
 */
export async function recordNetWorthSnapshot(
  db: SupabaseClient,
  internalUserId: string,
  today: string,
): Promise<void> {
  try {
    const { data: accounts, error: accErr } = await db
      .from('accounts')
      .select('balance, type')
      .eq('user_id', internalUserId)

    if (accErr || !accounts) return

    const nw = computeNetWorth(accounts as Array<{ balance: string | number | null; type: AccountType }>)

    const { error } = await db
      .from('net_worth_snapshots')
      .upsert(
        {
          user_id:       internalUserId,
          snapshot_date: today,
          net:           nw.net,
          assets:        nw.assets,
          liabilities:   nw.liabilities,
        },
        { onConflict: 'user_id,snapshot_date' },
      )

    if (error && !/relation .* does not exist/i.test(error.message)) {
      console.warn('[netWorthSnapshot] upsert failed:', error.message)
    }
  } catch (err) {
    console.warn('[netWorthSnapshot] failed:', err)
  }
}
