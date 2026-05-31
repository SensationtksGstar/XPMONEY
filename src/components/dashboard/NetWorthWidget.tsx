'use client'

import Link from 'next/link'
import { Wallet, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { computeNetWorth } from '@/lib/netWorth'
import { formatCurrency } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/LocaleProvider'

/**
 * NetWorthWidget — compact dashboard surface for the Património page.
 *
 * Renders ONLY when the user has actually set balances (any non-zero asset
 * or liability). Most users start with a single €0 default account, so an
 * always-visible "€0" net worth would be noise — this hides until there's a
 * real number, which also rewards setting it up. Reuses the ['accounts']
 * cache (shared with /contas) → zero extra fetch.
 */
export function NetWorthWidget() {
  const { t, locale } = useLocale()
  const { accounts, loading } = useAccounts()

  if (loading) {
    return <div className="h-24 bg-white/5 rounded-2xl animate-pulse" />
  }

  const nw = computeNetWorth(accounts)
  // Nothing meaningful set yet → don't render.
  if (nw.assets === 0 && nw.liabilities === 0) return null

  const netPositive = nw.net >= 0

  return (
    <Link
      href="/contas"
      className={`group block border rounded-2xl p-5 transition-colors ${
        netPositive
          ? 'bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-transparent border-emerald-500/25 hover:border-emerald-400/45'
          : 'bg-gradient-to-br from-rose-500/10 via-orange-500/5 to-transparent border-rose-500/25 hover:border-rose-400/45'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-white text-sm">{t('networth.title')}</h3>
        </div>
        <span className="text-[11px] text-white/50 flex items-center gap-1 group-hover:text-white/80 transition-colors">
          {t('networth.see_details')}
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>

      <p className={`text-2xl font-black tabular-nums ${netPositive ? 'text-emerald-300' : 'text-rose-300'}`}>
        {formatCurrency(nw.net, 'EUR', locale)}
      </p>

      <div className="flex items-center gap-4 mt-2 text-[11px]">
        <span className="inline-flex items-center gap-1 text-white/55">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          {t('networth.assets')}: <strong className="text-white/80 tabular-nums">{formatCurrency(nw.assets, 'EUR', locale)}</strong>
        </span>
        {nw.liabilities > 0 && (
          <span className="inline-flex items-center gap-1 text-white/55">
            <TrendingDown className="w-3 h-3 text-rose-400" />
            {t('networth.liabilities')}: <strong className="text-white/80 tabular-nums">{formatCurrency(nw.liabilities, 'EUR', locale)}</strong>
          </span>
        )}
      </div>
    </Link>
  )
}
