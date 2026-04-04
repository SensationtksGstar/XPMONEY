'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser }      from '@clerk/nextjs'
import { useVoltix }    from '@/hooks/useVoltix'
import { useXP }        from '@/hooks/useXP'
import { useToast }     from '@/components/ui/toaster'
import { Zap, MessageCircle, TrendingUp, Star } from 'lucide-react'
import { cn }           from '@/lib/utils'
import type { VoltixMood } from '@/types'

const MOOD_CONFIG: Record<VoltixMood, {
  emoji:     string
  label:     string
  messages:  string[]
  bgColor:   string
  textColor: string
  glowColor: string
}> = {
  sad: {
    emoji: '😢', label: 'Triste',
    messages: [
      'As finanças estão difíceis. Estou aqui para ajudar.',
      'Cada euro registado é um passo na direção certa.',
      'Não desistas! Os melhores investidores já passaram por aqui.',
    ],
    bgColor: 'bg-red-500/10', textColor: 'text-red-400', glowColor: 'shadow-red-500/20',
  },
  neutral: {
    emoji: '😐', label: 'Neutro',
    messages: [
      'Tudo estável. Que tal registares mais alguns movimentos?',
      'Ainda não tenho dados suficientes para te aconselhar. Adiciona transações!',
      'O score médio é 50. Vamos tentar chegar aos 70?',
    ],
    bgColor: 'bg-slate-500/10', textColor: 'text-slate-400', glowColor: 'shadow-slate-500/20',
  },
  happy: {
    emoji: '😊', label: 'Contente',
    messages: [
      'Estás no bom caminho! Continua assim.',
      'O teu score melhorou esta semana. 📈',
      'Já tens um bom controlo das despesas. E a poupança?',
    ],
    bgColor: 'bg-green-500/10', textColor: 'text-green-400', glowColor: 'shadow-green-500/20',
  },
  excited: {
    emoji: '🤩', label: 'Animado',
    messages: [
      'Incrível! O teu score está a subir. Estás quase no elite!',
      'Taxa de poupança excelente este mês! Continue!',
      'As tuas missões estão quase concluídas. Vai lá! 💪',
    ],
    bgColor: 'bg-yellow-500/10', textColor: 'text-yellow-400', glowColor: 'shadow-yellow-500/30',
  },
  celebrating: {
    emoji: '🎉', label: 'A celebrar!',
    messages: [
      'Score Elite! Estás no top 1% dos utilizadores. Lendário! 🏆',
      'Parabéns! Atingiste a máxima saúde financeira.',
      'O Voltix nunca esteve tão feliz. Continua a inspirar!',
    ],
    bgColor: 'bg-purple-500/10', textColor: 'text-purple-400', glowColor: 'shadow-purple-500/30',
  },
}

const EVO_EMOJIS = ['😢', '😐', '😊', '🤩', '🎉']

export default function VoltixPage() {
  const { user }         = useUser()
  const { voltix, loading } = useVoltix(user?.id ?? '')
  const { xp }           = useXP(user?.id ?? '')
  const [msgIndex, setMsgIndex] = useState(0)
  const [tapped, setTapped]     = useState(false)
  const { toast }        = useToast()
  const checkinCalled    = useRef(false)

  // Daily check-in — fires once on mount, ref prevents double-call in React Strict Mode
  useEffect(() => {
    if (checkinCalled.current) return
    checkinCalled.current = true

    fetch('/api/daily-checkin', { method: 'POST' })
      .then(res => res.ok ? res.json() : null)
      .then((result) => {
        if (!result) return
        if (result.badges_awarded && result.badges_awarded.length > 0) {
          result.badges_awarded.forEach((badge: { name: string; icon: string }) => {
            toast(`${badge.icon} Novo badge desbloqueado: ${badge.name}!`, 'xp')
          })
        }
      })
      .catch(() => { /* best-effort — never crash the page */ })
  }, [toast])

  const mood   = voltix?.mood ?? 'neutral'
  const config = MOOD_CONFIG[mood]
  const evo    = voltix?.evolution_level ?? 1
  const streak = voltix?.streak_days ?? 0

  function handleTap() {
    setTapped(true)
    setMsgIndex(i => (i + 1) % config.messages.length)
    setTimeout(() => setTapped(false), 300)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-white">Voltix</h1>
          <p className="text-white/50 text-sm mt-0.5">O teu copiloto financeiro pessoal</p>
        </div>
        <div className="glass-card p-12 animate-pulse flex flex-col items-center gap-4">
          <div className="w-28 h-28 rounded-full bg-white/10" />
          <div className="h-4 w-32 bg-white/10 rounded" />
          <div className="h-3 w-48 bg-white/10 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in-up pb-24 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Voltix</h1>
        <p className="text-white/50 text-sm mt-0.5">O teu copiloto financeiro pessoal</p>
      </div>

      {/* Card principal — interativo */}
      <motion.div
        className={cn(
          'glass-card p-8 flex flex-col items-center text-center cursor-pointer select-none',
          config.bgColor
        )}
        whileTap={{ scale: 0.97 }}
        onClick={handleTap}
      >
        {/* Emoji animado */}
        <motion.div
          key={tapped ? 'tapped' : 'idle'}
          initial={{ scale: 0.8, rotate: tapped ? -10 : 0 }}
          animate={{ scale: 1, rotate: 0 }}
          className={cn('text-8xl mb-4', config.glowColor)}
          style={{ filter: `drop-shadow(0 0 24px currentColor)` }}
        >
          {config.emoji}
        </motion.div>

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl font-bold text-white">Voltix</span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border border-current/20', config.textColor, config.bgColor)}>
            Evo {evo}
          </span>
        </div>
        <p className={cn('text-sm font-semibold mb-4', config.textColor)}>{config.label}</p>

        {/* Mensagem animada */}
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-sm text-white/70 leading-relaxed px-2 mb-4"
          >
            {config.messages[msgIndex]}
          </motion.p>
        </AnimatePresence>

        <p className="text-[11px] text-white/20 flex items-center gap-1">
          <MessageCircle className="w-3 h-3" /> Toca para mudar mensagem
        </p>
      </motion.div>

      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 px-4 py-3 rounded-xl">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-sm font-semibold text-orange-400">{streak} dias seguidos</p>
            <p className="text-xs text-white/40">Mantém o streak para mais XP</p>
          </div>
        </div>
      )}

      {/* Evolução */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Star className="w-3.5 h-3.5" /> Evolução do Voltix
        </h2>
        <div className="flex justify-between gap-2">
          {EVO_EMOJIS.map((e, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all',
                i + 1 === evo
                  ? 'bg-white/10 border-green-500/50 scale-105'
                  : i + 1 < evo
                    ? 'bg-white/5 border-white/10 opacity-60'
                    : 'border-white/5 opacity-25'
              )}
            >
              <span className="text-2xl">{e}</span>
              <span className="text-[10px] text-white/40">Evo {i + 1}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/30 text-center mt-3">
          A evolução sobe com o teu score de saúde financeira
        </p>
      </div>

      {/* XP resumo */}
      {xp && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> O teu progresso
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-lg font-bold text-yellow-400 tabular-nums">{xp.xp_total ?? 0}</div>
              <div className="text-[11px] text-white/40 mt-0.5">XP total</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-lg font-bold text-green-400 tabular-nums">{xp.level ?? 1}</div>
              <div className="text-[11px] text-white/40 mt-0.5">Nível</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-lg font-bold text-white tabular-nums flex items-center justify-center gap-0.5">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                {xp.xp_to_next_level ?? '—'}
              </div>
              <div className="text-[11px] text-white/40 mt-0.5">Para subir</div>
            </div>
          </div>
        </div>
      )}

      {/* Histórico de mensagens */}
      <div>
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
          O Voltix disse recentemente
        </h2>
        <div className="space-y-3">
          {[
            { msg: 'Parabéns! Poupaste este mês comparado ao mês passado. 🎉', time: 'Hoje' },
            { msg: 'Nova missão disponível: "7 dias seguidos". +300 XP se conseguires!', time: 'Ontem' },
            { msg: 'Bom trabalho a registar as despesas! Continua assim.', time: 'Há 2 dias' },
          ].map((item, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-3">
              <span className="text-2xl flex-shrink-0">⚡</span>
              <div>
                <p className="text-sm text-white/80">{item.msg}</p>
                <p className="text-xs text-white/30 mt-1">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
