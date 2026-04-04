'use client'

import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <main className="min-h-screen dashboard-bg flex flex-col items-center justify-center px-4 text-center">
      <div className="space-y-4 max-w-sm mx-auto">
        <p className="text-5xl font-black text-red-400">!</p>
        <h1 className="text-2xl font-bold text-white">Algo correu mal</h1>
        {error.message && (
          <p className="text-xs text-white/30 font-mono bg-white/5 border border-white/10 rounded-lg px-3 py-2 break-all">
            {error.message}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="bg-red-500 hover:bg-red-400 text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95"
          >
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="bg-white/10 hover:bg-white/15 text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  )
}
