import { getServerT } from '@/lib/i18n/server'

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

export async function LandingOutcomes() {
  const t = await getServerT()

  const OUTCOMES = [
    {
      stat:  t('landing.outcomes.o1_stat'),
      unit:  t('landing.outcomes.o1_unit'),
      label: t('landing.outcomes.o1_label'),
      desc:  t('landing.outcomes.o1_desc'),
      color: 'from-green-400 to-emerald-300',
    },
    {
      stat:  t('landing.outcomes.o2_stat'),
      unit:  t('landing.outcomes.o2_unit'),
      label: t('landing.outcomes.o2_label'),
      desc:  t('landing.outcomes.o2_desc'),
      color: 'from-yellow-400 to-orange-400',
    },
    {
      stat:  t('landing.outcomes.o3_stat'),
      unit:  t('landing.outcomes.o3_unit'),
      label: t('landing.outcomes.o3_label'),
      desc:  t('landing.outcomes.o3_desc'),
      color: 'from-purple-400 to-pink-400',
    },
  ]

  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">{t('landing.outcomes.eyebrow')}</p>
        <h2 className="text-4xl md:text-5xl font-bold">{t('landing.outcomes.title')}</h2>
        <p className="text-white/55 text-lg mt-4">{t('landing.outcomes.subtitle')}</p>
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
        {t('landing.outcomes.footnote')}
      </p>
    </section>
  )
}
