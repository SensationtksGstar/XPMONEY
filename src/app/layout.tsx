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

  return {
    metadataBase: new URL('https://xp-money.com'),
    alternates:   { canonical: '/' },
    title: {
      default:  title,
      template: '%s | XP-Money',
    },
    description: t('meta.description'),
    keywords: locale === 'en'
      ? ['personal finance', 'expense tracker', 'gamification', 'budget', 'savings', 'finance app']
      : ['finanças pessoais', 'controlo de gastos', 'gamificação', 'orçamento pessoal', 'poupança', 'gestão financeira', 'app finanças'],
    authors:  [{ name: 'XP-Money' }],
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
    },
    robots: { index: true, follow: true },
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
            </QueryProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
