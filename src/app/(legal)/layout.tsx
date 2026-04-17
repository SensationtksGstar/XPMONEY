import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { LandingFooter } from '@/components/landing/LandingFooter'

/**
 * (legal) layout — shared chrome for Terms / Privacy / Cookies pages.
 *
 * Routes under /termos, /privacidade, /cookies inherit this layout so the
 * copy blocks (which are long) don't have to each re-import nav/footer.
 *
 * Uses a route-group `(legal)` — the parentheses mean "no URL segment",
 * so `/termos/page.tsx` resolves at `/termos` (not `/legal/termos`).
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#060b14] text-white">
      {/* Slim nav — no CTA, user is here to read */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#060b14]/85 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-bold text-white tracking-tight">XP Money</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          ← Voltar ao site
        </Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-16 legal-prose">
        {children}
      </article>

      <LandingFooter />
    </main>
  )
}
