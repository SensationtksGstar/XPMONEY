import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

/**
 * LandingFooter — professional footer with proper IA columns.
 *
 * Design brief: make the app look established. A barebones single-line
 * footer (what we had before) reads as "one person's side project". A
 * columned footer with product / company / legal is what every SaaS
 * landing ships — the information doesn't have to be extensive, but the
 * *shape* signals maturity.
 *
 * Every link here must either exist or be clearly "em breve" so we don't
 * 404 visitors. Broken footer links are one of the fastest ways to lose
 * credibility.
 */

const COLUMNS = [
  {
    title: 'Produto',
    links: [
      { label: 'Funcionalidades',  href: '/#funcionalidades' },
      { label: 'Preços',           href: '/#precos' },
      { label: 'Demo interativa',  href: '/dashboard' },
      { label: 'Academia',         href: '/cursos' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre nós',        href: '/sobre',   soon: true },
      { label: 'Blog',             href: '/blog',    soon: true },
      { label: 'Contacto',         href: 'mailto:ola@xpmoney.app' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Termos de serviço', href: '/termos',       soon: true },
      { label: 'Privacidade',       href: '/privacidade',  soon: true },
      { label: 'Cookies',           href: '/cookies',      soon: true },
      { label: 'GDPR',              href: '/gdpr',         soon: true },
    ],
  },
]

export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-white/5 px-6 pt-14 pb-8 bg-[#04070e]">
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-10">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Logo size={32} />
              <span className="font-bold text-lg text-white tracking-tight">XP Money</span>
            </Link>
            <p className="text-sm text-white/55 leading-relaxed max-w-xs mb-4">
              Finanças pessoais gamificadas. Feito em Portugal para quem quer
              controlar o dinheiro sem se aborrecer.
            </p>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Sistemas operacionais
              </span>
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map(col => (
            <div key={col.title}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">
                {col.title}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l.label}>
                    {('soon' in l && l.soon) ? (
                      <span className="text-sm text-white/30 cursor-not-allowed flex items-center gap-2">
                        {l.label}
                        <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded uppercase">Em breve</span>
                      </span>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-sm text-white/60 hover:text-white transition-colors"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <p>© {year} XP Money · Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <span>🇵🇹 Feito em Portugal</span>
            <span>·</span>
            <span>Pagamentos via Stripe</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
