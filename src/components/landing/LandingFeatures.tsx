import {
  ScanLine,
  FileText,
  Trophy,
  Target,
  GraduationCap,
  Sparkles,
  Shield,
  Smartphone,
  Sword,
  PiggyBank,
} from 'lucide-react'
import { getServerT } from '@/lib/i18n/server'

/**
 * LandingFeatures — 10-card feature grid covering what actually exists today.
 *
 * April 2026: extended from 8 to 10 cards after audit flagged Mata-Dívidas
 * and Orçamento 50/30/20 as missing from the landing despite being shipped
 * features. Reorder so the highest-conversion items (mascot/score/scan)
 * stay above the fold on a 3-col grid; PWA + Privacy fall to the bottom.
 *
 * Each card: one icon, one title, one-sentence promise, one concrete proof
 * point. Proof points are the hook — "score financeiro" alone is abstract,
 * "um número de 0-100" is what sticks.
 */

export async function LandingFeatures() {
  const t = await getServerT()

  const FEATURES = [
    {
      icon:  <Trophy     className="w-5 h-5" />,
      color: 'text-yellow-300',
      bg:    'bg-yellow-500/10',
      title: t('landing.features.c1_title'),
      desc:  t('landing.features.c1_desc'),
      proof: t('landing.features.c1_proof'),
    },
    {
      icon:  <Sparkles   className="w-5 h-5" />,
      color: 'text-green-300',
      bg:    'bg-green-500/10',
      title: t('landing.features.c2_title'),
      desc:  t('landing.features.c2_desc'),
      proof: t('landing.features.c2_proof'),
    },
    {
      icon:  <ScanLine   className="w-5 h-5" />,
      color: 'text-purple-300',
      bg:    'bg-purple-500/10',
      title: t('landing.features.c3_title'),
      desc:  t('landing.features.c3_desc'),
      proof: t('landing.features.c3_proof'),
    },
    {
      icon:  <FileText   className="w-5 h-5" />,
      color: 'text-blue-300',
      bg:    'bg-blue-500/10',
      title: t('landing.features.c4_title'),
      desc:  t('landing.features.c4_desc'),
      proof: t('landing.features.c4_proof'),
    },
    {
      icon:  <Target     className="w-5 h-5" />,
      color: 'text-orange-300',
      bg:    'bg-orange-500/10',
      title: t('landing.features.c5_title'),
      desc:  t('landing.features.c5_desc'),
      proof: t('landing.features.c5_proof'),
    },
    {
      icon:  <PiggyBank  className="w-5 h-5" />,
      color: 'text-rose-300',
      bg:    'bg-rose-500/10',
      title: t('landing.features.c9_title'),
      desc:  t('landing.features.c9_desc'),
      proof: t('landing.features.c9_proof'),
    },
    {
      icon:  <Sword      className="w-5 h-5" />,
      color: 'text-red-300',
      bg:    'bg-red-500/10',
      title: t('landing.features.c10_title'),
      desc:  t('landing.features.c10_desc'),
      proof: t('landing.features.c10_proof'),
    },
    {
      icon:  <GraduationCap className="w-5 h-5" />,
      color: 'text-pink-300',
      bg:    'bg-pink-500/10',
      title: t('landing.features.c6_title'),
      desc:  t('landing.features.c6_desc'),
      proof: t('landing.features.c6_proof'),
    },
    {
      icon:  <Smartphone className="w-5 h-5" />,
      color: 'text-cyan-300',
      bg:    'bg-cyan-500/10',
      title: t('landing.features.c7_title'),
      desc:  t('landing.features.c7_desc'),
      proof: t('landing.features.c7_proof'),
    },
    {
      icon:  <Shield     className="w-5 h-5" />,
      color: 'text-emerald-300',
      bg:    'bg-emerald-500/10',
      title: t('landing.features.c8_title'),
      desc:  t('landing.features.c8_desc'),
      proof: t('landing.features.c8_proof'),
    },
  ]

  return (
    <section className="px-6 py-24 max-w-6xl mx-auto">
      <div className="text-center mb-14">
        <p className="text-green-400 font-semibold text-sm uppercase tracking-widest mb-2">{t('landing.features.eyebrow')}</p>
        <h2 className="text-4xl md:text-5xl font-bold">{t('landing.features.title')}</h2>
        <p className="text-white/55 text-lg mt-4 max-w-2xl mx-auto">
          {t('landing.features.sub_a')} <strong className="text-white/80">{t('landing.features.sub_p1')}</strong>{t('landing.features.sub_sep1')}{' '}
          <strong className="text-white/80">{t('landing.features.sub_p2')}</strong> {t('landing.features.sub_sep2')}{' '}
          <strong className="text-white/80">{t('landing.features.sub_p3')}</strong>{t('landing.features.sub_end')}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map(f => (
          <article
            key={f.title}
            className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 hover:bg-white/[0.07] transition-all"
          >
            <div className={`${f.bg} ${f.color} w-10 h-10 rounded-xl flex items-center justify-center mb-4`}>
              {f.icon}
            </div>
            <h3 className="font-bold text-white mb-1.5 text-[15px]">{f.title}</h3>
            <p className="text-sm text-white/55 leading-relaxed mb-4">{f.desc}</p>
            <p className="text-[10px] text-white/35 border-t border-white/5 pt-3 font-medium uppercase tracking-wider">
              {f.proof}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
