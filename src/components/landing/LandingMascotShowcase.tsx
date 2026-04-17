import Image from 'next/image'

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
const EVO_LABELS: Record<number, string> = {
  1: 'Ovo',
  2: 'Bebé',
  3: 'Jovem',
  4: 'Adulto',
  5: 'Elite',
  6: 'Lendário',
}

function EvoRow({ gender, name, tagline, accent }: {
  gender:  'voltix' | 'penny'
  name:    string
  tagline: string
  accent:  string
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
        <div>
          <h3 className="text-2xl font-bold text-white">{name}</h3>
          <p className="text-sm text-white/55">{tagline}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${accent}`}>
          6 evoluções
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {EVOS.map(evo => (
          <div key={evo} className="text-center">
            <div className="relative w-full aspect-square bg-gradient-to-b from-white/5 to-transparent rounded-xl flex items-center justify-center border border-white/5 overflow-hidden mb-1.5">
              <Image
                src={`/mascot/${gender}/${evo}.webp`}
                alt={`${name} evolução ${evo} — ${EVO_LABELS[evo]}`}
                width={96}
                height={96}
                className="w-full h-full object-contain p-1.5"
              />
            </div>
            <p className="text-[9px] font-semibold text-white/45 uppercase tracking-wider">
              {EVO_LABELS[evo]}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LandingMascotShowcase() {
  return (
    <section className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-yellow-400 font-semibold text-sm uppercase tracking-widest mb-2">O que nos faz diferentes</p>
        <h2 className="text-4xl md:text-5xl font-bold">
          Escolhe o teu mascote.<br className="hidden sm:block" /> Ele cresce contigo.
        </h2>
        <p className="text-white/55 text-lg mt-4 max-w-2xl mx-auto">
          Começas no ovo. Cada melhoria do teu score financeiro evolui o teu mascote —
          e ele reage em tempo real: feliz quando poupas, triste quando gastas demais,
          eufórico em streaks de 7 dias.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <EvoRow
          gender="voltix"
          name="Voltix"
          tagline="Dragão-trovão · o guardião do teu cofre"
          accent="text-yellow-400"
        />
        <EvoRow
          gender="penny"
          name="Penny"
          tagline="Gata-anjo · a protetora dos teus objetivos"
          accent="text-pink-400"
        />
      </div>

      <p className="text-center text-xs text-white/40 mt-6">
        Todas as 12 formas desbloqueáveis a partir do plano gratuito.
      </p>
    </section>
  )
}
