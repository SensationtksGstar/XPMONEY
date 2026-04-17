import type { MetadataRoute } from 'next'

/**
 * Sitemap for xp-money.com — only public, indexable pages.
 *
 * Authenticated routes (/dashboard, /settings, /transactions, etc.) are
 * gated by Clerk middleware and return 302 to /sign-in for anons, so
 * there's nothing for Google to index there. Keep this list to the
 * marketing surface + legal.
 */

const BASE = 'https://xp-money.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${BASE}/`,             lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/contacto`,     lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/termos`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/privacidade`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/cookies`,      lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
