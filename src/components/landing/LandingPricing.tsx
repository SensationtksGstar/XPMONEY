'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, Sparkles, Award } from 'lucide-react'

/**
 * LandingPricing — 2-tier (Free + Premium), with billing-period toggle.
 *
 * April 2026 rework: the older server-component version had monthly and
 * annual jammed into a single string ("€4,99 /mês · €39,99/ano"), which
 * blurred the savings signal. Visitors saw "€4,99" and anchored there,
 * missing that the annual works out to €3,33/mês — a 33% discount.
 *
 * New UX:
 *   - Monthly / Anual toggle at the top, anual selected by default
 *     because it is the option we want to convert toward.
 *   - When "Anual" is on, Premium shows €3,33/mês with €39,99/ano
 *     beneath it, a "POUPA 33%" chip and the NFT certificate bullet
 *     highlighted in rose so the eye doesn't miss it.
 *   - Each CTA passes `period=yearly|monthly` so billing page can pre-
 *     select the right plan. The query params are a no-op if the billing
 *     page doesn't read them — zero regression cost.
 *
 * Client component because of the toggle state. Keeping it small: no
 * Stripe calls here, just anchors. Pricing source-of-truth lives in
 * settings/billing/BillingClient.tsx and env vars.
 */

type Period = 'monthly' | 'yearly'

const PREMIUM_FEATURES = [
  { text: 'Tudo do Grátis, sem anúncios' },
  { text: 'Scanner de recibos com IA' },
  { text: 'Import de extratos (PDF / CSV)' },
  { text: 'Simulador de investimento (DCA)' },
  { text: 'Perspetiva de Riqueza · horas de trabalho' },
  { text: 'Relatório financeiro em PDF' },
  { text: 'Academia completa · todos os cursos' },
  { text: 'Categorias e objetivos ilimitados' },
  { text: 'Missões e badges exclusivos' },
  { text: 'Certificado NFT ao chegar à 6ª evolução', highlight: true },
  { text: 'Suporte prioritário · acesso antecipado' },
] as const

const FREE_FEATURES = [
  'Registo de transações ilimitado',
  'Score financeiro + histórico',
  'Mascote à escolha — Voltix ou Penny (6 evoluções)',
  'XP, níveis e missões do plano grátis',
  '2 objetivos de poupança',
  'Cursos iniciais da Academia',
] as const

export function LandingPricing() {
  const [period, setPeriod] = useState<Period>('yearly')

  const monthlyPrice = period === 'yearly' ? '€3,33' : '€4,99'
  const billedCopy   = period === 'yearly'
    ? 'Cobrado €39,99/ano · poupas €20/ano'
    : 'Cobrado €4,99/mês · cancelas quando quiseres'
  const ctaHref  = `/sign-up?plan=premium&period=${period}`
  const ctaLabel = period === 'yearly' ? 'Quero o anual · €3,33/mês' : 'Experimentar mensal · €4,99'

  return (
    <section id="precos" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <p className="text-purple-400 font-semibold text-sm uppercase tracking-widest mb-2">Preço</p>
        <h2 className="text-4xl md:text-5xl font-bold leading-[1.1]">
          Começa grátis. Desbloqueia tudo por{' '}
          <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
            €3,33/mês
          </span>
          .
        </h2>
        <p className="text-white/55 text-lg mt-4 max-w-xl mx-auto">
          Sem preços-armadilha. Sem letra pequena. Um único plano pago com tudo incluído.
        </p>
      </div>

      {/* Billing period toggle */}
      <div className="flex items-center justify-center mb-10">
        <div
          role="tablist"
          aria-label="Escolher período de faturação"
          className="inline-flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10"
        >
          <button
            type="button"
            role="tab"
            aria-selected={period === 'monthly'}
            onClick={() => setPeriod('monthly')}
            className={`min-h-[40px] px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              period === 'monthly'
                ? 'bg-white text-black shadow'
                : 'text-white/65 hover:text-white'
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'yearly'}
            onClick={() => setPeriod('yearly')}
            className={`relative min-h-[40px] px-5 py-2 rounded-full text-sm font-semibold transition-all ${
              period === 'yearly'
                ? 'bg-gradient-to-r from-purple-500 to-purple-400 text-white shadow-[0_6px_20px_-6px_rgba(168,85,247,0.6)]'
                : 'text-white/65 hover:text-white'
            }`}
          >
            Anual
            <span className="ml-2 inline-flex items-center gap-0.5 bg-emerald-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide">
              -33%
            </span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
        {/* ── FREE ─────────────────────────────────────────────────── */}
        <div className="relative rounded-2xl p-6 flex flex-col border border-white/10 bg-white/[0.03]">
          <div className="text-xs font-bold uppercase tracking-widest mb-3 text-white/50">
            Grátis
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-4xl font-bold text-white">€0</span>
          </div>
          <div className="text-sm text-white/50 mb-6">Para sempre</div>

          <ul className="space-y-2.5 text-sm text-white/70 mb-6 flex-1">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-white/60" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <p className="text-[10px] text-white/35 mb-3 italic">
            Tem anúncios discretos, não-intrusivos.
          </p>

          <Link
            href="/sign-up"
            className="block text-center font-bold py-3 rounded-xl text-sm transition-all border border-white/20 hover:border-white/40 text-white hover:bg-white/5 min-h-[48px] flex items-center justify-center"
          >
            Começar grátis
          </Link>
        </div>

        {/* ── PREMIUM ──────────────────────────────────────────────── */}
        <div className="relative rounded-2xl p-6 flex flex-col border-2 border-purple-500/50 bg-gradient-to-b from-purple-500/10 to-transparent shadow-[0_12px_40px_-15px_rgba(168,85,247,0.5)]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            TUDO INCLUÍDO
          </span>

          <div className="text-xs font-bold uppercase tracking-widest mb-3 text-purple-300">
            Premium
          </div>

          <div className="flex items-baseline gap-1 mb-0.5">
            <span className="text-4xl font-bold text-white">{monthlyPrice}</span>
            <span className="text-sm text-white/50">/mês</span>
          </div>
          <div className="text-sm text-white/55 mb-2">{billedCopy}</div>

          {period === 'yearly' && (
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5 self-start mb-5">
              <Sparkles className="w-2.5 h-2.5" />
              Poupas 33% vs mensal
            </div>
          )}
          {period !== 'yearly' && <div className="mb-5" />}

          <ul className="space-y-2.5 text-sm text-white/75 mb-6 flex-1">
            {PREMIUM_FEATURES.map(f => {
              const highlight = 'highlight' in f && f.highlight
              return (
                <li key={f.text} className="flex items-start gap-2">
                  {highlight ? (
                    <Award className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-300" />
                  ) : (
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-purple-400" />
                  )}
                  <span className={highlight ? 'text-rose-200 font-semibold' : ''}>
                    {f.text}
                  </span>
                </li>
              )
            })}
          </ul>

          <Link
            href={ctaHref}
            className="block text-center font-bold py-3 rounded-xl text-sm transition-all bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-400 hover:to-purple-300 text-white min-h-[48px] flex items-center justify-center shadow-[0_8px_30px_-8px_rgba(168,85,247,0.6)]"
          >
            {ctaLabel}
          </Link>

          <p className="text-center text-[10px] text-white/40 mt-3">
            Cancela a qualquer momento · IVA incluído
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-white/40 mt-8">
        Preços em EUR · Pagamento seguro via Stripe · GDPR
      </p>
    </section>
  )
}
