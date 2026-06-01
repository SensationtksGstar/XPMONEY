'use client'

import { useState, useEffect, useRef } from 'react'

import { useUser }  from '@clerk/nextjs'
import { useVoltix } from '@/hooks/useVoltix'
import { useXP }     from '@/hooks/useXP'
import { useToast }  from '@/components/ui/toaster'
import { Zap, Star, TrendingUp, MessageCircle, Flame, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MOOD_PALETTE } from '@/components/voltix/VoltixCreature'
import {
  MascotCreature,
  getMascotEvoName,
  getMascotEvoDescription,
  getMascotEvoRequirement,
  getMascotMaxEvo,
  type MascotGender,
} from '@/components/voltix/MascotCreature'
import { useT } from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'
import type { VoltixMood } from '@/types'

/* ── Mood config ─────────────────────────────────────────────────── */
const MOOD_MESSAGE_KEYS: Record<VoltixMood, TranslationKey[]> = {
  sad:         ['voltix.mood_sad_1',         'voltix.mood_sad_2',         'voltix.mood_sad_3'],
  neutral:     ['voltix.mood_neutral_1',     'voltix.mood_neutral_2',     'voltix.mood_neutral_3'],
  happy:       ['voltix.mood_happy_1',       'voltix.mood_happy_2',       'voltix.mood_happy_3'],
  excited:     ['voltix.mood_excited_1',     'voltix.mood_excited_2',     'voltix.mood_excited_3'],
  celebrating: ['voltix.mood_celebrating_1', 'voltix.mood_celebrating_2', 'voltix.mood_celebrating_3'],
}

const MOOD_LABEL_KEYS: Record<VoltixMood, TranslationKey> = {
  sad: 'voltix.mood.sad',
  neutral: 'voltix.mood.neutral',
  happy: 'voltix.mood.happy',
  excited: 'voltix.mood.excited',
  celebrating: 'voltix.mood.celebrating',
}

export default function VoltixPage() {
  const { user }            = useUser()
  const { voltix, loading } = useVoltix(user?.id ?? '')
  const { xp }              = useXP(user?.id ?? '')
  const t                   = useT()
  const [msgIdx, setMsgIdx] = useState(0)
  const [tapped, setTapped] = useState(false)
  const [preview, setPreview] = useState<number | null>(null)
  const { toast }           = useToast()
  const checkinDone         = useRef(false)

  // Daily check-in
  useEffect(() => {
    if (checkinDone.current) return
    checkinDone.current = true
    fetch('/api/daily-checkin', { method: 'POST' })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (!res) return
        res.badges_awarded?.forEach((b: { name: string; icon: string }) =>
          toast(t('voltix.badge_toast', { icon: b.icon, name: b.name }), 'xp')
        )
      })
      .catch(err => {
        console.warn('[voltix] daily-checkin failed:', err)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])

  const mood    = (voltix?.mood ?? 'neutral') as VoltixMood
  const evo     = voltix?.evolution_level ?? 1
  const streak  = voltix?.streak_days ?? 0
  const gender  = (voltix?.mascot_gender ?? 'voltix') as MascotGender
  const palette = MOOD_PALETTE[mood]
  const maxEvo  = getMascotMaxEvo(gender)
  const evoStages = Array.from({ length: maxEvo }, (_, i) => i + 1)

  const msgs = MOOD_MESSAGE_KEYS[mood]

  // Creature to display (real or preview)
  const displayEvo  = preview ?? evo
  const displayMood = preview ? 'happy' as VoltixMood : mood

  function handleTap() {
    setTapped(true)
    setMsgIdx(i => (i + 1) % msgs.length)
    setTimeout(() => setTapped(false), 280)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up max-w-lg mx-auto">
        <div className="h-8 bg-white/10 rounded w-40 animate-pulse" />
        <div className="glass-card p-12 animate-pulse flex flex-col items-center gap-4">
          <div className="w-40 h-40 rounded-full bg-white/10" />
          <div className="h-5 w-36 bg-white/10 rounded" />
          <div className="h-4 w-52 bg-white/10 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-24 max-w-lg mx-auto animate-fade-in-up">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {getMascotEvoName(gender, evo)}
        </h1>
        <p className="text-white/50 text-sm mt-0.5">{t('voltix.subtitle')}</p>
      </div>

      {/* ── Main interactive card ── */}
      <div
        className="glass-card p-8 flex flex-col items-center text-center cursor-pointer select-none relative overflow-hidden active:scale-[0.975] transition-transform"
        style={{ borderColor: `${palette.body}30` }}
        onClick={handleTap}
      >
        {/* Top gradient bar */}
        <div
          className="absolute inset-x-0 top-0 h-1 opacity-70"
          style={{ background: `linear-gradient(90deg, transparent, ${palette.body}, transparent)` }}
        />
        {/* Background glow */}
        <div
          className="absolute inset-0 opacity-[0.04] rounded-2xl"
          style={{ background: `radial-gradient(ellipse at 50% 30%, ${palette.body}, transparent 70%)` }}
        />

        {/* Creature */}
        <MascotCreature
          gender={gender}
          evo={displayEvo}
          mood={displayMood}
          className="w-48 h-48 mb-2 relative z-10"
        />

        {/* Preview label */}
        {preview && (
          <div className="absolute top-4 right-4 bg-white/10 text-white/60 text-[10px] font-bold px-2 py-1 rounded-full">
            {t('voltix.preview_chip')}
          </div>
        )}

        {/* Name + evo badge */}
        <div className="flex items-center gap-2 mb-1 relative z-10">
          <span className="text-2xl font-bold text-white">{getMascotEvoName(gender, displayEvo)}</span>
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full border"
            style={{ color: palette.body, borderColor: `${palette.body}40`, backgroundColor: `${palette.body}18` }}
          >
            EVO {displayEvo}/{maxEvo}
          </span>
        </div>

        {/* Mood */}
        <p className="text-sm font-semibold mb-4 relative z-10" style={{ color: palette.accent }}>
          {t(MOOD_LABEL_KEYS[mood])}
        </p>

        {/* Rotating message */}
        <p
          key={msgIdx}
          className="text-sm text-white/70 leading-relaxed px-2 mb-4 relative z-10 animate-fade-in-up"
        >
          {t(msgs[msgIdx])}
        </p>

        <p className="text-[11px] text-white/22 flex items-center gap-1 relative z-10">
          <MessageCircle className="w-3 h-3" /> {t('voltix.tap_hint')}
        </p>
      </div>

      {/* ── Streak ── */}
      {streak > 0 && (
        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 px-4 py-3 rounded-xl">
          <Flame className="w-6 h-6 text-orange-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-orange-400">{t('voltix.streak_days', { days: streak })}</p>
            <p className="text-xs text-white/40">{t('voltix.streak_sub')}</p>
          </div>
        </div>
      )}

      {/* ── XP progress ── */}
      {xp && (
        <div className="glass-card p-5">
          <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> {t('voltix.xp_section')}
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xl font-bold text-yellow-400 tabular-nums">{xp.xp_total ?? 0}</div>
              <div className="text-[11px] text-white/40 mt-0.5">{t('voltix.xp_total')}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xl font-bold text-green-400 tabular-nums">{xp.level ?? 1}</div>
              <div className="text-[11px] text-white/40 mt-0.5">{t('voltix.xp_level')}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xl font-bold text-white tabular-nums flex items-center justify-center gap-0.5">
                <Zap className="w-4 h-4 text-yellow-400" />
                {xp.xp_to_next_level ?? '—'}
              </div>
              <div className="text-[11px] text-white/40 mt-0.5">{t('voltix.xp_to_next')}</div>
            </div>
          </div>
          {/* XP bar */}
          {xp.xp_total != null && xp.xp_to_next_level != null && (
            <div>
              <div className="flex justify-between text-xs text-white/30 mb-1">
                <span>{t('voltix.level_n', { n: xp.level ?? 1 })}</span>
                <span>{t('voltix.level_n', { n: (xp.level ?? 1) + 1 })}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    backgroundColor: palette.body,
                    width: `${Math.min(100, ((xp.xp_in_current_level ?? 0) / ((xp.xp_in_current_level ?? 0) + (xp.xp_to_next_level ?? 1))) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Evolution stages ── */}
      <div className="glass-card p-5">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Star className="w-3.5 h-3.5" /> {t('voltix.evo_line')}
        </h2>
        <div className="space-y-3">
          {evoStages.map(stage => {
            const isUnlocked = stage <= evo
            const isCurrent  = stage === evo
            const p = isUnlocked ? MOOD_PALETTE['happy'] : { body: '#334155', shade: '#1e293b', light: '#475569', accent: '#475569' }

            return (
              <button
                key={stage}
                className={cn(
                  'w-full flex items-center gap-4 p-3.5 rounded-xl border transition-all text-left hover:scale-[1.01] active:scale-[0.99]',
                  isCurrent
                    ? 'border-opacity-60'
                    : isUnlocked
                      ? 'border-white/15 bg-white/[0.03]'
                      : 'border-white/5 bg-white/[0.02] opacity-50'
                )}
                style={isCurrent ? {
                  borderColor: `${palette.body}55`,
                  backgroundColor: `${palette.body}10`,
                } : {}}
                onMouseEnter={() => setPreview(stage)}
                onMouseLeave={() => setPreview(null)}
                onTouchStart={() => setPreview(stage)}
                onTouchEnd={() => setPreview(null)}
              >
                {/* Mini creature preview */}
                <div className="w-14 h-14 flex-shrink-0 relative">
                  <MascotCreature
                    gender={gender}
                    evo={stage}
                    mood={isUnlocked ? 'happy' : 'neutral'}
                    className="w-full h-full"
                    animate={false}
                  />
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                      <Shield className="w-5 h-5 text-white/40" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-white">{getMascotEvoName(gender, stage)}</span>
                    {isCurrent && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${palette.body}25`, color: palette.body }}
                      >
                        {t('voltix.current')}
                      </span>
                    )}
                    {isUnlocked && !isCurrent && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/45 leading-snug line-clamp-1">
                    {getMascotEvoDescription(gender, stage)}
                  </p>
                  <p className="text-[10px] text-white/25 mt-1">
                    {getMascotEvoRequirement(gender, stage)}
                  </p>
                </div>

                {/* Evo number badge */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={{
                    backgroundColor: isUnlocked ? `${p.body}25` : 'rgba(255,255,255,0.05)',
                    color: isUnlocked ? p.body : '#475569',
                  }}
                >
                  {stage}
                </div>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-white/25 text-center mt-3">
          {t('voltix.preview_footer')}
        </p>
      </div>

      {/* ── Tips ── */}
      <div className="glass-card p-5">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-yellow-400" /> {t('voltix.tips_title')}
        </h2>
        <div className="space-y-2.5">
          {[
            { icon: '📝', text: t('voltix.tip1') },
            { icon: '🔥', text: t('voltix.tip2') },
            { icon: '🎯', text: t('voltix.tip3') },
            { icon: '📈', text: t('voltix.tip4') },
            { icon: '🏆', text: t('voltix.tip5') },
          ].map((tip, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-base w-6 text-center flex-shrink-0">{tip.icon}</span>
              <span className="text-white/55">{tip.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
