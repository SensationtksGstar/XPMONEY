'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { TrendingUp, Info, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/* ─── Strategies ──────────────────────────────────────────────────────── */
const STRATEGIES = [
  { id: 'savings',     name: 'Depósito a prazo', rate: 3,  color: '#60a5fa', bg: 'border-blue-500/30  bg-blue-500/5',  emoji: '🏦', desc: 'Baixo risco, retorno garantido' },
  { id: 'bonds',       name: 'Obrigações',        rate: 5,  color: '#34d399', bg: 'border-emerald-500/30 bg-emerald-500/5', emoji: '📋', desc: 'Risco moderado, rendimento estável' },
  { id: 'mixed',       name: 'Carteira mista',    rate: 7,  color: '#a78bfa', bg: 'border-purple-500/30 bg-purple-500/5', emoji: '⚖️', desc: 'Ações + obrigações equilibrado' },
  { id: 'sp500',       name: 'S&P 500',           rate: 10, color: '#22c55e', bg: 'border-green-500/40 bg-green-500/8', emoji: '📈', desc: 'Média histórica últimas décadas' },
  { id: 'aggressive',  name: 'Agressivo',          rate: 15, color: '#f59e0b', bg: 'border-yellow-500/30 bg-yellow-500/5', emoji: '🚀', desc: 'Alto risco, alto potencial' },
]

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

function calcCompound(monthly: number, years: number, annualRate: number) {
  const r       = annualRate / 100 / 12
  const months  = years * 12
  const data: { year: number; invested: number; portfolio: number; gains: number }[] = []

  let portfolio    = 0
  let totalInvested = 0

  for (let m = 1; m <= months; m++) {
    totalInvested += monthly
    portfolio = (portfolio + monthly) * (1 + r)
    if (m % 12 === 0) {
      data.push({
        year:      m / 12,
        invested:  Math.round(totalInvested),
        portfolio: Math.round(portfolio),
        gains:     Math.round(portfolio - totalInvested),
      })
    }
  }

  return { data, final: portfolio, invested: totalInvested, gains: portfolio - totalInvested }
}

/* ─── Custom Tooltip ─────────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0f1629] border border-white/10 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-white/60 mb-2 font-medium">Ano {label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name === 'portfolio' ? 'Portfólio' : p.name === 'invested' ? 'Investido' : 'Ganhos'}</span>
          <span className="text-white font-bold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Component ───────────────────────────────────────────────────────── */
interface Props { suggestedMonthly: number }

export default function SimuladorClient({ suggestedMonthly }: Props) {
  const [monthly,   setMonthly]   = useState(suggestedMonthly > 50 ? suggestedMonthly : 200)
  const [years,     setYears]     = useState(20)
  const [stratId,   setStratId]   = useState('sp500')
  const [compare,   setCompare]   = useState(false)

  const strat   = STRATEGIES.find(s => s.id === stratId) ?? STRATEGIES[3]
  const result  = useMemo(() => calcCompound(monthly, years, strat.rate), [monthly, years, strat.rate])

  // Comparison: all strategies at same params
  const allResults = useMemo(
    () => STRATEGIES.map(s => ({ ...s, ...calcCompound(monthly, years, s.rate) })),
    [monthly, years]
  )

  const gainPct = result.invested > 0 ? ((result.gains / result.invested) * 100).toFixed(0) : '0'

  return (
    <div className="space-y-6 pb-10 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <h1 className="text-2xl font-bold text-white">Simulador de Investimento</h1>
          <span className="text-xs bg-purple-500/20 border border-purple-500/30 text-purple-400 px-2 py-0.5 rounded-full font-bold">PRO</span>
        </div>
        <p className="text-white/50 text-sm">Simula o crescimento dos teus investimentos com juros compostos</p>
      </div>

      {/* Inputs */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
        {/* Monthly amount */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-white/70">Poupança mensal</label>
            <span className="text-lg font-bold text-green-400">{fmt(monthly)}</span>
          </div>
          <input
            type="range" min={25} max={5000} step={25}
            value={monthly}
            onChange={e => setMonthly(Number(e.target.value))}
            className="w-full accent-green-400"
          />
          <div className="flex justify-between text-xs text-white/30 mt-1">
            <span>€25</span><span>€5 000</span>
          </div>
          {suggestedMonthly > 0 && (
            <button
              onClick={() => setMonthly(suggestedMonthly)}
              className="text-xs text-green-400/70 hover:text-green-400 mt-1 transition-colors"
            >
              ↩ Usar a tua poupança atual ({fmt(suggestedMonthly)}/mês)
            </button>
          )}
        </div>

        {/* Period */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-white/70">Período</label>
            <span className="text-lg font-bold text-blue-400">{years} anos</span>
          </div>
          <input
            type="range" min={1} max={40} step={1}
            value={years}
            onChange={e => setYears(Number(e.target.value))}
            className="w-full accent-blue-400"
          />
          <div className="flex justify-between text-xs text-white/30 mt-1">
            <span>1 ano</span><span>40 anos</span>
          </div>
        </div>

        {/* Strategy */}
        <div>
          <label className="text-sm font-medium text-white/70 mb-2 block">Estratégia de investimento</label>
          <div className="grid grid-cols-1 gap-2">
            {STRATEGIES.map(s => (
              <button
                key={s.id}
                onClick={() => setStratId(s.id)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left',
                  stratId === s.id ? s.bg : 'border-white/10 bg-white/3 hover:border-white/20'
                )}
              >
                <span className="text-xl w-8 text-center">{s.emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{s.name}</div>
                  <div className="text-xs text-white/40">{s.desc}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold" style={{ color: s.color }}>{s.rate}%/ano</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results summary */}
      <motion.div
        key={`${monthly}-${years}-${stratId}`}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="grid grid-cols-3 gap-3"
      >
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-xs text-white/40 mb-1">Total investido</div>
          <div className="text-lg font-bold text-white">{fmt(result.invested)}</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
          <div className="text-xs text-green-400/60 mb-1">Portfólio final</div>
          <div className="text-lg font-bold text-green-400">{fmt(result.final)}</div>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
          <div className="text-xs text-purple-400/60 mb-1">Lucro ({gainPct}%)</div>
          <div className="text-lg font-bold text-purple-400">+{fmt(result.gains)}</div>
        </div>
      </motion.div>

      {/* Chart */}
      {years >= 2 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Crescimento ao longo do tempo</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={result.data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradPortfolio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={strat.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={strat.color} stopOpacity={0}   />
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
                stroke={strat.color} strokeWidth={2}
                fill="url(#gradPortfolio)"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2">
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <div className="w-3 h-0.5 bg-gray-500 rounded" />
              Investido
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <div className="w-3 h-0.5 rounded" style={{ backgroundColor: strat.color }} />
              Portfólio
            </div>
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          Marcos do teu investimento
        </h3>
        <div className="space-y-2">
          {[1, 5, 10, 20, years].filter((y, i, a) => y <= years && a.indexOf(y) === i).sort((a,b)=>a-b).map(y => {
            const r = calcCompound(monthly, y, strat.rate)
            return (
              <div key={y} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span className="text-sm text-white/60">{y} {y === 1 ? 'ano' : 'anos'}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-white">{fmt(r.final)}</span>
                  <span className="text-xs text-green-400 ml-2">(+{fmt(r.gains)})</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Compare toggle */}
      <div>
        <button
          onClick={() => setCompare(!compare)}
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
        >
          {compare ? '▲ Esconder' : '▼ Ver'} comparação entre todas as estratégias
        </button>

        {compare && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2"
          >
            <h3 className="text-sm font-semibold text-white mb-3">Após {years} anos com {fmt(monthly)}/mês</h3>
            {allResults.sort((a,b) => b.final - a.final).map(s => (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="text-xl w-8 text-center">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{s.name}</div>
                  <div className="text-xs text-white/40">{s.rate}%/ano</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white">{fmt(s.final)}</div>
                  <div className="text-xs" style={{ color: s.color }}>+{fmt(s.gains)}</div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex gap-2 text-xs text-white/30 bg-white/3 rounded-xl p-3">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          Simulação baseada em retornos históricos. Resultados passados não garantem retornos futuros.
          O S&P 500 teve um retorno médio de ~10%/ano nos últimos 50 anos antes de inflação.
          Consulta um consultor financeiro antes de investir.
        </span>
      </div>
    </div>
  )
}
