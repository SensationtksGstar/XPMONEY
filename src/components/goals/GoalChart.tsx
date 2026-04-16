'use client'

/**
 * Standalone recharts wrapper for goal progress — loaded dynamically so the
 * recharts bundle (~100 KB gzipped) never hits the initial goals page payload.
 */

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface Props {
  data:     { date: string; value: number }[]
  gradId:   string
}

export default function GoalChart({ data, gradId }: Props) {
  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#ffffff50' }} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#ffffff80' }}
            itemStyle={{ color: '#22c55e' }}
            formatter={(v: number) => [formatCurrency(v), 'Poupado']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#22c55e"
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 4, fill: '#22c55e' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
