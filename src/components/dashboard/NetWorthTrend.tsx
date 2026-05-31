'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import type { NetWorthPoint } from '@/app/api/networth/history/route'

/**
 * NetWorthTrend — area chart of the user's net worth over time, built from
 * the snapshots written on each balance edit (see netWorthSnapshot.ts).
 *
 * Shows nothing until there are ≥2 points (one edit gives a single dot — no
 * line to draw). With exactly one point it shows a gentle "history builds
 * here" hint so the user understands why there's no chart yet. Degrades
 * cleanly when the snapshots table isn't migrated (endpoint returns []).
 */

async function fetchHistory(): Promise<NetWorthPoint[]> {
  const res = await fetch('/api/networth/history?days=180')
  if (!res.ok) return []
  const { data } = await res.json()
  return data ?? []
}

export function NetWorthTrend() {
  const { t, locale } = useLocale()
  const { data, isLoading } = useQuery({
    queryKey:             ['networth-history', 180],
    queryFn:              fetchHistory,
    staleTime:            5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const points = useMemo(() => {
    if (!data) return []
    const intl = locale === 'en' ? 'en-US' : 'pt-PT'
    return data.map(p => {
      const [y, m, d] = p.date.split('-').map(Number)
      return {
        ...p,
        label: new Date(y, m - 1, d).toLocaleDateString(intl, { day: '2-digit', month: 'short' }),
      }
    })
  }, [data, locale])

  if (isLoading) return null
  if (points.length === 0) return null

  // Single snapshot → no line yet; nudge instead of an empty chart.
  if (points.length === 1) {
    return (
      <div className="glass-card p-4 flex items-center gap-2 text-xs text-white/45">
        <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>{t('networth.trend_hint')}</span>
      </div>
    )
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <h3 className="font-semibold text-white text-sm">{t('networth.trend_title')}</h3>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
              minTickGap={24}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              tickFormatter={v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
              width={48}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.15)' }}
              contentStyle={{
                background:   '#0a0f1e',
                border:       '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                fontSize:     12,
                color:        '#fff',
              }}
              itemStyle={{ color: '#fff' }}
              formatter={(value: number) => [formatCurrency(value, 'EUR', locale), t('networth.net_label')]}
              labelFormatter={label => String(label)}
            />
            <Area
              type="monotone"
              dataKey="net"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#nwGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
