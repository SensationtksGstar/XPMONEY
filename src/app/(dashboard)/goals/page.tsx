'use client'

import { useState, useMemo } from 'react'
import {
  PlusCircle, Target, TrendingUp, Trash2, X,
  Check, ChevronDown, ChevronUp, PiggyBank,
  ArrowDownCircle, ArrowUpCircle, Calendar,
  Flame, Clock,
} from 'lucide-react'
import { useGoals, useGoalDeposits, useAddDeposit } from '@/hooks/useGoals'
import dynamic                from 'next/dynamic'
import { useToast }            from '@/components/ui/toaster'
import { EmptyState }          from '@/components/ui/EmptyState'
import { ConfirmDialog }       from '@/components/ui/ConfirmDialog'
import { Spinner }             from '@/components/ui/Spinner'

const AdBanner = dynamic(
  () => import('@/components/ads/AdBanner').then(m => ({ default: m.AdBanner })),
  { ssr: false },
)

// Recharts is ~100 KB gz — load it only when a goal actually has enough
// deposits to render the chart. Skeleton keeps layout stable while chunk loads.
const GoalChart = dynamic(
  () => import('@/components/goals/GoalChart'),
  {
    ssr: false,
    loading: () => <div className="h-28 bg-white/3 rounded-xl animate-pulse" />,
  },
)
import { CelebrationModal }    from '@/components/ui/CelebrationModal'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { Goal, GoalDeposit } from '@/types'

const GOAL_ICONS = ['🏠', '🚗', '✈️', '📱', '💻', '🎓', '💍', '🏖️', '💰', '🎯', '🛡️', '🏋️', '🏦', '🎸', '🐕', '👶']

// ── helpers ─────────────────────────────────────────────────────────────────

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: '2-digit' })
}

// Build cumulative chart data from deposits
function buildChartData(deposits: GoalDeposit[], targetAmount: number) {
  if (!deposits.length) return []
  let cumulative = 0
  return deposits
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => {
      cumulative = Math.max(0, cumulative + Number(d.amount))
      return {
        date:  fmtDate(d.date),
        value: cumulative,
        goal:  targetAmount,
      }
    })
}

// ── GoalHistoryChart ─────────────────────────────────────────────────────────

function GoalHistoryPanel({ goal }: { goal: Goal }) {
  const { data: deposits = [], isLoading } = useGoalDeposits(goal.id)
  const chartData = useMemo(() => buildChartData(deposits, goal.target_amount), [deposits, goal.target_amount])

  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-6 bg-white/5 rounded-lg animate-pulse" />)}
      </div>
    )
  }

  if (!deposits.length) {
    return (
      <div className="mt-4 pt-4 border-t border-white/10 text-center py-4">
        <PiggyBank className="w-8 h-8 text-white/20 mx-auto mb-2" />
        <p className="text-white/40 text-sm">Ainda sem depósitos.<br />Faz o primeiro agora!</p>
      </div>
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
      {/* Evolution chart */}
      {chartData.length > 1 && (
        <div>
          <p className="text-xs text-white/40 font-medium mb-2">Evolução da poupança</p>
          <GoalChart data={chartData} gradId={`grad-${goal.id}`} />
        </div>
      )}

      {/* Deposit list */}
      <div>
        <p className="text-xs text-white/40 font-medium mb-2">Histórico de movimentos</p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {deposits
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(dep => (
              <div key={dep.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/5">
                <div className="flex items-center gap-2">
                  {Number(dep.amount) >= 0
                    ? <ArrowDownCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    : <ArrowUpCircle  className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  }
                  <div>
                    <span className="text-xs text-white/70">{dep.note || 'Depósito'}</span>
                    <span className="text-[10px] text-white/30 ml-2">{fmtDate(dep.date)}</span>
                  </div>
                </div>
                <span className={`text-xs font-bold tabular-nums ${Number(dep.amount) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(dep.amount) >= 0 ? '+' : ''}{formatCurrency(Number(dep.amount))}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ── GoalCard ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal:         Goal
  onDeposit:    (goal: Goal) => void
  onDelete:     (goal: Goal) => void
  deletingId:   string | null
}

function GoalCard({ goal, onDeposit, onDelete, deletingId }: GoalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const progress   = goal.target_amount > 0
    ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
    : 0
  const isComplete = progress >= 100
  const days       = daysUntil(goal.deadline)
  const isUrgent   = days !== null && days <= 30 && days > 0
  const isOverdue  = days !== null && days < 0

  return (
    <div
      className={`bg-white/5 border rounded-2xl p-5 transition-all animate-fade-in-up ${
        isComplete ? 'border-green-500/40 shadow-lg shadow-green-500/10'
        : isUrgent ? 'border-orange-500/30'
        : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="text-3xl flex-shrink-0">{goal.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate">{goal.name}</h3>
            {isComplete && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded-full">
                <Check className="w-2.5 h-2.5" /> Concluído
              </span>
            )}
            {isUrgent && !isComplete && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-400 bg-orange-500/15 px-1.5 py-0.5 rounded-full">
                <Flame className="w-2.5 h-2.5" /> {days}d restantes
              </span>
            )}
            {isOverdue && !isComplete && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-full">
                <Clock className="w-2.5 h-2.5" /> Prazo expirou
              </span>
            )}
          </div>
          {goal.deadline && (
            <p className="text-xs text-white/35 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3" />
              {new Date(goal.deadline).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* Amounts */}
        <div className="text-right flex-shrink-0">
          <div className="text-green-400 font-bold tabular-nums text-base">{formatCurrency(goal.current_amount)}</div>
          <div className="text-white/35 text-xs">de {formatCurrency(goal.target_amount)}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 relative h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${
            isComplete ? 'bg-gradient-to-r from-green-500 to-emerald-400'
            : isUrgent ? 'bg-gradient-to-r from-orange-500 to-yellow-400'
            : 'bg-gradient-to-r from-green-600 to-green-400'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-white/40">
          <TrendingUp className="w-3 h-3 inline mr-1" />
          {formatPercent(progress)} concluído
        </span>
        {!isComplete && (
          <span className="text-xs text-white/40">
            Falta {formatCurrency(goal.target_amount - goal.current_amount)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4">
        {!isComplete && (
          <button
            onClick={() => onDeposit(goal)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-400 active:scale-95 text-black font-bold py-2 rounded-xl text-sm transition-all"
          >
            <ArrowDownCircle className="w-4 h-4" />
            Depositar
          </button>
        )}
        <button
          onClick={() => setExpanded(p => !p)}
          className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
        >
          Histórico
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onDelete(goal)}
          disabled={deletingId === goal.id}
          aria-label={`Eliminar poupança ${goal.name}`}
          className="w-11 h-11 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors rounded-xl hover:bg-red-500/10 disabled:opacity-50"
        >
          {deletingId === goal.id
            ? <Spinner size="xs" tone="light" />
            : <Trash2 className="w-3.5 h-3.5" />
          }
        </button>
      </div>

      {/* Expandable history */}
      {expanded && (
        <div className="overflow-hidden animate-fade-in-up">
          <GoalHistoryPanel goal={goal} />
        </div>
      )}
    </div>
  )
}

// ── Bottom sheet modal ───────────────────────────────────────────────────────

function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center sm:justify-center sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#0d1424] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden animate-slide-up sm:animate-fade-in-up"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { goals, loading, createGoal, isCreating, deleteGoal } = useGoals()
  const { mutateAsync: addDeposit, isPending: isDepositing }   = useAddDeposit()
  const { toast } = useToast()

  // UI state
  const [showForm, setShowForm]             = useState(false)
  const [deletingId, setDeletingId]         = useState<string | null>(null)
  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState<Goal | null>(null)
  const [depositGoal, setDepositGoal]       = useState<Goal | null>(null)
  const [celebration, setCelebration]       = useState<{ icon: string; title: string; subtitle: string; xp?: number } | null>(null)

  // Create goal form
  const [name,         setName]         = useState('')
  const [icon,         setIcon]         = useState('🎯')
  const [targetAmount, setTargetAmount] = useState('')
  const [deadline,     setDeadline]     = useState('')

  // Deposit form
  const [depAmount,    setDepAmount]    = useState('')
  const [depNote,      setDepNote]      = useState('')
  const [depDate,      setDepDate]      = useState(new Date().toISOString().split('T')[0])
  const [isWithdraw,   setIsWithdraw]   = useState(false)

  function resetCreateForm() { setName(''); setIcon('🎯'); setTargetAmount(''); setDeadline('') }
  function resetDepositForm() { setDepAmount(''); setDepNote(''); setDepDate(new Date().toISOString().split('T')[0]); setIsWithdraw(false) }

  // Stats
  const totalSaved   = goals.reduce((s, g) => s + Number(g.current_amount), 0)
  const activeGoals  = goals.filter(g => g.status === 'active').length
  const closestGoal  = goals
    .filter(g => g.status === 'active' && g.deadline)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))[0] ?? null
  const closestDays  = daysUntil(closestGoal?.deadline ?? null)

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !targetAmount) return
    try {
      const res = await createGoal({ name, icon, target_amount: parseFloat(targetAmount), deadline: deadline || null })
      const xp  = res?.xp_gained ?? 0
      toast(xp > 0 ? `Poupança criada! +${xp} XP 🎯` : 'Poupança criada! 🎯', 'success')
      setShowForm(false)
      resetCreateForm()
    } catch {
      toast('Erro ao criar poupança', 'error')
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteGoal(id)
      toast('Poupança eliminada', 'success')
      setConfirmDeleteGoal(null)
    } catch {
      toast('Erro ao eliminar', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault()
    if (!depositGoal || !depAmount) return
    const amount = parseFloat(depAmount) * (isWithdraw ? -1 : 1)
    try {
      const res = await addDeposit({ goalId: depositGoal.id, amount, note: depNote, date: depDate })
      setDepositGoal(null)
      resetDepositForm()
      if (res.isCompleted) {
        setCelebration({
          icon:     depositGoal.icon,
          title:    'Objetivo alcançado! 🎉',
          subtitle: `Parabéns! Atingiste a tua meta: ${depositGoal.name}`,
          xp:       res.xp_earned,
        })
      } else {
        toast(`${isWithdraw ? 'Levantamento' : 'Depósito'} registado! ${res.xp_earned ? `+${res.xp_earned} XP` : ''}`, 'success')
      }
    } catch {
      toast('Erro ao registar depósito', 'error')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in-up pb-24">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-green-400" />
            Poupanças
          </h1>
          <p className="text-white/50 text-sm mt-0.5">Regista depósitos e acompanha a evolução</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Nova poupança</span>
          <span className="sm:hidden">Nova</span>
        </button>
      </div>

      {/* Stats row */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-green-400 font-bold text-lg tabular-nums">{formatCurrency(totalSaved)}</div>
            <div className="text-white/40 text-xs mt-0.5">Total poupado</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-white font-bold text-lg">{activeGoals}</div>
            <div className="text-white/40 text-xs mt-0.5">Em curso</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            {closestGoal && closestDays !== null ? (
              <>
                <div className={`font-bold text-lg ${closestDays <= 30 ? 'text-orange-400' : 'text-white'}`}>
                  {closestDays > 0 ? `${closestDays}d` : 'Expirou'}
                </div>
                <div className="text-white/40 text-xs mt-0.5 truncate">{closestGoal.name}</div>
              </>
            ) : (
              <>
                <div className="text-white/40 font-bold text-lg">—</div>
                <div className="text-white/40 text-xs mt-0.5">Sem prazo</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Ad between stats and list */}
      <AdBanner variant="feed" />

      {/* Goal list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-36 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon="🐷"
          title="Começa a poupar hoje"
          description="Cria a tua primeira poupança, define uma meta e acompanha cada depósito no caminho para o objetivo."
          action={{
            label: 'Criar primeira poupança',
            onClick: () => setShowForm(true),
          }}
        />
      ) : (
        <div className="space-y-4">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onDeposit={g => { setDepositGoal(g); resetDepositForm() }}
              onDelete={() => setConfirmDeleteGoal(goal)}
              deletingId={deletingId}
            />
          ))}
        </div>
      )}

      {/* ── Modal: criar poupança ── */}
      {showForm && (
        <BottomSheet onClose={() => { setShowForm(false); resetCreateForm() }}>
          <div className="px-5 pt-4 pb-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Nova Poupança</h2>
              <button onClick={() => { setShowForm(false); resetCreateForm() }} className="p-2 text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Ícone</label>
                <div className="grid grid-cols-8 gap-1.5 mt-2">
                  {GOAL_ICONS.map(e => (
                    <button key={e} type="button" onClick={() => setIcon(e)}
                      className={`h-9 rounded-xl text-lg transition-all ${
                        icon === e ? 'bg-green-500/20 border border-green-500/50 scale-110' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >{e}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Nome</label>
                <input type="text" placeholder="Ex: Fundo de emergência" value={name} onChange={e => setName(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Valor Alvo (€)</label>
                <input type="number" inputMode="decimal" placeholder="0.00" value={targetAmount} onChange={e => setTargetAmount(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Prazo (opcional)</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/70 outline-none focus:border-green-500/50 text-sm" />
              </div>
              <button type="submit" disabled={isCreating || !name || !targetAmount}
                className="w-full py-3.5 min-h-[44px] bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2">
                {isCreating && <Spinner size="sm" tone="dark" />}
                {isCreating ? 'A criar...' : `Criar poupança ${icon}`}
              </button>
            </form>
          </div>
        </BottomSheet>
      )}

      {/* ── Modal: depositar / levantar ── */}
      {depositGoal && (
        <BottomSheet onClose={() => { setDepositGoal(null); resetDepositForm() }}>
          <div className="px-5 pt-4 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{depositGoal.icon}</span>
                <div>
                  <h2 className="text-base font-bold text-white">{depositGoal.name}</h2>
                  <p className="text-xs text-white/40">
                    {formatCurrency(depositGoal.current_amount)} / {formatCurrency(depositGoal.target_amount)}
                  </p>
                </div>
              </div>
              <button onClick={() => { setDepositGoal(null); resetDepositForm() }} className="p-2 text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toggle deposit / withdraw */}
            <div className="flex rounded-xl bg-white/5 p-1 mb-4">
              <button
                type="button"
                onClick={() => setIsWithdraw(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  !isWithdraw ? 'bg-green-500 text-black shadow' : 'text-white/50 hover:text-white'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" /> Depositar
              </button>
              <button
                type="button"
                onClick={() => setIsWithdraw(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isWithdraw ? 'bg-red-500 text-white shadow' : 'text-white/50 hover:text-white'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" /> Levantar
              </button>
            </div>

            <form onSubmit={handleDeposit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Valor (€)</label>
                <input
                  type="number" inputMode="decimal" step="0.01" min="0.01"
                  placeholder="0.00" value={depAmount} onChange={e => setDepAmount(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Nota (opcional)</label>
                <input
                  type="text" placeholder="Ex: Salário de janeiro" value={depNote} onChange={e => setDepNote(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Data</label>
                <input
                  type="date" value={depDate} onChange={e => setDepDate(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/70 outline-none focus:border-green-500/50 text-sm"
                />
              </div>
              <button
                type="submit" disabled={isDepositing || !depAmount}
                className={`w-full py-3.5 min-h-[44px] font-bold rounded-xl transition-all active:scale-[0.98] text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  isWithdraw
                    ? 'bg-red-500 hover:bg-red-400 text-white'
                    : 'bg-green-500 hover:bg-green-400 text-black'
                }`}
              >
                {isDepositing && <Spinner size="sm" tone={isWithdraw ? 'light' : 'dark'} />}
                {isDepositing
                  ? 'A registar...'
                  : isWithdraw
                    ? `Registar levantamento`
                    : `Depositar ${depAmount ? formatCurrency(parseFloat(depAmount) || 0) : ''}`
                }
              </button>
            </form>
          </div>
        </BottomSheet>
      )}

      {/* Celebration */}
      {celebration && (
        <CelebrationModal
          open
          onClose={() => setCelebration(null)}
          icon={celebration.icon}
          title={celebration.title}
          subtitle={celebration.subtitle}
          xp={celebration.xp}
        />
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={!!confirmDeleteGoal}
        title="Eliminar poupança?"
        description={
          confirmDeleteGoal
            ? `Vais apagar "${confirmDeleteGoal.name}" e todos os seus depósitos. Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Eliminar poupança"
        tone="danger"
        loading={!!deletingId}
        onConfirm={() => confirmDeleteGoal && handleDelete(confirmDeleteGoal.id)}
        onClose={() => setConfirmDeleteGoal(null)}
      />
    </div>
  )
}
