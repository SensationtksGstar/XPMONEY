'use client'

import { useState, useRef, useCallback, useEffect, useId } from 'react'
import Link from 'next/link'
import {
  X, Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  ChevronDown, Sparkles, Download, TriangleAlert, Info, Crown, Lock, ArrowRight,
} from 'lucide-react'
import { useCategories }    from '@/hooks/useCategories'
import { useAccounts }      from '@/hooks/useAccounts'
import { useUserPlan }      from '@/lib/contexts/UserPlanContext'
import { useQueryClient }   from '@tanstack/react-query'
import { cn }               from '@/lib/utils'
import { useLocale }        from '@/lib/i18n/LocaleProvider'
import type { TranslationKey } from '@/lib/i18n/translations'
import type { ParsedTransaction, ImportStatementResult } from '@/app/api/import-statement/route'

interface Props { onClose: () => void }

type Step = 'upload' | 'parsing' | 'preview' | 'saving' | 'done' | 'error'

const ACCEPTED = '.csv,.txt,.tsv,.pdf,application/pdf,text/csv,text/plain'
const MAX_TEXT_BYTES = 200_000   // 200 KB for text (matches server)
// Vercel's Serverless Function request body cap is 4.5 MB. Base64 inflates raw
// bytes by ~33% and JSON wrap adds more — 3 MB raw is the safe ceiling.
const MAX_PDF_BYTES  = 3_000_000 // 3 MB for PDF

const BANKS = [
  { id: 'cgd',         label: 'Caixa Geral de Depósitos' },
  { id: 'millennium',  label: 'Millennium BCP' },
  { id: 'bpi',         label: 'BPI' },
  { id: 'santander',   label: 'Santander' },
  { id: 'novobanco',   label: 'Novobanco' },
  { id: 'montepio',    label: 'Montepio' },
  { id: 'ca',          label: 'Crédito Agrícola / Moey' },
  { id: 'activobank',  label: 'ActivoBank' },
  { id: 'wise',        label: 'Wise' },
  { id: 'revolut',     label: 'Revolut' },
]

/** Read a File as base64 (without the data-url prefix). */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => {
      const result = r.result as string
      resolve(result.split(',').pop() ?? '')
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

/**
 * Lê um CSV/TXT com detecção de encoding. Bancos PT exportam frequentemente
 * em Windows-1252 ou ISO-8859-1, não UTF-8. file.text() assume UTF-8 e
 * devolve um substituto (U+FFFD) onde havia acentos — o que faz a IA ver
 * "Descri��o" em vez de "Descrição" e nem sempre consegue extrair movimentos.
 *
 * Estratégia: ler como UTF-8 primeiro; se detectarmos mais de 3 caracteres
 * de substituição, tentar de novo com Windows-1252 e devolver o melhor
 * resultado (menos substituições).
 */
async function readTextWithEncoding(file: File): Promise<string> {
  const readAs = (encoding: string) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload  = () => resolve((r.result as string) ?? '')
      r.onerror = () => reject(r.error)
      r.readAsText(file, encoding)
    })

  const utf8 = await readAs('UTF-8')
  const utf8Bad = (utf8.match(/\uFFFD/g) ?? []).length
  if (utf8Bad <= 3) return utf8

  // Tenta Windows-1252 (superset de ISO-8859-1 usado pelos bancos PT)
  try {
    const win1252 = await readAs('Windows-1252')
    const win1252Bad = (win1252.match(/\uFFFD/g) ?? []).length
    if (win1252Bad < utf8Bad) return win1252
  } catch { /* fallback silencioso */ }

  return utf8
}

function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    /\.pdf$/i.test(file.name)
  )
}

/**
 * Painel de "a analisar..." com contador de tempo decorrido. PDFs grandes
 * demoram 60-180s em Gemini — mostrar o tempo evita que o user pense que
 * a app travou e o "palpite" de tempo contextual (10s → 60s → 120s) faz
 * a espera parecer menos ansiosa.
 */
function ParsingPanel({ startedAt }: { startedAt: number | null }) {
  const { t } = useLocale()
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const hintKey: TranslationKey = elapsed < 15
    ? 'import.hint_1'
    : elapsed < 45
    ? 'import.hint_2'
    : elapsed < 90
    ? 'import.hint_3'
    : 'import.hint_4'
  const hint = t(hintKey)

  // Barra de progresso visual: cresce com o tempo mas nunca chega aos 100%
  // até a resposta voltar. Mapeia 0-180s → 0-90%.
  const pct = Math.min(90, Math.round((elapsed / 180) * 90))

  return (
    <div className="p-8 flex flex-col items-center gap-5" role="status" aria-live="polite">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-blue-400" />
        </div>
        <Loader2 className="w-6 h-6 text-blue-400 absolute -top-1 -right-1 animate-spin" />
      </div>
      <div className="text-center max-w-xs">
        <p className="text-white font-semibold">{t('import.parsing_title')}</p>
        <p className="text-white/50 text-sm mt-1">{hint}</p>
        <p className="text-white/30 text-xs mt-2 tabular-nums">{t('import.elapsed', { n: elapsed })}</p>
      </div>
      <div className="w-full max-w-xs bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function StatementImporter({ onClose }: Props) {
  const { isFree, plan } = useUserPlan()
  const { t, locale }    = useLocale()
  const titleId          = useId()

  const [step,      setStep]     = useState<Step>(isFree ? 'upload' : 'upload')
  const [dragOver,  setDragOver] = useState(false)
  const [result,    setResult]   = useState<ImportStatementResult | null>(null)
  const [rows,      setRows]     = useState<ParsedTransaction[]>([])
  const [accountId, setAccountId]= useState('')
  const [errorMsg,  setErrorMsg] = useState('')
  const [errorAttempts, setErrorAttempts] = useState<string[]>([])
  // Tracked explicitly instead of sniffing errorMsg for "Plano" — string
  // matching breaks under i18n (the EN error never contains "Plano").
  const [planError, setPlanError] = useState(false)
  const [doneMsg,   setDoneMsg]  = useState('')
  const [parsingStart, setParsingStart] = useState<number | null>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const qc       = useQueryClient()

  const { categories: allCategories } = useCategories()
  const { accounts, defaultAccount }  = useAccounts()

  // Set default account once loaded
  const resolvedAccount = accountId || defaultAccount?.id || ''

  // Esc to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // ── Parse file via AI ─────────────────────────────────────────────────────
  const parseFile = useCallback(async (file: File) => {
    const isPdf = isPdfFile(file)
    const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_TEXT_BYTES

    if (file.size > maxBytes) {
      setErrorMsg(t(isPdf ? 'import.err_pdf_too_big' : 'import.err_text_too_big'))
      setStep('error')
      return
    }
    if (file.size < 50) {
      setErrorMsg(t('import.err_empty'))
      setStep('error')
      return
    }

    setStep('parsing')
    setParsingStart(Date.now())

    // 4 min timeout (240s) — dá margem para PDFs grandes em Vercel Pro (300s
    // server). Em Hobby o servidor clampa a 60s → o fetch dá erro 504 antes
    // do aborter disparar, com mensagem específica. Em Pro o cliente é o
    // último a desistir, o que é o que queremos.
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 240_000)

    try {
      let body: { pdfBase64: string; filename: string } | { content: string; filename: string }
      try {
        body = isPdf
          ? { pdfBase64: await fileToBase64(file),     filename: file.name }
          : { content:   await readTextWithEncoding(file), filename: file.name }
      } catch {
        throw new Error(t('import.err_read'))
      }

      const res = await fetch('/api/import-statement', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  abort.signal,
      })

      // Handle non-JSON responses (e.g. Vercel's HTML 413/504 pages). Calling
      // res.json() on those on Safari/WebKit throws the cryptic DOMException
      // "The string did not match the expected pattern". Read as text first.
      const raw  = await res.text()
      let json: { error?: string; code?: string; data?: ImportStatementResult; attempts?: string[] } = {}
      try {
        json = raw ? JSON.parse(raw) : {}
      } catch {
        // Non-JSON body — most likely Vercel's edge error page
        if (res.status === 413) {
          throw new Error(t('import.err_413'))
        }
        if (res.status === 504 || res.status === 502 || res.status === 408) {
          throw new Error(t('import.err_timeout_server'))
        }
        throw new Error(t('import.err_unexpected', { status: res.status }))
      }

      if (res.status === 403 && json.code === 'plan_required') {
        setPlanError(true)
        setErrorMsg(json.error ?? t('import.err_plan'))
        setStep('error')
        return
      }
      if (!res.ok || json.error) {
        // Guardamos os attempts se o servidor os expôs — assim o user pode
        // expandir "ver detalhes técnicos" e perceber qual provider falhou.
        if (json.attempts && json.attempts.length > 0) {
          setErrorAttempts(json.attempts)
        }
        throw new Error(json.error ?? t('import.err_status', { status: res.status }))
      }

      const data = json.data as ImportStatementResult | undefined
      if (!data?.transactions?.length) {
        // Acontece tipicamente quando o CSV tem formato muito atípico ou
        // o PDF é totalmente scan sem camada de texto. Damos uma mensagem
        // mais útil com passos concretos.
        setErrorMsg(t('import.err_no_tx'))
        setStep('error')
        return
      }

      setResult(data)
      setRows(data.transactions)
      setStep('preview')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setErrorMsg(t('import.err_abort'))
      } else if (e instanceof TypeError) {
        // Safari/iOS surface fetch-level failures as TypeError "Load failed".
        // Could be: network drop mid-request, server crashed before sending
        // headers, or Vercel infra timeout. Give the user actionable steps
        // instead of the cryptic raw message.
        const msg  = e.message || ''
        const isLoadFailed = /load\s*failed/i.test(msg) || /network/i.test(msg)
        setErrorMsg(isLoadFailed ? t('import.err_load_failed') : t('import.err_network', { msg }))
      } else {
        setErrorMsg(e instanceof Error ? e.message : t('import.err_analyze'))
      }
      setStep('error')
    } finally {
      clearTimeout(timer)
      setParsingStart(null)
    }
  }, [t])

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (isFree) return
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile, isFree])

  // ── Toggle row ────────────────────────────────────────────────────────────
  const toggleRow = (i: number) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, selected: !row.selected } : row))

  const toggleAll = () => {
    const allOn = rows.every(r => r.selected)
    setRows(r => r.map(row => ({ ...row, selected: !allOn })))
  }

  const setCategory = (i: number, hint: string) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, category_hint: hint } : row))

  // ── Confirm import ────────────────────────────────────────────────────────
  const confirm = async () => {
    const selected = rows.filter(r => r.selected)
    if (!selected.length) return
    if (!resolvedAccount) {
      setErrorMsg(t('import.err_select_account'))
      return
    }

    setStep('saving')

    // Match category hints → category IDs
    const mapped = selected.map(t => {
      const cat = allCategories.find(c =>
        c.name.toLowerCase() === t.category_hint.toLowerCase()
      ) ?? allCategories.find(c => c.name === 'Outros') ?? allCategories[0]

      return {
        account_id:           resolvedAccount,
        category_id:          cat?.id ?? '',
        date:                 t.date,
        description:          t.description,
        // Send the unmodified bank description so the server can seed the
        // merchant cache against the original merchant token, not the
        // user's edited label.
        original_description: t.original_description,
        amount:               t.amount,
        type:                 t.type,
      }
    })

    try {
      const res  = await fetch('/api/import-statement/confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ transactions: mapped }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? t('import.err_save'))

      const { inserted, xp_gained, message } = json.data ?? json
      const msg = message
        ?? t('import.done_default', { inserted, xp: xp_gained })

      // Invalida TODAS as queries que agregam transações — antes só
      // mexíamos em score/xp/missions e o user via: "importei 178 mas
      // dashboard ainda em 0€". Agora o MonthlySummary, ExpenseBreakdown,
      // orçamento (status + história) e widgets de pet/dívida também
      // actualizam sem refresh manual.
      qc.invalidateQueries({ queryKey: ['transactions']    })
      qc.invalidateQueries({ queryKey: ['score']           })
      qc.invalidateQueries({ queryKey: ['xp']              })
      qc.invalidateQueries({ queryKey: ['missions']        })
      qc.invalidateQueries({ queryKey: ['summary']         })  // MonthlySummary + ExpenseBreakdown
      qc.invalidateQueries({ queryKey: ['budget-status']   })  // /orcamento dashboard
      qc.invalidateQueries({ queryKey: ['budget-history']  })  // chart 6 meses
      qc.invalidateQueries({ queryKey: ['voltix']          })  // Pet hero (mood pode mudar)
      qc.invalidateQueries({ queryKey: ['debts']           })  // DebtWidget

      setDoneMsg(msg)
      setStep('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t('import.err_save_tx'))
      setStep('error')
    }
  }

  const selectedCount = rows.filter(r => r.selected).length

  // ─────────────────────────────────────────────────────────────────────────
  // Free-plan gate: full-panel paywall, no upload button
  // ─────────────────────────────────────────────────────────────────────────
  if (isFree) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
        <div className="relative z-10 bg-[#0f1117] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <h2 id={titleId} className="font-bold text-white text-base flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" /> {t('import.title')}
            </h2>
            <button onClick={onClose} aria-label={t('dividas.close')}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 text-center space-y-4">
            {/* Hero icon with upgraded glow — signals "this is a Premium
                moment", not a generic info card. */}
            <div className="relative w-20 h-20 mx-auto">
              <div aria-hidden className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-400/30 to-purple-500/30 blur-xl" />
              <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-yellow-500/20 to-purple-500/20 border border-yellow-400/40 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-yellow-300" />
              </div>
            </div>

            <div>
              {/* Premium chip — sets expectation before the body. */}
              <div className="inline-flex items-center gap-1.5 bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 text-[10px] font-bold px-2.5 py-1 rounded-full mb-2">
                <Crown className="w-2.5 h-2.5" /> PREMIUM
              </div>
              <p className="text-white font-bold text-lg">{t('import.premium_title')}</p>
              <p className="text-white/55 text-sm mt-2 leading-relaxed">
                {t('import.premium_body')} <strong className="text-white">{t('import.premium_body_strong')}</strong>
              </p>
            </div>

            <ul className="text-left space-y-1.5 text-white/65 text-xs mx-auto max-w-xs">
              <li>✓ CGD, Millennium, BPI, Santander, Revolut, Wise</li>
              <li>✓ {t('import.feat_2')}</li>
              <li>✓ {t('import.feat_3')}</li>
              <li>✓ {t('import.feat_4')}</li>
            </ul>

            {/* Primary CTA — outcome + price in a single line. "Fazer
                upgrade" was vague; "Desbloquear por €3,33/mês" leaves no
                mental dead-end between intent and action. */}
            <Link
              href="/settings/billing?period=yearly"
              onClick={onClose}
              className="group w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-400 hover:from-yellow-400 hover:to-amber-300 text-black font-bold px-5 py-3.5 rounded-xl transition-all min-h-[48px] shadow-[0_10px_32px_-10px_rgba(234,179,8,0.6)] hover:scale-[1.02]"
            >
              <Crown className="w-4 h-4" />
              {t('import.unlock_cta')}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* Price anchor + no-risk row under the button. */}
            <p className="text-[11px] text-white/55 leading-relaxed">
              {t('import.price_anchor')}
            </p>

            {/* Social proof + secondary link (the "hesitant" exit). */}
            <div className="pt-3 border-t border-white/10 space-y-2">
              <p className="text-[11px] text-white/55 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                {t('import.social_proof')}
              </p>
              <Link
                href="/#precos"
                onClick={onClose}
                className="inline-block text-[11px] font-semibold text-yellow-300 hover:text-yellow-200 transition-colors"
              >
                {t('import.see_premium')} →
              </Link>
            </div>

            <p className="text-white/30 text-[10px] pt-1">{t('import.current_plan')} <span className="uppercase">{plan}</span></p>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />

      {/* Panel
          Mobile: fills the entire dynamic viewport (h-[100dvh]) so every
          step's content has room to show without being clipped by the
          bottom URL bar — the user reported that with the previous
          80dvh / 92dvh caps the upload screen and error details
          disappeared below the fold. Header + footer are sticky inside,
          middle scrolls.
          Desktop (sm+): goes back to the centered modal with sensible
          max-heights so it doesn't dominate large screens. */}
      <div className={cn(
        'relative z-10 bg-[#0f1117] border border-white/10 sm:rounded-2xl w-full',
        'flex flex-col overflow-hidden transition-all duration-300',
        // Mobile: full-height sheet with safe-area inset so iOS notch
        // and home-indicator never clip the rounded top / footer.
        'h-[100dvh] sm:h-auto rounded-none sm:rounded-2xl',
        step === 'preview' ? 'sm:max-w-3xl sm:max-h-[92dvh]' : 'sm:max-w-md sm:max-h-[80dvh]',
      )}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 id={titleId} className="font-bold text-white text-base">{t('import.title')}</h2>
              <p className="text-white/40 text-xs">
                {step === 'preview'
                  ? t('import.header_preview', { bank: result?.bank ?? '', n: result?.transactions.length ?? 0 })
                  : t('import.header_sub')}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            aria-label={t('import.close_aria')}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── UPLOAD step ──
            flex-1 + min-h-0 are essential here: without them the body
            takes its natural height, which can exceed the panel's max-h
            on desktop windows (especially when the "Como exportar"
            details are expanded). User had to scroll the page itself to
            reach the drop zone. With flex-1 the body fills the
            remaining panel height and scrolls INTERNALLY. */}
        {step === 'upload' && (
          <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Info banner */}
            <div className="flex gap-3 bg-blue-500/8 border border-blue-500/20 rounded-xl p-3">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-blue-300/80 text-xs leading-relaxed">
                {t('import.upload_info')}
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
              role="button"
              tabIndex={0}
              aria-label={t('import.drop_aria')}
              className={cn(
                'border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all',
                dragOver
                  ? 'border-blue-400/60 bg-blue-500/8'
                  : 'border-white/10 hover:border-white/25 hover:bg-white/3'
              )}
            >
              <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center transition-all',
                dragOver ? 'bg-blue-500/20' : 'bg-white/5')}>
                <Upload className={cn('w-6 h-6', dragOver ? 'text-blue-400' : 'text-white/40')} />
              </div>
              <div className="text-center">
                <p className="text-white font-medium text-sm">
                  {dragOver ? t('import.drop_here') : t('import.drop_prompt')}
                </p>
                <p className="text-white/35 text-xs mt-1">{t('import.drop_hint')}</p>
              </div>
              <input ref={fileRef} type="file" accept={ACCEPTED}
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
            </div>

            {/* Supported banks */}
            <div>
              <p className="text-white/30 text-xs mb-2">{t('import.banks_label')}</p>
              <div className="flex flex-wrap gap-1.5">
                {BANKS.map(b => (
                  <span key={b.id}
                    className="px-2 py-0.5 bg-white/5 border border-white/8 rounded-full text-white/50 text-xs">
                    {b.label}
                  </span>
                ))}
              </div>
            </div>

            {/* How to export guide */}
            <details className="group">
              <summary className="flex items-center gap-2 text-white/40 text-xs cursor-pointer hover:text-white/60 transition-colors list-none">
                <Download className="w-3.5 h-3.5" />
                {t('import.how_export')}
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 ml-auto" />
              </summary>
              <div className="mt-2 space-y-2 text-white/45 text-xs leading-relaxed pl-5 border-l border-white/8">
                <p>{t('import.guide_cgd')}</p>
                <p>{t('import.guide_millennium')}</p>
                <p>{t('import.guide_bpi')}</p>
                <p>{t('import.guide_santander')}</p>
                <p>{t('import.guide_revolut')}</p>
                <p>{t('import.guide_wise')}</p>
              </div>
            </details>
          </div>
        )}

        {/* ── PARSING step ── */}
        {step === 'parsing' && (
          <ParsingPanel startedAt={parsingStart} />
        )}

        {/* ── PREVIEW step ── */}
        {step === 'preview' && result && (
          <>
            {/* Account selector */}
            <div className="px-5 py-3 border-b border-white/8 flex-shrink-0 flex items-center gap-3">
              <label htmlFor="import-account" className="text-white/50 text-sm whitespace-nowrap">{t('import.import_to')}</label>
              <select
                id="import-account"
                value={resolvedAccount}
                onChange={e => setAccountId(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-blue-500/50 appearance-none"
              >
                {(accounts ?? []).map(a => (
                  <option key={a.id} value={a.id} className="bg-[#1a1d27]">{a.name}</option>
                ))}
                {(!accounts || accounts.length === 0) && (
                  <option value="acc-1" className="bg-[#1a1d27]">{t('import.demo_account')}</option>
                )}
              </select>
            </div>

            {/* Select all bar */}
            <div className="px-5 py-2.5 border-b border-white/8 flex-shrink-0 flex items-center justify-between bg-white/2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox"
                  checked={rows.every(r => r.selected)}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-blue-500 cursor-pointer" />
                <span className="text-white/70 text-sm">
                  {t('import.selected_count', { n: selectedCount, total: rows.length })}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/30">{result.currency}</span>
                <span className="text-xs text-blue-400 font-medium">
                  {result.bank}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#0f1117] border-b border-white/8">
                  <tr>
                    <th className="w-10 px-4 py-2.5" />
                    <th className="text-left px-2 py-2.5 text-white/40 font-medium text-xs">{t('scan.date')}</th>
                    <th className="text-left px-2 py-2.5 text-white/40 font-medium text-xs">{t('import.col_desc')}</th>
                    <th className="text-left px-2 py-2.5 text-white/40 font-medium text-xs hidden sm:table-cell">{t('dividas.category')}</th>
                    <th className="text-right px-4 py-2.5 text-white/40 font-medium text-xs">{t('import.col_amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}
                      onClick={() => toggleRow(i)}
                      className={cn(
                        'border-b border-white/5 cursor-pointer transition-colors',
                        row.selected ? 'hover:bg-white/3' : 'opacity-40 hover:opacity-60'
                      )}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={row.selected} readOnly
                          aria-label={`${row.selected ? t('import.uncheck') : t('import.check')} ${row.description}`}
                          className="w-4 h-4 rounded accent-blue-500 pointer-events-none" />
                      </td>
                      <td className="px-2 py-3 text-white/50 text-xs whitespace-nowrap">
                        {row.date.split('-').reverse().join('/')}
                      </td>
                      <td className="px-2 py-3">
                        <p className="text-white font-medium text-xs leading-tight">{row.description}</p>
                        <p className="text-white/30 text-xs truncate max-w-[180px]">{row.original_description}</p>
                      </td>
                      <td className="px-2 py-3 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                        <select
                          value={row.category_hint}
                          onChange={e => setCategory(i, e.target.value)}
                          aria-label={t('import.cat_for', { desc: row.description })}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/70 text-xs outline-none focus:border-blue-500/50 max-w-[130px] appearance-none"
                        >
                          {allCategories
                            .filter(c => c.transaction_type === row.type || c.transaction_type === 'both')
                            .map(c => (
                              <option key={c.id} value={c.name} className="bg-[#1a1d27]">
                                {c.icon} {c.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'font-bold text-sm tabular-nums',
                          row.type === 'income'   && 'text-green-400',
                          row.type === 'expense'  && 'text-red-400',
                          row.type === 'transfer' && 'text-purple-300',
                        )}>
                          {row.type === 'transfer'
                            ? <>🔁 {row.amount.toLocaleString(locale === 'en' ? 'en-US' : 'pt-PT', { minimumFractionDigits: 2 })} €</>
                            : <>{row.type === 'income' ? '+' : '-'}{row.amount.toLocaleString(locale === 'en' ? 'en-US' : 'pt-PT', { minimumFractionDigits: 2 })} €</>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer action */}
            <div className="px-5 py-4 border-t border-white/8 flex-shrink-0 flex items-center gap-3">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-all text-sm font-medium min-h-[44px]">
                {t('budget.cancel')}
              </button>
              <button
                onClick={confirm}
                disabled={selectedCount === 0}
                className={cn(
                  'flex-[2] py-3 rounded-xl font-bold text-sm transition-all min-h-[44px]',
                  selectedCount > 0
                    ? 'bg-blue-500 hover:bg-blue-400 text-white active:scale-[0.98]'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                )}>
                {selectedCount > 0
                  ? t(selectedCount === 1 ? 'import.import_one' : 'import.import_other', { n: selectedCount })
                  : t('import.import_zero')}
              </button>
            </div>
          </>
        )}

        {/* ── SAVING step ── */}
        {step === 'saving' && (
          <div className="p-8 flex flex-col items-center gap-4" role="status" aria-live="polite">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            <p className="text-white font-medium">{t('import.saving')}</p>
          </div>
        )}

        {/* ── DONE step ── */}
        {step === 'done' && (
          <div className="p-8 flex flex-col items-center gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">{t('import.done_title')}</p>
              <p className="text-white/50 text-sm mt-1">{doneMsg}</p>
            </div>
            <button onClick={onClose}
              className="w-full max-w-xs py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-all min-h-[44px]">
              {t('dividas.close')}
            </button>
          </div>
        )}

        {/* ── ERROR step ──
            Same flex-1 + min-h-0 + overflow-y-auto recipe so the
            "Detalhes técnicos" expander (long attempts list) scrolls
            internally instead of pushing the close buttons off-screen. */}
        {step === 'error' && (
          <div className="p-8 flex flex-col items-center gap-5 text-center overflow-y-auto flex-1 min-h-0" role="alert">
            <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center">
              {planError
                ? <Lock className="w-10 h-10 text-red-400" />
                : <AlertCircle className="w-10 h-10 text-red-400" />}
            </div>
            <div>
              <p className="text-white font-bold">
                {planError ? t('import.err_plan_title') : t('import.err_title')}
              </p>
              <p className="text-white/50 text-sm mt-1 whitespace-pre-line">{errorMsg}</p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={onClose}
                className="flex-1 py-3 border border-white/10 text-white/60 rounded-xl text-sm hover:border-white/25 hover:text-white transition-all min-h-[44px]">
                {t('dividas.close')}
              </button>
              <button onClick={() => { setStep('upload'); setErrorMsg(''); setErrorAttempts([]); setPlanError(false) }}
                className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium transition-all min-h-[44px]">
                {t('import.err_retry')}
              </button>
            </div>
            {errorMsg.toLowerCase().includes('manutenção') && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left">
                <TriangleAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300/80 text-xs leading-relaxed">
                  {t('import.maint')}
                </p>
              </div>
            )}

            {/* Detalhes técnicos — lista dos attempts falhados (útil para
                diagnosticar se é uma chave inválida, quota diária, etc.
                sem ter de abrir logs do servidor). */}
            {errorAttempts.length > 0 && (
              <details className="w-full text-left bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                <summary className="cursor-pointer px-3 py-2 text-[11px] text-white/50 hover:text-white transition-colors select-none">
                  {t(errorAttempts.length === 1 ? 'import.tech_one' : 'import.tech_other', { n: errorAttempts.length })}
                </summary>
                <div className="border-t border-white/5 px-3 py-2 space-y-1.5 font-mono text-[10px] text-white/60 break-all">
                  {errorAttempts.map((a, i) => (
                    <div key={i} className="leading-relaxed">• {a}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
