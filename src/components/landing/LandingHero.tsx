import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Sparkles, Star, Zap, Shield } from 'lucide-react'

/**
 * LandingHero — above-the-fold, v3.
 *
 * Rebuilt in April 2026 after the visual was flagged as "weak and unprofessional".
 * The new brief from the founder:
 *   - make the mascot the hero (people fall in love with Voltix/Penny first)
 *   - surface the annual discount (~33% off) as a real wallet lift, not a footnote
 *   - hint at NFT certificates without leading with crypto
 *   - keep the device card so it still reads as a real product, not a mood board
 *
 * Layout:
 *   LEFT  — copy + dual CTA + trust row + monthly/annual savings callout
 *   RIGHT — device card framed by the NEW cleaner mascot art (stage 4),
 *           with an "evolve-to-6" rail under it and a floating +XP chip.
 *
 * Everything above-the-fold is server-rendered. No hooks, no effects.
 * `priority` is set on the mascot image because it *is* the LCP on
 * desktop — pre-loading it keeps CLS at zero and LCP under 2s.
 */
export function LandingHero() {
  // Six evolution stages used in the rail under the device card. We render
  // all of them so visitors instantly grok "my pet grows". The current
  // stage (4) is highlighted; the rest sit at reduced opacity with a
  // grayscale filter so the progression reads as an aspirational arc.
  const EVO_RAIL = [1, 2, 3, 4, 5, 6] as const
  const CURRENT_EVO = 4

  return (
    <section className="relative pt-28 pb-16 md:pb-24 px-6 overflow-hidden">
      {/* Cinematic backdrop — hero art (Voltix egg cracking in a neon data
          stream) layered behind the content at reduced opacity and with a
          cool overlay so the text stays legible. This is the piece that
          gives the landing its "real game" feel without drowning the UI. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-center bg-cover opacity-[0.28]"
          style={{ backgroundImage: 'url(/herobot.webp)' }}
        />
        {/* Dark gradient from top + bottom so the art is strongest mid-band */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060b14] via-[#060b14]/60 to-[#060b14]" />
        {/* Radial vignette so the edges fall off into true black */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 40%, #060b14 85%)',
          }}
        />
        {/* Accent glows — kept subtle now the photo carries the colour */}
        <div className="absolute top-40 right-[18%] w-[380px] h-[380px] bg-yellow-500/10 rounded-full blur-3xl" />
        <div className="absolute top-20 left-[10%] w-[320px] h-[320px] bg-purple-500/10 rounded-full blur-3xl" />
        {/* Faint grid on top for "data" reading */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
        {/* ── Copy side ─────────────────────────────────────────────── */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Sparkles className="w-3 h-3" />
            Early Access · Grátis para sempre
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[4rem] font-bold leading-[1.02] tracking-tight mb-6">
            Poupa mais,{' '}
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
              sem tortura
            </span>
            .<br />
            <span className="text-white/95">Finanças em </span>
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              modo RPG
            </span>
            .
          </h1>

          <p className="text-lg text-white/70 max-w-xl mx-auto lg:mx-0 mb-7 leading-relaxed">
            Score financeiro, missões semanais, recibos por foto e um mascote que evolui
            contigo em <strong className="text-white">6 fases</strong>.
            Quando chegares ao topo, o teu progresso é selado num{' '}
            <span className="relative inline-block">
              <strong className="text-white">certificado NFT</strong>
              <span className="absolute -top-2 -right-10 text-[10px] font-bold bg-purple-500/20 border border-purple-500/40 text-purple-300 px-1.5 py-0.5 rounded-full rotate-3">
                NEW
              </span>
            </span>.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 mb-5">
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-bold px-7 py-3.5 rounded-xl text-base transition-all shadow-[0_10px_36px_-8px_rgba(34,197,94,0.7)] hover:scale-[1.02] active:scale-95"
            >
              Criar conta grátis
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="#precos"
              className="inline-flex items-center gap-2 text-white/85 hover:text-white px-6 py-3.5 rounded-xl border border-white/15 hover:border-purple-400/50 hover:bg-purple-500/5 transition-all text-base font-semibold"
            >
              <Zap className="w-4 h-4 text-purple-300" />
              Ver Premium · €3,33/mês
            </Link>
          </div>

          {/* Annual savings callout — primary conversion nudge. It shows
              BOTH numbers so the user doesn't have to compute; the €/mês
              effective is the click-worthy hook. */}
          <div className="inline-flex items-center gap-3 mb-5 p-3 pr-5 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-transparent">
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-300" />
            </div>
            <div className="text-left">
              <p className="text-[13px] text-white/85 font-semibold leading-tight">
                Anual <span className="text-purple-300">€39,99</span> ≈{' '}
                <span className="text-purple-300 font-bold">€3,33/mês</span>
                <span className="text-white/50"> · poupas <strong className="text-purple-300">€20</strong>/ano</span>
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">Comparado com o plano mensal a €4,99</p>
            </div>
          </div>

          {/* Inline trust row */}
          <div className="flex items-center justify-center lg:justify-start gap-4 text-xs text-white/45 flex-wrap">
            <span className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-current" />
                ))}
              </div>
              <span className="font-semibold text-white/75">4,9</span>
              <span className="text-white/50">· 1.200+ early users</span>
            </span>
            <span className="hidden sm:inline text-white/20">·</span>
            <span className="flex items-center gap-1">🇵🇹 Feito em Portugal</span>
            <span className="hidden sm:inline text-white/20">·</span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              GDPR · dados cifrados
            </span>
          </div>

          <p className="text-[11px] text-white/35 mt-3 lg:text-left text-center">
            Sem cartão · Cancela quando quiseres · Sem ligação obrigatória ao banco
          </p>
        </div>

        {/* ── Visual side ───────────────────────────────────────────── */}
        <div className="relative flex flex-col items-center justify-center">
          {/* Backdrop halo */}
          <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[460px] h-[460px] rounded-full bg-gradient-to-b from-green-500/25 via-emerald-500/10 to-transparent blur-2xl" />
            <div className="absolute w-[320px] h-[320px] rounded-full bg-yellow-500/10 blur-2xl" />
          </div>

          {/* Main mascot — dominant, NOT clipped inside a card. Sits IN
              FRONT of the device card so it reads as "alive on top of the
              UI", which is literally how the app feels. */}
          <div className="relative z-20 -mb-10 pointer-events-none">
            <Image
              src="/mascot/voltix/4.webp"
              alt="Voltix — mascote na 4ª evolução"
              width={380}
              height={380}
              priority
              className="w-[240px] sm:w-[280px] lg:w-[320px] h-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)] drop-shadow-[0_0_35px_rgba(34,197,94,0.35)]"
            />
          </div>

          {/* Device card */}
          <div className="relative w-full max-w-md z-10">
            <div className="relative bg-gradient-to-b from-white/10 to-white/[0.02] border border-white/15 backdrop-blur-xl rounded-3xl p-6 pt-10 shadow-2xl">
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

              {/* Mascot dialogue */}
              <div className="relative bg-gradient-to-b from-emerald-500/10 to-transparent rounded-2xl p-4 mb-4 border border-emerald-500/15">
                <p className="text-[10px] uppercase tracking-wider text-green-300 font-bold mb-1">Voltix diz</p>
                <p className="text-[13px] text-white/90 leading-snug">
                  Boa! Poupaste <strong className="text-green-300">€180</strong> este mês.
                  Mais 2 missões e subes para a <strong className="text-yellow-300">5ª evolução</strong>.
                </p>
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
            <div className="absolute -top-4 -right-3 bg-yellow-400 text-black text-[11px] font-bold px-3 py-1.5 rounded-full shadow-xl rotate-6 z-30">
              +250 XP
            </div>
          </div>

          {/* Evolution rail — the aspirational promise underneath the device.
              Tells the story "your pet will look like that one day" without
              a wall of copy. Current stage (4) stays full colour; the rest
              are dimmed so the progression reads at a glance. */}
          <div className="relative z-10 w-full max-w-md mt-5 px-2">
            <p className="text-center text-[10px] uppercase tracking-[0.22em] text-white/40 mb-2">
              6 evoluções conforme a tua vida financeira sobe
            </p>
            <div className="flex items-end justify-between gap-2">
              {EVO_RAIL.map(n => {
                const isCurrent = n === CURRENT_EVO
                return (
                  <div key={n} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`relative w-full aspect-square rounded-lg flex items-center justify-center ${
                        isCurrent
                          ? 'bg-gradient-to-b from-emerald-500/25 to-transparent border border-emerald-400/40 shadow-[0_0_20px_rgba(34,197,94,0.25)]'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <Image
                        src={`/mascot/voltix/${n}.webp`}
                        alt={`Voltix evolução ${n}`}
                        width={80}
                        height={80}
                        className={`w-10 h-10 sm:w-12 sm:h-12 object-contain ${
                          isCurrent ? '' : 'opacity-45 grayscale'
                        }`}
                      />
                      {isCurrent && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#060b14]" />
                      )}
                    </div>
                    <span className={`text-[9px] font-bold ${
                      isCurrent ? 'text-emerald-300' : 'text-white/35'
                    }`}>
                      {n}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
