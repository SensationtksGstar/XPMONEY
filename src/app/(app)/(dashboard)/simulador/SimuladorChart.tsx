'use client'

/**
 * Standalone recharts wrapper for the investment simulator chart.
 * Dynamic-imported by SimuladorClient so the ~100 KB recharts bundle only
 * loads when the user actually renders a chart (years >= 2).
 */

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

interface TooltipPayload { name: string; value: number; color: string }
function CustomTooltip({
  active, payload, label,
}: { active?: boolean; payload?: TooltipPayload[]; label?: string | number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0f1629] border border-white/10 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-white/60 mb-2 font-medium">Ano {label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>
            {p.name === 'portfolio' ? 'Portfólio' : p.name === 'invested' ? 'Investido' : 'Ganhos'}
          </span>
          <span className="text-white font-bold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  data:   { year: number; invested: number; portfolio: number; gains: number }[]
  color:  string
}

export default function SimuladorChart({ data, color }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradPortfolio" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color}    stopOpacity={0.3} />
            <stop offset="95%" stopColor={color}    stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="gradInvested" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6b7280" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6b7280" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="year"
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
          tickFormatter={v => `${v}a`}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
          tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`}
          axisLine={false}
          tickLine={false}
          width={38}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone" dataKey="invested" name="invested"
          stroke="#6b7280" strokeWidth={1.5}
          fill="url(#gradInvested)"
        />
        <Area
          type="monotone" dataKey="portfolio" name="portfolio"
          stroke={color} strokeWidth={2}
          fill="url(#gradPortfolio)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
