import type { MetadataRoute } from 'next'
import { getAllPosts }       from '@/lib/blog'

/**
 * Sitemap for xp-money.com — only public, indexable pages.
 *
 * Authenticated routes (/dashboard, /settings, /transactions, etc.) are
 * gated by Clerk middleware and return 302 to /sign-in for anons, so
 * there's nothing for Google to index there. Keep this list to the
 * marketing surface + legal + blog.
 *
 * Blog posts are added dynamically — the sitemap reads the filesystem
 * each time Google re-crawls, so a freshly published post shows up
 * without a code change. `lastModified` uses the post's `date`
 * frontmatter (close enough for sitemap purposes; we'd need a separate
 * `updated` field to track edits properly, deferred until needed).
 */

const BASE = 'https://xp-money.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,             lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/blog`,         lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/contacto`,     lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/termos`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/privacidade`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/cookies`,      lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]

  // Blog posts — pulled in PT (the canonical locale). EN-only readers will
  // still see the post in EN once they switch locale; sitemap entries are
  // per-URL not per-locale, and our URLs are locale-shared (cookie-driven).
  const blogEntries: MetadataRoute.Sitemap = getAllPosts('pt').map(post => ({
    url:             `${BASE}/blog/${post.slug}`,
    lastModified:    new Date(post.date),
    changeFrequency: 'monthly',
    priority:        0.7,
  }))

  return [...staticEntries, ...blogEntries]
}
