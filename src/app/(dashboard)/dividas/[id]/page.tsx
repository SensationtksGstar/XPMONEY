'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Sword, Zap, Check, TrendingDown, Clock,
  AlertTriangle, Flame, X,
} from 'lucide-react'
import { useDebts, useDebtAttack, type Debt } from '@/hooks/useDebts'
import {
  resolveCategory, projectPayoff, formatMonths, xpForAttack,
  type DebtAttack,
} from '@/lib/killDebt'
import { formatCurrency } from '@/lib/utils'
import { parseAmountLocale } from '@/lib/safeNumber'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/toaster'
import { useQuery } from '@tanstack/react-query'

/**
 * /dividas/[id] — página de batalha com uma dívida específica.
 *
 * Mostra saldo, progresso, taxa, prestação mínima, e tem o form
 * "atacar" — regista uma amortização extra com XP animado de retorno.
 *
 * Histórico de ataques vem via /api/debts/[id]/attacks (GET — criado
 * inline abaixo via useQuery para não inflar useDebts.ts).
 */

async function fetchAttacks(debtId: string): Promise<DebtAttack[]> {
  // Reuso a rota attack com método GET? Não — criámos só POST. Por
  // agora fazemos fetch do histórico filtrando debt_attacks via
  // endpoint no futuro; enquanto não existir, devolvemos []
  // graciosamente. TODO: /api/debts/[id]/attacks (GET).
  try {
    const res = await fetch(`/api/debts/${debtId}/attacks`)
    if (!res.ok) return []
    const { data } = await res.json()
    return data ?? []
  } catch {
    return []
  }
}

export default function DebtDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { debts, loading, updateDebt, deleteDebt } = useDebts()
  const attackMutation = useDebtAttack()
  const { toast } = useToast()

  const debt = useMemo(
    () => debts.find(d => d.id === params.id),
    [debts, params.id],
  )

  const attacksQuery = useQuery({
    queryKey:  ['debt-attacks', params.id],
    queryFn:   () => fetchAttacks(params.id),
    staleTime: 60_000,
    enabled:   !!params.id,
  })

  const [amount, setAmount] = useState('')
  const [note, setNote]     = useState('')
  const [showKillModal, setShowKillModal] = useState<{ xp: number } | null>(null)

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner /></div>
  }
  if (!debt) return notFound()

  const cat       = resolveCategory(debt.category)
  const current   = Number(debt.current_amount)
  const initial   = Number(debt.initial_amount)
  const paidOff   = Math.max(0, initial - current)
  const pctPaid   = initial > 0 ? Math.min(100, (paidOff / initial) * 100) : 0
  const isKilled  = debt.status === 'killed'

  // Projecções — com pagamento mínimo apenas, e com mínimo + 100€ extra
  const projMinOnly   = projectPayoff(current, debt.interest_rate, debt.min_payment, 0)
  const projWith100   = projectPayoff(current, debt.interest_rate, debt.min_payment, 100)

  async function submitAttack(e: React.FormEvent) {
    e.preventDefault()
    if (!debt) return
    const n = parseAmountLocale(amount)
    if (!Number.isFinite(n) || n <= 0) {
      toast('Valor inválido', 'error')
      return
    }
    try {
      const res = await attackMutation.mutateAsync({
        debtId: debt.id,
        amount: n,
        note:   note.trim() || undefined,
      })
      setAmount('')
      setNote('')
      if (res.killed) {
        setShowKillModal({ xp: res.xp_earned })
      } else {
        toast(`+${res.xp_earned} XP — saldo ${formatCurrency(res.new_balance)}`, 'xp', res.xp_earned)
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao registar', 'error')
    }
  }

  async function manualKill() {
    if (!debt) return
    if (!confirm('Marcar esta dívida como totalmente paga?')) return
    await updateDebt({ id: debt.id, status: 'killed' })
    toast('Dívida marcada como abatida', 'success')
  }

  async function reactivate() {
    if (!debt) return
    await updateDebt({ id: debt.id, status: 'active', current_amount: initial })
    toast('Dívida reactivada', 'info')
  }

  async function handleDelete() {
    if (!debt) return
    if (!confirm('Eliminar esta dívida e todo o histórico?')) return
    await deleteDebt(debt.id)
    router.push('/dividas')
  }

  const attacks = attacksQuery.data ?? []

  return (
    <div className="space-y-5 pb-20">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Link
          href="/dividas"
          className="text-white/40 hover:text-white p-1 -ml-1"
          aria-label="Voltar à lista"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl" aria-hidden>{cat.icon}</span>
            <h1 className="text-xl font-black text-white truncate">{debt.name}</h1>
            {isKilled && (
              <span className="text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/40 px-2 py-0.5 rounded-full uppercase">
                Abatida
              </span>
            )}
          </div>
          <p className="text-xs text-white/50">{cat.label}</p>
        </div>
      </div>

      {/* Hero — saldo grande + progresso */}
      <div className={`border rounded-3xl p-6 ${
        isKilled
          ? 'bg-gradient-to-br from-green-500/10 to-transparent border-green-500/30'
          : 'bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border-red-500/25'
      }`}>
        <div className="flex items-baseline gap-2 mb-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Saldo actual</p>
          {debt.interest_rate > 0 && (
            <span className="ml-auto text-[10px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
              {debt.interest_rate.toFixed(2)}% TAEG
            </span>
          )}
        </div>
        <div className="flex items-end gap-2 mb-4">
          <p className={`text-4xl sm:text-5xl font-black ${isKilled ? 'text-green-300' : 'text-white'}`}>
            {formatCurrency(current)}
          </p>
          <p className="text-sm text-white/40 mb-2">
            de {formatCurrency(initial)}
          </p>
        </div>
        <div className="h-3 bg-black/30 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all ${
              isKilled
                ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                : 'bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400'
            }`}
            style={{ width: `${pctPaid}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/50">{pctPaid.toFixed(1)}% abatido</span>
          <span className="text-white/50">{formatCurrency(paidOff)} pago</span>
        </div>
      </div>

      {/* Projecções */}
      {!isKilled && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Só com o mínimo
            </p>
            {projMinOnly ? (
              <>
                <p className="text-lg font-black text-white">{formatMonths(projMinOnly.months)}</p>
                <p className="text-[11px] text-orange-300 mt-0.5">
                  +{formatCurrency(projMinOnly.totalInterest)} juros
                </p>
              </>
            ) : (
              <p className="text-xs text-red-300 leading-snug flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                Mínimo não cobre juros — dívida infinita
              </p>
            )}
          </div>
          <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/25 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-green-300 mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Com +€100/mês
            </p>
            {projWith100 ? (
              <>
                <p className="text-lg font-black text-white">{formatMonths(projWith100.months)}</p>
                <p className="text-[11px] text-green-300 mt-0.5">
                  +{formatCurrency(projWith100.totalInterest)} juros
                </p>
              </>
            ) : (
              <p className="text-xs text-white/50">Aumenta o extra</p>
            )}
          </div>
        </div>
      )}

      {/* Form de ataque */}
      {!isKilled && (
        <form
          onSubmit={submitAttack}
          className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <Sword className="w-4 h-4 text-red-400" />
            <h2 className="text-base font-bold text-white">Atacar dívida</h2>
          </div>
          <p className="text-xs text-white/50">
            Regista um pagamento extra. Ganhas XP por cada €2 pagos, bonus de 20% se acima do mínimo.
          </p>

          <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-lg px-3 py-3 focus-within:border-red-500/50">
            <span className="text-white/40 text-lg">€</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9.,]*"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="100,00"
              required
              className="flex-1 bg-transparent text-white text-xl font-bold placeholder-white/25 outline-none"
            />
            {amount && parseAmountLocale(amount) > 0 && (
              <span className="text-xs font-bold text-yellow-300 bg-yellow-500/15 border border-yellow-500/30 px-2 py-1 rounded-full whitespace-nowrap">
                +{xpForAttack(parseAmountLocale(amount), Number(debt.min_payment))} XP
              </span>
            )}
          </div>

          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={200}
            placeholder="Nota (opcional) — Ex: salário, 13º mês…"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-red-500/50"
          />

          <button
            type="submit"
            disabled={attackMutation.isPending || !amount}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors min-h-[44px]"
          >
            {attackMutation.isPending
              ? <Spinner size="sm" />
              : <><Sword className="w-4 h-4" /> Atacar</>}
          </button>
        </form>
      )}

      {/* Acções secundárias */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        {!isKilled ? (
          <button
            type="button"
            onClick={manualKill}
            className="inline-flex items-center gap-1.5 text-green-300 hover:text-green-200 bg-green-500/5 border border-green-500/20 px-3 py-2 rounded-lg font-semibold"
          >
            <Check className="w-3.5 h-3.5" />
            Marcar como paga
          </button>
        ) : (
          <button
            type="button"
            onClick={reactivate}
            className="inline-flex items-center gap-1.5 text-orange-300 hover:text-orange-200 bg-orange-500/5 border border-orange-500/20 px-3 py-2 rounded-lg font-semibold"
          >
            <Flame className="w-3.5 h-3.5" />
            Reactivar
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 text-white/50 hover:text-red-300 bg-white/3 border border-white/10 px-3 py-2 rounded-lg font-semibold ml-auto"
        >
          <TrendingDown className="w-3.5 h-3.5" />
          Eliminar
        </button>
      </div>

      {/* Histórico de ataques */}
      {attacks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-2">Histórico de pagamentos</h2>
          <div className="space-y-1.5">
            {attacks.map(a => (
              <div
                key={a.id}
                className="flex items-center gap-3 bg-white/3 border border-white/8 rounded-xl px-4 py-2.5 text-sm"
              >
                <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{formatCurrency(Number(a.amount))}</p>
                  {a.note && <p className="text-[11px] text-white/50 truncate">{a.note}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] text-yellow-300 font-bold">+{a.xp_earned} XP</p>
                  <p className="text-[10px] text-white/40">
                    {new Date(a.created_at).toLocaleDateString('pt-PT')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de celebração de kill */}
      {showKillModal && (
        <KillCelebration
          debtName={debt.name}
          xp={showKillModal.xp}
          onClose={() => setShowKillModal(null)}
        />
      )}
    </div>
  )
}

// ── Modal de celebração quando a dívida é abatida ────────────────────

function KillCelebration({
  debtName, xp, onClose,
}: { debtName: string; xp: number; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="kill-title"
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-transparent border border-green-400/40 rounded-3xl p-8 text-center animate-fade-in-up"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-white/50 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="text-6xl mb-3">🎯</div>
        <h2 id="kill-title" className="text-2xl font-black text-white mb-2">
          Dívida abatida!
        </h2>
        <p className="text-white/70 mb-4 break-words">
          <strong className="text-green-300">{debtName}</strong> está completamente paga.
        </p>
        <div className="inline-flex items-center gap-2 bg-yellow-500/15 border border-yellow-500/40 rounded-2xl px-5 py-2.5">
          <Zap className="w-5 h-5 text-yellow-400" />
          <span className="text-yellow-300 font-black text-lg">+{xp} XP</span>
        </div>
        <p className="text-[11px] text-white/40 mt-4">
          Uma a menos. Vai lá tratar da próxima.
        </p>
      </div>
    </div>
  )
}
