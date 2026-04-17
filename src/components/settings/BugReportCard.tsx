'use client'

import { useState } from 'react'
import { Bug, Check, Send } from 'lucide-react'

/**
 * BugReportCard — settings card that lets any user report a bug to the admin
 * without ever seeing the admin's email address.
 *
 * Flow: user writes a title + description → POST /api/bug-report → row in
 * Supabase `bug_reports` table. The admin reads them from the dashboard.
 *
 * Privacy / UX:
 *   - No admin email exposed anywhere.
 *   - We DO pull the user's Clerk email server-side so we can respond back
 *     — surfacing that in the card so the user knows we'll contact them.
 *   - `pageUrl` is best-effort (window.location.href) so we know where the
 *     issue occurred. No tracking beyond that.
 */
export function BugReportCard() {
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [status,      setStatus]      = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending' || status === 'sent') return

    setStatus('sending')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/bug-report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:      title.trim(),
          description: description.trim(),
          pageUrl:    typeof window !== 'undefined' ? window.location.href : undefined,
          // Vercel exposes this at build time via NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
          appVersion: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setStatus('error')
        setErrorMsg(json?.error ?? 'Falha ao enviar. Tenta novamente.')
        return
      }

      setStatus('sent')
      setTitle('')
      setDescription('')
      // Reset back to idle after a pause so the user can submit another report
      setTimeout(() => setStatus('idle'), 4500)
    } catch (err) {
      console.warn('[BugReportCard] submit failed:', err)
      setStatus('error')
      setErrorMsg('Sem ligação. Verifica a internet e tenta de novo.')
    }
  }

  const disabled = status === 'sending' || title.trim().length < 3 || description.trim().length < 10

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
        <Bug className="w-4 h-4 text-orange-400" />
        Reportar um bug
      </h2>
      <p className="text-sm text-white/50 mb-4 leading-relaxed">
        Encontraste algo estranho? Conta-nos — vamos corrigir o mais rápido possível.
        Respondemos pelo teu email da conta.
      </p>

      {status === 'sent' ? (
        <div
          role="status"
          className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-300 rounded-lg px-3 py-3 text-sm animate-fade-in"
        >
          <span className="w-7 h-7 rounded-full bg-green-500 text-black flex items-center justify-center flex-shrink-0">
            <Check className="w-4 h-4" strokeWidth={3} />
          </span>
          <div>
            <p className="font-semibold">Report enviado, obrigado!</p>
            <p className="text-xs text-green-300/75">Vamos analisar e entrar em contacto se precisarmos de mais detalhes.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="bug-title" className="block text-xs font-medium text-white/60 mb-1.5">
              Título do problema
            </label>
            <input
              id="bug-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Ex: O botão de guardar não funciona"
              className="w-full bg-white/5 border border-white/10 focus:border-orange-400/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label htmlFor="bug-desc" className="block text-xs font-medium text-white/60 mb-1.5">
              Descrição (o que aconteceu? O que esperavas?)
            </label>
            <textarea
              id="bug-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={4000}
              rows={4}
              placeholder="Descreve o que estavas a fazer quando o bug apareceu e, se possível, como reproduzi-lo."
              className="w-full bg-white/5 border border-white/10 focus:border-orange-400/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors resize-none"
              required
            />
            <p className="text-[10px] text-white/30 mt-1 text-right">
              {description.length}/4000
            </p>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {status === 'sending' ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-orange-300/30 border-t-orange-300 animate-spin" />
                A enviar…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar report
              </>
            )}
          </button>

          <p className="text-[10px] text-white/30 leading-snug">
            Enviamos apenas o título, descrição, URL actual, versão da app e o teu email para podermos responder.
            Nunca partilhamos estes dados.
          </p>
        </form>
      )}
    </div>
  )
}
