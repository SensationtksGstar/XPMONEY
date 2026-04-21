import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),

  // Compress responses
  compress: true,

  // Hide "X-Powered-By: Next.js" — tiny but standard info leak.
  poweredByHeader: false,

  // Optimize packages — don't bundle server-only packages into client
  serverExternalPackages: ['@supabase/supabase-js'],

  experimental: {
    // Tree-shake large packages — only import icons/components actually used
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
    ],
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    return [
      {
        // Global security headers — hardened April 2026.
        // CSP is deliberately NOT set here yet — the app mixes Clerk,
        // PostHog, AdSense and Turnstile scripts and a strict policy
        // needs nonce infra + thorough regression testing before it can
        // be enforced. Scheduled as a separate pass.
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          {
            // 2-year HSTS with subdomains + preload. Vercel already sets
            // HSTS but we pin the exact policy so it doesn't silently
            // shrink on a platform default change.
            key:   'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            // Deny powerful browser APIs by default; allow camera only
            // on our origin (receipt scanner may use it). Clipboard read
            // is kept on self so paste-from-clipboard flows still work.
            key:   'Permissions-Policy',
            value: 'camera=(self), microphone=(), geolocation=(), payment=(), accelerometer=(), gyroscope=(), magnetometer=(), usb=()',
          },
          // DNS prefetch for outbound images (mascot CDN etc.). Safe.
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        // API responses must never be cached by browsers or CDNs —
        // they carry user-specific data and plan gates. Explicit here
        // so a future middleware or Vercel config can't accidentally
        // shorten `s-maxage=0` into something longer.
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
          { key: 'Pragma',        value: 'no-cache' },
          { key: 'Expires',       value: '0' },
        ],
      },
      {
        // Long cache for immutable Next.js chunks (unchanged)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
