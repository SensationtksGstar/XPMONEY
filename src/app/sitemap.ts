import type { MetadataRoute } from 'next'
import { getAllPosts }       from '@/lib/blog'
import { TOOLS, TOOLS_HUB_UPDATED, toolPath } from '@/lib/tools/registry'

/**
 * Sitemap for xp-money.com — only public, indexable pages.
 *
 * Authenticated routes (/dashboard, /settings, /transactions, etc.) are
 * gated by Clerk middleware and return 302 to /sign-in for anons, so
 * there's nothing for Google to index there. Keep this list to the
 * marketing surface + legal + blog + free tools.
 *
 * `lastModified` — datas REAIS e fixas, nunca a data do build:
 *  - páginas estáticas: data da última alteração substancial (atualizar à mão
 *    quando o conteúdo mudar; um lastmod que muda em cada deploy ensina o
 *    Google a ignorar o campo);
 *  - posts: `updated ?? date` do frontmatter;
 *  - ferramentas: `updated` do registry (src/lib/tools/registry.ts).
 * `changeFrequency`/`priority` foram removidos: o Google ignora ambos.
 *
 * Blog posts and tools are added dynamically — the sitemap reads the
 * filesystem / registry each time Google re-crawls, so a freshly published
 * post shows up without touching this file.
 */

const BASE = 'https://xp-money.com'

export default function sitemap(): MetadataRoute.Sitemap {
  // Blog posts — pulled in PT (the canonical locale). EN-only readers will
  // still see the post in EN once they switch locale; sitemap entries are
  // per-URL not per-locale, and our URLs are locale-shared (cookie-driven).
  const posts = getAllPosts('pt')

  const blogEntries: MetadataRoute.Sitemap = posts.map(post => ({
    url:          `${BASE}/blog/${post.slug}`,
    lastModified: new Date(post.updated ?? post.date),
  }))

  // O índice do blog muda quando sai/atualiza-se um post.
  const blogIndexDate = posts.reduce(
    (max, p) => { const d = p.updated ?? p.date; return d > max ? d : max },
    '2026-07-07',
  )

  const toolEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/ferramentas`, lastModified: new Date(TOOLS_HUB_UPDATED) },
    ...TOOLS.map(tool => ({
      url:          `${BASE}${toolPath(tool.slug)}`,
      lastModified: new Date(tool.updated),
    })),
  ]

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,            lastModified: new Date('2026-10-20') },
    { url: `${BASE}/blog`,        lastModified: new Date(blogIndexDate) },
    { url: `${BASE}/contacto`,    lastModified: new Date('2026-07-07') },
    { url: `${BASE}/termos`,      lastModified: new Date('2026-04-28') },
    { url: `${BASE}/privacidade`, lastModified: new Date('2026-04-29') },
    { url: `${BASE}/cookies`,     lastModified: new Date('2026-04-28') },
  ]

  return [...staticEntries, ...toolEntries, ...blogEntries]
}
