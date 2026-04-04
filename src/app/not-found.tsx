'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen dashboard-bg flex flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="space-y-4"
      >
        <p className="text-8xl font-black text-green-400">404</p>
        <h1 className="text-2xl font-bold text-white">Página não encontrada</h1>
        <p className="text-white/50 max-w-xs mx-auto">
          Esta página não existe ou foi removida. Volta ao Dashboard para continuares.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-4 bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-xl transition-all active:scale-95"
        >
          Voltar ao Dashboard
        </Link>
      </motion.div>
    </main>
  )
}
