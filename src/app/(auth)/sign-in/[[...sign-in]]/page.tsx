import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-[#060b14] flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <span className="text-3xl">⚡</span>
          <span className="font-bold text-xl text-white">XP Money</span>
        </Link>
        <h1 className="text-2xl font-bold text-white">Bem-vindo de volta</h1>
        <p className="text-white/50 mt-1">O Voltix está com saudades tuas</p>
      </div>
      <SignIn />
    </main>
  )
}
