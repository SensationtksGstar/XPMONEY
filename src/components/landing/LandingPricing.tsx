import Link from 'next/link'
import { Check } from 'lucide-react'

/**
 * LandingPricing — marketing version, 2 tiers (Free + Premium).
 *
 * A versão anterior tinha 3 tiers (Free/Plus/Pro). Foi colapsada em Abril 2026
 * para reduzir fricção de decisão: utilizadores convertem mais com uma
 * comparação binária do que a tentar perceber o que separa Plus de Pro.
 *
 * Mantém preços sincronizados com `settings/billing/BillingClient.tsx`. Se
 * divergirem, a fonte de verdade é o que o Stripe checkout cobra — este
 * ficheiro serve só de copy de marketing.
 */

const PLANS = [
  {
    tier:    'GRÁTIS',
    price:   '€0',
    period:  'para sempre',
    cta:     'Começar grátis',
    ctaHref: '/sign-up',
    ctaVariant: 'ghost' as const,
    features: [
      'Registo de transações ilimitado',
      'Score financeiro + histórico',
      'Mascote à escolha — Voltix ou Penny (6 evoluções)',
      'XP, níveis e missões do plano grátis',
      '2 objetivos de poupança',
      'Cursos iniciais da Academia',
    ],
    note: 'Tem anúncios discretos e não-intrusivos.',
  },
  {
    tier:    'PREMIUM',
    price:   '€4,99',
    period:  '/mês · €39,99/ano',
    savings: 'Poupa 33% no anual',
    cta:     'Experimentar Premium',
    ctaHref: '/sign-up?plan=premium',
    ctaVariant: 'primary' as const,
    badge:   'TUDO INCLUÍDO',
    features: [
      'Tudo do Grátis, sem anúncios',
      'Missões e badges exclusivos',
      'Categorias e objetivos ilimitados',
      'Scan de recibos com IA',
      'Import de extratos (PDF / CSV)',
      'Simulador de investimento (DCA)',
      'Perspetiva de Riqueza (projeção patrimonial)',
      'Relatório financeiro em PDF',
      'Academia completa — todos os cursos',
      'Suporte prioritário · acesso antecipado',
    ],
  },
]

export function LandingPricing() {
  return (
    <section id="precos" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-purple-400 font-semibold text-sm uppercase tracking-widest mb-2">Preço</p>
        <h2 className="text-4xl md:text-5xl font-bold">Começa grátis. Desbloqueia tudo por €4,99/mês.</h2>
        <p className="text-white/55 text-lg mt-4 max-w-xl mx-auto">
          Sem preços-armadilha. Sem letra pequena. Um único plano pago com tudo incluído.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
        {PLANS.map(p => {
          const isPrimary = p.ctaVariant === 'primary'

          return (
            <div
              key={p.tier}
              className={`relative rounded-2xl p-6 flex flex-col ${
                isPrimary
                  ? 'border-2 border-purple-500/50 bg-gradient-to-b from-purple-500/10 to-transparent shadow-[0_12px_40px_-15px_rgba(168,85,247,0.4)]'
                  : 'border border-white/10 bg-white/[0.03]'
              }`}
            >
              {p.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
                  {p.badge}
                </span>
              )}

              <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                isPrimary ? 'text-purple-400' : 'text-white/50'
              }`}>
                {p.tier}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-white">{p.price}</span>
              </div>
              <div className="text-sm text-white/50 mb-1">{p.period}</div>
              {p.savings && (
                <div className="text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-full px-2 py-0.5 self-start mb-5">
                  {p.savings}
                </div>
              )}
              {!p.savings && <div className="mb-5" />}

              <ul className="space-y-2.5 text-sm text-white/70 mb-6 flex-1">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      isPrimary ? 'text-purple-400' : 'text-white/60'
                    }`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {p.note && (
                <p className="text-[10px] text-white/35 mb-3 italic">{p.note}</p>
              )}

              <Link
                href={p.ctaHref}
                className={`block text-center font-bold py-3 rounded-xl text-sm transition-all ${
                  isPrimary
                    ? 'bg-purple-500 hover:bg-purple-400 text-white'
                    : 'border border-white/20 hover:border-white/40 text-white hover:bg-white/5'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-white/40 mt-8">
        Preços em EUR · IVA incluído · Pagamento seguro via Stripe
      </p>
    </section>
  )
}
