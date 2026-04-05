'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence }      from 'framer-motion'
import { useUser }  from '@clerk/nextjs'
import { useVoltix } from '@/hooks/useVoltix'
import { useXP }     from '@/hooks/useXP'
import { useToast }  from '@/components/ui/toaster'
import { Zap, Star, TrendingUp, MessageCircle, Flame, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  VoltixCreature, EVO_NAMES, EVO_DESCRIPTIONS,
  EVO_REQUIREMENTS, MOOD_PALETTE,
} from '@/components/voltix/VoltixCreature'
import type { VoltixMood } from '@/types'

/* ── Mood config ─────────────────────────────────────────────────── */
const MOOD_MESSAGES: Record<VoltixMood, string[]> = {
  sad: [
    'As finanças estão difíceis. Estou aqui para ajudar.',
    'Cada euro registado é um passo na direção certa.',
    'Não desistas! Os melhores investidores já passaram por aqui.',
  ],
  neutral: [
    'Tudo estável. Que tal registares mais alguns movimentos?',
    'Ainda não tenho dados suficientes. Adiciona transações!',
    'Score médio: 50. Vamos tentar chegar aos 70?',
  ],
  happy: [
    'Estás no bom caminho! Continua assim. 📈',
    'O teu score melhorou esta semana. Excelente!',
    'Bom controlo das despesas. E a poupança?',
  ],
  excited: [
    'Incrível! O teu score está a disparar. Quase no elite! 🚀',
    'Taxa de poupança excelente este mês. Continua!',
    'As tuas missões estão quase concluídas. Vai lá! 💪',
  ],
  celebrating: [
    'LENDÁRIO! Top 1% dos utilizadores. Extraordinário! 🏆',
    'Parabéns! Atingiste a máxima saúde financeira.',
    'O Legendrix nunca esteve tão poderoso. Inspiras todos!',
  ],
}

const MOOD_LABELS: Record<VoltixMood, string> = {
  sad: 'Triste', neutral: 'Neutro', happy: 'Contente',
  excited: 'Animado!', celebrating: 'LENDÁRIO! 👑',
}

/* ── Evolution stage cards ───────────────────────────────────────── */
const EVO_STAGES = [1, 2, 3, 4, 5] as const

export default function VoltixPage() {
  const { user }            = useUser()
  const { voltix, loading } = useVoltix(user?.id ?? '')
  const { xp }              = useXP(user?.id ?? '')
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
          toast(`${b.icon} Badge desbloqueado: ${b.name}!`, 'xp')
        )
      })
      .catch(() => {})
  }, [toast])

  const mood    = (voltix?.mood ?? 'neutral') as VoltixMood
  const evo     = voltix?.evolution_level ?? 1
  const streak  = voltix?.streak_days ?? 0
  const palette = MOOD_PALETTE[mood]

  const msgs = MOOD_MESSAGES[mood]

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
          {EVO_NAMES[evo] ?? 'Voltix'}
        </h1>
        <p className="text-white/50 text-sm mt-0.5">O teu copiloto financeiro — evolui contigo</p>
      </div>

      {/* ── Main interactive card ── */}
      <motion.div
        className="glass-card p-8 flex flex-col items-center text-center cursor-pointer select-none relative overflow-hidden"
        style={{ borderColor: `${palette.body}30` }}
        whileTap={{ scale: 0.975 }}
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
        <VoltixCreature
          evo={displayEvo}
          mood={displayMood}
          className="w-48 h-48 mb-2 relative z-10"
        />

        {/* Preview label */}
        {preview && (
          <div className="absolute top-4 right-4 bg-white/10 text-white/60 text-[10px] font-bold px-2 py-1 rounded-full">
            PRÉVIA
          </div>
        )}

        {/* Name + evo badge */}
        <div className="flex items-center gap-2 mb-1 relative z-10">
          <span className="text-2xl font-bold text-white">{EVO_NAMES[displayEvo]}</span>
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full border"
            style={{ color: palette.body, borderColor: `${palette.body}40`, backgroundColor: `${palette.body}18` }}
          >
            EVO {displayEvo}/5
          </span>
        </div>

        {/* Mood */}
        <p className="text-sm font-semibold mb-4 relative z-10" style={{ color: palette.accent }}>
          {MOOD_LABELS[mood]}
        </p>

        {/* Rotating message */}
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.22 }}
            className="text-sm text-white/70 leading-relaxed px-2 mb-4 relative z-10"
          >
            {msgs[msgIdx]}
          </motion.p>
        </AnimatePresence>

        <p className="text-[11px] text-white/22 flex items-center gap-1 relative z-10">
          <MessageCircle className="w-3 h-3" /> Toca para mudar mensagem
        </p>
      </motion.div>

      {/* ── Streak ── */}
      {streak > 0 && (
        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 px-4 py-3 rounded-xl">
          <Flame className="w-6 h-6 text-orange-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-orange-400">{streak} dias consecutivos 🔥</p>
            <p className="text-xs text-white/40">Mantém o streak para ganhar XP bónus e evoluir mais rápido</p>
          </div>
        </div>
      )}

      {/* ── XP progress ── */}
      {xp && (
        <div className="glass-card p-5">
          <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> Progresso XP
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xl font-bold text-yellow-400 tabular-nums">{xp.xp_total ?? 0}</div>
              <div className="text-[11px] text-white/40 mt-0.5">XP total</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xl font-bold text-green-400 tabular-nums">{xp.level ?? 1}</div>
              <div className="text-[11px] text-white/40 mt-0.5">Nível</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xl font-bold text-white tabular-nums flex items-center justify-center gap-0.5">
                <Zap className="w-4 h-4 text-yellow-400" />
                {xp.xp_to_next_level ?? '—'}
              </div>
              <div className="text-[11px] text-white/40 mt-0.5">P/ subir</div>
            </div>
          </div>
          {/* XP bar */}
          {xp.xp_total != null && xp.xp_to_next_level != null && (
            <div>
              <div className="flex justify-between text-xs text-white/30 mb-1">
                <span>Nível {xp.level}</span>
                <span>Nível {(xp.level ?? 1) + 1}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: palette.body }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((xp.xp_in_current_level ?? 0) / ((xp.xp_in_current_level ?? 0) + (xp.xp_to_next_level ?? 1))) * 100)}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Evolution stages ── */}
      <div className="glass-card p-5">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Star className="w-3.5 h-3.5" /> Linha de evolução
        </h2>
        <div className="space-y-3">
          {EVO_STAGES.map(stage => {
            const isUnlocked = stage <= evo
            const isCurrent  = stage === evo
            const p = isUnlocked ? MOOD_PALETTE['happy'] : { body: '#334155', shade: '#1e293b', light: '#475569', accent: '#475569' }

            return (
              <motion.button
                key={stage}
                className={cn(
                  'w-full flex items-center gap-4 p-3.5 rounded-xl border transition-all text-left',
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
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {/* Mini creature preview */}
                <div className="w-14 h-14 flex-shrink-0 relative">
                  <VoltixCreature
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
                    <span className="text-sm font-bold text-white">{EVO_NAMES[stage]}</span>
                    {isCurrent && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${palette.body}25`, color: palette.body }}
                      >
                        ATUAL
                      </span>
                    )}
                    {isUnlocked && !isCurrent && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/45 leading-snug line-clamp-1">
                    {EVO_DESCRIPTIONS[stage]}
                  </p>
                  <p className="text-[10px] text-white/25 mt-1">
                    {EVO_REQUIREMENTS[stage]}
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
              </motion.button>
            )
          })}
        </div>
        <p className="text-xs text-white/25 text-center mt-3">
          Passa o cursor sobre cada forma para pré-visualizar
        </p>
      </div>

      {/* ── Tips ── */}
      <div className="glass-card p-5">
        <h2 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-yellow-400" /> Como evoluir mais rápido
        </h2>
        <div className="space-y-2.5">
          {[
            { icon: '📝', text: 'Regista transações diariamente (+10 XP cada)' },
            { icon: '🔥', text: 'Mantém o streak diário — 7 dias = +300 XP' },
            { icon: '🎯', text: 'Conclui missões para XP bónus' },
            { icon: '📈', text: 'Melhora o teu score de saúde financeira' },
            { icon: '🏆', text: 'Desbloqueia badges para XP extra' },
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
