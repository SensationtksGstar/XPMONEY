import type { Metadata } from 'next'
import { notFound }      from 'next/navigation'
import Link              from 'next/link'
import { MDXRemote }     from 'next-mdx-remote/rsc'
import remarkGfm         from 'remark-gfm'
import { Logo }          from '@/components/ui/Logo'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { JsonLd }        from '@/components/seo/JsonLd'
import { article, breadcrumb } from '@/lib/seo/jsonLd'
import { getAllSlugs, getPostBySlug } from '@/lib/blog'
import { getServerT, getServerLocale } from '@/lib/i18n/server'

/**
 * /blog/[slug] — single post view.
 *
 * Renders MDX server-side with `remark-gfm` for GitHub-flavoured
 * extensions (tables, task lists, strikethrough, autolinks). No client
 * JS needed for prose content; if a future post embeds an interactive
 * widget we'll inline it via the `components` prop on MDXRemote.
 *
 * SEO:
 *   - Per-post canonical
 *   - openGraph + Twitter card with the post's title/description
 *   - JSON-LD: BlogPosting + BreadcrumbList
 *   - 404 returns nothing crawlable (notFound() fires Next's not-found page)
 */

interface PageProps {
  params: Promise<{ slug: string }>
}

// Pre-generate every published slug at build time so each post ships
// statically when the content tree doesn't change. Locale variants are
// resolved at request time via cookie, so this only enumerates slugs.
export async function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const locale   = await getServerLocale()
  const post     = getPostBySlug(slug, locale)

  if (!post) return { title: 'Post not found' }

  const url = `https://xp-money.com/blog/${post.slug}`
  return {
    title:       post.title,
    description: post.description,
    keywords:    post.keywords,
    authors:     post.author ? [{ name: post.author }] : undefined,
    alternates:  { canonical: `/blog/${post.slug}` },
    openGraph: {
      type:          'article',
      title:         post.title,
      description:   post.description,
      url,
      locale:        post.servedLocale === 'en' ? 'en_US' : 'pt_PT',
      publishedTime: post.date,
      authors:       post.author ? [post.author] : undefined,
      tags:          post.keywords,
      images:        post.ogImage ? [{ url: post.ogImage }] : undefined,
    },
    twitter: {
      card:        'summary_large_image',
      title:       post.title,
      description: post.description,
      images:      post.ogImage ? [post.ogImage] : undefined,
    },
    robots: { index: true, follow: true },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const t        = await getServerT()
  const locale   = await getServerLocale()
  const post     = getPostBySlug(slug, locale)

  if (!post) notFound()

  return (
    <main className="min-h-screen text-white">
      <JsonLd schema={breadcrumb([
        { name: t('common.home'), href: '/' },
        { name: 'Blog',                       href: '/blog' },
        { name: post.title,                   href: `/blog/${post.slug}` },
      ])} />
      <JsonLd schema={article({
        slug:        post.slug,
        title:       post.title,
        description: post.description,
        date:        post.date,
        author:      post.author,
        image:       post.ogImage,
        keywords:    post.keywords,
        locale:      post.servedLocale,
      })} />

      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#060b14]/85 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-bold text-white tracking-tight">XP-Money</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link href="/blog" className="text-sm text-white/60 hover:text-white transition-colors">
            ← {t('blog.back_to_index')}
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-10">
          {post.servedLocale !== locale && (
            <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
              {t('blog.fallback_locale_long')}
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold leading-tight text-white mb-3">
            {post.title}
          </h1>
          <p className="text-white/60 text-lg leading-relaxed mb-4">
            {post.description}
          </p>
          <div className="flex items-center gap-3 text-xs text-white/40 flex-wrap">
            <time dateTime={post.date} className="tabular-nums">
              {new Date(post.date).toLocaleDateString(post.servedLocale === 'en' ? 'en-US' : 'pt-PT', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </time>
            <span>·</span>
            <span>{t('blog.reading_time', { min: post.readingTime })}</span>
            {post.author && <><span>·</span><span>{post.author}</span></>}
          </div>
        </header>

        {/* Prose styles — keeps content readable across screen widths. */}
        <div className="prose prose-invert prose-emerald max-w-none
                        prose-headings:scroll-mt-20
                        prose-headings:font-bold
                        prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-3
                        prose-h3:text-xl  prose-h3:mt-8  prose-h3:mb-2
                        prose-p:text-white/80 prose-p:leading-relaxed
                        prose-li:text-white/80 prose-li:leading-relaxed
                        prose-strong:text-white prose-strong:font-semibold
                        prose-a:text-emerald-300 hover:prose-a:text-emerald-200
                        prose-code:text-emerald-300 prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-normal
                        prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10
                        prose-blockquote:border-emerald-500/40 prose-blockquote:text-white/70 prose-blockquote:italic
                        prose-hr:border-white/10
                        prose-table:text-sm
                        prose-th:text-white prose-td:text-white/80">
          <MDXRemote
            source={post.content}
            options={{
              parseFrontmatter: false,    // already parsed in lib/blog.ts
              mdxOptions:       { remarkPlugins: [remarkGfm] },
            }}
          />
        </div>

        {/* CTA at the foot of every post — converts readers into trial users
            without being pushy. Same pattern Notion / Linear use on docs. */}
        <aside className="mt-14 pt-8 border-t border-white/10">
          <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/30 rounded-2xl p-6 text-center">
            <h2 className="text-xl font-bold text-white mb-1">
              {t('blog.cta_title')}
            </h2>
            <p className="text-white/60 text-sm mb-4">
              {t('blog.cta_desc')}
            </p>
            <Link
              href="/sign-up"
              className="inline-block bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-6 py-3 rounded-xl transition-colors"
            >
              {t('blog.cta_button')}
            </Link>
          </div>
        </aside>
      </article>

      <LandingFooter />
    </main>
  )
}
