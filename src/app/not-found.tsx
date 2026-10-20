import type { Metadata } from 'next'
import Link              from 'next/link'
import { getServerT }    from '@/lib/i18n/server'
import { Logo }          from '@/components/ui/Logo'

/**
 * 404 global — Server Component (sem Clerk, sem JS de cliente).
 *
 * Desde out. 2026 o middleware deixa os URLs desconhecidos chegar ao Next
 * (antes faziam 307 → /sign-in = soft-404 para o Google). Por isso este 404
 * é visto sobretudo por visitantes ANÓNIMOS vindos de links partidos: os
 * CTAs apontam para a landing e para o blog, nunca para /dashboard (que
 * para um anónimo voltava a dar no muro de login).
 *
 * Os notFound() chamados DENTRO da app (ex.: /dividas/[id] com id alheio)
 * apanham primeiro src/app/(app)/(dashboard)/not-found.tsx, que fica dentro
 * do shell (Sidebar/TopBar) e aponta para /dashboard.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT()
  return {
    title:  t('notfound.title'),
    robots: { index: false, follow: true },
  }
}

export default async function NotFound() {
  const t = await getServerT()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Wordmark via showText (nunca hardcoded). O <img> do Logo já tem
          alt="XP-Money"; o aria-label dá ao link um nome único em vez de
          "XP-Money XP-Money". */}
      <Link href="/" aria-label="XP-Money" className="mb-8 flex items-center min-h-[44px]">
        <Logo size={32} showText textClass="text-lg" />
      </Link>

      <div className="w-full max-w-md bg-surface-1 border border-hairline rounded-2xl p-7 text-center shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
        <p className="text-5xl font-bold text-white/25 tabular-nums mb-3" aria-hidden="true">404</p>
        <h1 className="text-xl font-bold text-white mb-2">{t('notfound.title')}</h1>
        <p className="text-sm text-white/60 mb-6">{t('notfound.body')}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-semibold text-sm transition-colors touch-manipulation"
          >
            {t('notfound.home')}
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-surface-2 border border-hairline hover:bg-surface-3 text-white font-semibold text-sm transition-colors touch-manipulation"
          >
            {t('notfound.blog')}
          </Link>
        </div>
      </div>
    </main>
  )
}
