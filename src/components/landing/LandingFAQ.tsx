'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * LandingFAQ — addresses the 8 actual objections we hear before signup.
 *
 * Rule for writing these: the answer cannot contain the word "apenas" or
 * "simplesmente" — if it did the objection wasn't real. Every answer ends
 * with a concrete claim the user can verify.
 *
 * Interactive (client component) so only one item expanded at a time.
 * SEO note: all answers render in DOM (hidden via max-height, not
 * display:none) so search engines index them — important for long-tail
 * queries like "xp money é seguro", "xp money vs revolut", etc.
 */

interface QA {
  q: string
  a: string
}

const FAQS: QA[] = [
  {
    q: 'Tenho de ligar a app à minha conta bancária?',
    a: 'Não. Não pedimos credenciais do banco e nunca vamos pedir. Registas transações à mão (< 30s), por scan de recibo, ou importas o extrato em PDF que descarregas do homebanking. A única forma da app aceder aos teus dados é se TU os enviares.',
  },
  {
    q: 'Como é que os meus dados financeiros estão protegidos?',
    a: 'Todos os dados são cifrados em trânsito (HTTPS) e em repouso (Supabase/Postgres). Autenticação via Clerk (MFA disponível). GDPR-compliant. Podes apagar tudo (transações, poupanças, certificados) com um clique em Definições — e o apagar é imediato e definitivo.',
  },
  {
    q: 'A parte gamificada não é infantil?',
    a: 'A escolha é tua: se quiseres, ignoras o mascote e usas só o score + transações + gráficos. Mas as pessoas que deixam a app "em modo jogo" mantêm-na aberta 3× mais tempo — e é aí que se formam os hábitos financeiros.',
  },
  {
    q: 'Quanto tempo demora a ver resultados?',
    a: 'Score financeiro aparece na primeira transação. Missões personalizadas aparecem no final da primeira semana (quando temos dados suficientes). A maioria dos early users reporta mudanças de comportamento visíveis em 14-21 dias.',
  },
  {
    q: 'Funciona fora de Portugal?',
    a: 'A app é em português (PT-PT), categorias adaptadas ao mercado português (restaurantes, combustível, CP, etc.) e suporta EUR como moeda principal. Planeamos suportar USD/BRL/GBP + EN/ES em breve — entra e deixamos saber quando chegar.',
  },
  {
    q: 'Posso mudar de plano ou cancelar?',
    a: 'Sim, a qualquer momento e sem penalização. Cancelas e o plano continua ativo até ao fim do período pago. Fazes downgrade e mantemos os teus dados intactos — a única coisa que desaparece são as features premium.',
  },
  {
    q: 'Quem está por trás da app?',
    a: 'Somos uma equipa portuguesa de 2 pessoas — 1 engenheira de software + 1 profissional de finanças pessoais. Sem VCs, sem investidores, sem pressão para vender os teus dados. A app sustenta-se dos planos pagos.',
  },
  {
    q: 'Como é que vocês ganham dinheiro?',
    a: 'Só das subscrições Plus (€2,99/mês) e Pro (€5,99/mês). No plano gratuito há anúncios discretos para cobrir custos de servidor. Nunca vendemos dados a terceiros — a privacidade é o nosso produto tanto como a app em si.',
  },
]

export function LandingFAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="px-6 py-24 max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">Perguntas frequentes</p>
        <h2 className="text-4xl md:text-5xl font-bold">O que toda a gente pergunta</h2>
      </div>

      <div className="space-y-2">
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
                <span className="font-semibold text-white text-[15px]">{f.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-white/50 flex-shrink-0 transition-transform ${
                    isOpen ? 'rotate-180 text-green-400' : ''
                  }`}
                />
              </button>

              {/* Answer — always in DOM for SEO, collapsed via max-height */}
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="px-5 pb-5 text-sm text-white/65 leading-relaxed">{f.a}</p>
              </div>
            </article>
          )
        })}
      </div>

      <p className="text-center text-sm text-white/40 mt-8">
        Ainda tens dúvidas?{' '}
        <a href="mailto:ola@xpmoney.app" className="text-green-400 hover:text-green-300 underline">
          Escreve-nos
        </a>{' '}
        — respondemos em &lt; 24h.
      </p>
    </section>
  )
}
