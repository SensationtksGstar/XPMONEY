import Link           from 'next/link'
import { getServerT } from '@/lib/i18n/server'

/**
 * 404 dentro da app — fronteira dos notFound() chamados em páginas de
 * (dashboard) (ex.: /dividas/[id] com um id inválido ou de outro user).
 *
 * Renderiza DENTRO do layout do dashboard (Sidebar + TopBar + MobileNav), por
 * isso o utilizador autenticado não perde a navegação e o CTA leva-o de volta
 * a /dashboard. O root src/app/not-found.tsx continua a servir os URLs
 * desconhecidos (visitantes anónimos → landing + blog).
 *
 * Nota: URLs inexistentes nunca chegam aqui — o Next só resolve a fronteira
 * de grupo para notFound() explícitos; o resto cai no root not-found.
 */
export default async function DashboardNotFound() {
  const t = await getServerT()

  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-surface-1 border border-hairline rounded-2xl p-7 text-center shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
        <p className="text-5xl font-bold text-white/25 tabular-nums mb-3" aria-hidden="true">404</p>
        <h1 className="text-xl font-bold text-white mb-2">{t('notfound.title')}</h1>
        <p className="text-sm text-white/60 mb-6">{t('notfound.body')}</p>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-green-500 hover:bg-green-400 text-black font-semibold text-sm transition-colors touch-manipulation"
        >
          {t('notfound.dashboard')}
        </Link>
      </div>
    </div>
  )
}
