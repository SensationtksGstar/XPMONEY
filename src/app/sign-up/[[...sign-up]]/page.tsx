import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignUpPage() {
  return (
    <main className="min-h-screen dashboard-bg flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <span className="text-3xl">⚡</span>
          <span className="font-bold text-xl text-white">XP Money</span>
        </Link>
        <h1 className="text-2xl font-bold text-white">Cria a tua conta grátis</h1>
        <p className="text-white/50 mt-1">Sem cartão de crédito. Sempre grátis no plano base.</p>
      </div>

      <SignUp />

      <p className="mt-6 text-sm text-white/40">
        Já tens conta?{' '}
        <Link href="/sign-in" className="text-green-400 hover:text-green-300 transition-colors">
          Entra
        </Link>
      </p>
    </main>
  )
}
