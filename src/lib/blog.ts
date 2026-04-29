import 'server-only'
import fs   from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import type { Locale } from '@/lib/i18n/translations'

/**
 * Blog post catalogue — backed by MDX files in `content/blog/`.
 *
 * Layout (intentionally simple, no DB):
 *
 *   content/blog/
 *     ├── ynab-alternativas-portugal-2026/
 *     │   ├── index.pt.mdx
 *     │   └── index.en.mdx
 *     ├── ler-extracto-cgd-em-30-segundos/
 *     │   └── index.pt.mdx        ← EN missing → PT served as fallback
 *     └── ...
 *
 * Each `index.<locale>.mdx` has YAML frontmatter:
 *
 *   ---
 *   title:        "5 alternativas a YNAB em Portugal · 2026"
 *   description:  "Reviewed and ranked: which finance apps actually …"
 *   date:         "2026-04-29"
 *   keywords:     ["ynab", "finanças", "portugal"]
 *   author:       "Bruno"
 *   ogImage:      "/blog/ynab-alternativas/og.png"   (optional)
 *   draft:        false                              (optional)
 *   ---
 *
 *   # Body in markdown / MDX …
 *
 * The directory name IS the slug (`/blog/<slug>`). Locale fallback rule:
 * EN reader → try `index.en.mdx`, fall back to `index.pt.mdx`. We don't
 * mix locales mid-render — once we pick a file, we serve it whole.
 *
 * Why filesystem and not a DB:
 *   - Articles are part of the codebase (versioned, reviewed via PRs)
 *   - Zero infra cost
 *   - Editing in your IDE > admin CMS UI for a one-person team
 *   - Easy to migrate to a CMS later if/when needed
 */

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export interface BlogPostMeta {
  /** Directory name — also the URL slug. */
  slug:        string
  /** Locale-resolved file path (absolute, server-only). */
  _path:       string
  /** Locale of the served file — may differ from requested when EN is missing. */
  servedLocale: Locale
  title:       string
  description: string
  /** ISO date — `YYYY-MM-DD`. Used for sitemap lastmod and human formatting. */
  date:        string
  keywords:    string[]
  author?:     string
  ogImage?:    string
  draft?:      boolean
  /** Reading time in minutes, computed from word count (≈220 wpm). */
  readingTime: number
}

export interface BlogPost extends BlogPostMeta {
  /** Raw MDX/markdown content body (frontmatter stripped). */
  content: string
}

/** ≈220 words/minute for adult Portuguese/English non-fiction. */
function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

function readPostFile(slug: string, locale: Locale): { filePath: string; servedLocale: Locale } | null {
  if (!fs.existsSync(BLOG_DIR)) return null
  const dir = path.join(BLOG_DIR, slug)
  if (!fs.existsSync(dir)) return null

  // Try requested locale first, then fall back to PT (the canonical source).
  // PT is mandatory; an EN-only post is invalid by convention.
  const localeFile = path.join(dir, `index.${locale}.mdx`)
  if (fs.existsSync(localeFile)) return { filePath: localeFile, servedLocale: locale }

  if (locale !== 'pt') {
    const ptFile = path.join(dir, 'index.pt.mdx')
    if (fs.existsSync(ptFile)) return { filePath: ptFile, servedLocale: 'pt' }
  }
  return null
}

function parseFrontmatter(raw: string, slug: string, filePath: string, servedLocale: Locale): BlogPost {
  const { data, content } = matter(raw)
  const title       = String(data.title       ?? slug)
  const description = String(data.description ?? '')
  const date        = String(data.date        ?? '1970-01-01')
  const keywords    = Array.isArray(data.keywords) ? data.keywords.map(String) : []
  const author      = data.author  ? String(data.author)  : undefined
  const ogImage     = data.ogImage ? String(data.ogImage) : undefined
  const draft       = Boolean(data.draft)

  return {
    slug,
    _path:        filePath,
    servedLocale,
    title,
    description,
    date,
    keywords,
    author,
    ogImage,
    draft,
    readingTime:  estimateReadingTime(content),
    content,
  }
}

/**
 * List all (non-draft) posts in the requested locale, newest first. Drafts
 * are filtered out in production but kept in dev so authors can preview.
 */
export function getAllPosts(locale: Locale): BlogPostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return []

  const isDev = process.env.NODE_ENV !== 'production'
  const entries = fs.readdirSync(BLOG_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())

  const posts: BlogPostMeta[] = []
  for (const entry of entries) {
    const found = readPostFile(entry.name, locale)
    if (!found) continue
    try {
      const raw  = fs.readFileSync(found.filePath, 'utf-8')
      const post = parseFrontmatter(raw, entry.name, found.filePath, found.servedLocale)
      if (post.draft && !isDev) continue
      // Strip the body for list views — we only need metadata.
      // Caller can re-fetch the full post via getPostBySlug when needed.
      const { content: _content, ...meta } = post
      posts.push(meta)
    } catch (err) {
      console.warn(`[blog] failed to parse ${found.filePath}:`, err)
    }
  }

  return posts.sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Fetch a single post by slug + locale. Returns `null` if slug doesn't
 * exist OR (in production) the post is marked draft.
 */
export function getPostBySlug(slug: string, locale: Locale): BlogPost | null {
  const found = readPostFile(slug, locale)
  if (!found) return null
  try {
    const raw  = fs.readFileSync(found.filePath, 'utf-8')
    const post = parseFrontmatter(raw, slug, found.filePath, found.servedLocale)
    if (post.draft && process.env.NODE_ENV === 'production') return null
    return post
  } catch (err) {
    console.warn(`[blog] failed to read ${found.filePath}:`, err)
    return null
  }
}

/** All published slugs, used by sitemap.ts and (eventually) generateStaticParams. */
export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  return fs.readdirSync(BLOG_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
}
