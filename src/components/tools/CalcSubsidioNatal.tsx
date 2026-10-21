'use client'

import { useId, useState } from 'react'
import { AmountField, readAmount } from '@/components/tools/AmountField'
import {
  computeSubsidioNatal, splitPlan, MAX_WITHHOLDING_PCT,
} from '@/lib/tools/subsidioNatal'
import { fill, fmtEUR, type ToolLocale } from '@/lib/tools/format'

/**
 * Ilha client da calculadora do Subsídio de Natal + plano em 3 partes.
 *
 * Mesmas regras da ilha do 50/30/20: sem Clerk/PostHog/recharts/framer-motion
 * /fetch, nenhum valor no URL, resultado num <output aria-live="polite">,
 * nunca `disabled` por validação, textos vindos do servidor.
 *
 * O resultado é sempre uma ESTIMATIVA: a taxa de retenção é a que o
 * utilizador lê do recibo (não embutimos tabelas de IRS).
 */

export interface CalcSubsidioNatalLabels {
  baseLabel:         string
  baseHint:          string
  basePlaceholder:   string
  monthsLabel:       string
  monthsHint:        string
  /** Contém {n}. */
  monthsOne:         string
  monthsMany:        string
  monthsFull:        string
  rateLabel:         string
  rateHint:          string
  ratePlaceholder:   string
  duoLabel:          string
  duoHint:           string
  errorNumber:       string
  errorRate:         string
  empty:             string
  estimate:          string
  resultTitle:       string
  gross:             string
  tsu:               string
  irs:               string
  net:               string
  /** Contém {amount}. */
  perMonth:          string
  /** Aviso: não inclui outros descontos / outros regimes. */
  caveat:            string
  /** Nota âmbar quando a taxa de IRS está em branco (líquido sobrestimado). */
  rateMissing:       string
  planTitle:         string
  planIntro:         string
  planEmergency:     string
  planDebt:          string
  planFun:           string
  planTotal:         string
}

interface Props {
  locale: ToolLocale
  labels: CalcSubsidioNatalLabels
}

type Split = [number, number, number]

/** Ponto de partida do plano (percentagens inteiras, somam 100). */
const DEFAULT_SPLIT: Split = [50, 30, 20]

/**
 * Mexe no slider `i` para `v` e redistribui o resto pelos outros dois,
 * proporcionalmente ao que tinham (ou ao meio se ambos estavam a 0).
 * Tudo em múltiplos de 5 (o passo do slider) e soma exata de 100.
 */
function rebalance(current: Split, i: 0 | 1 | 2, v: number): Split {
  const value = Math.max(0, Math.min(100, Math.round(v / 5) * 5))
  const j = ((i + 1) % 3) as 0 | 1 | 2
  const k = ((i + 2) % 3) as 0 | 1 | 2
  const rest = 100 - value
  const sumOthers = current[j] + current[k]
  const share = sumOthers > 0 ? current[j] / sumOthers : 0.5
  const nj = Math.max(0, Math.min(rest, Math.round((share * rest) / 5) * 5))
  const out: Split = [0, 0, 0]
  out[i] = value
  out[j] = nj
  out[k] = rest - nj
  return out
}

export function CalcSubsidioNatal({ locale, labels: L }: Props) {
  const monthsId = useId()
  const duoId    = useId()

  const [baseRaw, setBaseRaw] = useState('')
  const [months,  setMonths]  = useState(12)
  const [rateRaw, setRateRaw] = useState('')
  const [duo,     setDuo]     = useState(false)
  const [split,   setSplit]   = useState<Split>(DEFAULT_SPLIT)

  const base = readAmount(baseRaw)
  const rate = readAmount(rateRaw, MAX_WITHHOLDING_PCT, { percent: true })

  const result =
    base.state === 'ok' && base.value > 0 && rate.state !== 'invalid'
      ? computeSubsidioNatal({
          baseMensalBruto:  base.value,
          mesesTrabalhados: months,
          // Taxa vazia = 0% (campo opcional, com aviso âmbar no resultado).
          // Taxa inválida NÃO calcula: o erro inline pede a correção.
          taxaRetencaoPct:  rate.state === 'ok' ? rate.value : 0,
          emDuodecimos:     duo,
        })
      : null

  const plan = result ? splitPlan(result.liquido, split[0], split[1]) : null
  const planRows = plan
    ? [
        { label: L.planEmergency, pct: split[0], amount: plan.a },
        { label: L.planDebt,      pct: split[1], amount: plan.b },
        { label: L.planFun,       pct: split[2], amount: plan.c },
      ]
    : []

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AmountField
          label={L.baseLabel}
          hint={L.baseHint}
          placeholder={L.basePlaceholder}
          suffix="€"
          value={baseRaw}
          onChange={setBaseRaw}
          error={base.state === 'invalid' ? L.errorNumber : undefined}
        />

        <div>
          <label htmlFor={monthsId} className="mb-1.5 block text-sm font-medium text-white/85">
            {L.monthsLabel}
          </label>
          <select
            id={monthsId}
            value={months}
            onChange={e => setMonths(Number(e.target.value))}
            aria-describedby={`${monthsId}-hint`}
            className="h-12 w-full rounded-xl border border-hairline bg-surface-0 px-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-green-500/60"
          >
            {Array.from({ length: 12 }, (_, idx) => 12 - idx).map(n => (
              <option key={n} value={n}>
                {n === 12 ? L.monthsFull : fill(n === 1 ? L.monthsOne : L.monthsMany, { n })}
              </option>
            ))}
          </select>
          <p id={`${monthsId}-hint`} className="mt-1.5 text-xs leading-relaxed text-white/60">{L.monthsHint}</p>
        </div>

        <AmountField
          label={L.rateLabel}
          hint={L.rateHint}
          placeholder={L.ratePlaceholder}
          suffix="%"
          value={rateRaw}
          onChange={setRateRaw}
          error={rate.state === 'invalid' ? L.errorRate : undefined}
        />

        <div className="flex items-start">
          <label
            htmlFor={duoId}
            className="flex min-h-[48px] w-full cursor-pointer items-start gap-3 rounded-xl border border-hairline bg-surface-0 px-4 py-3 touch-manipulation"
          >
            <input
              id={duoId}
              type="checkbox"
              checked={duo}
              onChange={e => setDuo(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#27c26b]"
            />
            <span>
              <span className="block text-sm font-medium text-white/85">{L.duoLabel}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-white/60">{L.duoHint}</span>
            </span>
          </label>
        </div>
      </div>

      <output aria-live="polite" className="mt-6 block">
        {!result || !plan ? (
          <p className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-sm text-white/60">
            {L.empty}
          </p>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-white/90">{L.resultTitle}</h2>
                <span className="rounded-full border border-hairline px-2.5 py-0.5 text-xs text-white/70">
                  {L.estimate}
                </span>
              </div>

              <dl className="divide-y divide-divider rounded-xl border border-hairline">
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-white/75">{L.gross}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-white">{fmtEUR(result.bruto, locale)}</dd>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-white/75">{L.tsu}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-white/85">− {fmtEUR(result.tsu, locale)}</dd>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-white/75">{L.irs}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-white/85">− {fmtEUR(result.irs, locale)}</dd>
                </div>
                <div className="flex items-center justify-between bg-surface-0 px-4 py-4">
                  <dt className="text-sm font-bold text-white">{L.net}</dt>
                  <dd className="text-xl font-bold tabular-nums text-brand-400">{fmtEUR(result.liquido, locale)}</dd>
                </div>
              </dl>

              {duo && (
                <p className="mt-3 text-sm font-medium text-white/85">
                  {fill(L.perMonth, { amount: fmtEUR(result.porMesSeDuodecimos, locale) })}
                </p>
              )}
              {rate.state === 'empty' && (
                <p className="mt-3 rounded-lg border border-amber-400/30 px-3 py-2 text-xs leading-relaxed text-amber-300">
                  {L.rateMissing}
                </p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-white/60">{L.caveat}</p>
            </div>

            <div>
              <h2 className="text-sm font-bold text-white/90">{L.planTitle}</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/60">{L.planIntro}</p>

              <ul className="mt-3 space-y-4">
                {planRows.map((r, idx) => {
                  const sliderId = `${duoId}-s${idx}`
                  return (
                    <li key={r.label}>
                      <div className="flex items-baseline justify-between gap-3">
                        <label htmlFor={sliderId} className="text-sm font-medium text-white/85">
                          {r.label} <span className="tabular-nums text-white/60">({r.pct}%)</span>
                        </label>
                        <span className="text-sm font-bold tabular-nums text-white">{fmtEUR(r.amount, locale)}</span>
                      </div>
                      <input
                        id={sliderId}
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={r.pct}
                        onChange={e => setSplit(prev => rebalance(prev, idx as 0 | 1 | 2, Number(e.target.value)))}
                        className="mt-1 h-11 w-full cursor-pointer touch-manipulation accent-[#27c26b]"
                      />
                    </li>
                  )
                })}
              </ul>

              <p className="mt-2 flex items-center justify-between border-t border-divider pt-3 text-sm">
                <span className="text-white/75">{L.planTotal}</span>
                <span className="font-bold tabular-nums text-white">{fmtEUR(result.liquido, locale)}</span>
              </p>
            </div>
          </div>
        )}
      </output>
    </div>
  )
}
