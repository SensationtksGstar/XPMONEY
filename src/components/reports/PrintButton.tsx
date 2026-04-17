'use client'

import { Printer } from 'lucide-react'

/**
 * PrintButton — thin client-side trigger for the browser's native print dialog.
 *
 * The `/reports/print` page is fully server-rendered HTML with a print
 * stylesheet, so all we need on the client is a button that calls
 * `window.print()`. The browser's "Save as PDF" destination then produces
 * the final file — no Chromium bundle, no @react-pdf, no wasm.
 *
 * Why a dedicated component instead of inline onClick on the page:
 * the parent is a server component, so any `onClick` there would throw
 * at build time. Splitting this out keeps the page fully server-rendered
 * while still giving the user a one-click export path.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') window.print()
      }}
      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm inline-flex items-center gap-2 shadow-lg"
    >
      <Printer className="w-4 h-4" />
      Guardar como PDF
    </button>
  )
}
