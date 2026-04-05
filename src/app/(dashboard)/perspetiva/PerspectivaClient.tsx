'use client'

import { useState } from 'react'
import { motion }   from 'framer-motion'
import { Clock, Coffee, Star, TrendingUp, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CategoryIcon } from '@/components/ui/CategoryIcon'

/* ─── Celebrity data (annual gross income in EUR, approximate) ───────── */
const CELEBRITIES = [
  { id: 'cr7',      name: 'Cristiano Ronaldo', role: 'Futebolista',       flag: '🇵🇹', emoji: '⚽', yearlyEUR: 200_000_000 },
  { id: 'messi',    name: 'Lionel Messi',      role: 'Futebolista',       flag: '🇦🇷', emoji: '⚽', yearlyEUR: 130_000_000 },
  { id: 'taylor',   name: 'Taylor Swift',      role: 'Cantora',           flag: '🇺🇸', emoji: '🎤', yearlyEUR: 180_000_000 },
  { id: 'lebron',   name: 'LeBron James',      role: 'Basquetebolista',   flag: '🇺🇸', emoji: '🏀', yearlyEUR: 120_000_000 },
  { id: 'beyonce',  name: 'Beyoncé',           role: 'Cantora',           flag: '🇺🇸', emoji: '👑', yearlyEUR: 100_000_000 },
  { id: 'travolta', name: 'John Travolta',     role: 'Ator',              flag: '🇺🇸', emoji: '🎬', yearlyEUR: 20_000_000 },
  { id: 'djokovic', name: 'Novak Djokovic',    role: 'Tenista',           flag: '🇷🇸', emoji: '🎾', yearlyEUR: 50_000_000 },
  { id: 'musk',     name: 'Elon Musk',         role: 'Empresário',        flag: '🇺🇸', emoji: '🚀', yearlyEUR: 5_000_000_000 },
]

/* ─── Fun equivalents (price in EUR) ─────────────────────────────────── */
const EQUIVALENTS = [
  { emoji: '☕', name: 'Café',              price: 0.80 },
  { emoji: '🍺', name: 'Cerveja',           price: 2.00 },
  { emoji: '🍕', name: 'Pizza',             price: 12.00 },
  { emoji: '🎬', name: 'Cinema',            price: 10.00 },
  { emoji: '📱', name: 'Netflix/mês',       price: 15.99 },
  { emoji: '👟', name: 'Nike Air Max',      price: 120.00 },
  { emoji: '✈️', name: 'Voo LX→Paris',     price: 150.00 },
  { emoji: '📱', name: 'iPhone 15',         price: 1000.00 },
]

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const fmt = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtDec = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

function humanDuration(minutes: number): string {
  if (minutes < 0.017) return `${Math.round(minutes * 3600)} segundos`
  if (minutes < 1)     return `${Math.round(minutes * 60)} segundos`
  if (minutes < 60)    return `${minutes.toFixed(1).replace('.0', '')} minutos`
  if (minutes < 1440)  return `${(minutes / 60).toFixed(1).replace('.0', '')} horas`
  if (minutes < 10080) return `${(minutes / 1440).toFixed(1).replace('.0', '')} dias`
  if (minutes < 43200) return `${(minutes / 10080).toFixed(1).replace('.0', '')} semanas`
  return `${(minutes / 43200).toFixed(1).replace('.0', '')} meses`
}

function minutesToEarnAmount(earnerYearly: number, amount: number): number {
  const perMinute = earnerYearly / (365 * 24 * 60)
  return amount / perMinute
}

/* ─── Types ───────────────────────────────────────────────────────────── */
interface Expense {
  id: string
  description: string
  amount: number
  date: string
  category?: { name: string; icon: string; color: string } | null
}

interface Props {
  monthlyIncome: number
  recentExpenses: Expense[]
}

/* ─── Component ───────────────────────────────────────────────────────── */
export default function PerspectivaClient({ monthlyIncome, recentExpenses }: Props) {
  const [selectedCel, setSelectedCel] = useState(CELEBRITIES[0])
  const [tab, setTab] = useState<'celebrities' | 'hourly' | 'equivalents'>('celebrities')

  // Derived values
  const hourlyRate    = monthlyIncome / (22 * 8)   // 22 working days × 8 h
  const minuteRate    = hourlyRate / 60
  const dailyRate     = monthlyIncome / 22
  const yearlyIncome  = monthlyIncome * 12

  // Celebrity per-minute rate
  const celPerMinute  = selectedCel.yearlyEUR / (365 * 24 * 60)
  const minsToEarnMyMonthly = monthlyIncome / celPerMinute

  return (
    <div className="space-y-6 pb-10 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-5 h-5 text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Perspetiva de Riqueza</h1>
          <span className="text-xs bg-purple-500/20 border border-purple-500/30 text-purple-400 px-2 py-0.5 rounded-full font-bold">PRO</span>
        </div>
        <p className="text-white/50 text-sm">Compara o teu dinheiro com o mundo real</p>
      </div>

      {/* Income summary */}
      {monthlyIncome === 0 ? (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-300">
          ⚠️ Não foi encontrado rendimento registado. Adiciona transações de receita para ver os teus dados personalizados.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Por hora',   value: fmtDec(hourlyRate), icon: '⏱️' },
            { label: 'Por dia',    value: fmt(dailyRate),      icon: '📅' },
            { label: 'Por mês',   value: fmt(monthlyIncome),   icon: '💰' },
          ].map(c => (
            <div key={c.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">{c.icon}</div>
              <div className="text-lg font-bold text-white">{c.value}</div>
              <div className="text-xs text-white/40">{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'celebrities', label: '⭐ Celebridades' },
          { id: 'hourly',      label: '⏱️ Custo em horas' },
          { id: 'equivalents', label: '☕ Equivalentes' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={cn(
              'px-3 py-2 rounded-xl text-xs font-medium transition-all',
              tab === t.id
                ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: CELEBRITIES ── */}
      {tab === 'celebrities' && (
        <motion.div key="celebrities" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Celebrity picker */}
          <div className="grid grid-cols-4 gap-2">
            {CELEBRITIES.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCel(c)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all text-center',
                  selectedCel.id === c.id
                    ? 'border-purple-500/60 bg-purple-500/15 text-white'
                    : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white'
                )}
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-[10px] font-medium leading-tight">{c.name.split(' ')[0]}</span>
                <span className="text-[9px] text-white/40">{c.flag}</span>
              </button>
            ))}
          </div>

          {/* Comparison card */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{selectedCel.emoji}</span>
              <div>
                <h2 className="font-bold text-white text-lg">{selectedCel.name}</h2>
                <p className="text-white/50 text-sm">{selectedCel.role} {selectedCel.flag}</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-lg font-bold text-purple-300">{fmt(selectedCel.yearlyEUR)}</div>
                <div className="text-xs text-white/40">/ano</div>
              </div>
            </div>

            <div className="h-px bg-white/10" />

            {monthlyIncome > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-white/60">O teu salário mensal ({fmt(monthlyIncome)})</span>
                  <span className="text-sm font-bold text-white">
                    = {humanDuration(minsToEarnMyMonthly)} p/ {selectedCel.name.split(' ')[0]}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-white/60">O teu salário anual ({fmt(yearlyIncome)})</span>
                  <span className="text-sm font-bold text-white">
                    = {humanDuration(minutesToEarnAmount(selectedCel.yearlyEUR, yearlyIncome))} p/ {selectedCel.name.split(' ')[0]}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-white/60">{selectedCel.name.split(' ')[0]} ganha por hora</span>
                  <span className="text-sm font-bold text-purple-300">
                    {fmt(selectedCel.yearlyEUR / (365 * 24))}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-white/60">{selectedCel.name.split(' ')[0]} ganha por minuto</span>
                  <span className="text-sm font-bold text-purple-300">
                    {fmtDec(selectedCel.yearlyEUR / (365 * 24 * 60))}
                  </span>
                </div>

                {/* Fun fact */}
                <div className="bg-white/5 rounded-xl p-3 text-xs text-white/60 flex gap-2">
                  <Info className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Enquanto lias esta frase (~5 seg), {selectedCel.name.split(' ')[0]} ganhou{' '}
                    <strong className="text-purple-300">
                      {fmtDec(selectedCel.yearlyEUR / (365 * 24 * 60 * 60) * 5)}
                    </strong>.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-white/40 text-sm">Regista rendimentos para ver a comparação personalizada.</p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── TAB: HOURLY COST ── */}
      {tab === 'hourly' && (
        <motion.div key="hourly" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {monthlyIncome === 0 ? (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-300">
              ⚠️ Regista as tuas receitas para ver o custo das despesas em horas de trabalho.
            </div>
          ) : (
            <>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-2">
                <div className="flex items-center gap-2 text-green-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">A tua hora vale</span>
                </div>
                <div className="text-3xl font-bold text-white">{fmtDec(hourlyRate)}</div>
                <div className="text-xs text-white/40 mt-1">Baseado em €{monthlyIncome.toFixed(0)}/mês · 22 dias × 8h</div>
              </div>

              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide px-1">
                Custo real das tuas despesas
              </h3>

              {recentExpenses.length === 0 ? (
                <div className="text-white/40 text-sm text-center py-8">Sem despesas registadas</div>
              ) : (
                recentExpenses.map(exp => {
                  const hoursNeeded  = exp.amount / hourlyRate
                  const minsNeeded   = exp.amount / minuteRate
                  return (
                    <div
                      key={exp.id}
                      className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4"
                    >
                      <CategoryIcon
                        categoryName={exp.category?.name}
                        categoryColor={exp.category?.color}
                        type="expense"
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{exp.description}</div>
                        <div className="text-xs text-white/40">{exp.category?.name ?? 'Despesa'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white">{fmtDec(exp.amount)}</div>
                        <div className="text-xs text-orange-400">
                          {hoursNeeded >= 1
                            ? `${hoursNeeded.toFixed(1)}h de trabalho`
                            : `${Math.round(minsNeeded)}min de trabalho`}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </>
          )}
        </motion.div>
      )}

      {/* ── TAB: EQUIVALENTS ── */}
      {tab === 'equivalents' && (
        <motion.div key="equivalents" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-2 flex items-center gap-3">
            <Coffee className="w-5 h-5 text-yellow-400" />
            <div>
              <div className="text-sm font-medium text-white">
                O teu salário mensal{monthlyIncome > 0 ? ` (${fmt(monthlyIncome)})` : ''} equivale a...
              </div>
              <div className="text-xs text-white/40">Baseado em preços de referência em Portugal</div>
            </div>
          </div>

          {EQUIVALENTS.map(eq => {
            const qty = monthlyIncome > 0 ? Math.floor(monthlyIncome / eq.price) : null
            return (
              <div
                key={eq.name}
                className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <span className="text-3xl w-10 text-center">{eq.emoji}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{eq.name}</div>
                  <div className="text-xs text-white/40">{fmtDec(eq.price)} cada</div>
                </div>
                <div className="text-right">
                  {qty !== null ? (
                    <>
                      <div className="text-lg font-bold text-green-400">{qty.toLocaleString('pt-PT')}</div>
                      <div className="text-xs text-white/40">por mês</div>
                    </>
                  ) : (
                    <div className="text-xs text-white/30">—</div>
                  )}
                </div>
              </div>
            )
          })}

          {monthlyIncome > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mt-2">
              <div className="flex items-center gap-2 text-blue-300 text-sm mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Comparação anual</span>
              </div>
              <div className="text-xs text-white/60 space-y-1">
                <div className="flex justify-between">
                  <span>Rendimento anual</span>
                  <span className="text-white font-medium">{fmt(yearlyIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Equivale a cafés ☕</span>
                  <span className="text-white font-medium">{Math.floor(yearlyIncome / 0.80).toLocaleString('pt-PT')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ou iPhones 📱</span>
                  <span className="text-white font-medium">{Math.floor(yearlyIncome / 1000).toLocaleString('pt-PT')}</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
