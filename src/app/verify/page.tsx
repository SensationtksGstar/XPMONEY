import type { Metadata } from 'next'
import Link              from 'next/link'
import { redirect }      from 'next/navigation'
import { Logo }          from '@/components/ui/Logo'
import { getServerT }    from '@/lib/i18n/server'

/**
 * /verify — entrada manual da verificacao de certificados.
 *
 * O certificado imprime "xp-money.com/verify"; antes esta rota nao existia
 * (404). Form GET sem JS para a propria pagina: quando chega `?code=`,
 * redireciona para /verify/<CODIGO> (a pagina que faz o lookup a sério).
 * Rota publica (middleware), noindex.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT()
  return {
    title:      t('verify.lookup_title'),
    robots:     { index: false, follow: true },
    alternates: { canonical: '/verify' },
  }
}

export default async function VerifyLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>
}) {
  const { code: rawParam } = await searchParams
  const raw  = Array.isArray(rawParam) ? rawParam[0] : rawParam
  const code = (raw ?? '').trim().toUpperCase().slice(0, 64)
  if (code) redirect(`/verify/${encodeURIComponent(code)}`)

  // `?code=` presente mas vazio = submissao em branco: feedback inline (sem
  // disabled/required nativo, que em mobile nao diz nada).
  const submittedEmpty = rawParam !== undefined

  const t = await getServerT()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Logo size={32} />
        <span className="font-bold text-white text-lg tracking-tight">XP-Money</span>
      </Link>

      <div className="w-full max-w-md bg-surface-1 border border-white/10 rounded-2xl p-7 shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
        <h1 className="text-lg font-bold text-white mb-1 text-center">{t('verify.lookup_title')}</h1>
        <p className="text-sm text-white/55 mb-5 text-center">{t('verify.lookup_sub')}</p>

        <form method="get" action="/verify" className="space-y-3">
          <label htmlFor="verify-code" className="block text-sm font-medium text-white/80">
            {t('verify.lookup_label')}
          </label>
          <input
            id="verify-code"
            name="code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={64}
            placeholder="XPM-XXXXXXXXXX"
            aria-invalid={submittedEmpty || undefined}
            aria-describedby={submittedEmpty ? 'verify-code-error' : undefined}
            className="w-full min-h-[44px] px-3 rounded-xl bg-surface-0 border border-white/10 text-white placeholder:text-white/30 font-mono text-base focus:outline-none focus:ring-2 focus:ring-green-500/60"
          />
          {submittedEmpty && (
            <p id="verify-code-error" role="alert" className="text-sm text-amber-400">
              {t('verify.lookup_empty')}
            </p>
          )}
          <button
            type="submit"
            className="w-full min-h-[44px] rounded-xl bg-green-500 hover:bg-green-400 text-black font-semibold text-sm transition-colors touch-manipulation"
          >
            {t('verify.lookup_cta')}
          </button>
        </form>
      </div>

      <Link href="/" className="mt-6 text-sm text-white/40 hover:text-white transition-colors">
        {t('verify.back_home')}
      </Link>
    </main>
  )
}
