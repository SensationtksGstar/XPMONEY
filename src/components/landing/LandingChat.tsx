'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Send, User, MessageSquare } from 'lucide-react'

/** Avatar redondo com o retrato do Dragon Coin — usado no header e em cada
 *  mensagem do assistente para reforçar a identidade do agente em vez do
 *  placeholder genérico de estrelas. */
function DragonAvatar({ size = 36 }: { size?: number }) {
  return (
    <div
      className="relative rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 via-green-400 to-emerald-500 shadow-[0_0_20px_rgba(34,197,94,0.35)] flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <Image
        src="/dragon-coin.webp"
        alt=""
        aria-hidden
        width={size}
        height={size}
        sizes={`${size}px`}
        className="w-full h-full object-contain scale-[1.05]"
      />
    </div>
  )
}

/**
 * LandingChat — agente IA inline na página de FAQ.
 *
 * Desenho:
 *   - Inline (não floating bubble) para não ser intrusivo na primeira visita.
 *     Fica no bloco FAQ como alternativa às perguntas pré-escritas.
 *   - Histórico guardado em memória do componente (não persistido) — uma
 *     conversa de landing não precisa de storage cross-session.
 *   - Fallback explícito para /contacto quando o user quer humano.
 *
 * Segurança: mensagens truncadas a 500 chars client-side antes de enviar,
 * histórico limitado a 8 mensagens (o endpoint re-verifica).
 */

interface Message {
  role:    'user' | 'assistant'
  content: string
}

const MAX_INPUT = 500
const MAX_HISTORY = 8

const SEED_ASSISTANT: Message = {
  role: 'assistant',
  content: 'Olá! Sou o Dragon Coin 🐲 — o assistente da XP-Money. Pergunta-me sobre como funciona, preços, privacidade ou features Premium. Estou cá para te ajudar a decidir antes de criares conta.',
}

const QUICK_PROMPTS = [
  'Como funciona o score financeiro?',
  'O que entra no plano Premium?',
  'Preciso ligar o meu banco?',
  'Como cancelo a subscrição?',
]

export function LandingChat() {
  const [messages, setMessages] = useState<Message[]>([SEED_ASSISTANT])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Autoscroll on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    const trimmed = text.trim().slice(0, MAX_INPUT)
    if (!trimmed || loading) return

    const next: Message[] = [...messages, { role: 'user', content: trimmed }]
    // Keep the system-seeded assistant but cap the last N turns sent to the API
    const apiHistory = next.slice(-MAX_HISTORY)

    setMessages(next)
    setInput('')
    setErr(null)
    setLoading(true)

    try {
      const res = await fetch('/api/landing-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: apiHistory }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setErr(json?.error ?? 'Agente indisponível. Tenta novamente.')
        setLoading(false)
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
    } catch (e) {
      console.warn('[LandingChat] request failed:', e)
      setErr('Sem ligação. Verifica a internet.')
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  return (
    <section className="bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 bg-white/[0.03]">
        <DragonAvatar size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">Dragon Coin</p>
          <p className="text-[11px] text-white/50 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Online · respostas em segundos
          </p>
        </div>
        <Link
          href="/contacto"
          className="text-[11px] text-white/60 hover:text-white transition-colors inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/5"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Falar com humano
        </Link>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="h-72 overflow-y-auto px-5 py-4 space-y-3 bg-[#050a14]"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {m.role === 'user' ? (
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-white/10 text-white/70">
                <User className="w-3.5 h-3.5" />
              </div>
            ) : (
              <DragonAvatar size={28} />
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-green-500/15 text-white rounded-tr-sm'
                  : 'bg-white/5 text-white/85 rounded-tl-sm'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2.5">
            <DragonAvatar size={28} />
            <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3.5 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts (only shown at start) */}
      {messages.length === 1 && !loading && (
        <div className="px-5 pt-3 pb-2 border-t border-white/5 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="text-[11px] text-white/70 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-full transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {err && (
        <p role="alert" className="px-5 pt-2 text-[11px] text-red-300">
          {err}
        </p>
      )}

      {/* Input */}
      <form onSubmit={onSubmit} className="flex items-center gap-2 px-4 py-3 border-t border-white/5 bg-[#050a14]">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.slice(0, MAX_INPUT))}
          maxLength={MAX_INPUT}
          disabled={loading}
          placeholder="Pergunta o que quiseres…"
          className="flex-1 bg-white/5 border border-white/10 focus:border-green-400/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          aria-label="Enviar mensagem"
          className="w-11 h-11 flex-shrink-0 flex items-center justify-center bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-white/40 text-black rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      <p className="px-4 py-2 text-[10px] text-white/30 text-center border-t border-white/5">
        As respostas são geradas por IA. Para pedidos formais usa o{' '}
        <Link href="/contacto" className="underline hover:text-white/60">formulário de contacto</Link>.
      </p>
    </section>
  )
}
