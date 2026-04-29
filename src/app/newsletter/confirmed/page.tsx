import type { Metadata } from 'next'
import Link               from 'next/link'
import { Logo }            from '@/components/ui/Logo'
import { LandingFooter }   from '@/components/landing/LandingFooter'
import { LanguageToggle }  from '@/components/common/LanguageToggle'
import { getServerT }      from '@/lib/i18n/server'

/**
 * /newsletter/confirmed — landing page after the user clicks the
 * confirmation link in the opt-in email. Status comes via ?status=
 * query param emitted by /api/newsletter/confirm:
 *   ok       — first-time confirmation, welcome email just fired
 *   already  — was already active, idempotent click
 *   invalid  — token expired / never existed / row deleted
 */

export const metadata: Metadata = {
  title:       'Subscrição confirmada · XP-Money',
  description: 'Newsletter do XP-Money — confirmação da subscrição.',
  robots:      { index: false, follow: false },   // not a public landing
}

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function NewsletterConfirmedPage({ searchParams }: PageProps) {
  const t           = await getServerT()
  const { status }  = await searchParams
  const kind        = status === 'already' || status === 'invalid' ? status : 'ok'

  const variant = {
    ok: {
      icon:  '🎉',
      title: t('newsletter.confirmed.ok_title'),
      desc:  t('newsletter.confirmed.ok_desc'),
    },
    already: {
      icon:  '✅',
      title: t('newsletter.confirmed.already_title'),
      desc:  t('newsletter.confirmed.already_desc'),
    },
    invalid: {
      icon:  '⚠️',
      title: t('newsletter.confirmed.invalid_title'),
      desc:  t('newsletter.confirmed.invalid_desc'),
    },
  }[kind]

  return (
    <main className="min-h-screen text-white">
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#060b14]/85 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-bold text-white tracking-tight">XP-Money</span>
        </Link>
        <LanguageToggle />
      </nav>

      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <div className="text-6xl mb-4">{variant.icon}</div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">{variant.title}</h1>
        <p className="text-white/60 text-lg leading-relaxed mb-8">{variant.desc}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/blog"
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 font-semibold text-sm transition-colors"
          >
            {t('newsletter.confirmed.cta_blog')}
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors"
          >
            {t('newsletter.confirmed.cta_signup')}
          </Link>
        </div>
      </div>

      <LandingFooter />
    </main>
  )
}
