'use client'

import { useState } from 'react'
import { Clock, Coffee, Star, TrendingUp, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { SalaryCompare } from '@/components/perspetiva/SalaryCompare'
import { useT } from '@/lib/i18n/LocaleProvider'

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
  monthlyIncome:  number
  salaryMonths:   number      // distinct months used to compute the average
  salaryTotal:    number      // total declared salary amount
  recentExpenses: Expense[]
}

/* ─── Component ───────────────────────────────────────────────────────── */
export default function PerspectivaClient({ monthlyIncome, salaryMonths, salaryTotal, recentExpenses }: Props) {
  const t = useT()
  const [selectedCel, setSelectedCel] = useState(CELEBRITIES[0])
  const [tab, setTab] = useState<'celebrities' | 'hourly' | 'equivalents' | 'countries'>('celebrities')

  function humanDurationT(minutes: number): string {
    if (minutes < 0.017) return t('perspective.dur.seconds', { n: Math.round(minutes * 3600) })
    if (minutes < 1)     return t('perspective.dur.seconds', { n: Math.round(minutes * 60) })
    if (minutes < 60)    return t('perspective.dur.minutes', { n: minutes.toFixed(1).replace('.0', '') })
    if (minutes < 1440)  return t('perspective.dur.hours',   { n: (minutes / 60).toFixed(1).replace('.0', '') })
    if (minutes < 10080) return t('perspective.dur.days',    { n: (minutes / 1440).toFixed(1).replace('.0', '') })
    if (minutes < 43200) return t('perspective.dur.weeks',   { n: (minutes / 10080).toFixed(1).replace('.0', '') })
    return                 t('perspective.dur.months',  { n: (minutes / 43200).toFixed(1).replace('.0', '') })
  }

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
          <h1 className="text-2xl font-bold text-white">{t('perspective.title')}</h1>
          <span className="text-xs bg-purple-500/20 border border-purple-500/30 text-purple-400 px-2 py-0.5 rounded-full font-bold">{t('perspective.badge_pro')}</span>
        </div>
        <p className="text-white/50 text-sm">{t('perspective.subtitle')}</p>
      </div>

      {/* Income summary */}
      {monthlyIncome === 0 ? (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-300">
          {t('perspective.no_salary', { salary: 'Salário', freelance: 'Freelance' })}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Source label */}
          <div className="flex items-center gap-2 text-xs text-white/40 px-1">
            <Info className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            <span>
              {t('perspective.avg_base_a')}{' '}
              <strong className="text-green-400">{salaryMonths} {salaryMonths === 1 ? t('perspective.months_one') : t('perspective.months_many')}</strong>
              {' '}{t('perspective.avg_base_b')}
              {salaryMonths > 1 && (
                <> · {t('perspective.avg_total', { amount: '' })}<strong className="text-white">{fmt(salaryTotal)}</strong></>
              )}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('perspective.per_hour'),  value: fmtDec(hourlyRate),  icon: '⏱️' },
              { label: t('perspective.per_day'),   value: fmt(dailyRate),       icon: '📅' },
              { label: t('perspective.per_month'), value: fmt(monthlyIncome),   icon: '💰' },
            ].map(c => (
              <div key={c.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className="text-lg font-bold text-white">{c.value}</div>
                <div className="text-xs text-white/40">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {[
          { id: 'countries',   label: t('perspective.tab.countries') },
          { id: 'celebrities', label: t('perspective.tab.celebrities') },
          { id: 'hourly',      label: t('perspective.tab.hourly') },
          { id: 'equivalents', label: t('perspective.tab.equivalents') },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={cn(
              'flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all',
              tab === t.id
                ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: COUNTRIES ── */}
      {tab === 'countries' && (
        <div className="animate-fade-in-up">
          <SalaryCompare initialMonthlyEUR={monthlyIncome} />
        </div>
      )}

      {/* ── TAB: CELEBRITIES ── */}
      {tab === 'celebrities' && (
        <div className="space-y-4 animate-fade-in-up">
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
                  <span className="text-sm text-white/60">{t('perspective.my_monthly', { amount: fmt(monthlyIncome) })}</span>
                  <span className="text-sm font-bold text-white">
                    {t('perspective.earn_time', { duration: humanDurationT(minsToEarnMyMonthly), name: selectedCel.name.split(' ')[0] })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-white/60">{t('perspective.my_yearly', { amount: fmt(yearlyIncome) })}</span>
                  <span className="text-sm font-bold text-white">
                    {t('perspective.earn_time', { duration: humanDurationT(minutesToEarnAmount(selectedCel.yearlyEUR, yearlyIncome)), name: selectedCel.name.split(' ')[0] })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-white/60">{t('perspective.hourly_earn', { name: selectedCel.name.split(' ')[0] })}</span>
                  <span className="text-sm font-bold text-purple-300">
                    {fmt(selectedCel.yearlyEUR / (365 * 24))}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-white/60">{t('perspective.minute_earn', { name: selectedCel.name.split(' ')[0] })}</span>
                  <span className="text-sm font-bold text-purple-300">
                    {fmtDec(selectedCel.yearlyEUR / (365 * 24 * 60))}
                  </span>
                </div>

                {/* Fun fact */}
                <div className="bg-white/5 rounded-xl p-3 text-xs text-white/60 flex gap-2">
                  <Info className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <span>
                    {t('perspective.funfact', { name: selectedCel.name.split(' ')[0] })}{' '}
                    <strong className="text-purple-300">
                      {fmtDec(selectedCel.yearlyEUR / (365 * 24 * 60 * 60) * 5)}
                    </strong>.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-white/40 text-sm">{t('perspective.no_income_msg')}</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: HOURLY COST ── */}
      {tab === 'hourly' && (
        <div className="space-y-3 animate-fade-in-up">
          {monthlyIncome === 0 ? (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-300">
              {t('perspective.hourly.no_income')}
            </div>
          ) : (
            <>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-2">
                <div className="flex items-center gap-2 text-green-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('perspective.hour_worth')}</span>
                </div>
                <div className="text-3xl font-bold text-white">{fmtDec(hourlyRate)}</div>
                <div className="text-xs text-white/40 mt-1">{t('perspective.hour_base', { income: monthlyIncome.toFixed(0) })}</div>
              </div>

              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide px-1">
                {t('perspective.real_cost')}
              </h3>

              {recentExpenses.length === 0 ? (
                <div className="text-white/40 text-sm text-center py-8">{t('perspective.no_expenses')}</div>
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
                        <div className="text-xs text-white/40">{exp.category?.name ?? t('perspective.expense_fallback')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white">{fmtDec(exp.amount)}</div>
                        <div className="text-xs text-orange-400">
                          {hoursNeeded >= 1
                            ? t('perspective.cost_hours', { hours: hoursNeeded.toFixed(1) })
                            : t('perspective.cost_minutes', { mins: Math.round(minsNeeded) })}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: EQUIVALENTS ── */}
      {tab === 'equivalents' && (
        <div className="space-y-3 animate-fade-in-up">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-2 flex items-center gap-3">
            <Coffee className="w-5 h-5 text-yellow-400" />
            <div>
              <div className="text-sm font-medium text-white">
                {t('perspective.eq.monthly_eq', { amount: monthlyIncome > 0 ? t('perspective.eq.amount_suffix', { amount: fmt(monthlyIncome) }) : '' })}
              </div>
              <div className="text-xs text-white/40">{t('perspective.eq.ref')}</div>
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
                  <div className="text-xs text-white/40">{t('perspective.eq.each', { amount: fmtDec(eq.price) })}</div>
                </div>
                <div className="text-right">
                  {qty !== null ? (
                    <>
                      <div className="text-lg font-bold text-green-400">{qty.toLocaleString('pt-PT')}</div>
                      <div className="text-xs text-white/40">{t('perspective.eq.per_month')}</div>
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
                <span className="font-medium">{t('perspective.eq.compare')}</span>
              </div>
              <div className="text-xs text-white/60 space-y-1">
                <div className="flex justify-between">
                  <span>{t('perspective.eq.yearly')}</span>
                  <span className="text-white font-medium">{fmt(yearlyIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('perspective.eq.coffees')}</span>
                  <span className="text-white font-medium">{Math.floor(yearlyIncome / 0.80).toLocaleString('pt-PT')}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('perspective.eq.iphones')}</span>
                  <span className="text-white font-medium">{Math.floor(yearlyIncome / 1000).toLocaleString('pt-PT')}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
