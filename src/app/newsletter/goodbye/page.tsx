import type { Metadata } from 'next'
import Link               from 'next/link'
import { Logo }            from '@/components/ui/Logo'
import { LandingFooter }   from '@/components/landing/LandingFooter'
import { LanguageToggle }  from '@/components/common/LanguageToggle'
import { getServerT }      from '@/lib/i18n/server'

/**
 * /newsletter/goodbye — landing page after the user clicks unsubscribe.
 * Status comes via ?status= from /api/newsletter/unsubscribe:
 *   ok       — first-time unsubscribe, row flipped
 *   already  — was already unsubscribed (idempotent click)
 *   invalid  — token expired or never existed
 */

export const metadata: Metadata = {
  title:       'Subscrição cancelada · XP-Money',
  description: 'Saída da newsletter XP-Money confirmada.',
  robots:      { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function NewsletterGoodbyePage({ searchParams }: PageProps) {
  const t          = await getServerT()
  const { status } = await searchParams
  const kind       = status === 'already' || status === 'invalid' ? status : 'ok'

  const variant = {
    ok: {
      icon:  '👋',
      title: t('newsletter.goodbye.ok_title'),
      desc:  t('newsletter.goodbye.ok_desc'),
    },
    already: {
      icon:  '👍',
      title: t('newsletter.goodbye.already_title'),
      desc:  t('newsletter.goodbye.already_desc'),
    },
    invalid: {
      icon:  '⚠️',
      title: t('newsletter.goodbye.invalid_title'),
      desc:  t('newsletter.goodbye.invalid_desc'),
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
        <Link
          href="/"
          className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/90 font-semibold text-sm transition-colors"
        >
          ← {t('newsletter.goodbye.back_home')}
        </Link>
      </div>

      <LandingFooter />
    </main>
  )
}
