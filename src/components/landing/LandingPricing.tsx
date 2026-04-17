import Link from 'next/link'
import { Check } from 'lucide-react'

/**
 * LandingPricing — 3 tiers with honest feature claims.
 *
 * Cleanup vs previous version:
 *   - Removed "API access" from Pro (we don't expose an API).
 *   - Removed "Voltix evoluído" language — every plan has the full mascot
 *     since we gate evolutions by score, not by plan.
 *   - Added actual Pro/Family differentiators that match the code
 *     (simulator investimento, relatório PDF, modo família).
 *
 * Keep prices hard-coded here + in settings/billing/BillingClient.tsx. This
 * is the "marketing copy" source, that one is the "checkout source". If
 * they drift, the one that appears in the Stripe session is the truth.
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
      'Score financeiro + histórico básico',
      'Voltix OU Penny (evolução completa)',
      'XP, níveis e 3 missões/semana',
      '1 objetivo de poupança',
      'Acesso à Academia (1 curso)',
    ],
    note: 'Tem anúncios discretos.',
  },
  {
    tier:    'PLUS',
    price:   '€2,99',
    period:  '/mês · €24,99/ano',
    savings: 'Poupa 30% no anual',
    cta:     'Experimentar Plus',
    ctaHref: '/sign-up',
    ctaVariant: 'primary' as const,
    badge:   'MAIS POPULAR',
    features: [
      'Tudo do Grátis, sem anúncios',
      'Missões ilimitadas + badges exclusivos',
      'Categorias e objetivos ilimitados',
      'Scan de recibos com IA',
      'Import de extratos (PDF / CSV)',
      'Academia completa (todos os cursos)',
      'Relatório mensal em PDF',
    ],
  },
  {
    tier:    'PRO',
    price:   '€5,99',
    period:  '/mês · €49,99/ano',
    savings: 'Poupa 30% no anual',
    cta:     'Começar Pro',
    ctaHref: '/sign-up',
    ctaVariant: 'pro' as const,
    features: [
      'Tudo do Plus',
      'Simulador de investimento (DCA)',
      'Modo família (partilha até 4 pessoas)',
      'Voltix E Penny em simultâneo',
      'Certificado NFT dos cursos',
      'Suporte prioritário em < 4h',
      'Acesso antecipado a novas features',
    ],
  },
]

export function LandingPricing() {
  return (
    <section id="precos" className="px-6 py-24 max-w-6xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">Preço</p>
        <h2 className="text-4xl md:text-5xl font-bold">Começa grátis. Paga quando fizer sentido.</h2>
        <p className="text-white/55 text-lg mt-4 max-w-xl mx-auto">
          Sem preços-armadilha. Sem letra pequena. Cancelas a qualquer momento.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {PLANS.map(p => {
          const isPrimary = p.ctaVariant === 'primary'
          const isPro     = p.ctaVariant === 'pro'

          return (
            <div
              key={p.tier}
              className={`relative rounded-2xl p-6 flex flex-col ${
                isPrimary
                  ? 'border-2 border-green-500/50 bg-gradient-to-b from-green-500/10 to-transparent shadow-[0_12px_40px_-15px_rgba(34,197,94,0.4)]'
                  : isPro
                  ? 'border border-purple-500/30 bg-gradient-to-b from-purple-500/5 to-transparent'
                  : 'border border-white/10 bg-white/[0.03]'
              }`}
            >
              {p.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
                  {p.badge}
                </span>
              )}

              <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                isPrimary ? 'text-green-400' : isPro ? 'text-purple-400' : 'text-white/50'
              }`}>
                {p.tier}
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-white">{p.price}</span>
              </div>
              <div className="text-sm text-white/50 mb-1">{p.period}</div>
              {p.savings && (
                <div className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5 self-start mb-5">
                  {p.savings}
                </div>
              )}
              {!p.savings && <div className="mb-5" />}

              <ul className="space-y-2.5 text-sm text-white/70 mb-6 flex-1">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      isPrimary ? 'text-green-400' : isPro ? 'text-purple-400' : 'text-white/60'
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
                    ? 'bg-green-500 hover:bg-green-400 text-black'
                    : isPro
                    ? 'border border-purple-500/40 hover:border-purple-500/70 hover:bg-purple-500/10 text-white'
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
