'use client'

import { useState } from 'react'
import { Check, Send } from 'lucide-react'

/**
 * ContactForm — formulário público que encaminha a mensagem ao admin.
 *
 * Privacidade: o email do admin nunca é exposto — o POST /api/contact-message
 * guarda na tabela bug_reports (type='contact') e o admin lê pelo /admin/bugs.
 *
 * Anti-spam: honeypot (`website` field invisível). Bots preenchem tudo, users
 * reais não veem o campo. Rate limiting seria uma boa v2 mas por agora o
 * honeypot cobre 95% do abuso.
 */
export function ContactForm() {
  const [email,    setEmail]    = useState('')
  const [name,     setName]     = useState('')
  const [subject,  setSubject]  = useState('')
  const [message,  setMessage]  = useState('')
  const [website,  setWebsite]  = useState('')  // honeypot
  const [status,   setStatus]   = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'sending' || status === 'sent') return

    setStatus('sending')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/contact-message', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:   email.trim(),
          name:    name.trim() || undefined,
          subject: subject.trim(),
          message: message.trim(),
          website,  // honeypot — should be ""
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setErrorMsg(json?.error ?? 'Falha ao enviar. Tenta novamente.')
        return
      }

      setStatus('sent')
      setEmail(''); setName(''); setSubject(''); setMessage('')
    } catch (err) {
      console.warn('[ContactForm] submit failed:', err)
      setStatus('error')
      setErrorMsg('Sem ligação. Verifica a internet.')
    }
  }

  const disabled =
    status === 'sending' ||
    !email.includes('@') ||
    subject.trim().length < 3 ||
    message.trim().length < 10

  if (status === 'sent') {
    return (
      <div
        role="status"
        className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center animate-fade-in"
      >
        <div className="w-14 h-14 rounded-full bg-green-500 text-black mx-auto flex items-center justify-center mb-4">
          <Check className="w-7 h-7" strokeWidth={3} />
        </div>
        <h2 className="text-xl font-bold text-green-200 mb-2">Mensagem enviada!</h2>
        <p className="text-white/70 text-sm">
          Recebemos a tua mensagem. Vamos responder a <strong className="text-green-300">{email || 'ti'}</strong>{' '}
          dentro de 24 horas.
        </p>
        <button
          type="button"
          onClick={() => { setStatus('idle'); setEmail(''); setName(''); setSubject(''); setMessage('') }}
          className="mt-5 text-sm text-green-300 hover:text-green-200 underline"
        >
          Enviar outra mensagem
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4"
    >
      {/* Honeypot — hidden from users, bots will fill it */}
      <div aria-hidden className="absolute opacity-0 pointer-events-none h-0 overflow-hidden">
        <label>
          Website (não preencher)
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={e => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="c-email" className="block text-xs font-medium text-white/60 mb-1.5">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            id="c-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            maxLength={200}
            required
            autoComplete="email"
            placeholder="o.teu@email.pt"
            className="w-full bg-white/5 border border-white/10 focus:border-green-400/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors"
          />
        </div>
        <div>
          <label htmlFor="c-name" className="block text-xs font-medium text-white/60 mb-1.5">
            Nome <span className="text-white/30">(opcional)</span>
          </label>
          <input
            id="c-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            placeholder="Como te chamas?"
            className="w-full bg-white/5 border border-white/10 focus:border-green-400/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor="c-subject" className="block text-xs font-medium text-white/60 mb-1.5">
          Assunto <span className="text-red-400">*</span>
        </label>
        <input
          id="c-subject"
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          maxLength={120}
          required
          placeholder="Ex: Como cancelar o plano Plus"
          className="w-full bg-white/5 border border-white/10 focus:border-green-400/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors"
        />
      </div>

      <div>
        <label htmlFor="c-message" className="block text-xs font-medium text-white/60 mb-1.5">
          Mensagem <span className="text-red-400">*</span>
        </label>
        <textarea
          id="c-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={4000}
          rows={6}
          required
          placeholder="Escreve o teu pedido com o máximo de detalhe possível."
          className="w-full bg-white/5 border border-white/10 focus:border-green-400/50 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition-colors resize-none"
        />
        <p className="text-[10px] text-white/30 mt-1 text-right">{message.length}/4000</p>
      </div>

      {errorMsg && (
        <p role="alert" className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-black font-bold px-5 py-3 rounded-xl text-sm transition-colors min-h-[48px]"
      >
        {status === 'sending' ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
            A enviar…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Enviar mensagem
          </>
        )}
      </button>
    </form>
  )
}
