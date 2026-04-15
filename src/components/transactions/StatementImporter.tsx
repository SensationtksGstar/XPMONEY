'use client'

import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, FileText, Loader2, CheckCircle2, AlertCircle,
  ChevronDown, Sparkles, Download, TriangleAlert, Info,
} from 'lucide-react'
import { useCategories }    from '@/hooks/useCategories'
import { useAccounts }      from '@/hooks/useAccounts'
import { useQueryClient }   from '@tanstack/react-query'
import { cn }               from '@/lib/utils'
import type { ParsedTransaction, ImportStatementResult } from '@/app/api/import-statement/route'

interface Props { onClose: () => void }

type Step = 'upload' | 'parsing' | 'preview' | 'saving' | 'done' | 'error'

const ACCEPTED = '.csv,.txt,.tsv'
const MAX_BYTES = 1_000_000 // 1 MB

const BANKS = [
  { id: 'auto',        label: 'Detectar automaticamente' },
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

export function StatementImporter({ onClose }: Props) {
  const [step,      setStep]     = useState<Step>('upload')
  const [dragOver,  setDragOver] = useState(false)
  const [result,    setResult]   = useState<ImportStatementResult | null>(null)
  const [rows,      setRows]     = useState<ParsedTransaction[]>([])
  const [accountId, setAccountId]= useState('')
  const [errorMsg,  setErrorMsg] = useState('')
  const [doneMsg,   setDoneMsg]  = useState('')
  const fileRef  = useRef<HTMLInputElement>(null)
  const qc       = useQueryClient()

  const { categories: allCategories }  = useCategories()
  const { accounts, defaultAccount } = useAccounts()

  // Set default account once loaded
  const resolvedAccount = accountId || defaultAccount?.id || ''

  // ── Parse file via Claude ──────────────────────────────────────────────────
  const parseFile = useCallback(async (file: File) => {
    if (file.size > MAX_BYTES) {
      setErrorMsg('Ficheiro demasiado grande. Máximo 1 MB.')
      setStep('error')
      return
    }

    setStep('parsing')
    const content = await file.text()

    try {
      const res = await fetch('/api/import-statement', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content, filename: file.name }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Erro desconhecido')

      const data = json.data as ImportStatementResult
      setResult(data)
      setRows(data.transactions)
      setStep('preview')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Erro ao analisar ficheiro.')
      setStep('error')
    }
  }, [])

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile])

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

      // Invalidate all relevant caches
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
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

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
              <h2 className="font-bold text-white text-base">Importar Extrato</h2>
              <p className="text-white/40 text-xs">
                {step === 'preview'
                  ? `${result?.bank} · ${result?.transactions.length} movimentos detectados`
                  : 'CSV · TXT · Qualquer banco português'}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
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
                Exporta o extrato do teu banco em formato CSV ou TXT.
                O Claude analisa e categoriza automaticamente cada movimento.
                Os dados <strong className="text-blue-300">nunca são armazenados</strong> além das transações confirmadas.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
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
                <p className="text-white/35 text-xs mt-1">CSV · TXT · TSV — máx. 1 MB</p>
              </div>
              <input ref={fileRef} type="file" accept={ACCEPTED}
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
            </div>

            {/* Supported banks */}
            <div>
              <p className="text-white/30 text-xs mb-2">Bancos compatíveis:</p>
              <div className="flex flex-wrap gap-1.5">
                {BANKS.slice(1).map(b => (
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
                <p><strong className="text-white/60">CGD (Caixa):</strong> Netcaixa → Movimentos → Exportar → CSV</p>
                <p><strong className="text-white/60">Millennium:</strong> Site → Conta → Movimentos → Exportar Excel/CSV</p>
                <p><strong className="text-white/60">BPI:</strong> BPI Net → Consultas → Movimentos → Exportar</p>
                <p><strong className="text-white/60">Santander:</strong> Online → Conta corrente → Movimentos → Download</p>
                <p><strong className="text-white/60">Revolut:</strong> App → Conta → Declaração → CSV</p>
                <p><strong className="text-white/60">Wise:</strong> Account → Statements → Download CSV</p>
              </div>
            </details>
          </div>
        )}

        {/* ── PARSING step ── */}
        {step === 'parsing' && (
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-blue-400" />
              </div>
              <Loader2 className="w-6 h-6 text-blue-400 absolute -top-1 -right-1 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold">Claude está a analisar...</p>
              <p className="text-white/40 text-sm mt-1">A identificar o banco, extrair e categorizar movimentos</p>
            </div>
            <div className="w-full max-w-xs bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '65%' }} />
            </div>
          </div>
        )}

        {/* ── PREVIEW step ── */}
        {step === 'preview' && result && (
          <>
            {/* Account selector */}
            <div className="px-5 py-3 border-b border-white/8 flex-shrink-0 flex items-center gap-3">
              <span className="text-white/50 text-sm whitespace-nowrap">Importar para:</span>
              <select
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
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-all text-sm font-medium">
                Cancelar
              </button>
              <button
                onClick={confirm}
                disabled={selectedCount === 0}
                className={cn(
                  'flex-[2] py-3 rounded-xl font-bold text-sm transition-all',
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
          <div className="p-8 flex flex-col items-center gap-4">
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
              className="w-full max-w-xs py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-all">
              Fechar
            </button>
          </div>
        )}

        {/* ── ERROR step ── */}
        {step === 'error' && (
          <div className="p-8 flex flex-col items-center gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <div>
              <p className="text-white font-bold">Ocorreu um erro</p>
              <p className="text-white/50 text-sm mt-1">{errorMsg}</p>
            </div>
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={onClose}
                className="flex-1 py-3 border border-white/10 text-white/60 rounded-xl text-sm hover:border-white/25 hover:text-white transition-all">
                Fechar
              </button>
              <button onClick={() => { setStep('upload'); setErrorMsg('') }}
                className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium transition-all">
                Tentar de novo
              </button>
            </div>
            {errorMsg.includes('ANTHROPIC') && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left">
                <TriangleAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300/80 text-xs">
                  A chave ANTHROPIC_API_KEY não está configurada em <code>.env.local</code>.
                  Adiciona: <code>ANTHROPIC_API_KEY=sk-ant-...</code>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
