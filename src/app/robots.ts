import type { MetadataRoute } from 'next'

/**
 * robots.txt — block crawlers from authenticated / admin surfaces.
 *
 * /admin/bugs is already gated by ADMIN_CLERK_ID (404 for non-admins), but
 * belt-and-braces: don't even let Googlebot know the path exists.
 * /api/* has no reason to be indexed either.
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/dashboard', '/settings', '/transactions', '/onboarding', '/reports'],
      },
    ],
    sitemap: 'https://xp-money.com/sitemap.xml',
    host: 'https://xp-money.com',
  }
}
