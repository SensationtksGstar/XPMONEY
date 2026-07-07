'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Wallet, Plus, Trash2, X, Check, TrendingUp, TrendingDown } from 'lucide-react'
import { useAccounts, type NewAccount } from '@/hooks/useAccounts'
import {
  ACCOUNT_TYPE_META, ACCOUNT_TYPES, computeNetWorth, isLiability,
} from '@/lib/netWorth'
import type { Account, AccountType } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { parseAmountLocale } from '@/lib/safeNumber'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { useToast } from '@/components/ui/toaster'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'

// Dynamic import — NetWorthTrend pulls recharts (~90 KB gz); statically it
// lands in this route's First Load JS even for users whose trend renders
// null (project rule: recharts consumers are always dynamic()-imported).
const NetWorthTrend = dynamic(
  () => import('@/components/dashboard/NetWorthTrend').then(m => ({ default: m.NetWorthTrend })),
  { ssr: false, loading: () => <div className="h-48 bg-white/5 rounded-2xl animate-pulse" /> },
)

export default function ContasPage() {
  const { t, locale } = useLocale()
  const { toast } = useToast()
  const { accounts, loading, createAccount, updateAccount, deleteAccount, isMutating } = useAccounts()

  const [showAdd, setShowAdd]   = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const nw = computeNetWorth(accounts)
  const netPositive = nw.net >= 0

  async function handleDelete(id: string) {
    try {
      await deleteAccount(id)
      toast(t('networth.deleted'), 'success')
    } catch (e) {
      const msg = e instanceof Error && e.message === 'account_has_transactions'
        ? t('networth.delete_blocked')
        : t('networth.err_generic')
      toast(msg, 'error')
    } finally {
      setDeleteId(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner /></div>
  }

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-400" />
            {t('networth.title')}
          </h1>
          <p className="text-sm text-white/50">{t('networth.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          {t('networth.add')}
        </button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Wallet className="w-10 h-10 text-white/30" />}
          title={t('networth.empty_title')}
          description={t('networth.empty_desc')}
          action={{ label: t('networth.add'), onClick: () => setShowAdd(true) }}
        />
      ) : (
        <>
          {/* Net worth hero */}
          <div className={`border rounded-3xl p-6 ${
            netPositive
              ? 'bg-gradient-to-br from-emerald-500/12 via-green-500/5 to-transparent border-emerald-500/25'
              : 'bg-gradient-to-br from-rose-500/12 via-orange-500/5 to-transparent border-rose-500/25'
          }`}>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{t('networth.net_label')}</p>
            <p className={`text-4xl sm:text-5xl font-bold mt-1 tabular-nums ${netPositive ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatCurrency(nw.net, 'EUR', locale)}
            </p>
            <div className="flex items-center gap-5 mt-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-white/60">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                {t('networth.assets')}: <strong className="text-white/85 tabular-nums">{formatCurrency(nw.assets, 'EUR', locale)}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 text-white/60">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                {t('networth.liabilities')}: <strong className="text-white/85 tabular-nums">{formatCurrency(nw.liabilities, 'EUR', locale)}</strong>
              </span>
            </div>
          </div>

          {/* Trend — renders only once ≥2 snapshots exist (needs the
              net_worth_snapshots migration; degrades to nothing otherwise). */}
          <NetWorthTrend />

          {/* Accounts */}
          <div>
            <h2 className="text-base font-semibold text-white mb-3">{t('networth.accounts_heading')}</h2>
            <div className="space-y-2.5">
              {accounts.map(a => (
                <AccountCard
                  key={a.id}
                  account={a}
                  onSaveName={(name) => updateAccount({ id: a.id, patch: { name } }).then(() => {}).catch(() => toast(t('networth.err_generic'), 'error'))}
                  onSaveBalance={(balance) => updateAccount({ id: a.id, patch: { balance } })
                    .then(() => toast(t('networth.updated'), 'success'))
                    .catch(() => toast(t('networth.err_generic'), 'error'))}
                  onSaveType={(type) => updateAccount({ id: a.id, patch: { type } }).then(() => {}).catch(() => toast(t('networth.err_generic'), 'error'))}
                  onDelete={() => setDeleteId(a.id)}
                  typeLabel={(type) => t(ACCOUNT_TYPE_META[type].labelKey)}
                  balanceLabel={t('networth.balance')}
                />
              ))}
            </div>
            <p className="text-[11px] text-white/35 mt-3 leading-relaxed">{t('networth.hint')}</p>
          </div>
        </>
      )}

      {showAdd && (
        <AddAccountModal
          onClose={() => setShowAdd(false)}
          submitting={isMutating}
          onSubmit={async (input) => {
            try {
              await createAccount(input)
              toast(t('networth.created'), 'success')
              setShowAdd(false)
            } catch {
              toast(t('networth.err_generic'), 'error')
            }
          }}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          open
          title={t('networth.delete_title')}
          description={t('networth.delete_desc')}
          confirmLabel={t('dividas.del_confirm')}
          tone="danger"
          onClose={() => setDeleteId(null)}
          onConfirm={() => handleDelete(deleteId)}
        />
      )}
    </div>
  )
}

// ── Single account row — inline-editable name + balance + type ────────────
function AccountCard({
  account, onSaveName, onSaveBalance, onSaveType, onDelete, typeLabel, balanceLabel,
}: {
  account:       Account
  onSaveName:    (name: string) => void
  onSaveBalance: (balance: number) => void
  onSaveType:    (type: AccountType) => void
  onDelete:      () => void
  typeLabel:     (type: AccountType) => string
  balanceLabel:  string
}) {
  const meta = ACCOUNT_TYPE_META[account.type]
  const [name, setName]       = useState(account.name)
  const [balanceStr, setBalanceStr] = useState(String(account.balance ?? 0))

  const liability = isLiability(account.type)

  const commitName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== account.name) onSaveName(trimmed)
    else if (!trimmed) setName(account.name)
  }
  const commitBalance = () => {
    const parsed = parseAmountLocale(balanceStr)
    if (Number.isFinite(parsed) && parsed !== Number(account.balance)) onSaveBalance(parsed)
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-2xl flex-shrink-0">{meta.icon}</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={commitName}
          maxLength={60}
          aria-label="Nome da conta"
          className="flex-1 min-w-0 bg-transparent text-white font-semibold text-sm outline-none border-b border-transparent focus:border-white/20 transition-colors"
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label="Eliminar conta"
          className="text-white/40 hover:text-rose-400 transition-colors p-1.5 flex-shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <select
          value={account.type}
          onChange={e => onSaveType(e.target.value as AccountType)}
          aria-label="Tipo de conta"
          className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white/70 text-xs outline-none focus:border-emerald-500/50 appearance-none flex-shrink-0"
        >
          {ACCOUNT_TYPES.map(ty => (
            <option key={ty} value={ty} className="bg-[#1a1d27]">{typeLabel(ty)}</option>
          ))}
        </select>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-lg px-3 py-2 focus-within:border-emerald-500/50">
          <span className="text-white/40 text-sm">{liability ? '−€' : '€'}</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9.,]*"
            value={balanceStr}
            onChange={e => setBalanceStr(e.target.value)}
            onBlur={commitBalance}
            aria-label={balanceLabel}
            className={`w-24 bg-transparent font-bold text-right outline-none tabular-nums ${liability ? 'text-rose-300' : 'text-white'}`}
          />
        </div>
      </div>
    </div>
  )
}

// ── Add-account modal ─────────────────────────────────────────────────────
function AddAccountModal({
  onClose, onSubmit, submitting,
}: {
  onClose:    () => void
  onSubmit:   (input: NewAccount) => void
  submitting: boolean
}) {
  const { t } = useLocale()
  const [name, setName]       = useState('')
  const [type, setType]       = useState<AccountType>('checking')
  const [balanceStr, setBalanceStr] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit({
      name:    trimmed,
      type,
      balance: parseAmountLocale(balanceStr) || 0,
      icon:    ACCOUNT_TYPE_META[type].icon,
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md bg-[#0a1220] border border-white/10 rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{t('networth.new_title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('dividas.close')}
            className="text-white/40 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1.5">{t('dividas.name')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            maxLength={60}
            placeholder={t('networth.name_ph')}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1.5">{t('networth.type')}</label>
          <div className="grid grid-cols-3 gap-1.5">
            {ACCOUNT_TYPES.map(ty => (
              <button
                key={ty}
                type="button"
                onClick={() => setType(ty)}
                className={`p-2.5 rounded-lg border text-center transition-colors ${
                  type === ty ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <span className="block text-xl mb-0.5" aria-hidden>{ACCOUNT_TYPE_META[ty].icon}</span>
                <span className="block text-[11px] text-white/70 leading-tight">{t(ACCOUNT_TYPE_META[ty].labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/60 mb-1.5">{t('networth.balance')}</label>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 focus-within:border-emerald-500/50">
            <span className="text-white/40">€</span>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9.,]*"
              value={balanceStr}
              onChange={e => setBalanceStr(e.target.value)}
              placeholder="0,00"
              className="flex-1 bg-transparent text-white placeholder-white/30 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/70 bg-white/5 border border-white/10 hover:bg-white/10 min-h-[44px]">
            {t('budget.cancel')}
          </button>
          <button type="submit" disabled={submitting || !name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2">
            {submitting ? <Spinner size="sm" /> : <><Check className="w-4 h-4" /> {t('budget.save')}</>}
          </button>
        </div>
      </form>
    </div>
  )
}
