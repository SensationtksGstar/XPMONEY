import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { getServerT } from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * LandingFooter — professional footer with proper IA columns.
 *
 * Design brief: make the app look established. A barebones single-line
 * footer (what we had before) reads as "one person's side project". A
 * columned footer with product / company / legal is what every SaaS
 * landing ships — the information doesn't have to be extensive, but the
 * *shape* signals maturity.
 *
 * Every link here must either exist or be clearly "em breve" so we don't
 * 404 visitors. Broken footer links are one of the fastest ways to lose
 * credibility.
 */

type FooterLink = { labelKey: TranslationKey; href: string; soon?: boolean }
type FooterColumn = { titleKey: TranslationKey; links: FooterLink[] }

const COLUMNS: FooterColumn[] = [
  {
    titleKey: 'landing.footer.col1_title',
    links: [
      { labelKey: 'landing.footer.col1_l1',  href: '/#funcionalidades' },
      { labelKey: 'landing.footer.col1_l2',  href: '/#precos' },
      { labelKey: 'landing.footer.col1_l3',  href: '/dashboard' },
      { labelKey: 'landing.footer.col1_l4',  href: '/cursos' },
    ],
  },
  {
    titleKey: 'landing.footer.col2_title',
    links: [
      { labelKey: 'landing.footer.col2_l1',  href: '/sobre',    soon: true },
      { labelKey: 'landing.footer.col2_l2',  href: '/blog' },
      { labelKey: 'landing.footer.col2_l3',  href: '/contacto' },
    ],
  },
  {
    titleKey: 'landing.footer.col3_title',
    links: [
      { labelKey: 'landing.footer.col3_l1', href: '/termos'       },
      { labelKey: 'landing.footer.col3_l2', href: '/privacidade'  },
      { labelKey: 'landing.footer.col3_l3', href: '/cookies'      },
    ],
  },
]

export async function LandingFooter() {
  const t = await getServerT()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-white/5 px-6 pt-14 pb-8 bg-[#04070e]">
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-10">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Logo size={32} />
              <span className="font-bold text-lg text-white tracking-tight">XP-Money</span>
            </Link>
            <p className="text-sm text-white/55 leading-relaxed max-w-xs mb-4">
              {t('landing.footer.tagline')}
            </p>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {t('landing.footer.status')}
              </span>
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map(col => (
            <div key={col.titleKey}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">
                {t(col.titleKey)}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map(l => {
                  const label = t(l.labelKey)
                  return (
                    <li key={l.labelKey}>
                      {l.soon ? (
                        <span className="text-sm text-white/30 cursor-not-allowed flex items-center gap-2">
                          {label}
                          <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded uppercase">{t('landing.footer.soon')}</span>
                        </span>
                      ) : (
                        <Link
                          href={l.href}
                          className="text-sm text-white/60 hover:text-white transition-colors"
                        >
                          {label}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <p>{t('landing.footer.rights', { year })}</p>
          <div className="flex items-center gap-4">
            <span>{t('landing.footer.made_pt')}</span>
            <span>·</span>
            <span>{t('landing.footer.stripe')}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
