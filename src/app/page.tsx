import Link from 'next/link'
import { ArrowRight, Zap, Shield, TrendingUp, Star, Target, Brain } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#060b14] text-white overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#060b14]/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="font-bold text-lg text-white">XP Money</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2"
          >
            Entrar
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Começar grátis
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-20 px-6 text-center">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-green-500/8 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-purple-500/6 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium px-4 py-2 rounded-full mb-8">
            <Star className="w-3.5 h-3.5 fill-current" />
            Early Access — Grátis para sempre no plano base
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Controla o teu{' '}
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              dinheiro
            </span>
            <br />
            como um{' '}
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              RPG
            </span>
          </h1>

          <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            A única app de finanças pessoais que te{' '}
            <strong className="text-white/90">recompensa</strong> por seres consistente.
            Score financeiro, missões, XP e o Voltix sempre do teu lado.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-4 rounded-xl text-lg transition-all hover:scale-105 active:scale-95"
            >
              Começar grátis
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/sign-in"
              className="flex items-center gap-2 text-white/70 hover:text-white px-8 py-4 rounded-xl border border-white/10 hover:border-white/20 transition-all text-lg"
            >
              Já tenho conta
            </Link>
          </div>

          <p className="text-sm text-white/30 mt-6">
            Sem cartão de crédito. Começas grátis, pagas quando quiseres mais.
          </p>
        </div>
      </section>

      {/* MOCK DASHBOARD (visual) */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Score Financeiro', value: '74', icon: '🏆', color: 'text-yellow-400' },
              { label: 'Nível XP',         value: '7',  icon: '⚡', color: 'text-green-400' },
              { label: 'Poupado',          value: '€340', icon: '💰', color: 'text-emerald-400' },
              { label: 'Missões Ativas',   value: '3',  icon: '🎯', color: 'text-purple-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/5 rounded-xl p-4 border border-white/5">
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.icon} {stat.value}
                </div>
                <div className="text-xs text-white/50 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Voltix preview */}
          <div className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="text-5xl animate-bounce">⚡</div>
            <div>
              <div className="font-semibold text-green-400">Voltix diz:</div>
              <div className="text-white/70 text-sm">
                "Gastaste €120 em restaurantes este mês. Que tal cozinhares 3x esta semana e poupares €50? +200 XP se conseguires!"
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Finalmente uma app que{' '}
            <span className="text-gradient-brand bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              funciona para ti
            </span>
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Não mais apps chatas que abres uma vez e esqueces. O XP Money cria um hábito que dura.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <TrendingUp className="w-6 h-6" />,
              title:   'Score de Saúde Financeira',
              desc:    'Um número de 0 a 100 que resume a tua situação financeira. Simples de entender, poderoso para agir.',
              color:   'text-green-400',
              bgColor: 'bg-green-500/10',
            },
            {
              icon: <Zap className="w-6 h-6" />,
              title:   'Missões e XP',
              desc:    'Cada boa decisão financeira ganha XP. Completa missões, sobe de nível, desbloqueia badges. O teu dinheiro virou um jogo.',
              color:   'text-yellow-400',
              bgColor: 'bg-yellow-500/10',
            },
            {
              icon: <Brain className="w-6 h-6" />,
              title:   'Voltix, o teu copiloto',
              desc:    'O teu pet virtual que reage ao teu comportamento financeiro. Está feliz quando poupas, triste quando gastas demais.',
              color:   'text-purple-400',
              bgColor: 'bg-purple-500/10',
            },
            {
              icon: <Target className="w-6 h-6" />,
              title:   'Objetivos de Poupança',
              desc:    'Define objetivos, acompanha o progresso e recebe XP quando os atinges. Poupar nunca foi tão motivador.',
              color:   'text-blue-400',
              bgColor: 'bg-blue-500/10',
            },
            {
              icon: <Shield className="w-6 h-6" />,
              title:   'Dados 100% seguros',
              desc:    'Os teus dados financeiros são cifrados e nunca partilhados. GDPR compliant. Zero acesso às tuas contas bancárias.',
              color:   'text-emerald-400',
              bgColor: 'bg-emerald-500/10',
            },
            {
              icon: <Star className="w-6 h-6" />,
              title:   'Educação integrada',
              desc:    'Aprende finanças enquanto usas a app. Dicas contextuais, não artigos que nunca vais ler.',
              color:   'text-orange-400',
              bgColor: 'bg-orange-500/10',
            },
          ].map(feature => (
            <div
              key={feature.title}
              className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all hover:bg-white/8"
            >
              <div className={`${feature.bgColor} ${feature.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                {feature.icon}
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Preço justo, sempre</h2>
          <p className="text-white/60 text-lg">Começa grátis. Paga quando quiseres mais poder.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Free */}
          <div className="border border-white/10 rounded-2xl p-6 bg-white/5">
            <div className="text-white/50 text-sm font-medium mb-2">GRÁTIS</div>
            <div className="text-4xl font-bold mb-1">€0</div>
            <div className="text-white/40 text-sm mb-6">para sempre</div>
            <ul className="space-y-3 text-sm text-white/70 mb-8">
              {['Registo de transações', 'Score financeiro', 'XP e níveis básicos', 'Voltix básico', '3 missões/mês'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className="block text-center border border-white/20 hover:border-white/40 py-3 rounded-lg transition-colors text-sm font-medium">
              Começar grátis
            </Link>
          </div>

          {/* Plus */}
          <div className="border border-green-500/40 rounded-2xl p-6 bg-green-500/5 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-full">
              MAIS POPULAR
            </div>
            <div className="text-green-400 text-sm font-medium mb-2">PLUS</div>
            <div className="text-4xl font-bold mb-1">€3.99</div>
            <div className="text-white/40 text-sm mb-6">por mês · €29.99/ano</div>
            <ul className="space-y-3 text-sm text-white/70 mb-8">
              {['Tudo do Free', 'Missões ilimitadas', 'Categorias ilimitadas', 'Histórico completo', 'Relatórios PDF', 'Sem anúncios'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className="block text-center bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-lg transition-colors text-sm">
              Experimentar Plus
            </Link>
          </div>

          {/* Pro */}
          <div className="border border-purple-500/30 rounded-2xl p-6 bg-purple-500/5">
            <div className="text-purple-400 text-sm font-medium mb-2">PRO</div>
            <div className="text-4xl font-bold mb-1">€7.99</div>
            <div className="text-white/40 text-sm mb-6">por mês · €59.99/ano</div>
            <ul className="space-y-3 text-sm text-white/70 mb-8">
              {['Tudo do Plus', 'Multi-conta (5)', 'Modo casal', 'Voltix evoluído', 'Suporte prioritário', 'API access'].map(f => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-purple-400">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className="block text-center border border-purple-500/40 hover:border-purple-500/70 py-3 rounded-lg transition-colors text-sm font-medium">
              Começar Pro
            </Link>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-5xl mb-6">⚡</div>
          <h2 className="text-4xl font-bold mb-4">
            O Voltix está à tua espera
          </h2>
          <p className="text-white/60 text-lg mb-8">
            Junta-te a milhares de pessoas que já controlam o dinheiro de forma diferente.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-10 py-4 rounded-xl text-lg transition-all hover:scale-105"
          >
            Criar conta grátis
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-white/30 text-sm">
        <p>© {new Date().getFullYear()} XP Money · Feito com ⚡ para quem quer controlar o futuro</p>
      </footer>
    </main>
  )
}
