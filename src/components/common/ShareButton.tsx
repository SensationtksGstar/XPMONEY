'use client'

/**
 * ShareButton — partilha um link nos momentos-wow (evolução da mascote,
 * marcos de sequência, certificado da Academia).
 *
 * Comportamento (só no clique — nunca abre por si):
 *   1. `navigator.share` quando existe (folha nativa no mobile).
 *      Cancelar a folha (AbortError) é uma escolha do user → nada a fazer.
 *   2. Senão (ou se a Web Share falhar por outra razão): copia o link com a
 *      Clipboard API → fallback `execCommand('copy')` num textarea fora do
 *      ecrã → em último caso mostra o link num campo só-de-leitura já
 *      selecionado para o user copiar à mão (nunca um beco sem saída).
 *   3. Feedback inline: o rótulo passa a "Link copiado" com `aria-live` —
 *      é o "toast" deste botão. Não usamos o Toaster global porque o botão
 *      vive dentro de overlays (cinematic z-[300], CelebrationModal z-[201])
 *      que tapariam o toast, e em páginas sem ToastProvider.
 *
 * Regra de conteúdo: o URL partilhado NUNCA leva valores financeiros nem
 * dados pessoais (ver as páginas /p/* e /verify).
 *
 * `url` pode ser um caminho ('/p/evo/voltix-3') — é resolvido contra a
 * origem atual no momento do clique (nada de domínio hardcoded).
 * `onShareStart` deixa o pai suspender um auto-close (o user está a
 * partilhar — fechar o momento por baixo dele seria hostil).
 */

import { useEffect, useRef, useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { useT } from '@/lib/i18n/LocaleProvider'
import { cn } from '@/lib/utils'

interface Props {
  url:           string
  title:         string
  text:          string
  /** Rótulo visível; default t('share.button'). */
  label?:        string
  /** aria-label; default t('share.aria'). */
  ariaLabel?:    string
  /** 'ghost' = secundário (overlays); 'solid' = superfície neutra. */
  variant?:      'ghost' | 'solid'
  className?:    string
  onShareStart?: () => void
}

type Status = 'idle' | 'copied' | 'manual'

function toAbsolute(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  if (typeof window === 'undefined') return url
  return new URL(url, window.location.origin).toString()
}

/** Fallback para browsers sem Clipboard API (ou contexto não seguro). */
function legacyCopy(value: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = value
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '-1000px'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  try {
    ta.select()
    ta.setSelectionRange(0, value.length)
    return document.execCommand('copy')
  } catch (err) {
    console.warn('[share] execCommand copy failed:', err)
    return false
  } finally {
    document.body.removeChild(ta)
  }
}

export function ShareButton({
  url, title, text, label, ariaLabel, variant = 'ghost', className, onShareStart,
}: Props) {
  const t = useT()
  const [status, setStatus]   = useState<Status>('idle')
  const [manualUrl, setManual] = useState('')
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const busyRef  = useRef(false)

  useEffect(() => () => {
    if (resetRef.current) clearTimeout(resetRef.current)
  }, [])

  // Campo manual: seleciona o link assim que aparece.
  useEffect(() => {
    if (status === 'manual') inputRef.current?.select()
  }, [status])

  function flashCopied() {
    setStatus('copied')
    if (resetRef.current) clearTimeout(resetRef.current)
    resetRef.current = setTimeout(() => setStatus('idle'), 2500)
  }

  async function copy(link: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
        flashCopied()
        return
      }
    } catch (err) {
      console.warn('[share] clipboard.writeText failed:', err)
    }
    if (legacyCopy(link)) {
      flashCopied()
      return
    }
    setManual(link)
    setStatus('manual')
  }

  async function handleClick() {
    if (busyRef.current) return
    busyRef.current = true
    onShareStart?.()
    const link = toAbsolute(url)
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text, url: link })
          return
        } catch (err) {
          // O user fechou a folha nativa: não é erro, não copiamos por cima.
          if (err instanceof DOMException && err.name === 'AbortError') return
          console.warn('[share] navigator.share failed, falling back to copy:', err)
        }
      }
      await copy(link)
    } finally {
      busyRef.current = false
    }
  }

  const copied = status === 'copied'

  return (
    <div className={cn('flex flex-col items-center gap-2', className)} data-share-button="">
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel ?? t('share.aria')}
        className={cn(
          'inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-full text-sm font-semibold',
          'touch-manipulation transition-colors active:scale-[0.98]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60',
          variant === 'solid'
            ? 'bg-surface-2 border border-white/10 text-white hover:bg-surface-3 active:bg-surface-3'
            : 'bg-white/5 border border-white/15 text-white/85 hover:bg-white/10 hover:text-white active:bg-white/10',
        )}
      >
        {copied
          ? <Check className="w-4 h-4 text-green-400" aria-hidden />
          : <Share2 className="w-4 h-4" aria-hidden />}
        <span>{copied ? t('share.copied') : (label ?? t('share.button'))}</span>
      </button>

      {/* Anúncio para leitores de ecrã (o rótulo do botão é o feedback visual). */}
      <span className="sr-only" aria-live="polite">
        {copied ? t('share.copied') : ''}
      </span>

      {status === 'manual' && (
        <label className="w-full max-w-xs text-left">
          <span className="block text-xs text-white/50 mb-1">{t('share.manual_label')}</span>
          <input
            ref={inputRef}
            readOnly
            value={manualUrl}
            onFocus={e => e.currentTarget.select()}
            className="w-full min-h-[44px] px-3 rounded-xl bg-surface-1 border border-white/10 text-sm text-white/80 font-mono"
          />
        </label>
      )}
    </div>
  )
}
