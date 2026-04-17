import { Check, X, Minus } from 'lucide-react'

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

const ROWS: { feature: string; xp: Cell; excel: Cell; generic: Cell; note?: string }[] = [
  { feature: 'Registo manual rápido (< 30s)',        xp: 'yes', excel: 'partial', generic: 'yes' },
  { feature: 'Scan de recibos por IA',                xp: 'yes', excel: 'no',      generic: 'partial' },
  { feature: 'Import de extratos bancários (PDF)',   xp: 'yes', excel: 'no',      generic: 'partial' },
  { feature: 'Score financeiro único 0-100',         xp: 'yes', excel: 'no',      generic: 'no' },
  { feature: 'Gamificação (XP, missões, badges)',    xp: 'yes', excel: 'no',      generic: 'no' },
  { feature: 'Mascote que reage ao comportamento',   xp: 'yes', excel: 'no',      generic: 'no' },
  { feature: 'Cursos + certificado digital',         xp: 'yes', excel: 'no',      generic: 'no' },
  { feature: 'Categorias PT + IVA PT',               xp: 'yes', excel: 'partial', generic: 'partial' },
  { feature: 'Relatório PDF mensal',                 xp: 'yes', excel: 'partial', generic: 'partial' },
  { feature: 'Funciona offline (PWA)',               xp: 'yes', excel: 'yes',     generic: 'partial' },
  { feature: 'Sem ligação ao banco obrigatória',     xp: 'yes', excel: 'yes',     generic: 'no' },
]

function Mark({ v }: { v: Cell }) {
  if (v === 'yes')     return <Check className="w-4 h-4 text-green-400 mx-auto" />
  if (v === 'no')      return <X     className="w-4 h-4 text-white/25 mx-auto" />
  return <Minus className="w-4 h-4 text-yellow-400/70 mx-auto" />
}

export function LandingComparison() {
  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-purple-400 font-semibold text-sm uppercase tracking-widest mb-2">Comparar</p>
        <h2 className="text-4xl md:text-5xl font-bold">Porquê não outra app?</h2>
        <p className="text-white/55 text-lg mt-4 max-w-xl mx-auto">
          Somos honestos: para tudo o que é bancário, usa o teu banco. Nós fazemos o que eles nunca vão fazer.
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-4 text-white/55 font-medium w-[40%]">Funcionalidade</th>
                <th className="px-3 py-4 text-center min-w-[110px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                    <span className="font-bold text-white">XP Money</span>
                  </div>
                </th>
                <th className="px-3 py-4 text-center text-white/60 min-w-[100px] font-medium">Excel / Sheets</th>
                <th className="px-3 py-4 text-center text-white/60 min-w-[130px] font-medium">Apps de banco genéricas</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr
                  key={r.feature}
                  className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.015]' : ''}`}
                >
                  <td className="px-5 py-3 text-white/85">{r.feature}</td>
                  <td className="px-3 py-3"><Mark v={r.xp} /></td>
                  <td className="px-3 py-3"><Mark v={r.excel} /></td>
                  <td className="px-3 py-3"><Mark v={r.generic} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-center gap-5 text-[10px] text-white/40 py-3 border-t border-white/5 flex-wrap">
          <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-400" /> Incluído</span>
          <span className="flex items-center gap-1.5"><Minus className="w-3 h-3 text-yellow-400/70" /> Parcial</span>
          <span className="flex items-center gap-1.5"><X className="w-3 h-3 text-white/25" /> Não disponível</span>
        </div>
      </div>
    </section>
  )
}
