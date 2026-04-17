import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, Star } from 'lucide-react'

/**
 * LandingHero — the above-the-fold moment.
 *
 * Design brief:
 *   - One clear promise, no jargon ("controla as tuas finanças como um RPG")
 *   - Trust row baked in — not a separate strip: user sees rating + badge
 *     inline so the hero reads as a single credible unit.
 *   - Right-side visual is the REAL hero Voltix render (512px webp) on a
 *     device-frame glass card so it reads as "a real app, not a mockup".
 *     Replaces the previous ⚡ emoji with bounce animation that looked
 *     amateur.
 *
 * Keep server-rendered so the first paint is fast — no animation state,
 * no onClick. All tilt/animation is elsewhere.
 */
export function LandingHero() {
  return (
    <section className="relative pt-32 pb-16 md:pb-24 px-6 overflow-hidden">
      {/* Ambient glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-[320px] h-[320px] bg-yellow-500/5 rounded-full blur-3xl" />
        <div className="absolute top-10 left-1/4 w-[260px] h-[260px] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* ── Copy side ─────────────────────────────────────────────── */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Sparkles className="w-3 h-3" />
            Early Access · Plano grátis para sempre
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-6">
            Poupa mais,{' '}
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              sem tortura
            </span>
            .<br />
            As tuas finanças, em{' '}
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              modo RPG
            </span>.
          </h1>

          <p className="text-lg text-white/65 max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
            Score financeiro, missões semanais, recibos por foto e um mascote que reage ao teu
            comportamento. Uma app feita em Portugal que transforma gerir dinheiro em algo
            que <strong className="text-white/90">apetece fazer todos os dias</strong>.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 mb-6">
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-7 py-3.5 rounded-xl text-base transition-all shadow-[0_8px_30px_-8px_rgba(34,197,94,0.6)] hover:scale-[1.02] active:scale-95"
            >
              Criar conta grátis
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white px-6 py-3.5 rounded-xl border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all text-base font-medium"
            >
              Ver demo interativa
            </Link>
          </div>

          {/* Inline trust row */}
          <div className="flex items-center justify-center lg:justify-start gap-5 text-xs text-white/45 flex-wrap">
            <span className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-current" />
                ))}
              </div>
              <span className="font-semibold text-white/70">4,9</span>
              <span>· 1.200+ early users</span>
            </span>
            <span className="hidden sm:inline">·</span>
            <span>🇵🇹 Feito em Portugal</span>
            <span className="hidden sm:inline">·</span>
            <span>🔒 GDPR · dados cifrados</span>
          </div>

          <p className="text-[11px] text-white/30 mt-4 lg:text-left text-center">
            Sem cartão de crédito · Cancela quando quiseres · Sem ligação ao banco obrigatória
          </p>
        </div>

        {/* ── Visual side ───────────────────────────────────────────── */}
        <div className="relative flex items-center justify-center">
          {/* Backdrop panel */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[420px] h-[420px] rounded-full bg-gradient-to-b from-green-500/20 via-emerald-500/10 to-transparent blur-2xl" />
          </div>

          {/* Device card */}
          <div className="relative w-full max-w-md">
            <div className="relative bg-gradient-to-b from-white/10 to-white/[0.02] border border-white/15 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
              {/* Top stats row */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Score</p>
                  <p className="text-xl font-bold text-yellow-300 mt-0.5">74<span className="text-xs text-white/40">/100</span></p>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Nível</p>
                  <p className="text-xl font-bold text-green-400 mt-0.5">7</p>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-white/40">Streak</p>
                  <p className="text-xl font-bold text-orange-400 mt-0.5">23d</p>
                </div>
              </div>

              {/* Mascot hero */}
              <div className="relative bg-gradient-to-b from-emerald-500/10 to-transparent rounded-2xl p-4 flex items-center gap-4 mb-4">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <Image
                    src="/mascot/voltix/4.webp"
                    alt="Voltix — mascote evolução 4"
                    width={128}
                    height={128}
                    className="w-full h-full object-contain drop-shadow-[0_0_18px_rgba(34,197,94,0.4)]"
                    priority
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-green-300 font-bold mb-1">Voltix diz</p>
                  <p className="text-[13px] text-white/85 leading-snug">
                    Boa! Poupaste <strong className="text-green-300">€180</strong> este mês.
                    Completa mais 2 missões e sobes de nível.
                  </p>
                </div>
              </div>

              {/* XP bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-[10px] text-white/50 mb-1.5">
                  <span>XP · Nível 7</span>
                  <span>1.240 / 1.500</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[82%] bg-gradient-to-r from-green-400 to-emerald-300 rounded-full" />
                </div>
              </div>

              {/* Mini missions */}
              <div className="space-y-1.5">
                {[
                  { label: 'Registar 15 transações', pct: 80, color: 'bg-green-400' },
                  { label: 'Ficar abaixo de €200 em restaurantes', pct: 55, color: 'bg-yellow-400' },
                  { label: 'Poupar €100 este mês', pct: 100, color: 'bg-emerald-400' },
                ].map(m => (
                  <div key={m.label} className="flex items-center gap-3 text-xs">
                    <div className="flex-1 min-w-0 truncate text-white/70">{m.label}</div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-[10px] font-bold text-white/60">{m.pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating XP gain chip */}
            <div className="absolute -top-4 -right-3 bg-yellow-400 text-black text-xs font-bold px-3 py-1.5 rounded-full shadow-xl rotate-6">
              +250 XP
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
