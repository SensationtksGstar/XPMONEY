'use client'

import { FileText, Lock } from 'lucide-react'
import { useUserPlan } from '@/lib/contexts/UserPlanContext'

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

/**
 * PDFReportCard — settings entry point for the Premium PDF financial report.
 *
 * Design decision: we link to `/reports/print` in a NEW TAB (target="_blank")
 * so the user's current settings context isn't blown away by the print page.
 * The print page auto-opens the browser's Save-as-PDF dialog via PrintButton.
 *
 * Plan gating mirrors what the server route does: Free users see a muted
 * "upgrade to unlock" state. We still render a disabled button rather than
 * hiding the card — users need to know the feature exists so they know what
 * they'd get by upgrading.
 */
export function PDFReportCard() {
  const { isPaid } = useUserPlan()

  // Premium (ou legacy plus/pro/family) desbloqueia a feature.
  // `isPaid` == plan !== 'free' — o layout já coerce legacy → premium.
  const unlocked = isPaid

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
        <FileText className="w-4 h-4 text-purple-300" />
        Relatório financeiro em PDF
        {!unlocked && (
          <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 inline-flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" />
            PREMIUM
          </span>
        )}
      </h2>
      <p className="text-sm text-white/50 mb-4 leading-relaxed">
        Exporta um relatório do mês com score, balanço, top categorias e
        estado das tuas poupanças. Ideal para guardar, partilhar com o
        contabilista ou imprimir.
      </p>

      {unlocked ? (
        <a
          href="/reports/print"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors min-h-[44px] active:scale-[0.98]"
        >
          <FileText className="w-4 h-4" />
          Gerar relatório PDF
        </a>
      ) : (
        <a
          href={IS_DEMO ? '/sign-up' : '/settings/billing'}
          className="w-full flex items-center justify-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-200 font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors min-h-[44px] active:scale-[0.98]"
        >
          <Lock className="w-4 h-4" />
          {IS_DEMO ? 'Criar conta para gerar relatório' : 'Desbloquear com Premium'}
        </a>
      )}

      <p className="text-[10px] text-white/30 mt-3 leading-snug">
        O relatório abre numa nova aba e usa a função nativa do browser para guardar PDF —
        funciona offline e não exige instalar nada.
      </p>
    </div>
  )
}
