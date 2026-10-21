'use client'

import { useId } from 'react'
import { parseAmountLocale } from '@/lib/safeNumber'
import { stripThousandsOnly } from '@/lib/tools/amountText'

/**
 * Campo de montante das ferramentas públicas.
 *
 *  - type="text" + inputMode="decimal" + pattern (vírgula decimal PT; aceita
 *    "1.234,56" e "1,234.56" via parseAmountLocale).
 *  - text-base (16px): o iOS não faz zoom ao focar.
 *  - label sempre visível; erro inline com role="alert" + aria-describedby.
 *  - NUNCA `disabled` por validação: o erro aparece em texto, o botão/estado
 *    não morre (regra "mobile dead-end" do CLAUDE.md).
 */

export type ParsedAmount =
  | { state: 'empty' }
  | { state: 'invalid' }
  | { state: 'ok'; value: number }

/**
 * Lê o texto do campo. Vazio = 'empty' (campo por preencher, não é erro).
 * Negativo, não-numérico ou acima de `max` = 'invalid'.
 */
export function readAmount(
  raw: string,
  max = 10_000_000,
  opts: { percent?: boolean } = {},
): ParsedAmount {
  if (!raw.trim()) return { state: 'empty' }
  // "1.300" / "1,300" = mil e trezentos (milhar), exceto em percentagens.
  const n = parseAmountLocale(opts.percent ? raw : stripThousandsOnly(raw))
  if (!Number.isFinite(n) || n < 0 || n > max) return { state: 'invalid' }
  return { state: 'ok', value: n }
}

interface Props {
  label:        string
  value:        string
  onChange:     (next: string) => void
  placeholder?: string
  hint?:        string
  /** Texto do erro (já traduzido). Vazio/undefined = sem erro. */
  error?:       string
  /** Sufixo visual dentro do campo, ex.: "€" ou "%". */
  suffix?:      string
  /** Marca o campo como opcional no rótulo (texto já traduzido). */
  optionalLabel?: string
}

export function AmountField({
  label, value, onChange, placeholder, hint, error, suffix, optionalLabel,
}: Props) {
  const id      = useId()
  const hintId  = `${id}-hint`
  const errorId = `${id}-err`
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/85">
        {label}
        {optionalLabel && <span className="ml-1.5 text-xs font-normal text-white/60">{optionalLabel}</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          pattern="[0-9.,]*"
          autoComplete="off"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={
            'h-12 w-full rounded-xl border bg-surface-0 px-4 text-base tabular-nums text-white ' +
            'placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-green-500/60 ' +
            (suffix ? 'pr-10 ' : '') +
            (error ? 'border-amber-400/50' : 'border-hairline')
          }
        />
        {suffix && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base text-white/50">
            {suffix}
          </span>
        )}
      </div>
      {hint && !error && <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-white/60">{hint}</p>}
      {error && <p id={errorId} role="alert" className="mt-1.5 text-xs leading-relaxed text-amber-300">{error}</p>}
    </div>
  )
}
