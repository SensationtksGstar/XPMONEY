import { SignIn } from '@clerk/nextjs'
import { dark }   from '@clerk/themes'
import Link       from 'next/link'
import { Logo }   from '@/components/ui/Logo'

const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorBackground:      '#0d1424',
    colorInputBackground: '#111827',
    colorText:            '#f1f5f9',
    colorTextSecondary:   '#94a3b8',
    colorInputText:       '#f1f5f9',
    colorPrimary:         '#22c55e',
    colorDanger:          '#f87171',
    borderRadius:         '0.75rem',
    fontFamily:           'inherit',
  },
  elements: {
    /* outer card */
    card:                   'bg-[#0d1424] border border-white/10 shadow-2xl shadow-black/60 rounded-2xl',
    /* header */
    headerTitle:            'text-white font-bold',
    headerSubtitle:         'text-white/50',
    /* divider */
    dividerLine:            'bg-white/10',
    dividerText:            'text-white/30',
    /* social buttons */
    socialButtonsBlockButton:
      'border border-white/15 bg-white/5 hover:bg-white/10 text-white transition-colors rounded-xl',
    socialButtonsBlockButtonText: 'text-white font-medium',
    socialButtonsBlockButtonArrow: 'text-white/40',
    /* form fields */
    formFieldLabel:         'text-white/70 text-sm font-medium',
    formFieldInput:
      'bg-[#111827] border border-white/15 text-white placeholder-white/30 rounded-xl focus:border-green-500/60 focus:ring-1 focus:ring-green-500/40',
    formFieldInputShowPasswordButton: 'text-white/40 hover:text-white',
    /* primary button */
    formButtonPrimary:
      'bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-colors',
    /* links */
    footerActionText:       'text-white/40',
    footerActionLink:       'text-green-400 hover:text-green-300 font-semibold',
    identityPreviewText:    'text-white',
    identityPreviewEditButton: 'text-green-400 hover:text-green-300',
    /* OTP / code input */
    otpCodeFieldInput:
      'bg-[#111827] border border-white/20 text-white rounded-xl text-center',
    /* alerts */
    alertText:              'text-white/80',
    formFieldErrorText:     'text-red-400 text-xs',
    /* internal card parts */
    cardBox:                'bg-transparent',
    navbar:                 'hidden',
    navbarMobileMenuRow:    'hidden',
    pageScrollBox:          'bg-transparent',
    profileSection:         'bg-transparent',
    /* badge */
    badge:                  'bg-green-500/20 text-green-400 border border-green-500/30',
  },
}

export default function SignInPage() {
  return (
    <main className="min-h-screen dashboard-bg flex flex-col items-center justify-center px-4 py-8">
      <div className="mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-5">
          <Logo size={36} />
          <span className="font-bold text-xl text-white tracking-tight">XP-Money</span>
        </Link>
        <h1 className="text-2xl font-bold text-white">Bem-vindo de volta</h1>
        <p className="text-white/50 mt-1 text-sm">O Voltix está com saudades tuas</p>
      </div>

      <SignIn appearance={clerkAppearance} />

      <p className="mt-5 text-sm text-white/40">
        Ainda não tens conta?{' '}
        <Link href="/sign-up" className="text-green-400 hover:text-green-300 transition-colors font-semibold">
          Regista-te grátis
        </Link>
      </p>
    </main>
  )
}
