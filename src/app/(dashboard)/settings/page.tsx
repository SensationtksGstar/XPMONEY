import { auth, currentUser } from '@clerk/nextjs/server'
import { UserProfile }       from '@clerk/nextjs'
import { Crown, Zap, Check } from 'lucide-react'
import Link                  from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase'

export const metadata = { title: 'Definições' }

const PLAN_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  free:   { name: 'Gratuito', icon: '🌱', color: 'text-white/60' },
  plus:   { name: 'Plus',     icon: '⚡', color: 'text-green-400' },
  pro:    { name: 'Pro',      icon: '👑', color: 'text-purple-400' },
  family: { name: 'Family',   icon: '👨‍👩‍👧', color: 'text-blue-400' },
}

export default async function SettingsPage() {
  const { userId } = await auth()
  const user       = await currentUser()
  if (!userId || !user) return null

  const db = createSupabaseAdmin()
  const { data: profile } = await db
    .from('users')
    .select('plan')
    .eq('clerk_id', userId)
    .single()

  const plan      = profile?.plan ?? 'free'
  const planInfo  = PLAN_LABELS[plan] ?? PLAN_LABELS.free
  const isPaid    = plan !== 'free'

  return (
    <div className="space-y-6 animate-fade-in-up max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Definições</h1>
        <p className="text-white/50 text-sm mt-0.5">Gere a tua conta e subscrição</p>
      </div>

      {/* Plano atual */}
      <div className={`border rounded-xl p-5 ${isPaid ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-400" />
              Plano Atual
            </h2>
            <p className="text-sm text-white/60">
              Estás no plano{' '}
              <strong className={planInfo.color}>
                {planInfo.icon} {planInfo.name}
              </strong>
            </p>
          </div>
          {isPaid ? (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-2 rounded-lg">
              <Check className="w-4 h-4" />
              Ativo
            </div>
          ) : (
            <Link
              href="/settings/billing"
              className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-500/20 transition-colors"
            >
              <Crown className="w-4 h-4" />
              Fazer upgrade
            </Link>
          )}
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
