import { getServerT } from '@/lib/i18n/server'

/**
 * LandingHowItWorks — 3-step "what do I do first" section.
 *
 * Users bounce from SaaS pages when they can't picture the first 30 seconds.
 * Three numbered steps short-circuit that: read → understand → "ah I just
 * type in what I spent, got it". Each step has a concrete verb + outcome,
 * not product jargon.
 */

export async function LandingHowItWorks() {
  const t = await getServerT()

  const STEPS = [
    {
      num:   '1',
      title: t('landing.how.step1_title'),
      desc:  t('landing.how.step1_desc'),
      pill:  t('landing.how.step1_pill'),
    },
    {
      num:   '2',
      title: t('landing.how.step2_title'),
      desc:  t('landing.how.step2_desc'),
      pill:  t('landing.how.step2_pill'),
    },
    {
      num:   '3',
      title: t('landing.how.step3_title'),
      desc:  t('landing.how.step3_desc'),
      pill:  t('landing.how.step3_pill'),
    },
  ]

  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">{t('landing.how.eyebrow')}</p>
        <h2 className="text-4xl md:text-5xl font-bold">{t('landing.how.title')}</h2>
        <p className="text-white/55 text-lg mt-4 max-w-xl mx-auto">
          {t('landing.how.subtitle')}
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
