'use client'

import { useState }      from 'react'
import { useRouter }     from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, AlertTriangle } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

/**
 * "Danger Zone" card that lets the user wipe all their transactions.
 *
 * Flow:
 *   1. Click "Apagar todas as transações" → opens ConfirmDialog (danger tone).
 *   2. Confirm → DELETE /api/transactions/reset { confirm: "APAGAR" }.
 *   3. Success → toast-like inline banner, invalidate all data queries so the
 *      dashboard/transactions/score refetch automatically.
 */
export function ResetTransactionsCard() {
  const router = useRouter()
  const qc     = useQueryClient()

  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setResult(null)
    try {
      const res  = await fetch('/api/transactions/reset', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ confirm: 'APAGAR' }),
      })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error ?? 'Erro ao apagar transações.')

      setResult({
        type: 'success',
        msg:  json.deleted === 0
          ? 'Não havia transações para apagar.'
          : `${json.deleted} transaç${json.deleted === 1 ? 'ão apagada' : 'ões apagadas'} com sucesso.`,
      })

      // Invalidate every cached query — safest bet since transactions feed
      // many derived values (balances, score, missions progress, etc.).
      await qc.invalidateQueries()
      router.refresh()
      setShowConfirm(false)
    } catch (err: unknown) {
      setResult({
        type: 'error',
        msg:  err instanceof Error ? err.message : 'Erro desconhecido.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          Zona de Perigo
        </h2>
        <p className="text-sm text-white/50 mb-4 leading-relaxed">
          Apaga <strong className="text-white/80">todas as transações</strong> registadas na tua conta
          e recomeça do zero. O teu XP, missões e conquistas são mantidos —
          apenas os movimentos são removidos.
        </p>

        {result && (
          <div
            className={`mb-3 text-sm rounded-lg px-3 py-2 border ${
              result.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
            role="status"
          >
            {result.msg}
          </div>
        )}

        <button
          onClick={() => { setResult(null); setShowConfirm(true) }}
          className="inline-flex items-center gap-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px] text-sm active:scale-[0.98]"
        >
          <Trash2 className="w-4 h-4" />
          Apagar todas as transações
        </button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        tone="danger"
        loading={loading}
        title="Apagar todas as transações?"
        description="Esta ação é irreversível. Todas as tuas despesas e receitas registadas serão permanentemente apagadas. O teu XP, nível, missões e conquistas serão mantidos."
        confirmLabel="Sim, apagar tudo"
        cancelLabel="Cancelar"
        onConfirm={handleConfirm}
        onClose={() => { if (!loading) setShowConfirm(false) }}
      />
    </>
  )
}
