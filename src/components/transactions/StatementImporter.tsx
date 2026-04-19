'use client'

import { useState, useRef, useCallback, useEffect, useId } from 'react'
import Link from 'next/link'
import {
  X, Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  ChevronDown, Sparkles, Download, TriangleAlert, Info, Crown, Lock,
} from 'lucide-react'
import { useCategories }    from '@/hooks/useCategories'
import { useAccounts }      from '@/hooks/useAccounts'
import { useUserPlan }      from '@/lib/contexts/UserPlanContext'
import { useQueryClient }   from '@tanstack/react-query'
import { cn }               from '@/lib/utils'
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
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const hint = elapsed < 15
    ? 'A identificar o banco e extrair movimentos…'
    : elapsed < 45
    ? 'PDFs com muitas páginas demoram 1-2 min. Não feches a janela.'
    : elapsed < 90
    ? 'Ainda a processar — a IA está a categorizar cada linha.'
    : 'Quase lá. Se passar dos 3 min, o teu PDF pode ser demasiado grande.'

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
        <p className="text-white font-semibold">A IA está a analisar…</p>
        <p className="text-white/50 text-sm mt-1">{hint}</p>
        <p className="text-white/30 text-xs mt-2 tabular-nums">{elapsed}s decorridos</p>
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
  const titleId          = useId()

  const [step,      setStep]     = useState<Step>(isFree ? 'upload' : 'upload')
  const [dragOver,  setDragOver] = useState(false)
  const [result,    setResult]   = useState<ImportStatementResult | null>(null)
  const [rows,      setRows]     = useState<ParsedTransaction[]>([])
  const [accountId, setAccountId]= useState('')
  const [errorMsg,  setErrorMsg] = useState('')
  const [errorAttempts, setErrorAttempts] = useState<string[]>([])
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
      setErrorMsg(
        isPdf
          ? 'PDF demasiado grande. Máximo 3 MB. Experimenta exportar só as páginas com movimentos.'
          : 'Ficheiro demasiado grande. Máximo 200 KB.'
      )
      setStep('error')
      return
    }
    if (file.size < 50) {
      setErrorMsg('Ficheiro vazio ou demasiado pequeno.')
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
        throw new Error('Não foi possível ler o ficheiro. Verifica se não está corrompido.')
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
          throw new Error('Ficheiro demasiado grande para o servidor. Reduz para menos de 3 MB.')
        }
        if (res.status === 504 || res.status === 502 || res.status === 408) {
          throw new Error('O servidor demorou demasiado a responder. Tenta um ficheiro mais pequeno.')
        }
        throw new Error(`Erro inesperado do servidor (${res.status}). Tenta novamente em alguns minutos.`)
      }

      if (res.status === 403 && json.code === 'plan_required') {
        setErrorMsg(json.error ?? 'Plano insuficiente.')
        setStep('error')
        return
      }
      if (!res.ok || json.error) {
        // Guardamos os attempts se o servidor os expôs — assim o user pode
        // expandir "ver detalhes técnicos" e perceber qual provider falhou.
        if (json.attempts && json.attempts.length > 0) {
          setErrorAttempts(json.attempts)
        }
        throw new Error(json.error ?? `Erro ${res.status}`)
      }

      const data = json.data as ImportStatementResult | undefined
      if (!data?.transactions?.length) {
        // Acontece tipicamente quando o CSV tem formato muito atípico ou
        // o PDF é totalmente scan sem camada de texto. Damos uma mensagem
        // mais útil com passos concretos.
        setErrorMsg(
          'Não consegui extrair movimentos deste ficheiro. Verifica:\n' +
          '• CSV: o separador é ";" ou ","? tens cabeçalhos Data/Descrição/Valor?\n' +
          '• PDF: é texto pesquisável (tenta Ctrl+F)? Se não, é um scan de imagem e precisa de OCR externo.\n' +
          '• Se o banco exporta em Excel, usa "Guardar como CSV" no teu cliente de folha de cálculo.',
        )
        setStep('error')
        return
      }

      setResult(data)
      setRows(data.transactions)
      setStep('preview')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setErrorMsg(
          'A análise ultrapassou 4 minutos e foi cancelada. Divide o PDF em menos páginas ' +
          '(ex: só o último mês) ou converte para CSV no site do teu banco.',
        )
      } else {
        setErrorMsg(e instanceof Error ? e.message : 'Erro ao analisar ficheiro.')
      }
      setStep('error')
    } finally {
      clearTimeout(timer)
      setParsingStart(null)
    }
  }, [])

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
      setErrorMsg('Seleciona uma conta antes de importar.')
      return
    }

    setStep('saving')

    // Match category hints → category IDs
    const mapped = selected.map(t => {
      const cat = allCategories.find(c =>
        c.name.toLowerCase() === t.category_hint.toLowerCase()
      ) ?? allCategories.find(c => c.name === 'Outros') ?? allCategories[0]

      return {
        account_id:  resolvedAccount,
        category_id: cat?.id ?? '',
        date:        t.date,
        description: t.description,
        amount:      t.amount,
        type:        t.type,
      }
    })

    try {
      const res  = await fetch('/api/import-statement/confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ transactions: mapped }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Erro ao guardar')

      const { inserted, xp_gained, message } = json.data ?? json
      const msg = message
        ?? `${inserted} transações importadas! +${xp_gained} XP 🎉`

      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['score'] })
      qc.invalidateQueries({ queryKey: ['xp'] })
      qc.invalidateQueries({ queryKey: ['missions'] })

      setDoneMsg(msg)
      setStep('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erro ao guardar transações.')
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
              <Crown className="w-4 h-4 text-yellow-400" /> Importar Extrato
            </h2>
            <button onClick={onClose} aria-label="Fechar"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-yellow-500/15 to-purple-500/15 border border-yellow-500/25 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-yellow-400" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Funcionalidade Plus</p>
              <p className="text-white/50 text-sm mt-2 leading-relaxed">
                Envia o teu extrato bancário (CSV ou PDF) e a IA extrai e categoriza
                automaticamente todos os movimentos — sem digitar nada à mão.
              </p>
            </div>
            <ul className="text-left space-y-1.5 text-white/60 text-xs mx-auto max-w-xs">
              <li>✓ Suporta CGD, Millennium, BPI, Santander, Revolut, Wise</li>
              <li>✓ Categorização automática com IA</li>
              <li>✓ Deteta receitas e despesas</li>
              <li>✓ Ignora saldos e cabeçalhos</li>
            </ul>
            <Link
              href="/settings/billing"
              onClick={onClose}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold px-5 py-3 rounded-xl transition-all min-h-[44px]"
            >
              <Crown className="w-4 h-4" /> Fazer upgrade para Plus
            </Link>
            <p className="text-white/30 text-xs">Plano actual: <span className="uppercase">{plan}</span></p>
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

      {/* Panel */}
      <div className={cn(
        'relative z-10 bg-[#0f1117] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full',
        'flex flex-col overflow-hidden transition-all duration-300',
        step === 'preview' ? 'sm:max-w-3xl max-h-[92dvh]' : 'sm:max-w-md max-h-[80dvh]',
      )}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 id={titleId} className="font-bold text-white text-base">Importar Extrato</h2>
              <p className="text-white/40 text-xs">
                {step === 'preview'
                  ? `${result?.bank} · ${result?.transactions.length} movimentos detectados`
                  : 'CSV · PDF · Qualquer banco português'}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            aria-label="Fechar importação"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── UPLOAD step ── */}
        {step === 'upload' && (
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Info banner */}
            <div className="flex gap-3 bg-blue-500/8 border border-blue-500/20 rounded-xl p-3">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-blue-300/80 text-xs leading-relaxed">
                Envia o extrato do teu banco em <strong className="text-blue-300">CSV/TXT</strong> ou <strong className="text-blue-300">PDF</strong>.
                A IA analisa e categoriza automaticamente cada movimento.
                Os dados <strong className="text-blue-300">nunca são armazenados</strong> além das transações confirmadas.
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
              aria-label="Seleccionar ficheiro de extrato bancário"
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
                  {dragOver ? 'Larga aqui' : 'Arrasta o ficheiro ou clica para seleccionar'}
                </p>
                <p className="text-white/35 text-xs mt-1">CSV · TXT · PDF — texto até 200 KB · PDF até 3 MB</p>
              </div>
              <input ref={fileRef} type="file" accept={ACCEPTED}
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
            </div>

            {/* Supported banks */}
            <div>
              <p className="text-white/30 text-xs mb-2">Bancos compatíveis:</p>
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
                Como exportar o extrato do meu banco?
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 ml-auto" />
              </summary>
              <div className="mt-2 space-y-2 text-white/45 text-xs leading-relaxed pl-5 border-l border-white/8">
                <p><strong className="text-white/60">CGD (Caixa):</strong> Netcaixa → Movimentos → Exportar → CSV ou PDF</p>
                <p><strong className="text-white/60">Millennium:</strong> Site → Conta → Movimentos → Exportar Excel/CSV/PDF</p>
                <p><strong className="text-white/60">BPI:</strong> BPI Net → Consultas → Movimentos → Exportar</p>
                <p><strong className="text-white/60">Santander:</strong> Online → Conta corrente → Movimentos → Download</p>
                <p><strong className="text-white/60">Revolut:</strong> App → Conta → Declaração → CSV ou PDF</p>
                <p><strong className="text-white/60">Wise:</strong> Account → Statements → Download CSV ou PDF</p>
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
              <label htmlFor="import-account" className="text-white/50 text-sm whitespace-nowrap">Importar para:</label>
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
                  <option value="acc-1" className="bg-[#1a1d27]">Conta Principal (demo)</option>
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
                  {selectedCount} de {rows.length} seleccionados
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
                    <th className="text-left px-2 py-2.5 text-white/40 font-medium text-xs">Data</th>
                    <th className="text-left px-2 py-2.5 text-white/40 font-medium text-xs">Descrição</th>
                    <th className="text-left px-2 py-2.5 text-white/40 font-medium text-xs hidden sm:table-cell">Categoria</th>
                    <th className="text-right px-4 py-2.5 text-white/40 font-medium text-xs">Valor</th>
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
                          aria-label={`${row.selected ? 'Desmarcar' : 'Marcar'} ${row.description}`}
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
                          aria-label={`Categoria para ${row.description}`}
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
                          row.type === 'income' ? 'text-green-400' : 'text-red-400'
                        )}>
                          {row.type === 'income' ? '+' : '-'}
                          {row.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} €
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
                Cancelar
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
                Importar {selectedCount > 0 ? `${selectedCount} movimento${selectedCount > 1 ? 's' : ''}` : '—'}
              </button>
            </div>
          </>
        )}

        {/* ── SAVING step ── */}
        {step === 'saving' && (
          <div className="p-8 flex flex-col items-center gap-4" role="status" aria-live="polite">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            <p className="text-white font-medium">A guardar transações...</p>
          </div>
        )}

        {/* ── DONE step ── */}
        {step === 'done' && (
          <div className="p-8 flex flex-col items-center gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Importação concluída!</p>
              <p className="text-white/50 text-sm mt-1">{doneMsg}</p>
            </div>
            <button onClick={onClose}
              className="w-full max-w-xs py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-all min-h-[44px]">
              Fechar
            </button>
          </div>
        )}

        {/* ── ERROR step ── */}
        {step === 'error' && (
          <div className="p-8 flex flex-col items-center gap-5 text-center" role="alert">
            <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center">
              {errorMsg.includes('Plano') || errorMsg.includes('plano')
                ? <Lock className="w-10 h-10 text-red-400" />
                : <AlertCircle className="w-10 h-10 text-red-400" />}
            </div>
            <div>
              <p className="text-white font-bold">
                {errorMsg.includes('Plano') || errorMsg.includes('plano') ? 'Plano insuficiente' : 'Ocorreu um erro'}
              </p>
              <p className="text-white/50 text-sm mt-1 whitespace-pre-line">{errorMsg}</p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={onClose}
                className="flex-1 py-3 border border-white/10 text-white/60 rounded-xl text-sm hover:border-white/25 hover:text-white transition-all min-h-[44px]">
                Fechar
              </button>
              <button onClick={() => { setStep('upload'); setErrorMsg(''); setErrorAttempts([]) }}
                className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium transition-all min-h-[44px]">
                Tentar de novo
              </button>
            </div>
            {errorMsg.toLowerCase().includes('manutenção') && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left">
                <TriangleAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300/80 text-xs leading-relaxed">
                  Enquanto a IA está a recarregar, podes adicionar as transações manualmente
                  em poucos segundos — ainda assim ganhas XP.
                </p>
              </div>
            )}

            {/* Detalhes técnicos — lista dos attempts falhados (útil para
                diagnosticar se é uma chave inválida, quota diária, etc.
                sem ter de abrir logs do servidor). */}
            {errorAttempts.length > 0 && (
              <details className="w-full text-left bg-white/3 border border-white/8 rounded-xl overflow-hidden">
                <summary className="cursor-pointer px-3 py-2 text-[11px] text-white/50 hover:text-white transition-colors select-none">
                  Detalhes técnicos ({errorAttempts.length} {errorAttempts.length === 1 ? 'tentativa' : 'tentativas'})
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
