'use client'

/**
 * AdBanner — Google AdSense responsive ad unit.
 *
 * Only renders for free-plan users.
 * Requires NEXT_PUBLIC_ADSENSE_CLIENT set to your publisher ID (ca-pub-XXXXXXXXXXXXXXXX).
 *
 * Ad slot IDs are configured via environment variables:
 *   NEXT_PUBLIC_ADSENSE_SLOT_FEED     → in-feed (between sections)
 *   NEXT_PUBLIC_ADSENSE_SLOT_BANNER   → horizontal banner
 */

import { useEffect, useRef } from 'react'
import { useUserPlan }       from '@/lib/contexts/UserPlanContext'
import { Crown }             from 'lucide-react'
import Link                  from 'next/link'

type AdVariant = 'feed' | 'banner'

const SLOT_MAP: Record<AdVariant, string> = {
  feed:   process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED   ?? '',
  banner: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BANNER ?? '',
}

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? ''

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

interface Props {
  variant?: AdVariant
  className?: string
}

export function AdBanner({ variant = 'feed', className = '' }: Props) {
  const { isFree } = useUserPlan()
  const adRef      = useRef<HTMLModElement>(null)
  const pushed     = useRef(false)

  useEffect(() => {
    if (!isFree || pushed.current) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch (err) {
      console.warn('[AdBanner] adsbygoogle push failed:', err)
    }
  }, [isFree])

  // Don't render for paid users
  if (!isFree) return null

  // AdSense not configured — show a friendly upgrade prompt as placeholder
  if (!CLIENT || !SLOT_MAP[variant]) {
    return (
      <div className={`relative ${className}`}>
        <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-white/20 mb-1 uppercase tracking-wider font-medium">Publicidade</div>
            <div className="text-xs text-white/40">
              Espaço reservado para anúncios · Remove anúncios com{' '}
              <Link href="/settings/billing" className="text-purple-400 hover:text-purple-300 font-semibold">
                Premium
              </Link>
            </div>
          </div>
          <Link
            href="/settings/billing"
            className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-black bg-green-400 px-2.5 py-1.5 rounded-lg hover:bg-green-300 transition-colors"
          >
            <Crown className="w-3 h-3" />
            Upgrade
          </Link>
        </div>
      </div>
    )
  }

  // Real AdSense unit
  return (
    <div className={`relative ${className}`}>
      <div className="text-[10px] text-white/20 text-right mb-1 uppercase tracking-wider">
        Publicidade ·{' '}
        <Link href="/settings/billing" className="hover:text-white/40 transition-colors">
          Remover com Premium
        </Link>
      </div>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT_MAP[variant]}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
