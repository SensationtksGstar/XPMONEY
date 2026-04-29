import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { getServerT } from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * LandingFAQ — perguntas mais afiadas + agente IA + fallback humano.
 *
 * April 2026 mobile-perf rework: this used to be `'use client'` so the
 * accordion expand/collapse could use React state. The whole component
 * (~250 lines + the FAQ data) shipped to the client even though the
 * answers themselves are static. Now uses native HTML `<details>` /
 * `<summary>` for the accordion, removing the React runtime cost from
 * this section entirely. The QA content gets server-rendered into the
 * SSR HTML straight away → better LCP + SEO, smaller mobile bundle.
 *
 * Princípio de edição: eliminámos o banal ("é seguro?", "funciona offline?")
 * e deixámos só perguntas que um prospect REAL faz antes de comprar — as
 * que nem sequer sabem que se podem perguntar. Cada resposta:
 *   1. Começa com a verdade crua (sim/não/depende)
 *   2. Dá um detalhe verificável
 *   3. Não usa "apenas" nem "simplesmente"
 *
 * Layout: FAQ pré-escrita (8 entries, server-rendered for SEO), depois
 * uma âncora visual para o Dragon Coin (que vive como FAB), depois um
 * fallback humano para quem prefere preencher um formulário.
 */

interface QA { qKey: TranslationKey; aKey: TranslationKey }

const FAQS: QA[] = [
  { qKey: 'landing.faq.q1', aKey: 'landing.faq.a1' },
  { qKey: 'landing.faq.q2', aKey: 'landing.faq.a2' },
  { qKey: 'landing.faq.q3', aKey: 'landing.faq.a3' },
  { qKey: 'landing.faq.q4', aKey: 'landing.faq.a4' },
  { qKey: 'landing.faq.q5', aKey: 'landing.faq.a5' },
  { qKey: 'landing.faq.q6', aKey: 'landing.faq.a6' },
  { qKey: 'landing.faq.q7', aKey: 'landing.faq.a7' },
  { qKey: 'landing.faq.q8', aKey: 'landing.faq.a8' },
]

export async function LandingFAQ() {
  const t = await getServerT()

  return (
    <section className="px-6 py-24 max-w-3xl mx-auto">
      {/* ── Pre-written FAQ (server-rendered, SEO-friendly) ─────────── */}
      <div className="text-center mb-12">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">{t('landing.faq.eyebrow')}</p>
        <h2 className="text-4xl md:text-5xl font-bold">{t('landing.faq.title')}</h2>
        <p className="text-white/55 text-lg mt-4">
          {t('landing.faq.subtitle')}
        </p>
      </div>

      <div className="space-y-2 mb-16">
        {FAQS.map((f, i) => (
          // <details> is a native HTML accordion. First entry opens by default
          // via the `open` attribute (matches the previous client-state behaviour
          // where index 0 was open on mount). The `[open]:…` Tailwind variants
          // light up the open state without any JS.
          <details
            key={i}
            open={i === 0}
            className="group bg-white/5 border border-white/10 hover:border-white/20 open:border-green-500/30 rounded-xl transition-colors"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 py-4 min-h-[56px] [&::-webkit-details-marker]:hidden">
              <span className="font-semibold text-white text-[15px]">{t(f.qKey)}</span>
              <ChevronDown
                className="w-4 h-4 text-white/50 flex-shrink-0 transition-transform group-open:rotate-180 group-open:text-green-400"
              />
            </summary>
            <p className="px-5 pb-5 text-sm text-white/70 leading-relaxed">{t(f.aKey)}</p>
          </details>
        ))}
      </div>

      {/* ── Dragon Coin nudge ─────────────────────────────────────────
          The conversational chat used to live inline here. Now it lives
          on the persistent floating button (DragonCoinFAB), so this
          block just points at where to find it. */}
      <div className="bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent border border-green-500/20 rounded-2xl p-6 text-center">
        <div className="flex items-center justify-center mb-4">
          <Image
            src="/dragon-coin.webp"
            alt=""
            aria-hidden
            width={96}
            height={96}
            sizes="96px"
            className="w-24 h-24 object-contain drop-shadow-[0_8px_24px_rgba(34,197,94,0.35)] drop-shadow-[0_0_28px_rgba(34,197,94,0.25)]"
          />
        </div>
        <h3 className="text-xl md:text-2xl font-bold mb-2">
          {t('landing.faq.dc_title')}
        </h3>
        <p className="text-white/55 text-sm max-w-md mx-auto">
          {t('landing.faq.dc_desc')}
        </p>
      </div>

      {/* ── Human fallback ────────────────────────────────────────── */}
      <div className="mt-10 bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
        <h4 className="font-bold text-white mb-2">{t('landing.faq.human_title')}</h4>
        <p className="text-sm text-white/60 mb-4 max-w-md mx-auto">
          {t('landing.faq.human_desc')}
        </p>
        <Link
          href="/contacto"
          className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          {t('landing.faq.human_cta')}
        </Link>
      </div>
    </section>
  )
}
