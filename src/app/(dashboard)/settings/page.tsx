import { auth, clerkClient } from '@clerk/nextjs/server'
import { Crown, Zap, Check } from 'lucide-react'
import Link                  from 'next/link'
import { createSupabaseAdmin } from '@/lib/supabase'
import { getUserProfile }    from '@/lib/userCache'
import { ProfileEditForm }   from './ProfileEditForm'
import { PushOptIn }         from '@/components/notifications/PushOptIn'
import { ResetTransactionsCard } from '@/components/settings/ResetTransactionsCard'
import { PrivacyCards }          from '@/components/settings/PrivacyCards'
import { MascotPicker }      from '@/components/settings/MascotPicker'
import { LanguageSwitcher }  from '@/components/settings/LanguageSwitcher'
import { BugReportCard }     from '@/components/settings/BugReportCard'
import { PDFReportCard }     from '@/components/settings/PDFReportCard'
import { getServerT }        from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'

export const metadata = { title: 'Definições' }

// Modelo 2-tier. Legacy plus/pro/family fazem fallback para premium para
// contas ainda não migradas.
const PLAN_LABELS: Record<string, { key: TranslationKey; icon: string; color: string }> = {
  free:    { key: 'settings.plan.free',    icon: '🌱', color: 'text-white/60' },
  premium: { key: 'settings.plan.premium', icon: '👑', color: 'text-purple-400' },
  plus:    { key: 'settings.plan.premium', icon: '👑', color: 'text-purple-400' },
  pro:     { key: 'settings.plan.premium', icon: '👑', color: 'text-purple-400' },
  family:  { key: 'settings.plan.premium', icon: '👑', color: 'text-purple-400' },
}

export default async function SettingsPage() {
  const { userId } = await auth()
  if (!userId) return null

  const t = await getServerT()

  // Plan from shared cache — no extra DB call
  const cached = await getUserProfile(userId)
  const plan     = (cached?.plan ?? 'free') as string
  const planInfo = PLAN_LABELS[plan] ?? PLAN_LABELS.free
  const isPaid   = plan !== 'free'

  // Profile details (name, email, etc.) — fetch separately since they change more often.
  // `challenge` and `goal` live in Clerk publicMetadata (see /api/profile for the why).
  const db = createSupabaseAdmin()
  const { data: profile } = await db
    .from('users')
    .select('id, name, email, avatar_url, currency, mascot_gender')
    .eq('clerk_id', userId)
    .maybeSingle()

  // Fetch the user's current mascot evolution so the MascotPicker can preview
  // the mascots at THEIR stage (e.g. a user who's at evo 4 should see the
  // picker show evo 4 art, not the default evo-3 baby form). Fresh users
  // without a voltix_states row default to evo 1.
  let currentEvo = 1
  if (profile?.id) {
    const { data: vx } = await db
      .from('voltix_states')
      .select('evolution_level')
      .eq('user_id', profile.id)
      .maybeSingle()
    currentEvo = Math.max(1, Math.min(6, vx?.evolution_level ?? 1))
  }

  // Challenge/goal from Clerk metadata (no DDL required)
  let challenge = ''
  let goal      = ''
  try {
    const clerk = await clerkClient()
    const cu    = await clerk.users.getUser(userId)
    const meta  = (cu.publicMetadata ?? {}) as { challenge?: string; goal?: string }
    challenge   = meta.challenge ?? ''
    goal        = meta.goal      ?? ''
  } catch (err) {
    console.warn('[settings] failed to read Clerk metadata:', err)
  }

  const mascotGender = (profile?.mascot_gender === 'penny' ? 'penny' : 'voltix') as 'voltix' | 'penny'

  return (
    <div className="space-y-6 animate-fade-in-up max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
        <p className="text-white/50 text-sm mt-0.5">{t('settings.subtitle')}</p>
      </div>

      {/* Plano atual */}
      <div className={`border rounded-xl p-5 ${isPaid ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-400" />
              {t('settings.plan_current')}
            </h2>
            <p className="text-sm text-white/60">
              {t('settings.plan_on')}{' '}
              <strong className={planInfo.color}>
                {planInfo.icon} {t(planInfo.key)}
              </strong>
            </p>
          </div>
          {isPaid ? (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-2 rounded-lg">
              <Check className="w-4 h-4" />
              {t('settings.plan_active')}
            </div>
          ) : (
            <Link
              href="/settings/billing"
              className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-500/20 transition-colors"
            >
              <Crown className="w-4 h-4" />
              {t('settings.plan_upgrade')}
            </Link>
          )}
        </div>
      </div>

      {/* Notificações push */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
          <span className="text-base">{t('settings.notifications_icon')}</span>
          {t('settings.notifications')}
        </h2>
        <p className="text-sm text-white/50 mb-4">
          {t('settings.notifications_desc')}
        </p>
        <PushOptIn />
      </div>

      {/* Mascote */}
      <MascotPicker initialGender={mascotGender} currentEvo={currentEvo} />

      {/* Idioma / Language */}
      <LanguageSwitcher />

      {/* Formulário de edição de perfil */}
      <ProfileEditForm
        initialName={profile?.name ?? ''}
        initialChallenge={challenge}
        initialGoal={goal}
        initialCurrency={profile?.currency ?? 'EUR'}
        email={profile?.email ?? ''}
        avatarUrl={profile?.avatar_url ?? null}
      />

      {/* Relatório em PDF — Pro+ only, Free/Plus see upsell */}
      <PDFReportCard />

      {/* Report bug — user → admin (admin email never exposed) */}
      <BugReportCard />

      {/* RGPD — exportar dados (Art. 20) e apagar conta de vez (Art. 17) */}
      <PrivacyCards />

      {/* Zona de perigo — apagar todas as transações (mantém a conta) */}
      <ResetTransactionsCard />
    </div>
  )
}
