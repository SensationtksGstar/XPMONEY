import { Check, X, Minus } from 'lucide-react'
import { getServerT } from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * LandingComparison — side-by-side with alternatives the prospect is
 * actually considering.
 *
 * Keeps it honest: we only flex on dimensions we really win (gamification,
 * PT-specific features, PDF export, mascot). We don't claim to replace a
 * bank or a full Open Banking aggregator — that's Revolut's turf.
 *
 * Dimensions chosen to match what a Portuguese user googles when they think
 * "finance app": manual entry vs Excel, visual feedback, PT categories,
 * etc. Avoids fake "faster than X" claims that don't mean anything.
 */

type Cell = 'yes' | 'no' | 'partial'

const ROWS: { key: TranslationKey; xp: Cell; excel: Cell; generic: Cell }[] = [
  { key: 'landing.cmp.r1',  xp: 'yes', excel: 'partial', generic: 'yes' },
  { key: 'landing.cmp.r2',  xp: 'yes', excel: 'no',      generic: 'partial' },
  { key: 'landing.cmp.r3',  xp: 'yes', excel: 'no',      generic: 'partial' },
  { key: 'landing.cmp.r4',  xp: 'yes', excel: 'no',      generic: 'no' },
  { key: 'landing.cmp.r5',  xp: 'yes', excel: 'no',      generic: 'no' },
  { key: 'landing.cmp.r6',  xp: 'yes', excel: 'no',      generic: 'no' },
  // Orçamento 50/30/20 + alertas — Excel needs heavy formulas (partial),
  // generic apps usually offer total budget but not bucket discipline.
  { key: 'landing.cmp.r12', xp: 'yes', excel: 'partial', generic: 'partial' },
  // Mata-Dívidas avalanche/snowball — neither Excel nor generic apps
  // ship the planner out-of-the-box; you'd build it yourself.
  { key: 'landing.cmp.r13', xp: 'yes', excel: 'no',      generic: 'no' },
  { key: 'landing.cmp.r7',  xp: 'yes', excel: 'no',      generic: 'no' },
  { key: 'landing.cmp.r8',  xp: 'yes', excel: 'partial', generic: 'partial' },
  { key: 'landing.cmp.r9',  xp: 'yes', excel: 'partial', generic: 'partial' },
  { key: 'landing.cmp.r10', xp: 'yes', excel: 'yes',     generic: 'partial' },
  { key: 'landing.cmp.r11', xp: 'yes', excel: 'yes',     generic: 'no' },
]

function Mark({ v }: { v: Cell }) {
  if (v === 'yes')     return <Check className="w-4 h-4 text-green-400 mx-auto" />
  if (v === 'no')      return <X     className="w-4 h-4 text-white/25 mx-auto" />
  return <Minus className="w-4 h-4 text-yellow-400/70 mx-auto" />
}

export async function LandingComparison() {
  const t = await getServerT()

  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-purple-400 font-semibold text-sm uppercase tracking-widest mb-2">{t('landing.cmp.eyebrow')}</p>
        <h2 className="text-4xl md:text-5xl font-bold">{t('landing.cmp.title')}</h2>
        <p className="text-white/55 text-lg mt-4 max-w-xl mx-auto">
          {t('landing.cmp.subtitle')}
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-4 text-white/55 font-medium w-[40%]">{t('landing.cmp.col_feature')}</th>
                <th className="px-3 py-4 text-center min-w-[110px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                    <span className="font-bold text-white">{t('landing.cmp.col_xp')}</span>
                  </div>
                </th>
                <th className="px-3 py-4 text-center text-white/60 min-w-[100px] font-medium">{t('landing.cmp.col_excel')}</th>
                <th className="px-3 py-4 text-center text-white/60 min-w-[130px] font-medium">{t('landing.cmp.col_generic')}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr
                  key={r.key}
                  className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.015]' : ''}`}
                >
                  <td className="px-5 py-3 text-white/85">{t(r.key)}</td>
                  <td className="px-3 py-3"><Mark v={r.xp} /></td>
                  <td className="px-3 py-3"><Mark v={r.excel} /></td>
                  <td className="px-3 py-3"><Mark v={r.generic} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-5 text-[10px] text-white/40 py-3 border-t border-white/5 flex-wrap">
          <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-400" /> {t('landing.cmp.legend_yes')}</span>
          <span className="flex items-center gap-1.5"><Minus className="w-3 h-3 text-yellow-400/70" /> {t('landing.cmp.legend_part')}</span>
          <span className="flex items-center gap-1.5"><X className="w-3 h-3 text-white/25" /> {t('landing.cmp.legend_no')}</span>
        </div>
      </div>
    </section>
  )
}
