import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import './globals.css'
import { PostHogProvider } from '@/components/providers/PostHogProvider'
import { QueryProvider }    from '@/components/providers/QueryProvider'
import { Toaster }          from '@/components/ui/toaster'

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
    'finanças pessoais',
    'controlo de gastos',
    'gamificação',
    'orçamento pessoal',
    'poupança',
    'gestão financeira',
    'app finanças',
  ],
  authors: [{ name: 'XP Money' }],
  openGraph: {
    type:        'website',
    locale:      'pt_PT',
    siteName:    'XP Money',
    title:       'XP Money — Controla as tuas finanças como um RPG',
    description: 'A única app que te recompensa por controlares o teu dinheiro.',
  },
  robots: {
    index:  true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor:    '#0a0f1e',
  width:         'device-width',
  initialScale:  1,
  maximumScale:  1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary:    '#22c55e',
          colorBackground: '#0a0f1e',
          colorText:       '#f8fafc',
          borderRadius:    '0.75rem',
        },
      }}
    >
      <html lang="pt" className={inter.variable} suppressHydrationWarning>
        <body className="font-sans antialiased">
          <PostHogProvider>
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
