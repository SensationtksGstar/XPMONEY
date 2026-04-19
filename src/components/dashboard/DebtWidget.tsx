'use client'

import Link from 'next/link'
import { Sword, ArrowRight, TrendingDown, Flame } from 'lucide-react'
import { useDebts } from '@/hooks/useDebts'
import {
  resolveCategory, orderByStrategy, formatMonths, projectPayoff,
  type DebtStrategy,
} from '@/lib/killDebt'
import { formatCurrency } from '@/lib/utils'

/**
 * DebtWidget — card compacto no dashboard que promove e resume o
 * estado do Mata-Dívidas.
 *
 * Comportamento:
 *   - Se o user tem dívidas activas: mostra total, progresso global,
 *     próxima a atacar (segundo a estratégia da primeira) e CTA
 *     "Ver detalhes" para /dividas.
 *   - Se não tem dívidas (array vazio ou só killed): devolve null.
 *     O sidebar já tem link para /dividas, não precisamos de noise
 *     no dashboard de users que não usam a feature.
 *
 * A query reusa o queryKey ['debts'] pelo que partilha cache com a
 * página /dividas — zero double-fetch.
 */
export function DebtWidget() {
  const { debts, loading } = useDebts()

  if (loading) {
    return (
      <div className="glass-card p-5 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 bg-white/10 rounded" />
          <div className="h-4 w-32 bg-white/10 rounded" />
        </div>
        <div className="h-8 w-40 bg-white/10 rounded mb-3" />
        <div className="h-2 bg-white/10 rounded" />
      </div>
    )
  }

  const active  = debts.filter(d => d.status === 'active')
  const killed  = debts.filter(d => d.status === 'killed')
  if (active.length === 0 && killed.length === 0) return null

  // Totais
  const currentTotal = active.reduce((s, d) => s + Number(d.current_amount), 0)
  const initialTotal = debts.reduce((s, d) => s + Number(d.initial_amount), 0)
  const paidOff      = Math.max(0, initialTotal - currentTotal)
  const pctPaid      = initialTotal > 0 ? Math.min(100, (paidOff / initialTotal) * 100) : 0

  // Se já abateu tudo, mostra troféu — feedback positivo para
  // users que já fecharam o ciclo
  if (active.length === 0 && killed.length > 0) {
    return (
      <Link
        href="/dividas"
        className="group block bg-gradient-to-br from-emerald-500/15 via-green-500/5 to-transparent border border-emerald-500/30 rounded-2xl p-5 hover:border-emerald-400/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
              <span aria-hidden className="text-lg">🎯</span>
            </div>
            <div>
              <p className="font-bold text-emerald-200">
                {killed.length} {killed.length === 1 ? 'dívida abatida' : 'dívidas abatidas'}
              </p>
              <p className="text-xs text-white/55">
                Livre de dívidas — mantém assim.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-emerald-300 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    )
  }

  // Decide qual é a próxima a atacar — usa a estratégia da primeira dívida
  // (todas têm a mesma em prática, são actualizadas em lote em /dividas)
  const strategy: DebtStrategy = active[0]?.strategy ?? 'avalanche'
  const next = orderByStrategy(active, strategy)[0]
  const nextCat = next ? resolveCategory(next.category) : null

  // Projecção rápida: tempo até zero da próxima dívida com só o mínimo
  const proj = next
    ? projectPayoff(Number(next.current_amount), next.interest_rate, next.min_payment, 0)
    : null

  return (
    <Link
      href="/dividas"
      className="group block bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border border-red-500/25 hover:border-red-400/50 rounded-2xl p-5 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sword className="w-4 h-4 text-red-400" />
          <h3 className="font-semibold text-white text-sm">Mata-Dívidas</h3>
          <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full uppercase">
            Pro
          </span>
        </div>
        <span className="text-[11px] text-white/50 flex items-center gap-1 group-hover:text-white/80 transition-colors">
          Ver
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>

      {/* Totais */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-2xl font-black text-white tabular-nums">
            {formatCurrency(currentTotal)}
          </p>
          <p className="text-[11px] text-white/50">
            em {active.length} {active.length === 1 ? 'dívida' : 'dívidas'} activas
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-300 tabular-nums">
            {formatCurrency(paidOff)}
          </p>
          <p className="text-[10px] text-white/45">já abatido</p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="h-2 bg-black/30 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all"
          style={{ width: `${pctPaid}%` }}
        />
      </div>

      {/* Próxima a atacar */}
      {next && nextCat && (
        <div className="flex items-center gap-2.5 bg-black/20 rounded-lg p-2.5">
          <span aria-hidden className="text-lg flex-shrink-0">{nextCat.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-white truncate">{next.name}</p>
              <span className="text-[9px] font-bold bg-red-500/15 text-red-300 border border-red-500/30 px-1 py-px rounded-full whitespace-nowrap">
                Próximo
              </span>
            </div>
            <p className="text-[11px] text-white/50 flex items-center gap-2 mt-0.5">
              <span className="tabular-nums">{formatCurrency(Number(next.current_amount))}</span>
              {next.interest_rate > 0 && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="flex items-center gap-0.5 text-orange-300">
                    <Flame className="w-2.5 h-2.5" />
                    <span className="tabular-nums">{next.interest_rate.toFixed(2)}%</span>
                  </span>
                </>
              )}
              {proj && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="text-white/60">só mínimo: {formatMonths(proj.months)}</span>
                </>
              )}
            </p>
          </div>
          <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
        </div>
      )}
    </Link>
  )
}
