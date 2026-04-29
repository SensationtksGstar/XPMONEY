import type { Metadata } from 'next'
import Link             from 'next/link'
import { Logo }          from '@/components/ui/Logo'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { JsonLd }        from '@/components/seo/JsonLd'
import { breadcrumb }    from '@/lib/seo/jsonLd'
import { getAllPosts }   from '@/lib/blog'
import { getServerT, getServerLocale } from '@/lib/i18n/server'

/**
 * /blog — index page listing every published post in the requested locale.
 *
 * Server component, force-dynamic so a freshly published post shows up
 * without redeploy. Filesystem reads are cheap (a few KB of MDX
 * frontmatter), no need for revalidation tricks.
 *
 * Empty state: when `content/blog/` is empty (or all posts are drafts in
 * production), we show a friendly "coming soon" card instead of a
 * blank list — the route still exists in the sitemap because we want
 * Google to start crawling it from day one.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t      = await getServerT()
  const locale = await getServerLocale()
  return {
    title:       t('blog.meta_title'),
    description: t('blog.meta_description'),
    alternates:  { canonical: '/blog' },
    openGraph: {
      type:        'website',
      title:       t('blog.meta_title'),
      description: t('blog.meta_description'),
      url:         'https://xp-money.com/blog',
      locale:      locale === 'en' ? 'en_US' : 'pt_PT',
    },
    robots: { index: true, follow: true },
  }
}

export const dynamic    = 'force-dynamic'
export const revalidate = 0

export default async function BlogIndexPage() {
  const t      = await getServerT()
  const locale = await getServerLocale()
  const posts  = getAllPosts(locale)

  return (
    <main className="min-h-screen text-white">
      <JsonLd schema={breadcrumb([
        { name: t('common.home'), href: '/' },
        { name: 'Blog',                       href: '/blog' },
      ])} />

      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#060b14]/85 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-bold text-white tracking-tight">XP-Money</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors">
            ← {t('blog.back_home')}
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-12">
          <p className="text-emerald-400 font-semibold text-xs uppercase tracking-widest mb-2">
            {t('blog.eyebrow')}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-3">
            {t('blog.title')}
          </h1>
          <p className="text-white/60 text-lg leading-relaxed">
            {t('blog.subtitle')}
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
            <p className="text-4xl mb-3">✍️</p>
            <h2 className="font-bold text-white mb-1">{t('blog.empty_title')}</h2>
            <p className="text-white/50 text-sm">{t('blog.empty_desc')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {posts.map(post => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="block group bg-white/5 border border-white/10 hover:border-emerald-500/40 rounded-2xl p-5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                    <h2 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors leading-snug flex-1 min-w-0">
                      {post.title}
                    </h2>
                    <time
                      dateTime={post.date}
                      className="text-xs text-white/40 tabular-nums shrink-0 mt-1"
                    >
                      {new Date(post.date).toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-PT', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </time>
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed mb-3">
                    {post.description}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-white/40">
                    <span>{t('blog.reading_time', { min: post.readingTime })}</span>
                    {post.servedLocale !== locale && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                        {t('blog.fallback_locale')}
                      </span>
                    )}
                    {post.draft && (
                      <span className="px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-[10px] font-bold">
                        DRAFT
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <LandingFooter />
    </main>
  )
}
