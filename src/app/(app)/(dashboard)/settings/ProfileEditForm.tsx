'use client'

import { useState } from 'react'
import { User, Target, TrendingUp, Save, Check, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

const CHALLENGES: { id: string; labelKey: TranslationKey; icon: string }[] = [
  { id: 'overspend',   labelKey: 'settings.challenge.overspend',   icon: '💸' },
  { id: 'no_tracking', labelKey: 'settings.challenge.no_tracking', icon: '📊' },
  { id: 'no_savings',  labelKey: 'settings.challenge.no_savings',  icon: '🏦' },
  { id: 'debts',       labelKey: 'settings.challenge.debts',       icon: '⛓️' },
  { id: 'planning',    labelKey: 'settings.challenge.planning',    icon: '🗺️' },
]

const GOALS: { id: string; labelKey: TranslationKey; icon: string }[] = [
  { id: 'emergency', labelKey: 'settings.goal.emergency', icon: '🛡️' },
  { id: 'travel',    labelKey: 'settings.goal.travel',    icon: '✈️' },
  { id: 'house',     labelKey: 'settings.goal.house',     icon: '🏠' },
  { id: 'car',       labelKey: 'settings.goal.car',       icon: '🚗' },
  { id: 'invest',    labelKey: 'settings.goal.invest',    icon: '📈' },
  { id: 'debt',      labelKey: 'settings.goal.debt',      icon: '🔓' },
  { id: 'other',     labelKey: 'settings.goal.other',     icon: '🎯' },
]

const CURRENCIES: { code: string; labelKey: TranslationKey }[] = [
  { code: 'EUR', labelKey: 'settings.currency.eur' },
  { code: 'USD', labelKey: 'settings.currency.usd' },
  { code: 'GBP', labelKey: 'settings.currency.gbp' },
  { code: 'BRL', labelKey: 'settings.currency.brl' },
]

interface Props {
  initialName:      string
  initialChallenge: string
  initialGoal:      string
  initialCurrency:  string
  email:            string
  avatarUrl:        string | null
}

export function ProfileEditForm({
  initialName, initialChallenge, initialGoal, initialCurrency, email, avatarUrl,
}: Props) {
  const router = useRouter()
  const t      = useT()
  const [name,      setName]      = useState(initialName)
  const [challenge, setChallenge] = useState(initialChallenge)
  const [goal,      setGoal]      = useState(initialGoal)
  const [currency,  setCurrency]  = useState(initialCurrency || 'EUR')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const isDirty =
    name !== initialName ||
    challenge !== initialChallenge ||
    goal !== initialGoal ||
    currency !== initialCurrency

  async function handleSave() {
    if (!isDirty) return
    setSaving(true)
    setError(null)
    try {
      // Only send fields the user actually set — empty `name` would fail
      // the server's min(1) validation and block saving goals/challenge.
      const payload: Record<string, string> = {}
      if (name.trim())  payload.name      = name.trim()
      if (challenge)    payload.challenge = challenge
      if (goal)         payload.goal      = goal
      if (currency)     payload.currency  = currency

      const res = await fetch('/api/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({ error: `Erro ${res.status}` }))
      if (!res.ok) {
        // Server may return a plain string or (legacy) an object — coerce safely
        const msg = typeof json.error === 'string'
          ? json.error
          : typeof json.error === 'object' && json.error
            ? JSON.stringify(json.error)
            : t('settings.save_err_default')
        throw new Error(msg)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.save_err_default'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Dados pessoais ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-green-400" />
          {t('settings.personal')}
        </h2>

        {/* Avatar + Email (read-only) */}
        <div className="flex items-center gap-4 mb-5 p-4 bg-white/3 rounded-xl border border-white/8">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <span className="text-2xl">👤</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{name || t('settings.user_fallback')}</p>
            <p className="text-white/40 text-sm truncate">{email}</p>
            <p className="text-white/25 text-xs mt-0.5">{t('settings.avatar_managed')}</p>
          </div>
        </div>

        {/* Nome editável */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
            {t('settings.display_name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('settings.display_name_placeholder')}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 outline-none focus:border-green-500/50 transition-colors text-sm"
          />
        </div>

        {/* Moeda */}
        <div className="space-y-1.5 mt-4">
          <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
            {t('settings.currency')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CURRENCIES.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCurrency(c.code)}
                className={cn(
                  'py-2.5 px-3 rounded-xl border text-sm font-medium transition-all',
                  currency === c.code
                    ? 'bg-green-500/15 border-green-500/40 text-green-400'
                    : 'bg-white/4 border-white/10 text-white/60 hover:border-white/20 hover:text-white',
                )}
              >
                {t(c.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Desafio financeiro ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-400" />
          {t('settings.challenge')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CHALLENGES.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChallenge(c.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left',
                challenge === c.id
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                  : 'bg-white/4 border-white/10 text-white/60 hover:border-white/20 hover:text-white',
              )}
            >
              <span className="text-xl flex-shrink-0">{c.icon}</span>
              <span className="text-sm font-medium">{t(c.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Objetivo principal ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          {t('settings.goal')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {GOALS.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGoal(g.id)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                goal === g.id
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  : 'bg-white/4 border-white/10 text-white/60 hover:border-white/20 hover:text-white',
              )}
            >
              <span className="text-2xl">{g.icon}</span>
              <span className="text-xs font-medium text-center leading-tight">{t(g.labelKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Erro ── */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ── Guardar ── */}
      <button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className={cn(
          'w-full flex items-center justify-center gap-2 font-bold py-4 rounded-xl transition-all text-sm',
          saved
            ? 'bg-green-500/20 border border-green-500/40 text-green-400'
            : isDirty
              ? 'bg-green-500 hover:bg-green-400 text-black active:scale-95'
              : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed',
        )}
      >
        {saved ? (
          <>
            <Check className="w-4 h-4" />
            {t('settings.saved')}
          </>
        ) : saving ? (
          t('settings.save_in_progress')
        ) : (
          <>
            <Save className="w-4 h-4" />
            {isDirty ? t('settings.save_cta') : t('settings.no_changes')}
          </>
        )}
      </button>
    </div>
  )
}
