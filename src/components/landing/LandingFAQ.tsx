'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { useT } from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * LandingFAQ — perguntas mais afiadas + agente IA + fallback humano.
 *
 * Princípio de edição: eliminámos o banal ("é seguro?", "funciona offline?")
 * e deixámos só perguntas que um prospect REAL faz antes de comprar — as
 * que nem sequer sabem que se podem perguntar. Cada resposta:
 *   1. Começa com a verdade crua (sim/não/depende)
 *   2. Dá um detalhe verificável
 *   3. Não usa "apenas" nem "simplesmente"
 *
 * Layout: primeiro a FAQ pré-escrita para SEO (todas as answers sempre no
 * DOM, collapsed via max-height), depois o chat IA para perguntas que
 * ficaram de fora, depois um CTA claro para /contacto se quiserem humano.
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

export function LandingFAQ() {
  const t = useT()
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="px-6 py-24 max-w-3xl mx-auto">
      {/* ── Pre-written FAQ ──────────────────────────────────────── */}
      <div className="text-center mb-12">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">{t('landing.faq.eyebrow')}</p>
        <h2 className="text-4xl md:text-5xl font-bold">{t('landing.faq.title')}</h2>
        <p className="text-white/55 text-lg mt-4">
          {t('landing.faq.subtitle')}
        </p>
      </div>

      <div className="space-y-2 mb-16">
        {FAQS.map((f, i) => {
          const isOpen = open === i
          return (
            <article
              key={i}
              className={`bg-white/5 border rounded-xl transition-colors ${
                isOpen ? 'border-green-500/30' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left min-h-[56px]"
              >
                <span className="font-semibold text-white text-[15px]">{t(f.qKey)}</span>
                <ChevronDown
                  className={`w-4 h-4 text-white/50 flex-shrink-0 transition-transform ${
                    isOpen ? 'rotate-180 text-green-400' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="px-5 pb-5 text-sm text-white/70 leading-relaxed">{t(f.aKey)}</p>
              </div>
            </article>
          )
        })}
      </div>

      {/* ── Dragon Coin nudge ────────────────────────────────────────
          The conversational chat used to live inline here. It was moved to
          a persistent floating button (DragonCoinFAB) in April 2026 so
          users don't have to scroll past the whole FAQ to find it. This
          block now just points at the FAB that is visible on every page. */}
      <div className="bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent border border-green-500/20 rounded-2xl p-6 text-center">
        {/* Retrato do Dragon Coin — sem moldura, apenas o animal com um glow
            emerald via drop-shadow. Serve de âncora visual do mascote que
            vive no FAB flutuante. */}
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

      {/* ── Human fallback ───────────────────────────────────────── */}
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
