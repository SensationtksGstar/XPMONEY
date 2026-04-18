import Image from 'next/image'
import {
  ScanLine, FileText, Zap, Trophy, Target, Award,
  BarChart3, Crown, Bot, Shield, BookOpen, Sparkles,
} from 'lucide-react'

/**
 * LandingAdvantages — master feature grid surfaced after the mascot showcase.
 *
 * Purpose: answer the implicit question "but what do I actually get?" in a
 * single scroll. The page already has a LandingFeatures section, but that
 * one is organised as 8 generic tiles. This section is different on purpose:
 *
 *   - Top strip: 4 "everyone gets this" pillars. Builds trust that the free
 *     tier isn't a crippled teaser.
 *   - Grid: 9 Premium-tagged advantages including the NFT certificate,
 *     which was previously buried in a single FAQ answer. Each card has a
 *     concrete line about WHY it matters, not just what it is.
 *   - Closing banner: evolution chart strip + a soft reminder that the
 *     €39,99/ano works out to €3,33/mês (the same callout used in hero).
 *
 * Server component — no interactivity beyond the underlying anchors.
 */

type Card = {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
  tag?: 'FREE' | 'PREMIUM'
  accent: 'green' | 'purple' | 'yellow' | 'emerald' | 'rose'
}

// Shared feature set. `tag` = which plan unlocks. Card order is a story:
// start with the AI pillars (scan + import), move to gamification
// (mascot/missions), then the heavier Premium-only analytics, end on the
// NFT certificate which is the "why this is different" kicker.
const CARDS: Card[] = [
  {
    icon: ScanLine,
    title: 'Scan de recibos por foto',
    body: 'Tira foto ao talão e a IA extrai valor, data e categoria em segundos. ~92% de precisão em talões PT.',
    tag: 'PREMIUM',
    accent: 'purple',
  },
  {
    icon: FileText,
    title: 'Importa extratos PDF e CSV',
    body: 'Largas o extrato do banco e deixas a IA categorizar. Meses de histórico tratados em segundos.',
    tag: 'PREMIUM',
    accent: 'purple',
  },
  {
    icon: Trophy,
    title: 'Missões semanais e badges',
    body: 'Cada boa decisão vira XP. Sobes de nível, desbloqueias badges, competes contigo.',
    tag: 'FREE',
    accent: 'yellow',
  },
  {
    icon: Target,
    title: 'Objetivos com progresso',
    body: 'Fundo de emergência, viagem, casa própria. Acompanhas a barra a subir — Free até 2, Premium ilimitado.',
    tag: 'FREE',
    accent: 'emerald',
  },
  {
    icon: BarChart3,
    title: 'Perspetiva de Riqueza',
    body: 'Compara o teu salário com CEOs, celebridades e média EU. Vê cada despesa traduzida em horas de trabalho.',
    tag: 'PREMIUM',
    accent: 'purple',
  },
  {
    icon: Sparkles,
    title: 'Simulador de investimento',
    body: 'Vê em 5 segundos quanto valem €100/mês em ETFs durante 10, 20 ou 30 anos. Juros compostos reais.',
    tag: 'PREMIUM',
    accent: 'purple',
  },
  {
    icon: FileText,
    title: 'Relatórios PDF profissionais',
    body: 'Gera um relatório mensal com score, balanço e top categorias. Pronto a imprimir ou enviar ao contabilista.',
    tag: 'PREMIUM',
    accent: 'purple',
  },
  {
    icon: BookOpen,
    title: 'Academia — cursos interativos',
    body: 'Orçamento, dívida, investimento, imobiliário. Quizzes com nota mínima e certificados ao fim.',
    tag: 'PREMIUM',
    accent: 'purple',
  },
  {
    icon: Award,
    title: 'Certificado NFT · única',
    body: 'Quando chegas à última evolução, o teu progresso é selado numa NFT cunhada na tua carteira. Prova pública de disciplina.',
    tag: 'PREMIUM',
    accent: 'rose',
  },
]

const FREE_PILLARS = [
  { icon: Zap,    label: 'Transações ilimitadas' },
  { icon: Crown,  label: 'Mascote 6 evoluções' },
  { icon: Shield, label: 'GDPR · dados cifrados' },
  { icon: Bot,    label: 'Dragon Coin · assistente' },
]

const ACCENT_CLASSES: Record<Card['accent'], { border: string; bg: string; icon: string; tag: string }> = {
  green:   { border: 'border-green-500/25',   bg: 'bg-green-500/5',   icon: 'text-green-300',   tag: 'bg-green-500/10 text-green-300 border-green-500/30' },
  purple:  { border: 'border-purple-500/25',  bg: 'bg-purple-500/5',  icon: 'text-purple-300',  tag: 'bg-purple-500/15 text-purple-200 border-purple-500/40' },
  yellow:  { border: 'border-yellow-500/25',  bg: 'bg-yellow-500/5',  icon: 'text-yellow-300',  tag: 'bg-yellow-500/10 text-yellow-200 border-yellow-500/30' },
  emerald: { border: 'border-emerald-500/25', bg: 'bg-emerald-500/5', icon: 'text-emerald-300', tag: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' },
  rose:    { border: 'border-rose-500/30',    bg: 'bg-rose-500/5',    icon: 'text-rose-300',    tag: 'bg-rose-500/15 text-rose-200 border-rose-500/40' },
}

export function LandingAdvantages() {
  return (
    <section className="relative px-6 py-24 overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[320px] h-[320px] bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-emerald-400 font-semibold text-sm uppercase tracking-widest mb-2">
            Todas as vantagens
          </p>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-[1.1]">
            Feito para quem quer{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-green-300 bg-clip-text text-transparent">
              resultados reais
            </span>
            , não apenas gráficos bonitos.
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Arranca grátis — já vale mais do que 80% dos apps pagos por aí.
            O Premium tira o teto a tudo e adiciona certificado NFT no fim.
          </p>
        </div>

        {/* Free pillars */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {FREE_PILLARS.map(p => {
            const Icon = p.icon
            return (
              <div
                key={p.label}
                className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="text-sm font-semibold text-white/90 leading-tight">
                  {p.label}
                </div>
              </div>
            )
          })}
        </div>

        {/* Main advantages grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {CARDS.map(card => {
            const Icon   = card.icon
            const accent = ACCENT_CLASSES[card.accent]
            return (
              <div
                key={card.title}
                className={`relative rounded-2xl p-5 border ${accent.border} ${accent.bg} backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/[0.05]`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${accent.icon}`} />
                  </div>
                  {card.tag && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${accent.tag}`}>
                      {card.tag === 'PREMIUM' ? '👑 PREMIUM' : 'FREE'}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white mb-1.5 leading-snug">{card.title}</h3>
                <p className="text-[13px] text-white/60 leading-relaxed">{card.body}</p>
              </div>
            )
          })}
        </div>

        {/* Evolution chart banner — uses the real line-up art so visitors
            can SEE the 6 stages side-by-side. Toggles between Voltix and
            Penny by rendering both stacked on mobile / side-by-side on
            wide screens. Soft overlay + caption keeps it readable. */}
        <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 overflow-hidden mb-12">
          <div className="text-center mb-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-300 font-bold mb-1">
              Evolução completa
            </p>
            <h3 className="text-xl md:text-2xl font-bold text-white">
              Escolhe o teu — e cresce de{' '}
              <span className="text-emerald-300">ovo</span> a{' '}
              <span className="text-yellow-300">lenda</span>
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative rounded-2xl bg-[#060b14]/50 border border-white/5 overflow-hidden">
              {/* Label posicionado no canto superior direito sobre o sprite —
                  a evolução 1 (ovo) está no canto esquerdo, pelo que colocar
                  o label aí cria sobreposição de cores. Mantemos um backdrop
                  com blur + solid fill para legibilidade mesmo que a última
                  evolução tenha tons fortes. */}
              <div className="absolute top-3 right-3 z-10 text-[10px] font-bold text-green-300 bg-[#060b14]/80 backdrop-blur-sm border border-green-500/40 px-2.5 py-1 rounded-full shadow-lg shadow-black/40">
                VOLTIX ⚡
              </div>
              <Image
                src="/mascot/evolucoes-voltix.webp"
                alt="Voltix — 6 evoluções"
                width={1920}
                height={600}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="relative rounded-2xl bg-[#060b14]/50 border border-white/5 overflow-hidden">
              <div className="absolute top-3 right-3 z-10 text-[10px] font-bold text-pink-300 bg-[#060b14]/80 backdrop-blur-sm border border-pink-500/40 px-2.5 py-1 rounded-full shadow-lg shadow-black/40">
                PENNY ✨
              </div>
              <Image
                src="/mascot/evolucoes-penny.webp"
                alt="Penny — 6 evoluções"
                width={1920}
                height={600}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>

          <p className="text-center text-[11px] text-white/45 mt-4">
            Última evolução desbloqueia o <strong className="text-rose-300">certificado NFT</strong> único — cunhado uma só vez por conta.
          </p>
        </div>

        {/* Mid-section annual savings callout — repeats the hero CTA here
            so users who land mid-scroll also get the pricing nudge. */}
        <div className="relative rounded-2xl border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-transparent p-6 md:p-8 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-60 h-60 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-purple-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full mb-3">
                <Sparkles className="w-3 h-3" />
                POUPA 33% NO ANUAL
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">
                €39,99/ano ={' '}
                <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                  €3,33/mês
                </span>
              </h3>
              <p className="text-white/65 text-sm max-w-md">
                Um café por mês compra-te: scanner de recibos, simulador, Perspetiva,
                cursos completos e o <strong className="text-white">certificado NFT</strong> no fim.
              </p>
            </div>
            <a
              href="/sign-up?plan=premium&period=yearly"
              className="group self-start md:self-auto inline-flex items-center gap-2 bg-purple-500 hover:bg-purple-400 text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-all shadow-[0_10px_36px_-8px_rgba(168,85,247,0.6)] hover:scale-[1.02] whitespace-nowrap"
            >
              Quero o anual
              <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M7.05 4.05a1 1 0 011.414 0l5.243 5.243a1 1 0 010 1.414l-5.243 5.243a1 1 0 11-1.414-1.414L11.586 10 7.05 5.464a1 1 0 010-1.414z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
