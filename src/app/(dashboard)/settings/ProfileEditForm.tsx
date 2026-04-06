'use client'

import { useState } from 'react'
import { User, Target, TrendingUp, Save, Check, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

const CHALLENGES = [
  { id: 'overspend',   label: 'Gasto em excesso',        icon: '💸' },
  { id: 'no_tracking', label: 'Falta de controlo',       icon: '📊' },
  { id: 'no_savings',  label: 'Dificuldade em poupar',   icon: '🏦' },
  { id: 'debts',       label: 'Gestão de dívidas',       icon: '⛓️' },
  { id: 'planning',    label: 'Planeamento financeiro',  icon: '🗺️' },
]

const GOALS = [
  { id: 'emergency', label: 'Fundo de emergência', icon: '🛡️' },
  { id: 'travel',    label: 'Viagem de sonho',     icon: '✈️' },
  { id: 'house',     label: 'Casa própria',         icon: '🏠' },
  { id: 'car',       label: 'Carro novo',           icon: '🚗' },
  { id: 'invest',    label: 'Investimentos',        icon: '📈' },
  { id: 'debt',      label: 'Pagar dívidas',        icon: '🔓' },
  { id: 'other',     label: 'Objetivo pessoal',     icon: '🎯' },
]

const CURRENCIES = [
  { code: 'EUR', label: '€ Euro' },
  { code: 'USD', label: '$ Dólar' },
  { code: 'GBP', label: '£ Libra' },
  { code: 'BRL', label: 'R$ Real' },
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
      const res = await fetch('/api/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, challenge, goal, currency }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao guardar')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar')
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
          Dados Pessoais
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
            <p className="text-white font-semibold truncate">{name || 'Utilizador'}</p>
            <p className="text-white/40 text-sm truncate">{email}</p>
            <p className="text-white/25 text-xs mt-0.5">Avatar e email geridos pelo Clerk</p>
          </div>
        </div>

        {/* Nome editável */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
            Nome de exibição
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="O teu nome"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 outline-none focus:border-green-500/50 transition-colors text-sm"
          />
        </div>

        {/* Moeda */}
        <div className="space-y-1.5 mt-4">
          <label className="text-xs text-white/50 font-medium uppercase tracking-wider">
            Moeda
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
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Desafio financeiro ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-400" />
          O meu maior desafio
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
              <span className="text-sm font-medium">{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Objetivo principal ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          O meu objetivo principal
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
              <span className="text-xs font-medium text-center leading-tight">{g.label}</span>
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
            Guardado!
          </>
        ) : saving ? (
          '⚡ A guardar...'
        ) : (
          <>
            <Save className="w-4 h-4" />
            {isDirty ? 'Guardar alterações' : 'Sem alterações'}
          </>
        )}
      </button>
    </div>
  )
}
