'use client'

import { useState }      from 'react'
import { useRouter }     from 'next/navigation'
import { useUser }       from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, AlertTriangle } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { clearAllCourseProgress } from '@/lib/courses'
import { useT } from '@/lib/i18n/LocaleProvider'

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
  const router   = useRouter()
  const qc       = useQueryClient()
  const { user } = useUser()
  const t        = useT()

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

      if (!res.ok) throw new Error(json.error ?? t('settings.reset.err_default'))

      setResult({
        type: 'success',
        msg:  json.deleted === 0
          ? t('settings.reset.empty_msg')
          : json.deleted === 1
            ? t('settings.reset.deleted_one',  { n: json.deleted })
            : t('settings.reset.deleted_many', { n: json.deleted }),
      })

      // Client-side cleanup — things the server can't touch because they live
      // in localStorage:
      //   1) Mascot-evolution cache (prevents a phantom cinematic after reset).
      //   2) Course progress + certificates (user asked: reset should include
      //      poupanças AND certificados so the account goes truly back to zero).
      try {
        window.localStorage.removeItem('xpmoney:mascot_last_evo')
        if (user?.id) clearAllCourseProgress(user.id)
      } catch { /* storage disabled — non-critical */ }

      // Invalidate every cached query — safest bet since transactions feed
      // many derived values (balances, score, missions progress, etc.).
      await qc.invalidateQueries()
      router.refresh()
      setShowConfirm(false)
    } catch (err: unknown) {
      setResult({
        type: 'error',
        msg:  err instanceof Error ? err.message : t('settings.reset.err_unknown'),
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
          {t('settings.reset.title')}
        </h2>
        <p className="text-sm text-white/50 mb-4 leading-relaxed">
          {t('settings.reset.desc_a')} <strong className="text-white/80">{t('settings.reset.desc_strong_a')}</strong>{t('settings.reset.desc_b')}{' '}
          <strong className="text-white/80">{t('settings.reset.desc_strong_b')}</strong> {t('settings.reset.desc_c')}{' '}
          <strong className="text-white/80">{t('settings.reset.desc_strong_c')}</strong>{t('settings.reset.desc_d')}{' '}
          <strong className="text-white/80">{t('settings.reset.desc_strong_d')}</strong> {t('settings.reset.desc_e')}
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
          {t('settings.reset.button')}
        </button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        tone="danger"
        loading={loading}
        title={t('settings.reset.confirm_title')}
        description={t('settings.reset.confirm_desc')}
        confirmLabel={t('settings.reset.confirm_yes')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleConfirm}
        onClose={() => { if (!loading) setShowConfirm(false) }}
      />
    </>
  )
}
