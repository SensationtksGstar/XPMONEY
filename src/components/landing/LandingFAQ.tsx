'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Sparkles } from 'lucide-react'

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

interface QA { q: string; a: string }

const FAQS: QA[] = [
  {
    q: 'Vocês conseguem ver as minhas transações?',
    a: 'Tecnicamente sim — estão na nossa base de dados para fazermos o score funcionar. Mas: (1) nunca as lemos manualmente, (2) nunca são partilhadas com terceiros, (3) qualquer acesso admin fica em log, (4) podes apagar tudo num clique em Definições e a eliminação é definitiva em 30 dias. Se isto te desconforta, o plano Grátis permite usar a app só com categorias agregadas.',
  },
  {
    q: 'O que acontece se eu cancelar a subscrição Premium?',
    a: 'A conta continua a funcionar até ao fim do período pago. Depois, as features Premium desaparecem (missões ilimitadas, scan recibos, import PDF, simulador, relatório PDF) mas os teus dados — transações, objetivos, XP, mascote, certificados — ficam intactos. Podes voltar a subscrever a qualquer momento e recuperas tudo.',
  },
  {
    q: 'Se abrir a app daqui a 6 meses, o meu mascote morreu?',
    a: 'Não morre. O Voltix / Penny guarda a evolução mais alta que atingiste — nunca desce de nível por inatividade. O que acontece é que entra em "modo triste" até retomares (transações + check-in diário). Mal voltes a usar regularmente, ele recupera em 3-5 dias.',
  },
  {
    q: 'Como é que vocês competem com uma app do banco (Revolut, BPI)?',
    a: 'Não competimos — complementamos. Apps de banco mostram o que aconteceu (extrato, saldo). A XP-Money mostra o que deves mudar (score baixo em restaurantes → missão "cozinhar 3x esta semana"). E tem a camada motivacional (mascote, XP, streaks) que nenhum banco vai fazer, porque o negócio deles é que gastes mais, não menos.',
  },
  {
    q: 'Existe modo família ou posso partilhar com o meu parceiro/a?',
    a: 'No momento a app é 1 conta por pessoa — cada user tem o seu login, transações, score e mascote. Para objetivos partilhados (ex. "renda da casa", "férias do ano") a forma prática hoje é cada um criar o seu objetivo e alinharem o valor a depositar. Modo família multi-conta está no roadmap.',
  },
  {
    q: 'Quão bom é o scan de recibos? Vai ler um talão amarrotado?',
    a: 'Em testes internos lemos ~92% dos talões portugueses à primeira (Continente, Pingo Doce, Lidl, restaurantes com impressora térmica). Talões muito amarrotados, ilegíveis, ou em cursivo dão erros — nesse caso a app deixa-te corrigir manualmente antes de gravar. Imagens não são guardadas depois do processamento.',
  },
  {
    q: 'Posso exportar os meus dados se decidir sair?',
    a: 'Sim — é um direito RGPD e cumprimos. Em Definições → Privacidade tens um botão de export que te dá um ZIP com: (1) todas as transações em CSV, (2) objetivos e depósitos em JSON, (3) certificados dos cursos em PDF, (4) histórico de XP. Não há "lock-in" no teu próprio dinheiro.',
  },
  {
    q: 'Posso usar só a parte gamificada e ignorar o financeiro?',
    a: 'Podes, mas não é a ideia. O XP vem de ações financeiras reais (registar transações, atingir objetivos, completar missões). Sem transações, o mascote fica no nível 1 e o score em 0. Se só queres um Tamagotchi digital, há melhores apps para isso — a XP-Money faz sentido quando usas o lado financeiro a sério.',
  },
]

export function LandingFAQ() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="px-6 py-24 max-w-3xl mx-auto">
      {/* ── Pre-written FAQ ──────────────────────────────────────── */}
      <div className="text-center mb-12">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">Perguntas frequentes</p>
        <h2 className="text-4xl md:text-5xl font-bold">Perguntas que importam</h2>
        <p className="text-white/55 text-lg mt-4">
          As respostas às perguntas que a maioria faz — mas não encontra em nenhum lado.
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
                <span className="font-semibold text-white text-[15px]">{f.q}</span>
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
                <p className="px-5 pb-5 text-sm text-white/70 leading-relaxed">{f.a}</p>
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
        <div className="inline-flex items-center gap-2 bg-green-500/15 border border-green-500/30 text-green-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
          <Sparkles className="w-3 h-3" />
          Não encontraste? Pergunta-nos.
        </div>
        <h3 className="text-xl md:text-2xl font-bold mb-2 flex items-center justify-center gap-2">
          <span aria-hidden className="text-2xl">🐲</span>
          Fala com o Dragon Coin
        </h3>
        <p className="text-white/55 text-sm max-w-md mx-auto">
          O nosso assistente virtual está sempre no canto do ecrã — clica
          no botão verde em baixo à direita e pergunta o que quiseres sobre
          a app, preços ou privacidade.
        </p>
      </div>

      {/* ── Human fallback ───────────────────────────────────────── */}
      <div className="mt-10 bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
        <h4 className="font-bold text-white mb-2">Queres falar connosco a sério?</h4>
        <p className="text-sm text-white/60 mb-4 max-w-md mx-auto">
          Preenche o formulário — responde uma pessoa real em menos de 24h.
          Sem partilhamos o nosso email porque preferimos tracking centralizado
          dos pedidos (mas o teu email fica connosco para responder).
        </p>
        <Link
          href="/contacto"
          className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          Abrir formulário de contacto →
        </Link>
      </div>
    </section>
  )
}
