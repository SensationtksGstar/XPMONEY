import type { Metadata, Viewport } from 'next'
import { Inter }         from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ptPT, enUS }    from '@clerk/localizations'
import Script            from 'next/script'
import './globals.css'
import { PostHogProvider } from '@/components/providers/PostHogProvider'
import { QueryProvider }   from '@/components/providers/QueryProvider'
import { Toaster }         from '@/components/ui/toaster'
import { LocaleProvider }  from '@/lib/i18n/LocaleProvider'
import { SiteBackground }  from '@/components/wallpaper/SiteBackground'
import { CookieConsentBanner } from '@/components/common/CookieConsentBanner'
import { PWAInstallPrompt }    from '@/components/common/PWAInstallPrompt'
import { JsonLd }              from '@/components/seo/JsonLd'
import { organization, website } from '@/lib/seo/jsonLd'
import { SpeedInsights }       from '@vercel/speed-insights/next'
import { getServerLocale, getServerT } from '@/lib/i18n/server'

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? ''

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

/**
 * Locale-aware metadata. Runs at request time (cookie read), so EN users
 * sharing the link get EN OG cards on Twitter/WhatsApp/LinkedIn. The title
 * template stays the same for both (brand-first), but the OG description
 * and open-graph locale flip. Note: we DON'T set `alternates.languages`
 * here because PT and EN share the same URL (cookie-driven) — declaring
 * them as separate URLs would confuse Google more than help.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t      = await getServerT()
  const locale = await getServerLocale()
  const title  = t('meta.title_default')

  // Optional verification env vars — if/when set in Vercel, Next.js
  // emits the right meta tag and we get verified ownership in Google
  // Search Console / Bing Webmaster without code changes.
  // Pattern: GOOGLE_SITE_VERIFICATION=ABC123... (just the token, not the
  // full meta tag). Same for Bing/Yandex.
  const verification: NonNullable<Metadata['verification']> = {}
  if (process.env.GOOGLE_SITE_VERIFICATION) verification.google = process.env.GOOGLE_SITE_VERIFICATION
  if (process.env.BING_SITE_VERIFICATION)   verification.other  = { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }
  if (process.env.YANDEX_SITE_VERIFICATION) verification.yandex = process.env.YANDEX_SITE_VERIFICATION

  return {
    metadataBase: new URL('https://xp-money.com'),
    alternates:   { canonical: '/' },
    title: {
      default:  title,
      template: '%s | XP-Money',
    },
    description: t('meta.description'),
    keywords: locale === 'en'
      ? ['personal finance', 'expense tracker', 'gamification', 'budget', 'savings', 'finance app', 'PWA finance app', 'YNAB alternative', 'gamified budgeting']
      : ['finanças pessoais', 'controlo de gastos', 'gamificação', 'orçamento pessoal', 'poupança', 'gestão financeira', 'app finanças', 'app finanças portuguesa', 'alternativa YNAB', 'orçamento familiar', 'controlar despesas', 'finanças gamificadas'],
    authors:  [{ name: 'XP-Money' }],
    creator:  'XP-Money',
    publisher:'XP-Money',
    manifest: '/manifest.json',
    appleWebApp: {
      capable:        true,
      statusBarStyle: 'black-translucent',
      title:          'XP-Money',
    },
    formatDetection: { telephone: false },
    openGraph: {
      type:        'website',
      locale:      locale === 'en' ? 'en_US' : 'pt_PT',
      siteName:    'XP-Money',
      title:       t('meta.title_og'),
      description: t('meta.description_og'),
      url:         'https://xp-money.com',
    },
    // Twitter Cards — without this, links shared on X/Twitter render as
    // a plain blue text link. With `summary_large_image`, our 1200×630
    // OG image fills the card. Same image+title flips for EN locale via
    // generateMetadata().
    twitter: {
      card:        'summary_large_image',
      site:        '@xpmoney',  // placeholder until handle exists; harmless
      creator:     '@xpmoney',
      title:       t('meta.title_og'),
      description: t('meta.description_og'),
    },
    robots: {
      index:     true,
      follow:    true,
      googleBot: {
        index:                   true,
        follow:                  true,
        'max-image-preview':     'large',
        'max-snippet':           -1,
        'max-video-preview':     -1,
      },
    },
    verification: Object.keys(verification).length > 0 ? verification : undefined,
    category: 'finance',
  }
}

export const viewport: Viewport = {
  themeColor:   '#060b14',
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit:  'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve locale server-side from the xpmoney-locale cookie (+ Accept-
  // Language fallback). Drives TWO things that MUST be rendered correctly
  // on the first paint: the <html lang> attribute (screen readers, Google
  // Translate, browser auto-translate, SEO) and the Clerk UI localization
  // bundle (sign-in/up form labels and error strings).
  const locale = await getServerLocale()

  return (
    <ClerkProvider
      localization={locale === 'en' ? enUS : ptPT}
      appearance={{
        variables: {
          colorPrimary:    '#22c55e',
          colorBackground: '#0a0f1e',
          colorText:       '#f8fafc',
          borderRadius:    '0.75rem',
        },
      }}
    >
      <html lang={locale} className={inter.variable} suppressHydrationWarning>
        <head>
          {/* Site-wide JSON-LD — Organization + WebSite live in <head> so
              every page (including authenticated ones) inherits the brand
              identity. Per-page schemas (SoftwareApplication, FAQPage,
              Product, BreadcrumbList) are injected in their own page.tsx. */}
          <JsonLd schema={organization()} />
          <JsonLd schema={website(locale)} />
        </head>
        <body className="font-sans antialiased">
          {ADSENSE_CLIENT && (
            <Script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
          )}
          <PostHogProvider>
            <QueryProvider>
              <LocaleProvider>
                {/* Site-wide Neon Grid wallpaper — single WebGL context
                    mounted once here, behind every route. Respects
                    prefers-reduced-motion and pauses when the tab is
                    hidden (see ShaderCanvas). */}
                <SiteBackground />
                {/* `relative z-10` guarantees every page content sits
                    above the fixed z-0 background, regardless of what
                    stacking contexts the page's own wrappers create. */}
                <div className="relative z-10">
                  <Toaster>
                    {children}
                  </Toaster>
                </div>
                {/* Overlays — render last so they sit above all page chrome.
                    Both are no-ops when their conditions aren't met (banner
                    only when consent is undecided; install prompt only when
                    `beforeinstallprompt` fired and the app isn't already
                    standalone), so unconditionally mounting is cheap. */}
                <CookieConsentBanner />
                <PWAInstallPrompt />
              </LocaleProvider>
              {/* Vercel Speed Insights — Web Vitals (LCP, CLS, INP, FCP)
                  measured on real visitors. No cookies, no fingerprinting,
                  no consent banner needed. Free up to 25k datapoints/mo. */}
              <SpeedInsights />
            </QueryProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
