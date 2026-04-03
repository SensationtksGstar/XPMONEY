import { auth, currentUser } from '@clerk/nextjs/server'
import { UserProfile }       from '@clerk/nextjs'
import { Crown, Zap }        from 'lucide-react'
import Link                  from 'next/link'

export const metadata = { title: 'Definições' }

export default async function SettingsPage() {
  const { userId } = await auth()
  const user       = await currentUser()
  if (!userId || !user) return null

  return (
    <div className="space-y-6 animate-fade-in-up max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Definições</h1>
        <p className="text-white/50 text-sm mt-0.5">Gere a tua conta e subscrição</p>
      </div>

      {/* Plano atual */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-400" />
              Plano Atual
            </h2>
            <p className="text-sm text-white/60">Estás no plano <strong className="text-white">Gratuito</strong></p>
          </div>
          <Link
            href="/settings/billing"
            className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-500/20 transition-colors"
          >
            <Crown className="w-4 h-4" />
            Fazer upgrade
          </Link>
        </div>
      </div>

      {/* Perfil Clerk */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-4">Perfil e Conta</h2>
        <UserProfile
          appearance={{
            elements: {
              card:               'bg-transparent shadow-none border-0',
              navbar:             'hidden',
              pageScrollBox:      'p-0',
              rootBox:            'w-full',
              formButtonPrimary:  'bg-green-500 hover:bg-green-400 text-black',
            },
          }}
        />
      </div>
    </div>
  )
}
