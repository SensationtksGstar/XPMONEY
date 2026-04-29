'use client'

import { useState, useMemo } from 'react'
import Link                  from 'next/link'
import {
  PlusCircle, Target, TrendingUp, Trash2, X,
  Check, ChevronDown, ChevronUp, PiggyBank,
  ArrowDownCircle, ArrowUpCircle, Calendar,
  Flame, Clock, Crown, Lock,
} from 'lucide-react'
import { useGoals, useGoalDeposits, useAddDeposit, CreateGoalError } from '@/hooks/useGoals'
import { useUserPlan }        from '@/lib/contexts/UserPlanContext'
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
import { useT }                 from '@/lib/i18n/LocaleProvider'
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
  const t = useT()
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
        <p className="text-white/40 text-sm">{t('goals.no_deposits')}<br />{t('goals.make_first')}</p>
      </div>
    )
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
      {/* Evolution chart */}
      {chartData.length > 1 && (
        <div>
          <p className="text-xs text-white/40 font-medium mb-2">{t('goals.chart_title')}</p>
          <GoalChart data={chartData} gradId={`grad-${goal.id}`} />
        </div>
      )}

      {/* Deposit list */}
      <div>
        <p className="text-xs text-white/40 font-medium mb-2">{t('goals.history_title')}</p>
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
                    <span className="text-xs text-white/70">{dep.note || t('goals.deposit_fallback')}</span>
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
  const t = useT()
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
                <Check className="w-2.5 h-2.5" /> {t('goals.completed_chip')}
              </span>
            )}
            {isUrgent && !isComplete && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-400 bg-orange-500/15 px-1.5 py-0.5 rounded-full">
                <Flame className="w-2.5 h-2.5" /> {t('goals.days_left', { days })}
              </span>
            )}
            {isOverdue && !isComplete && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-full">
                <Clock className="w-2.5 h-2.5" /> {t('goals.deadline_expired')}
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
          <div className="text-white/35 text-xs">{t('goals.of', { amount: formatCurrency(goal.target_amount) })}</div>
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
          {t('goals.pct_completed', { pct: formatPercent(progress) })}
        </span>
        {!isComplete && (
          <span className="text-xs text-white/40">
            {t('goals.missing', { amount: formatCurrency(goal.target_amount - goal.current_amount) })}
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
            {t('goals.deposit')}
          </button>
        )}
        <button
          onClick={() => setExpanded(p => !p)}
          className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
        >
          {t('goals.history')}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onDelete(goal)}
          disabled={deletingId === goal.id}
          aria-label={t('goals.delete_aria', { name: goal.name })}
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

// Free plan goal limit. Mirrors FREE_GOAL_LIMIT in /api/goals/route.ts —
// keep them in sync. The server is the authoritative gate; this constant
// just powers the UI counter and proactive button-state so free users
// don't open the create modal only to be rejected on submit.
const FREE_GOAL_LIMIT = 2

export default function GoalsPage() {
  const { goals, loading, createGoal, isCreating, deleteGoal } = useGoals()
  const { mutateAsync: addDeposit, isPending: isDepositing }   = useAddDeposit()
  const { isFree }    = useUserPlan()
  const { toast }     = useToast()
  const t = useT()

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
  // Free user is "at limit" when they have FREE_GOAL_LIMIT active goals
  // already. Completed goals don't count (finishing one frees a slot).
  const freeAtLimit  = isFree && activeGoals >= FREE_GOAL_LIMIT
  const closestGoal  = goals
    .filter(g => g.status === 'active' && g.deadline)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))[0] ?? null
  const closestDays  = daysUntil(closestGoal?.deadline ?? null)

  // Sorted list for rendering. Ordering rules:
  //   1. Active before completed (completed sink to the bottom — they're
  //      historic, not actionable)
  //   2. Within active: closest deadline first; goals without a deadline
  //      come AFTER goals with deadlines (less urgent)
  //   3. Tiebreaker: alphabetical by name (locale-aware) so the order is
  //      stable across renders even when deadlines are identical
  // Previously goals rendered in DB-insertion order which felt random
  // (a "Casa Própria" with a deadline could appear after a free-floating
  // "Objetivo Pessoal").
  const sortedGoals = [...goals].sort((a, b) => {
    const aActive = a.status === 'active' ? 0 : 1
    const bActive = b.status === 'active' ? 0 : 1
    if (aActive !== bActive) return aActive - bActive

    const aHasDl = a.deadline ? 0 : 1
    const bHasDl = b.deadline ? 0 : 1
    if (aHasDl !== bHasDl) return aHasDl - bHasDl

    if (a.deadline && b.deadline) {
      const cmp = a.deadline.localeCompare(b.deadline)
      if (cmp !== 0) return cmp
    }

    return (a.name ?? '').localeCompare(b.name ?? '', 'pt-PT', { sensitivity: 'base' })
  })

  async function handleCreateGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !targetAmount) return
    try {
      const res = await createGoal({ name, icon, target_amount: parseFloat(targetAmount), deadline: deadline || null })
      const xp  = res?.xp_gained ?? 0
      toast(xp > 0 ? t('goals.created_xp', { xp }) : t('goals.created'), 'success')
      setShowForm(false)
      resetCreateForm()
    } catch (err) {
      // Surface the server-provided message verbatim when it's a known
      // structured rejection (e.g. free_goal_limit). The server message
      // is already locale-aware, so we don't translate again client-side.
      if (err instanceof CreateGoalError && err.message) {
        toast(err.message, 'error')
        // For the limit case, also close the form — keeping it open
        // implies "fix and retry" but they can't retry without upgrading.
        if (err.code === 'free_goal_limit') setShowForm(false)
      } else {
        toast(t('goals.create_error'), 'error')
      }
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteGoal(id)
      toast(t('goals.deleted_toast'), 'success')
      setConfirmDeleteGoal(null)
    } catch {
      toast(t('goals.delete_error'), 'error')
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
          title:    t('goals.dep.achieved_title'),
          subtitle: t('goals.dep.achieved_sub', { name: depositGoal.name }),
          xp:       res.xp_earned,
        })
      } else {
        toast(
          t('goals.dep.registered', {
            action: isWithdraw ? t('goals.withdraw_label') : t('goals.deposit_label'),
            xp: res.xp_earned ? t('goals.dep.xp_inline', { xp: res.xp_earned }) : '',
          }),
          'success',
        )
      }
    } catch {
      toast(t('goals.dep.error'), 'error')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in-up pb-24">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-green-400" />
            {t('goals.title')}
          </h1>
          <p className="text-white/50 text-sm mt-0.5">{t('goals.subtitle')}</p>
        </div>
        {freeAtLimit ? (
          // Free user at the 2-goal limit — swap the "New" CTA for an
          // "Upgrade" CTA that goes straight to the billing page. Gives
          // honest feedback instead of letting the user click and fail.
          <Link
            href="/settings/billing"
            className="flex items-center gap-2 bg-purple-500 hover:bg-purple-400 text-white font-bold px-4 py-2.5 rounded-xl transition-all text-sm active:scale-95"
            aria-label={t('goals.limit.upgrade_aria')}
          >
            <Crown className="w-4 h-4" />
            <span className="hidden sm:inline">{t('goals.limit.upgrade_long')}</span>
            <span className="sm:hidden">{t('goals.limit.upgrade_short')}</span>
          </Link>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2.5 rounded-xl transition-all text-sm active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{t('goals.new_long')}</span>
            <span className="sm:hidden">{t('goals.new_short')}</span>
          </button>
        )}
      </div>

      {/* Free-plan limit indicator: small badge under the header so users
          see at a glance how close they are to the cap. Only renders for
          free users with at least 1 active goal — otherwise it's noise. */}
      {isFree && activeGoals > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border tabular-nums ${
            freeAtLimit
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
              : 'bg-white/5 border-white/10 text-white/60'
          }`}>
            {freeAtLimit && <Lock className="w-3 h-3" />}
            {t('goals.limit.counter', { used: activeGoals, max: FREE_GOAL_LIMIT })}
          </span>
          {!freeAtLimit && (
            <Link href="/settings/billing" className="text-white/40 hover:text-white/70 underline underline-offset-2">
              {t('goals.limit.upgrade_link')}
            </Link>
          )}
        </div>
      )}

      {/* Stats row */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-green-400 font-bold text-lg tabular-nums">{formatCurrency(totalSaved)}</div>
            <div className="text-white/40 text-xs mt-0.5">{t('goals.stat_total')}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-white font-bold text-lg">{activeGoals}</div>
            <div className="text-white/40 text-xs mt-0.5">{t('goals.stat_active')}</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            {closestGoal && closestDays !== null ? (
              <>
                <div className={`font-bold text-lg ${closestDays <= 30 ? 'text-orange-400' : 'text-white'}`}>
                  {closestDays > 0 ? `${closestDays}d` : t('goals.stat_expired')}
                </div>
                <div className="text-white/40 text-xs mt-0.5 truncate">{closestGoal.name}</div>
              </>
            ) : (
              <>
                <div className="text-white/40 font-bold text-lg">—</div>
                <div className="text-white/40 text-xs mt-0.5">{t('goals.stat_no_deadline')}</div>
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
          title={t('goals.empty_title')}
          description={t('goals.empty_desc')}
          action={{
            label: t('goals.empty_cta'),
            onClick: () => setShowForm(true),
          }}
        />
      ) : (
        <div className="space-y-4">
          {sortedGoals.map(goal => (
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
              <h2 className="text-lg font-bold text-white">{t('goals.new_title')}</h2>
              <button onClick={() => { setShowForm(false); resetCreateForm() }} className="p-2 text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t('goals.form.icon')}</label>
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
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t('goals.form.name')}</label>
                <input type="text" placeholder={t('goals.form.name_placeholder')} value={name} onChange={e => setName(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t('goals.form.target')}</label>
                <input type="number" inputMode="decimal" placeholder="0.00" value={targetAmount} onChange={e => setTargetAmount(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t('goals.form.deadline')}</label>
                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/70 outline-none focus:border-green-500/50 text-sm" />
              </div>
              <button type="submit" disabled={isCreating || !name || !targetAmount}
                className="w-full py-3.5 min-h-[44px] bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2">
                {isCreating && <Spinner size="sm" tone="dark" />}
                {isCreating ? t('goals.form.creating') : t('goals.form.create_with_icon', { icon })}
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
                <ArrowDownCircle className="w-4 h-4" /> {t('goals.deposit_label')}
              </button>
              <button
                type="button"
                onClick={() => setIsWithdraw(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isWithdraw ? 'bg-red-500 text-white shadow' : 'text-white/50 hover:text-white'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" /> {t('goals.withdraw_label')}
              </button>
            </div>

            <form onSubmit={handleDeposit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t('goals.dep.value')}</label>
                <input
                  type="number" inputMode="decimal" step="0.01" min="0.01"
                  placeholder="0.00" value={depAmount} onChange={e => setDepAmount(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t('goals.dep.note')}</label>
                <input
                  type="text" placeholder={t('goals.dep.note_placeholder')} value={depNote} onChange={e => setDepNote(e.target.value)}
                  className="mt-1.5 w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 outline-none focus:border-green-500/50 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t('goals.dep.date')}</label>
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
                  ? t('goals.dep.registering')
                  : isWithdraw
                    ? t('goals.dep.withdraw_cta')
                    : t('goals.dep.deposit_cta', { amount: depAmount ? formatCurrency(parseFloat(depAmount) || 0) : '' })
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
        title={t('goals.confirm_title')}
        description={
          confirmDeleteGoal
            ? t('goals.confirm_desc', { name: confirmDeleteGoal.name })
            : ''
        }
        confirmLabel={t('goals.confirm_delete')}
        tone="danger"
        loading={!!deletingId}
        onConfirm={() => confirmDeleteGoal && handleDelete(confirmDeleteGoal.id)}
        onClose={() => setConfirmDeleteGoal(null)}
      />
    </div>
  )
}
