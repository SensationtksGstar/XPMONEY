/**
 * LandingHowItWorks — 3-step "what do I do first" section.
 *
 * Users bounce from SaaS pages when they can't picture the first 30 seconds.
 * Three numbered steps short-circuit that: read → understand → "ah I just
 * type in what I spent, got it". Each step has a concrete verb + outcome,
 * not product jargon.
 */

const STEPS = [
  {
    num:   '1',
    title: 'Regista as tuas transações',
    desc:  'Adiciona à mão em 5 segundos, tira foto ao recibo ou importa o extrato do banco em PDF. A IA categoriza por ti.',
    pill:  'Em < 30s por dia',
  },
  {
    num:   '2',
    title: 'Vê o teu score subir',
    desc:  'Um número de 0 a 100 que resume a tua saúde financeira. Missões semanais dizem-te exatamente o que mudar para subir.',
    pill:  'Feedback instantâneo',
  },
  {
    num:   '3',
    title: 'Evolui o teu mascote',
    desc:  'Voltix ou Penny crescem contigo — do ovo à forma lendária. Ganhas XP, desbloqueias badges, fazes streaks. Poupar vira hábito.',
    pill:  '6 evoluções · 12 badges',
  },
]

export function LandingHowItWorks() {
  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">Como funciona</p>
        <h2 className="text-4xl md:text-5xl font-bold">Três passos. Zero complicação.</h2>
        <p className="text-white/55 text-lg mt-4 max-w-xl mx-auto">
          A primeira vez que abres a app, sabes exatamente o que fazer.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 relative">
        {/* Decorative line behind desktop */}
        <div
          aria-hidden
          className="hidden md:block absolute top-6 left-[16.66%] right-[16.66%] h-px bg-gradient-to-r from-green-500/0 via-green-500/30 to-green-500/0"
        />

        {STEPS.map((s) => (
          <article
            key={s.num}
            className="relative bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col hover:border-green-500/30 transition-colors"
          >
            <div className="relative z-10 w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-black font-bold text-xl flex items-center justify-center mb-4 shadow-[0_4px_14px_rgba(34,197,94,0.4)]">
              {s.num}
            </div>
            <h3 className="font-bold text-lg mb-2 text-white">{s.title}</h3>
            <p className="text-sm text-white/60 leading-relaxed mb-4 flex-1">{s.desc}</p>
            <span className="inline-block text-[10px] font-semibold text-green-300 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full self-start">
              {s.pill}
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}
