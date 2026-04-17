import {
  ScanLine,
  FileText,
  Trophy,
  Target,
  GraduationCap,
  Sparkles,
  Shield,
  Smartphone,
} from 'lucide-react'

/**
 * LandingFeatures — 8-card feature grid covering what actually exists today.
 *
 * Replaces the old 6-card grid that missed big differentiators:
 *   - Receipt scan (AI / OCR)
 *   - Statement import (CSV + PDF)
 *   - Academia with certificates
 *   - Dual mascots (Voltix + Penny)
 *
 * Each card: one icon, one title, one-sentence promise, one concrete proof
 * point. Proof points are the hook — "score financeiro" alone is abstract,
 * "um número de 0-100" is what sticks.
 */

const FEATURES = [
  {
    icon:  <Trophy     className="w-5 h-5" />,
    color: 'text-yellow-300',
    bg:    'bg-yellow-500/10',
    title: 'Score financeiro 0-100',
    desc:  'Um único número que resume a tua saúde financeira. Sabes onde estás em 3 segundos.',
    proof: 'Recalculado a cada transação',
  },
  {
    icon:  <Sparkles   className="w-5 h-5" />,
    color: 'text-green-300',
    bg:    'bg-green-500/10',
    title: 'Missões + XP',
    desc:  'Cada boa decisão dá XP. Missões semanais personalizadas. Badges que desbloqueias.',
    proof: '12 badges · 40+ missões',
  },
  {
    icon:  <ScanLine   className="w-5 h-5" />,
    color: 'text-purple-300',
    bg:    'bg-purple-500/10',
    title: 'Scan de recibos',
    desc:  'Tira foto, a IA lê valor, data e categoria. Adiciona a transação em 2 segundos.',
    proof: 'Powered by Gemini Vision',
  },
  {
    icon:  <FileText   className="w-5 h-5" />,
    color: 'text-blue-300',
    bg:    'bg-blue-500/10',
    title: 'Importar extratos',
    desc:  'Arrasta o extrato do teu banco (PDF ou CSV) e criamos as transações por ti.',
    proof: 'Suporta todos os bancos PT',
  },
  {
    icon:  <Target     className="w-5 h-5" />,
    color: 'text-orange-300',
    bg:    'bg-orange-500/10',
    title: 'Objetivos de poupança',
    desc:  'Define metas, acompanha depósitos, recebe XP quando atinges. Fundo de emergência como missão.',
    proof: 'Ilimitado no plano Plus',
  },
  {
    icon:  <GraduationCap className="w-5 h-5" />,
    color: 'text-pink-300',
    bg:    'bg-pink-500/10',
    title: 'Academia XP-Money',
    desc:  'Cursos de finanças com quiz. Passas → tiras certificado digital com código único.',
    proof: 'Orçamento, DCA, impostos',
  },
  {
    icon:  <Smartphone className="w-5 h-5" />,
    color: 'text-cyan-300',
    bg:    'bg-cyan-500/10',
    title: 'PWA mobile-first',
    desc:  'Instala no telemóvel como uma app nativa. Notificações diárias, offline-friendly.',
    proof: 'iOS + Android + Desktop',
  },
  {
    icon:  <Shield     className="w-5 h-5" />,
    color: 'text-emerald-300',
    bg:    'bg-emerald-500/10',
    title: 'Privacidade a sério',
    desc:  'Dados cifrados, GDPR, zero partilha com terceiros. Sem ligação obrigatória ao banco.',
    proof: 'Apagas tudo num clique',
  },
]

export function LandingFeatures() {
  return (
    <section className="px-6 py-24 max-w-6xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">O que tens dentro</p>
        <h2 className="text-4xl md:text-5xl font-bold">Tudo o que precisas. Nada a mais.</h2>
        <p className="text-white/55 text-lg mt-4 max-w-2xl mx-auto">
          Construída à volta de 3 princípios: <strong className="text-white/80">registo rápido</strong>,{' '}
          <strong className="text-white/80">feedback visual</strong> e{' '}
          <strong className="text-white/80">hábito recompensado</strong>.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map(f => (
          <article
            key={f.title}
            className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 hover:bg-white/[0.07] transition-all"
          >
            <div className={`${f.bg} ${f.color} w-10 h-10 rounded-xl flex items-center justify-center mb-4`}>
              {f.icon}
            </div>
            <h3 className="font-bold text-white mb-1.5 text-[15px]">{f.title}</h3>
            <p className="text-sm text-white/55 leading-relaxed mb-4">{f.desc}</p>
            <p className="text-[10px] text-white/35 border-t border-white/5 pt-3 font-medium uppercase tracking-wider">
              {f.proof}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
