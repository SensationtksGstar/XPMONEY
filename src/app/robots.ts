import type { MetadataRoute } from 'next'

/**
 * robots.txt — block crawlers from authenticated / admin surfaces.
 *
 * /admin/bugs is already gated by ADMIN_CLERK_ID (404 for non-admins), but
 * belt-and-braces: don't even let Googlebot know the path exists.
 * /api/* has no reason to be indexed either.
 *
 * NOTE: /dashboard, /settings and /transactions are deliberately NOT
 * disallowed. They sit behind auth (307 -> /sign-in); if robots.txt blocks
 * them, crawlers never fetch the redirect and keep already-indexed URLs
 * (Bing had /dashboard) forever. Letting them crawl lets the 307 drop them.
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/onboarding', '/reports'],
      },
    ],
    sitemap: 'https://xp-money.com/sitemap.xml',
    host: 'https://xp-money.com',
  }
}
