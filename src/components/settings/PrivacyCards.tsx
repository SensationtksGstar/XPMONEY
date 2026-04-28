'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { Download, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useT } from '@/lib/i18n/LocaleProvider'
import { clearConsent } from '@/lib/consent'

/**
 * RGPD-compliance pair of cards in Settings:
 *
 *   1. Exportar dados — Art. 20 portability. Triggers a download of every
 *      user-scoped row as a single JSON file. No confirmation needed —
 *      reading your own data isn't destructive.
 *
 *   2. Apagar conta — Art. 17 right-to-erasure. Triple-gated:
 *        a. Click button → opens ConfirmDialog
 *        b. ConfirmDialog requires explicit "APAGAR-CONTA" typed input
 *        c. Server requires { confirm: "APAGAR-CONTA" } in body
 *      On success, signs out via Clerk and lands on the landing page.
 *
 * The split into two cards (rather than a single "danger zone") is
 * deliberate: export is benign, delete is terminal. Stacking them under
 * the same header invites accidental clicks on mobile.
 */
export function PrivacyCards() {
  const t        = useT()
  const router   = useRouter()
  const { signOut } = useClerk()

  // ── Export ──
  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    setExportErr(null)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      // Stream the JSON to a Blob and trigger a download client-side.
      // We don't navigate to the URL because that would open it in-tab and
      // the JSON would render as text instead of being saved.
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `xpmoney-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportErr(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setExporting(false)
    }
  }

  // ── Delete ──
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [deleteErr, setDeleteErr]     = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteErr(null)
    try {
      const res = await fetch('/api/account', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ confirm: 'APAGAR-CONTA' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)

      // Clear consent so a future visitor on this device sees a fresh banner.
      clearConsent()
      try { window.localStorage.clear() } catch { /* private mode */ }

      // Clerk signOut redirects automatically when given a redirectUrl.
      await signOut({ redirectUrl: '/' })
      router.refresh()
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : t('common.error'))
      setDeleting(false)
    }
  }

  return (
    <>
      {/* Exportar dados — Art. 20 RGPD */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
          <Download className="w-4 h-4 text-green-400" />
          {t('privacy.export.title')}
        </h2>
        <p className="text-sm text-white/50 mb-4 leading-relaxed">
          {t('privacy.export.desc')}
        </p>

        {exportErr && (
          <div className="mb-3 text-sm rounded-lg px-3 py-2 border bg-red-500/10 border-red-500/30 text-red-300" role="alert">
            {exportErr}
          </div>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 bg-green-500/15 hover:bg-green-500/25 disabled:opacity-50 border border-green-500/30 text-green-300 font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px] text-sm active:scale-[0.98]"
        >
          {exporting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('privacy.export.loading')}</>
            : <><Download className="w-4 h-4" /> {t('privacy.export.button')}</>}
        </button>
      </div>

      {/* Apagar conta — Art. 17 RGPD */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          {t('privacy.delete.title')}
        </h2>
        <p className="text-sm text-white/50 mb-4 leading-relaxed">
          {t('privacy.delete.desc')}
        </p>

        {deleteErr && (
          <div className="mb-3 text-sm rounded-lg px-3 py-2 border bg-red-500/10 border-red-500/30 text-red-300" role="alert">
            {deleteErr}
          </div>
        )}

        <button
          type="button"
          onClick={() => { setDeleteErr(null); setShowConfirm(true) }}
          className="inline-flex items-center gap-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-semibold px-4 py-2.5 rounded-xl transition-colors min-h-[44px] text-sm active:scale-[0.98]"
        >
          <Trash2 className="w-4 h-4" />
          {t('privacy.delete.button')}
        </button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        tone="danger"
        loading={deleting}
        title={t('privacy.delete.confirm_title')}
        description={t('privacy.delete.confirm_desc')}
        confirmLabel={t('privacy.delete.confirm_yes')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDelete}
        onClose={() => { if (!deleting) setShowConfirm(false) }}
      />
    </>
  )
}
