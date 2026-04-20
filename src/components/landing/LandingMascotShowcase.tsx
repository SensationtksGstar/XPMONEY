import Image from 'next/image'
import { getServerT } from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * LandingMascotShowcase — the "wow" moment: shows the 6 evolutions side by
 * side for both Voltix and Penny so prospects see that the gamification is
 * not cosmetic — there's real art, real progression, real choice.
 *
 * This is the biggest differentiator vs competitors (YNAB, Linxo, Revolut
 * budgets) — none of them have a character that evolves with the user's
 * financial health. Giving it its own section sells that.
 *
 * Rendering: we reuse the same `/mascot/<gender>/<n>.webp` assets the app
 * uses, at smaller size. No interactivity — server component.
 */

const EVOS = [1, 2, 3, 4, 5, 6]
const EVO_LABEL_KEYS: Record<number, TranslationKey> = {
  1: 'landing.mascot.evo_1',
  2: 'landing.mascot.evo_2',
  3: 'landing.mascot.evo_3',
  4: 'landing.mascot.evo_4',
  5: 'landing.mascot.evo_5',
  6: 'landing.mascot.evo_6',
}

function EvoRow({
  gender, name, tagline, accent, t,
}: {
  gender:  'voltix' | 'penny'
  name:    string
  tagline: string
  accent:  string
  t:       (key: TranslationKey, vars?: Record<string, string | number>) => string
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
        <div>
          <h3 className="text-2xl font-bold text-white">{name}</h3>
          <p className="text-sm text-white/55">{tagline}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${accent}`}>
          {t('landing.mascot.evo_count')}
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {EVOS.map(evo => {
          const label = t(EVO_LABEL_KEYS[evo])
          return (
            <div key={evo} className="text-center">
              <div className="relative w-full aspect-square bg-gradient-to-b from-white/5 to-transparent rounded-xl flex items-center justify-center border border-white/5 overflow-hidden mb-1.5">
                <Image
                  src={`/mascot/${gender}/${evo}.webp`}
                  alt={t('landing.mascot.evo_alt', { name, evo, label })}
                  width={96}
                  height={96}
                  className="w-full h-full object-contain p-1.5"
                />
              </div>
              <p className="text-[9px] font-semibold text-white/45 uppercase tracking-wider">
                {label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export async function LandingMascotShowcase() {
  const t = await getServerT()

  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-yellow-400 font-semibold text-sm uppercase tracking-widest mb-2">{t('landing.mascot.eyebrow')}</p>
        <h2 className="text-4xl md:text-5xl font-bold">
          {t('landing.mascot.title_l1')}<br className="hidden sm:block" /> {t('landing.mascot.title_l2')}
        </h2>
        <p className="text-white/55 text-lg mt-4 max-w-2xl mx-auto">
          {t('landing.mascot.subtitle')}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <EvoRow
          gender="voltix"
          name={t('landing.mascot.voltix_name')}
          tagline={t('landing.mascot.voltix_tag')}
          accent="text-yellow-400"
          t={t}
        />
        <EvoRow
          gender="penny"
          name={t('landing.mascot.penny_name')}
          tagline={t('landing.mascot.penny_tag')}
          accent="text-pink-400"
          t={t}
        />
      </div>

      <p className="text-center text-xs text-white/40 mt-6">
        {t('landing.mascot.footer')}
      </p>
    </section>
  )
}
