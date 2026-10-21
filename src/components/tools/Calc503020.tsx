'use client'

import { useState } from 'react'
import { AmountField, readAmount } from '@/components/tools/AmountField'
import { compute503020, SPLIT_503020 } from '@/lib/tools/budget503020'
import { fill, fmtEUR, fmtPct, type ToolLocale } from '@/lib/tools/format'

/**
 * Ilha client da calculadora 50/30/20 + fundo de emergência.
 *
 * Regras da ilha (ver ToolShell): sem Clerk, PostHog, recharts, framer-motion
 * ou fetch; nenhum valor no URL; resultado num <output aria-live="polite">;
 * nunca `disabled` por validação. Os textos chegam já traduzidos do servidor
 * (`labels`) para a ilha não carregar o dicionário i18n.
 */

export interface Calc503020Labels {
  incomeLabel:       string
  incomeHint:        string
  incomePlaceholder: string
  rentLabel:         string
  rentPlaceholder:   string
  optional:          string
  errorNumber:       string
  empty:             string
  resultTitle:       string
  needs:             string
  needsDesc:         string
  wants:             string
  wantsDesc:         string
  savings:           string
  savingsDesc:       string
  /** Contém {pct}. */
  rentShare:         string
  rentWarn:          string
  emTitle:           string
  em3:               string
  em6:               string
  /** Contém {amount}. */
  emPlan:            string
  emNote:            string
}

interface Props {
  locale: ToolLocale
  labels: Calc503020Labels
}

export function Calc503020({ locale, labels: L }: Props) {
  const [incomeRaw, setIncomeRaw] = useState('')
  const [rentRaw,   setRentRaw]   = useState('')

  const income = readAmount(incomeRaw)
  const rent   = readAmount(rentRaw)

  const result =
    income.state === 'ok' && income.value > 0
      ? compute503020({
          netIncome: income.value,
          rent:      rent.state === 'ok' ? rent.value : undefined,
        })
      : null

  const rows = result
    ? [
        { key: 'needs',   title: L.needs,   desc: L.needsDesc,   amount: result.needs,   pct: SPLIT_503020.needs,   bar: 'bg-white/35' },
        { key: 'wants',   title: L.wants,   desc: L.wantsDesc,   amount: result.wants,   pct: SPLIT_503020.wants,   bar: 'bg-white/20' },
        { key: 'savings', title: L.savings, desc: L.savingsDesc, amount: result.savings, pct: SPLIT_503020.savings, bar: 'bg-brand-500' },
      ]
    : []

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AmountField
          label={L.incomeLabel}
          hint={L.incomeHint}
          placeholder={L.incomePlaceholder}
          suffix="€"
          value={incomeRaw}
          onChange={setIncomeRaw}
          error={income.state === 'invalid' ? L.errorNumber : undefined}
        />
        <AmountField
          label={L.rentLabel}
          optionalLabel={L.optional}
          placeholder={L.rentPlaceholder}
          suffix="€"
          value={rentRaw}
          onChange={setRentRaw}
          error={rent.state === 'invalid' ? L.errorNumber : undefined}
        />
      </div>

      <output aria-live="polite" className="mt-6 block">
        {!result ? (
          <p className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-sm text-white/60">
            {L.empty}
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="mb-3 text-sm font-bold text-white/90">{L.resultTitle}</h2>

              {/* Barra proporcional estática (sem animação). */}
              <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-surface-0" aria-hidden>
                {rows.map(r => (
                  <div key={r.key} className={r.bar} style={{ width: `${r.pct * 100}%` }} />
                ))}
              </div>

              <ul className="divide-y divide-divider rounded-xl border border-hairline">
                {rows.map(r => (
                  <li key={r.key} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{r.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-white/60">{r.desc}</p>
                    </div>
                    <p className="shrink-0 text-base font-bold tabular-nums text-white">
                      {fmtEUR(r.amount, locale)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {rent.state === 'ok' && rent.value > 0 && (
              <div
                className={
                  'rounded-xl border px-4 py-3 text-sm leading-relaxed ' +
                  (result.rentExceedsNeeds
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                    : 'border-hairline bg-surface-0 text-white/75')
                }
              >
                <p>{fill(L.rentShare, { pct: fmtPct(result.rentShareOfIncome, locale) })}</p>
                {result.rentExceedsNeeds && <p className="mt-1.5 font-semibold">{L.rentWarn}</p>}
              </div>
            )}

            <div>
              <h2 className="mb-3 text-sm font-bold text-white/90">{L.emTitle}</h2>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-hairline bg-surface-0 px-4 py-3">
                  <dt className="text-xs text-white/60">{L.em3}</dt>
                  <dd className="mt-1 text-lg font-bold tabular-nums text-white">{fmtEUR(result.emergency3, locale)}</dd>
                </div>
                <div className="rounded-xl border border-hairline bg-surface-0 px-4 py-3">
                  <dt className="text-xs text-white/60">{L.em6}</dt>
                  <dd className="mt-1 text-lg font-bold tabular-nums text-white">{fmtEUR(result.emergency6, locale)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm font-medium text-white/85">
                {fill(L.emPlan, { amount: fmtEUR(result.monthlyToEmergency3In12, locale) })}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/60">{L.emNote}</p>
            </div>
          </div>
        )}
      </output>
    </div>
  )
}
