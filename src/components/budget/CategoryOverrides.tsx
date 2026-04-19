'use client'

import { useState } from 'react'
import { ChevronDown, Sparkles, RotateCcw } from 'lucide-react'
import { useBudgetOverrides } from '@/hooks/useBudget'
import {
  BUCKET_LABELS, BUCKET_COLORS,
  type BudgetBucket,
} from '@/lib/budget'
import { formatCurrency } from '@/lib/utils'

/**
 * CategoryOverrides — painel colapsável que lista as categorias que
 * aparecem nas despesas do mês e permite ao user recategorizar manualmente
 * em needs/wants/savings.
 *
 * A heurística em `categoryToBucket` cobre o caso geral mas nem sempre
 * acerta (ex: "Uber" → heurística manda para wants, mas um user que usa
 * Uber para commute diário quer em needs). Este painel resolve sem
 * precisar de mudar código.
 *
 * Preferências persistem em localStorage via useBudgetOverrides.
 */

interface Category {
  name:   string
  icon:   string | null
  bucket: BudgetBucket
  total:  number
}

interface Props {
  categories: Category[]
}

export function CategoryOverrides({ categories }: Props) {
  const { overrides, setOverride, clearAll } = useBudgetOverrides()
  const [open, setOpen] = useState(false)

  if (categories.length === 0) return null

  const hasOverrides = Object.keys(overrides).length > 0

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-left">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <div>
            <p className="font-semibold text-white text-sm">Personalizar categorias</p>
            <p className="text-[11px] text-white/50 mt-0.5">
              {hasOverrides
                ? `${Object.keys(overrides).length} recategorizadas · clica para ajustar`
                : 'Muda para outro bucket se a categorização automática não for ideal'}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-white/5">
          {hasOverrides && (
            <div className="flex items-center justify-between px-5 py-2.5 bg-white/3 border-b border-white/5">
              <p className="text-[11px] text-white/50">
                As tuas escolhas ficam guardadas neste dispositivo.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/60 hover:text-white"
              >
                <RotateCcw className="w-3 h-3" />
                Repor tudo
              </button>
            </div>
          )}

          <div className="divide-y divide-white/5">
            {categories.map(cat => (
              <CategoryRow
                key={cat.name}
                category={cat}
                isOverridden={!!overrides[cat.name]}
                onChange={bucket => {
                  // Se o user escolhe o mesmo bucket que a heurística
                  // atribuíu sem override, remove o override para manter
                  // o localStorage enxuto. Só guardamos escolhas que
                  // discordam da heurística.
                  setOverride(cat.name, bucket)
                }}
                onReset={() => setOverride(cat.name, null)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryRow({
  category, isOverridden, onChange, onReset,
}: {
  category:     Category
  isOverridden: boolean
  onChange:     (bucket: BudgetBucket) => void
  onReset:      () => void
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span aria-hidden className="text-lg flex-shrink-0">
        {category.icon ?? '📎'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{category.name}</p>
        <p className="text-[11px] text-white/45 tabular-nums">
          {formatCurrency(category.total)} este mês
          {isOverridden && <span className="ml-1 text-emerald-300">· recategorizado</span>}
        </p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1">
        {(['needs', 'wants', 'savings'] as const).map(b => {
          const active = category.bucket === b
          const colors = BUCKET_COLORS[b]
          return (
            <button
              key={b}
              type="button"
              onClick={() => onChange(b)}
              aria-label={`Mover ${category.name} para ${BUCKET_LABELS[b]}`}
              aria-pressed={active}
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg border transition-all min-h-[32px] ${
                active
                  ? `${colors.border} ${colors.bg} ${colors.text}`
                  : 'border-white/10 bg-white/3 text-white/50 hover:text-white'
              }`}
            >
              {b === 'needs' ? 'Need' : b === 'wants' ? 'Want' : 'Save'}
            </button>
          )
        })}
        {isOverridden && (
          <button
            type="button"
            onClick={onReset}
            aria-label="Voltar à categorização automática"
            title="Voltar ao automático"
            className="text-white/40 hover:text-white min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}
