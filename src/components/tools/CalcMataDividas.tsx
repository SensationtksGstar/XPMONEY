'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { AmountField, readAmount } from '@/components/tools/AmountField'
import {
  compareStrategies, formatMonths, orderByStrategy, simulatePlan,
} from '@/lib/killDebt'
import {
  MAX_DEBTS, plansEquivalent, savingsVsBase, toSimDebts, whatIfLadder,
  type DebtInput, type PlanSummary,
} from '@/lib/tools/mataDividas'
import { fill, fmtEUR, type ToolLocale } from '@/lib/tools/format'

/**
 * Ilha client do Mata-Dividas publico: Avalanche vs Bola de Neve em euros.
 *
 * Mesmas regras das outras ilhas (ver ToolShell): sem Clerk/PostHog/recharts/
 * framer-motion/fetch, nenhum valor no URL, resultado num <output
 * aria-live="polite">, nunca `disabled` por validacao, textos ja traduzidos
 * vindos do servidor.
 *
 * A matematica e SEMPRE do src/lib/killDebt.ts (simulatePlan/
 * compareStrategies/orderByStrategy) — aqui so ha formulario e apresentacao.
 */

export interface CalcMataDividasLabels {
  /** Contem {n}. */
  debtTitle:       string
  exampleName1:    string
  exampleName2:    string
  exampleBanner:   string
  exampleClear:    string
  nameLabel:       string
  namePlaceholder: string
  optional:        string
  balanceLabel:    string
  balancePlaceholder: string
  rateLabel:       string
  ratePlaceholder: string
  minLabel:        string
  minPlaceholder:  string
  minHint:         string
  remove:          string
  add:             string
  maxReached:      string
  rowIncomplete:   string
  errorNumber:     string
  errorRate:       string
  extraLabel:      string
  extraHint:       string
  extraPlaceholder: string
  empty:           string
  incompleteNote:  string
  resultTitle:     string
  avalancheTitle:  string
  avalancheDesc:   string
  snowballTitle:   string
  snowballDesc:    string
  freeIn:          string
  totalInterest:   string
  attackOrder:     string
  infiniteValue:   string
  infiniteWarn:    string
  cheaper:         string
  equivTitle:      string
  equivBody:       string
  /** Contem {amount}. */
  betterAvalanche: string
  /** Contem {amount}. */
  betterSnowball:  string
  caveat:          string
  whatIfTitle:     string
  whatIfIntro:     string
  /** Contem {amount}. */
  perMonth:        string
  whatIfCurrent:   string
  whatIfBase:      string
  whatIfNone:      string
  whatIfEnds:      string
  whatIfNever:     string
  /** Contem {interest}. */
  whatIfSavesInterest: string
  /** Contem {interest} e {months}. */
  whatIfSavesBoth: string
  /** Contem {months}. Usado quando os juros poupados sao ~0 (ex.: taxa 0%). */
  whatIfSavesMonths: string
}

interface Props {
  locale: ToolLocale
  labels: CalcMataDividasLabels
}

interface Row {
  id:      string
  name:    string
  balance: string
  rate:    string
  min:     string
}

const MAX_NAME = 40

const rateText = (rate: number, locale: ToolLocale): string =>
  `${new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'pt-PT', { maximumFractionDigits: 2 }).format(rate)}%`

/** Texto do <input> de nome (AmountField e so numerico). */
function NameField({
  label, optionalLabel, placeholder, value, onChange,
}: {
  label: string; optionalLabel: string; placeholder: string
  value: string; onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/85">
        {label}
        <span className="ml-1.5 text-xs font-normal text-white/60">{optionalLabel}</span>
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        maxLength={MAX_NAME}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-xl border border-hairline bg-surface-0 px-4 text-base text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-green-500/60"
      />
    </div>
  )
}

const BTN_SECONDARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-hairline bg-surface-2 px-4 text-sm font-semibold text-white transition-colors hover:bg-surface-3 touch-manipulation'

export function CalcMataDividas({ locale, labels: L }: Props) {
  const nextId = useRef(3)
  const [rows, setRows] = useState<Row[]>(() => [
    { id: 'r1', name: L.exampleName1, balance: '500',  rate: '20', min: '50'  },
    { id: 'r2', name: L.exampleName2, balance: '5000', rate: '10', min: '100' },
  ])
  const [extraRaw,  setExtraRaw]  = useState('')
  const [isExample, setIsExample] = useState(true)

  const updateRow = (id: string, patch: Partial<Omit<Row, 'id'>>) => {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
    setIsExample(false)
  }
  const addRow = () => {
    setRows(rs => (rs.length >= MAX_DEBTS ? rs : [...rs, { id: `r${nextId.current++}`, name: '', balance: '', rate: '', min: '' }]))
    setIsExample(false)
  }
  const removeRow = (id: string) => {
    setRows(rs => (rs.length <= 1 ? rs : rs.filter(r => r.id !== id)))
    setIsExample(false)
  }
  const clearExample = () => {
    setRows([{ id: `r${nextId.current++}`, name: '', balance: '', rate: '', min: '' }])
    setExtraRaw('')
    setIsExample(false)
  }

  const extra = readAmount(extraRaw, 1_000_000)
  const extraValue = extra.state === 'ok' ? extra.value : 0
  const extraRounded = Math.round(extraValue * 100) / 100

  // Uma linha so entra na simulacao com saldo > 0 e taxa validos; o minimo
  // em branco conta como 0. Linhas a meio ficam de fora (com aviso).
  const { parsed, inputs } = useMemo(() => {
    const list = rows.map((r, i) => {
      const balance = readAmount(r.balance)
      const rate    = readAmount(r.rate, 100, { percent: true })
      const min     = readAmount(r.min)
      const complete =
        balance.state === 'ok' && balance.value > 0 &&
        rate.state === 'ok' &&
        min.state !== 'invalid'
      const anyNumeric = !!(r.balance.trim() || r.rate.trim() || r.min.trim())
      const input: DebtInput | null = complete
        ? {
            name:    r.name.trim() || fill(L.debtTitle, { n: i + 1 }),
            balance: balance.value,
            ratePct: rate.value,
            min:     min.state === 'ok' ? min.value : 0,
          }
        : null
      return { row: r, balance, rate, min, complete, anyNumeric, input }
    })
    return { parsed: list, inputs: list.flatMap(p => (p.input ? [p.input] : [])) }
  }, [rows, L.debtTitle])

  const hasIncomplete = parsed.some(p => p.anyNumeric && !p.complete)

  const calc = useMemo(() => {
    if (inputs.length === 0) return null
    const debts = toSimDebts(inputs)
    const cmp   = compareStrategies(debts, extraValue)
    const ladder = whatIfLadder(extraRounded).map(x => ({
      extra: x,
      plan:  x === extraValue ? cmp.avalanche : simulatePlan(debts, x, 'avalanche'),
    }))
    const base = ladder.find(l => l.extra === 0)!.plan
    return {
      debts,
      cmp,
      base,
      ladder,
      orderAvalanche: orderByStrategy(debts, 'avalanche'),
      orderSnowball:  orderByStrategy(debts, 'snowball'),
    }
  }, [inputs, extraValue, extraRounded])

  const planFree = (p: PlanSummary) => (p.infinite ? L.infiniteValue : formatMonths(p.monthsToFree, locale))
  const planInterest = (p: PlanSummary) => (p.infinite ? '—' : fmtEUR(p.totalInterest, locale))

  const orderList = (order: ReturnType<typeof orderByStrategy>) => (
    <>
      <p className="mt-4 text-xs font-semibold text-white/80">{L.attackOrder}</p>
      <ol className="mt-1.5 space-y-1.5">
        {order.map((d, i) => (
          <li key={d.id} className="flex items-baseline gap-2 text-sm">
            <span aria-hidden className="w-4 shrink-0 text-xs tabular-nums text-white/50">{i + 1}.</span>
            <span className="min-w-0">
              <span className="font-medium text-white">{d.name}</span>
              <span className="block text-xs tabular-nums text-white/60">
                {fmtEUR(d.current_amount, locale)} · {rateText(d.interest_rate, locale)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </>
  )

  const summaryDl = (plan: PlanSummary) => (
    <dl className="mt-3 grid grid-cols-2 gap-3">
      <div>
        <dt className="text-xs text-white/60">{L.freeIn}</dt>
        <dd className="mt-0.5 text-base font-bold tabular-nums text-white">{planFree(plan)}</dd>
      </div>
      <div>
        <dt className="text-xs text-white/60">{L.totalInterest}</dt>
        <dd className="mt-0.5 text-base font-bold tabular-nums text-white">{planInterest(plan)}</dd>
      </div>
    </dl>
  )

  const methodCard = (
    title: string, desc: string, plan: PlanSummary,
    order: ReturnType<typeof orderByStrategy>, cheaper: boolean,
  ) => (
    <div className="rounded-xl border border-hairline bg-surface-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {cheaper && (
          <span className="shrink-0 rounded-full bg-brand-500/15 px-2.5 py-1 text-xs font-semibold text-green-300">
            {L.cheaper}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-white/60">{desc}</p>
      {summaryDl(plan)}
      {orderList(order)}
    </div>
  )

  // Qual e mais barato? Um infinito perde para um que acaba; senao, juros
  // (desempate: meses).
  let better: 'avalanche' | 'snowball' | null = null
  let equivalent = false
  if (calc) {
    const { avalanche: a, snowball: s } = calc.cmp
    equivalent = plansEquivalent(a, s)
    if (!equivalent) {
      if (a.infinite !== s.infinite) better = a.infinite ? 'snowball' : 'avalanche'
      else if (!a.infinite) {
        if (a.totalInterest < s.totalInterest - 0.005) better = 'avalanche'
        else if (s.totalInterest < a.totalInterest - 0.005) better = 'snowball'
        else if (a.monthsToFree !== s.monthsToFree) better = a.monthsToFree < s.monthsToFree ? 'avalanche' : 'snowball'
      }
    }
  }
  const anyInfinite = !!calc && (calc.cmp.avalanche.infinite || calc.cmp.snowball.infinite)
  const bothInfinite = !!calc && calc.cmp.avalanche.infinite && calc.cmp.snowball.infinite
  const interestGap = calc && !anyInfinite ? calc.cmp.savings : 0

  return (
    <div>
      {isExample && (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-hairline bg-surface-0 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-white/75">{L.exampleBanner}</p>
          <button type="button" onClick={clearExample} className={BTN_SECONDARY + ' shrink-0'}>
            {L.exampleClear}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {parsed.map((p, i) => {
          const r = p.row
          return (
            <fieldset key={r.id} className="min-w-0 rounded-xl border border-hairline p-4">
              <legend className="px-1.5 text-sm font-bold text-white">
                {fill(L.debtTitle, { n: i + 1 })}
              </legend>
              <div className="space-y-3">
                <NameField
                  label={L.nameLabel}
                  optionalLabel={L.optional}
                  placeholder={L.namePlaceholder}
                  value={r.name}
                  onChange={v => updateRow(r.id, { name: v })}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <AmountField
                    label={L.balanceLabel}
                    placeholder={L.balancePlaceholder}
                    suffix="€"
                    value={r.balance}
                    onChange={v => updateRow(r.id, { balance: v })}
                    error={p.balance.state === 'invalid' ? L.errorNumber : undefined}
                  />
                  <AmountField
                    label={L.rateLabel}
                    placeholder={L.ratePlaceholder}
                    suffix="%"
                    value={r.rate}
                    onChange={v => updateRow(r.id, { rate: v })}
                    error={p.rate.state === 'invalid' ? L.errorRate : undefined}
                  />
                  <div className="col-span-2 sm:col-span-1">
                    <AmountField
                      label={L.minLabel}
                      hint={L.minHint}
                      placeholder={L.minPlaceholder}
                      suffix="€"
                      value={r.min}
                      onChange={v => updateRow(r.id, { min: v })}
                      error={p.min.state === 'invalid' ? L.errorNumber : undefined}
                    />
                  </div>
                </div>
                {p.anyNumeric && !p.complete &&
                  p.balance.state !== 'invalid' && p.rate.state !== 'invalid' && p.min.state !== 'invalid' && (
                    <p className="text-xs leading-relaxed text-amber-300">{L.rowIncomplete}</p>
                  )}
                {rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(r.id)} className={BTN_SECONDARY}>
                    {L.remove}
                  </button>
                )}
              </div>
            </fieldset>
          )
        })}

        {rows.length < MAX_DEBTS ? (
          <button type="button" onClick={addRow} className={BTN_SECONDARY + ' w-full sm:w-auto'}>
            + {L.add}
          </button>
        ) : (
          <p className="text-xs text-white/60">{L.maxReached}</p>
        )}
      </div>

      <div className="mt-5">
        <AmountField
          label={L.extraLabel}
          optionalLabel={L.optional}
          hint={L.extraHint}
          placeholder={L.extraPlaceholder}
          suffix="€"
          value={extraRaw}
          onChange={setExtraRaw}
          error={extra.state === 'invalid' ? L.errorNumber : undefined}
        />
      </div>

      <output aria-live="polite" className="mt-6 block">
        {!calc ? (
          <p className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-sm text-white/60">
            {L.empty}
          </p>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white/90">{L.resultTitle}</h2>

            {hasIncomplete && (
              <p className="text-xs leading-relaxed text-amber-300">{L.incompleteNote}</p>
            )}

            {anyInfinite && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-100">
                {L.infiniteWarn}
              </div>
            )}

            {equivalent ? (
              <div className="rounded-xl border border-hairline bg-surface-0 p-4">
                <h3 className="text-sm font-bold text-white">{L.equivTitle}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/75">{L.equivBody}</p>
                {summaryDl(calc.cmp.avalanche)}
                {orderList(calc.orderAvalanche)}
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {methodCard(L.avalancheTitle, L.avalancheDesc, calc.cmp.avalanche, calc.orderAvalanche, better === 'avalanche')}
                  {methodCard(L.snowballTitle, L.snowballDesc, calc.cmp.snowball, calc.orderSnowball, better === 'snowball')}
                </div>
                {!bothInfinite && better && interestGap >= 0.01 && (
                  <p className="text-sm font-medium text-white/85">
                    {fill(better === 'avalanche' ? L.betterAvalanche : L.betterSnowball, {
                      amount: fmtEUR(interestGap, locale),
                    })}
                  </p>
                )}
              </>
            )}

            <p className="text-xs leading-relaxed text-white/60">{L.caveat}</p>
          </div>
        )}
      </output>

      {calc && (
        <section className="mt-8" aria-labelledby="whatif-title">
          <h2 id="whatif-title" className="text-sm font-bold text-white/90">{L.whatIfTitle}</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/60">{L.whatIfIntro}</p>
          <ul className="mt-3 space-y-2">
            {calc.ladder.map(({ extra: x, plan }) => {
              const sv = savingsVsBase(calc.base, plan)
              const current = x === extraRounded
              let note = ''
              if (x === 0) note = L.whatIfBase
              else if (sv.kind === 'never') note = L.whatIfNever
              else if (sv.kind === 'ends') note = L.whatIfEnds
              else if (sv.kind === 'none') note = L.whatIfNone
              else if (sv.months > 0 && sv.interest < 0.005) {
                note = fill(L.whatIfSavesMonths, { months: formatMonths(sv.months, locale) })
              } else if (sv.months > 0) {
                note = fill(L.whatIfSavesBoth, {
                  interest: fmtEUR(sv.interest, locale),
                  months:   formatMonths(sv.months, locale),
                })
              } else {
                note = fill(L.whatIfSavesInterest, { interest: fmtEUR(sv.interest, locale) })
              }
              return (
                <li key={x}>
                  <button
                    type="button"
                    aria-pressed={current}
                    onClick={() => setExtraRaw(x === 0 ? '' : String(x))}
                    className={
                      'flex min-h-[56px] w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors touch-manipulation sm:flex-row sm:items-center sm:justify-between sm:gap-4 ' +
                      (current
                        ? 'border-green-500/50 bg-brand-500/10'
                        : 'border-hairline bg-surface-0 hover:border-white/20 hover:bg-surface-2')
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-white">
                        {fill(L.perMonth, { amount: fmtEUR(x, locale) })}
                      </span>
                      {current && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80">
                          {L.whatIfCurrent}
                        </span>
                      )}
                    </span>
                    <span className="text-xs leading-relaxed text-white/70 sm:text-right">
                      <span className="font-semibold tabular-nums text-white/90">
                        {planFree(plan)} · {planInterest(plan)}
                      </span>
                      <span className="block">{note}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
