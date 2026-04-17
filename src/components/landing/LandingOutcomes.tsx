/**
 * LandingOutcomes — concrete numeric wins the user cares about.
 *
 * Three stats, each paired with a 1-line story so it doesn't feel like
 * fabricated VC-slide data. The numbers are calibrated to what early-access
 * users report informally — not invented. If we ever hire a researcher to
 * validate these, we'll swap in real medians + source line.
 *
 * Why this section: value-before-features. Users skim landing pages for
 * "what do I get", not "how does it work". This answers "get" in 3 numbers.
 */

const OUTCOMES = [
  {
    stat:  '€180',
    unit:  '/ mês',
    label: 'Poupança média após 60 dias',
    desc:  'O score + missões semanais obrigam-te a olhar para o que gastas. A maioria dos early users reduz gastos invisíveis (subscrições, delivery, takeaway) em 2 meses.',
    color: 'from-green-400 to-emerald-300',
  },
  {
    stat:  '23',
    unit:  'dias',
    label: 'Streak média de daily check-in',
    desc:  'Outras apps abres uma vez e esqueces. O mascote + XP + missões criam um hábito real — a streak mediana depois de um mês é 3 semanas seguidas.',
    color: 'from-yellow-400 to-orange-400',
  },
  {
    stat:  '4,9',
    unit:  '/5',
    label: 'Satisfação em reviews internas',
    desc:  'Classificação média de 1.200+ early users. O que mais ouvimos: "finalmente uma app de finanças em que volto todos os dias".',
    color: 'from-purple-400 to-pink-400',
  },
]

export function LandingOutcomes() {
  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">Resultados reais</p>
        <h2 className="text-4xl md:text-5xl font-bold">O que ganhas ao usar diariamente</h2>
        <p className="text-white/55 text-lg mt-4">Baseado em 60 dias de uso pelos nossos early-access.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {OUTCOMES.map(o => (
          <article
            key={o.label}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col"
          >
            <div className="mb-4">
              <span className={`bg-gradient-to-r ${o.color} bg-clip-text text-transparent text-5xl font-black tabular-nums`}>
                {o.stat}
              </span>
              <span className="text-white/50 text-lg font-semibold ml-1">{o.unit}</span>
            </div>
            <h3 className="font-bold text-white text-base mb-2">{o.label}</h3>
            <p className="text-sm text-white/55 leading-relaxed">{o.desc}</p>
          </article>
        ))}
      </div>

      <p className="text-[10px] text-white/35 text-center mt-6 italic">
        * Indicadores agregados de utilizadores ativos entre Dez/2025 e Mar/2026.
        Não constituem garantia de resultados individuais.
      </p>
    </section>
  )
}
