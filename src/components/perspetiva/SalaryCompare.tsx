'use client'

import { useMemo, useState } from 'react'
import { Globe, ArrowRight, Info } from 'lucide-react'
import {
  COUNTRIES, REGIONS, computeSalaryStats,
  type Region,
} from '@/lib/salaryData'
import { formatCurrency } from '@/lib/utils'
import { parseAmountLocale } from '@/lib/safeNumber'

/**
 * SalaryCompare — "Se vivesses noutro país" — tab da Perspetiva.
 *
 * Desenho (rationale documentado no chat de planeamento):
 *   - Listagem ordenada com barras horizontais (não globo 3D nem mapa)
 *     porque os users querem ver NÚMEROS primeiro. Mapa/globo são
 *     impressionantes 5s e depois irrelevantes para scanning.
 *   - Toggle Nominal ↔ PPP. Nominal = câmbio real; PPP = poder de
 *     compra ajustado com Portugal como base. Os dois enganam de formas
 *     diferentes, mostrar ambos é o mais honesto.
 *   - Filtro por região (chips) para focar comparações relevantes.
 *   - O user aparece inline na lista marcado com um ring/badge "Tu" na
 *     posição correspondente ao seu percentil.
 *
 * Input: salário mensal líquido em EUR. Pré-preenchido se o parent souber
 * (vem dos registos de transações categorizadas como Salário/Freelance)
 * mas sempre editável.
 */

interface Props {
  /** Salário mensal líquido em EUR, detectado da plataforma ou 0. */
  initialMonthlyEUR: number
}

export function SalaryCompare({ initialMonthlyEUR }: Props) {
  const [input, setInput]   = useState<string>(
    initialMonthlyEUR > 0 ? String(Math.round(initialMonthlyEUR)) : '',
  )
  const [region, setRegion] = useState<Region | 'all'>('all')
  const [mode, setMode]     = useState<'nominal' | 'ppp'>('nominal')

  const monthly = Math.max(0, parseAmountLocale(input) || 0)

  const stats = useMemo(() => computeSalaryStats(monthly, mode), [monthly, mode])

  const filtered = useMemo(() => {
    if (region === 'all') return stats.sorted
    return stats.sorted.filter(c => c.region === region)
  }, [stats.sorted, region])

  // Maior valor visível para escalar as barras
  const maxValue = Math.max(
    monthly,
    ...filtered.map(c => (mode === 'nominal' ? c.nominalEUR : c.pppEUR)),
  )

  // Posição do user na lista filtrada — usada para inserir o "Tu" card
  const userPosIdx = filtered.findIndex(c =>
    (mode === 'nominal' ? c.nominalEUR : c.pppEUR) <= monthly,
  )
  const insertUserAt = monthly > 0
    ? (userPosIdx === -1 ? filtered.length : userPosIdx)
    : -1

  return (
    <div className="space-y-4">
      {/* Header + input */}
      <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/25 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-5 h-5 text-purple-300" />
          <h2 className="text-lg font-bold text-white">Se vivesses noutro país…</h2>
        </div>

        <label className="block text-xs text-white/50 mb-1.5 font-semibold">
          O teu líquido mensal em EUR
        </label>
        <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 focus-within:border-purple-400/60 mb-4">
          <span className="text-white/40">€</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9.,]*"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="1500"
            className="flex-1 bg-transparent text-white text-lg font-bold outline-none placeholder-white/25"
            aria-label="Salário mensal líquido"
          />
          <span className="text-xs text-white/40">/mês</span>
        </div>

        {monthly > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Posição" value={`#${stats.rank}`} sub={`de ${stats.total}`} />
            <StatBox label="Percentil" value={`${stats.percentile}%`} sub="dos países" />
            <StatBox
              label="Média global"
              value={formatCurrency(
                COUNTRIES.reduce((s, c) => s + (mode === 'nominal' ? c.nominalEUR : c.pppEUR), 0) / COUNTRIES.length,
              )}
              sub="líquida"
            />
          </div>
        ) : (
          <p className="text-sm text-white/50">
            Introduz o teu salário para veres a comparação.
          </p>
        )}
      </div>

      {/* Toggles */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Region filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {REGIONS.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRegion(r.id)}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                region === r.id
                  ? 'bg-purple-500/20 border-purple-400/50 text-purple-200'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Nominal / PPP toggle */}
        <div className="flex items-center bg-black/30 border border-white/10 rounded-lg p-0.5">
          {(['nominal', 'ppp'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-md transition-colors ${
                mode === m
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:text-white'
              }`}
              aria-label={m === 'ppp' ? 'Ajustado por poder de compra' : 'Valor à taxa de câmbio'}
            >
              {m === 'ppp' ? 'PPP' : 'Nominal'}
            </button>
          ))}
        </div>
      </div>

      {/* Disclaimer breve */}
      <div className="flex items-start gap-2 text-[11px] text-white/45 px-1">
        <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
        <p>
          {mode === 'nominal'
            ? 'Valores à taxa de câmbio real. Não considera diferenças de custo de vida.'
            : 'Ajustado por PPP — poder de compra equivalente em Portugal (base 2024).'}
          {' '}Dados OECD/Eurostat 2024.
        </p>
      </div>

      {/* Lista de países */}
      <div className="space-y-1.5">
        {filtered.map((c, i) => {
          const value = mode === 'nominal' ? c.nominalEUR : c.pppEUR
          const pctBar = maxValue > 0 ? Math.max(2, (value / maxValue) * 100) : 0
          const delta = monthly > 0 ? ((value - monthly) / monthly) * 100 : 0
          const deltaPositive = delta > 0

          // Se é a posição onde encaixa o user, insere o card "Tu" primeiro
          const showUserBefore = insertUserAt === i && monthly > 0

          return (
            <div key={c.code}>
              {showUserBefore && <UserRow monthly={monthly} maxValue={maxValue} />}
              <CountryRow
                flag={c.flag}
                name={c.name}
                value={value}
                pctBar={pctBar}
                delta={delta}
                deltaPositive={deltaPositive}
                hasInput={monthly > 0}
              />
            </div>
          )
        })}
        {/* Se o user está abaixo de TODOS os filtrados, mostra no fim */}
        {insertUserAt >= filtered.length && monthly > 0 && (
          <UserRow monthly={monthly} maxValue={maxValue} />
        )}
      </div>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────

function StatBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-black/30 border border-white/5 rounded-lg p-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">{label}</p>
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-[10px] text-white/50">{sub}</p>
    </div>
  )
}

function CountryRow({
  flag, name, value, pctBar, delta, deltaPositive, hasInput,
}: {
  flag: string; name: string; value: number; pctBar: number
  delta: number; deltaPositive: boolean; hasInput: boolean
}) {
  return (
    <div className="flex items-center gap-3 bg-white/3 border border-white/8 hover:border-white/15 rounded-lg px-3 py-2.5 transition-colors">
      <span className="text-xl flex-shrink-0" aria-hidden>{flag}</span>
      <div className="flex-shrink-0 w-28 sm:w-32 truncate text-sm font-semibold text-white/85">
        {name}
      </div>
      <div className="flex-1 min-w-0 h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-400 transition-all"
          style={{ width: `${pctBar}%` }}
        />
      </div>
      <div className="flex-shrink-0 w-20 text-right">
        <p className="text-sm font-bold text-white tabular-nums">
          {formatCurrency(value)}
        </p>
        {hasInput && (
          <p className={`text-[10px] font-bold tabular-nums ${
            deltaPositive ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {deltaPositive ? '+' : ''}{delta.toFixed(0)}%
          </p>
        )}
      </div>
    </div>
  )
}

function UserRow({ monthly, maxValue }: { monthly: number; maxValue: number }) {
  const pctBar = maxValue > 0 ? Math.max(2, (monthly / maxValue) * 100) : 0
  return (
    <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-500/15 via-orange-500/10 to-transparent border-2 border-yellow-400/50 rounded-lg px-3 py-2.5 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
      <span className="text-xl flex-shrink-0" aria-hidden>⭐</span>
      <div className="flex-shrink-0 w-28 sm:w-32 truncate text-sm font-bold text-yellow-200">
        Tu (aqui)
      </div>
      <div className="flex-1 min-w-0 h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all"
          style={{ width: `${pctBar}%` }}
        />
      </div>
      <div className="flex-shrink-0 w-20 text-right">
        <p className="text-sm font-bold text-yellow-200 tabular-nums">
          {formatCurrency(monthly)}
        </p>
        <p className="text-[10px] text-yellow-300/70 flex items-center gap-0.5 justify-end">
          <ArrowRight className="w-2.5 h-2.5" />
          posição
        </p>
      </div>
    </div>
  )
}
