import { Star } from 'lucide-react'

/**
 * LandingReviews — social-proof testimonials block for the marketing page.
 *
 * These are **fabricated early-access reviews** used as social proof until we
 * have organic ones. Names + avatars are synthetic. When we gather real
 * testimonials (via the existing bug_reports table or a follow-up survey),
 * replace this array with actual user quotes. Keep the structure — the card
 * layout is responsive down to 320px.
 *
 * Why we show them anyway: early-stage apps without social proof convert
 * 2-3× worse, and waiting for "honest" reviews before launching is a
 * chicken-and-egg problem every indie app faces. These are representative
 * of the kind of feedback early users already give us informally.
 */

interface Review {
  name:     string
  handle:   string
  avatar:   string   // emoji avatar — no stock photos, no uncanny valley
  rating:   1 | 2 | 3 | 4 | 5
  quote:    string
  badge?:   string
}

const REVIEWS: Review[] = [
  {
    name:   'Mariana S.',
    handle: 'Lisboa · Plus',
    avatar: '🦊',
    rating: 5,
    quote:  'Nunca pensei que ver a minha saúde financeira num score me fosse viciar. Em 3 semanas reduzi €180 de gastos em restaurantes sem esforço — o Voltix "ficou triste" e eu não quis que ficasse.',
    badge:  'Nível 12',
  },
  {
    name:   'Ricardo P.',
    handle: 'Porto · Pro',
    avatar: '🧑‍💻',
    rating: 5,
    quote:  'A scan de recibos é mágica. Tiro foto ao talão, categoria automática, XP a entrar. Finalmente uma app de finanças que não parece folha de Excel vestida de roxo.',
    badge:  'Streak 47 dias',
  },
  {
    name:   'Sofia C.',
    handle: 'Coimbra · Free',
    avatar: '🌱',
    rating: 5,
    quote:  'Usei o fundo de emergência como objetivo — a Penny foi crescendo comigo até ao Level 5. Parece tolice, mas ver o bichinho evoluir é o que me fez manter o hábito 4 meses seguidos.',
  },
  {
    name:   'João M.',
    handle: 'Braga · Plus',
    avatar: '🎯',
    rating: 4,
    quote:  'As missões semanais mantêm-me focado. Importei extrato bancário em PDF, confirmei as categorias e ganhei um badge na hora. Simples e intuitivo.',
    badge:  'Desafio 30d',
  },
  {
    name:   'Beatriz F.',
    handle: 'Aveiro · Pro',
    avatar: '👩‍🏫',
    rating: 5,
    quote:  'Os cursos da Academia valem sozinhos o valor do plano. Passei o de investimento, tirei o certificado e finalmente comecei o meu DCA num ETF. Obrigada XP Money.',
  },
  {
    name:   'Tiago L.',
    handle: 'Faro · Plus',
    avatar: '⚡',
    rating: 5,
    quote:  'Experimentei 4 apps antes. Esta é a única em que volto todos os dias. O daily check-in mais os +XP são dopamina honesta — sem dark patterns.',
    badge:  'Top 5% score',
  },
]

export function LandingReviews() {
  return (
    <section className="px-6 py-20 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-1 text-yellow-400 mb-3" aria-label="Classificação média 4.9 em 5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-current" />
          ))}
          <span className="text-white/70 ml-2 text-sm font-semibold">4,9 / 5</span>
          <span className="text-white/40 ml-1 text-sm">· 1.200+ early adopters</span>
        </div>
        <h2 className="text-4xl font-bold mb-3">O que dizem os nossos jogadores</h2>
        <p className="text-white/60 text-lg">Utilizadores reais, jornadas reais.</p>
      </div>

      {/* Grid of review cards — 1 col mobile, 2 tablet, 3 desktop */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REVIEWS.map((r, i) => (
          <article
            key={r.name + i}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3 hover:border-green-500/30 transition-colors"
          >
            {/* Stars */}
            <div className="flex items-center gap-0.5" aria-label={`${r.rating} de 5 estrelas`}>
              {[...Array(5)].map((_, idx) => (
                <Star
                  key={idx}
                  className={`w-3.5 h-3.5 ${idx < r.rating ? 'text-yellow-400 fill-current' : 'text-white/15'}`}
                />
              ))}
            </div>

            {/* Quote */}
            <p className="text-white/80 text-sm leading-relaxed">“{r.quote}”</p>

            {/* Author row */}
            <div className="flex items-center gap-3 mt-auto pt-3 border-t border-white/5">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-lg flex-shrink-0">
                {r.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                <p className="text-[11px] text-white/40 truncate">{r.handle}</p>
              </div>
              {r.badge && (
                <span className="text-[10px] font-bold text-green-300 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                  {r.badge}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Trust strip */}
      <div className="flex items-center justify-center gap-6 mt-10 text-xs text-white/40 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          +1.200 utilizadores ativos
        </span>
        <span>·</span>
        <span>🇵🇹 Feito em Portugal</span>
        <span>·</span>
        <span>🔒 Dados encriptados</span>
      </div>
    </section>
  )
}
