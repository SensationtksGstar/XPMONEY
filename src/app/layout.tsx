import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import Script from 'next/script'
import './globals.css'
import { PostHogProvider } from '@/components/providers/PostHogProvider'
import { QueryProvider }   from '@/components/providers/QueryProvider'
import { Toaster }         from '@/components/ui/toaster'

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? ''

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default:  'XP Money — Controla as tuas finanças como um RPG',
    template: '%s | XP Money',
  },
  description:
    'A app de finanças pessoais gamificada que te recompensa por controlares o teu dinheiro. Score de saúde financeira, missões, XP e o Voltix ao teu lado.',
  keywords: [
    'finanças pessoais', 'controlo de gastos', 'gamificação',
    'orçamento pessoal', 'poupança', 'gestão financeira', 'app finanças',
  ],
  authors:  [{ name: 'XP Money' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'black-translucent',
    title:          'XP Money',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type:        'website',
    locale:      'pt_PT',
    siteName:    'XP Money',
    title:       'XP Money — Controla as tuas finanças como um RPG',
    description: 'A única app que te recompensa por controlares o teu dinheiro.',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor:   '#060b14',
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit:  'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary:    '#22c55e',
          colorBackground: '#0a0f1e',
          colorText:       '#f8fafc',
          borderRadius:    '0.75rem',
        },
      }}
    >
      <html lang="pt" className={inter.variable} suppressHydrationWarning>
        <head>
          {/* Google AdSense — only loads when publisher ID is configured */}
          {ADSENSE_CLIENT && (
            <Script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
          )}
        </head>
        <body className="font-sans antialiased">
          <PostHogProvider>
            <QueryProvider>
              <Toaster>
                {children}
              </Toaster>
            </QueryProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
