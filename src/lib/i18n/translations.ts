/**
 * XP-Money — i18n translation tables.
 *
 * The PT file is the source of truth (app was built PT-PT first). Every key
 * MUST exist in `pt`. `en` is additive — if a key is missing there, `useT()`
 * falls back to the PT string so half-migrated views still render rather
 * than showing raw keys.
 *
 * Scalability note: we chose a flat key namespace (e.g. `nav.home` rather
 * than nested objects) so the table stays searchable and auto-completes
 * nicely. When adding a string:
 *   1. Add the PT version to `pt` below.
 *   2. Add the EN version to `en`.
 *   3. Replace the hardcoded string in the component with `t('your.key')`.
 *
 * Any {placeholder} tokens in the value get replaced at render time — pass
 * the map as the second arg to `t()`: `t('hi', { name: 'Ana' })`.
 */

export type Locale = 'pt' | 'en'

export const LOCALES: Locale[] = ['pt', 'en']
export const DEFAULT_LOCALE: Locale = 'pt'

export const LOCALE_LABELS: Record<Locale, { name: string; flag: string; native: string }> = {
  pt: { name: 'Português', flag: '🇵🇹', native: 'Português' },
  en: { name: 'English',   flag: '🇬🇧', native: 'English'   },
}

// ── Translation tables ───────────────────────────────────────────────────────

export const pt = {
  // Greetings / common
  'common.hello':        'Olá',
  'common.continue':     'Continuar',
  'common.cancel':       'Cancelar',
  'common.save':         'Guardar',
  'common.saving':       'A guardar…',
  'common.saved':        'Guardado',
  'common.close':        'Fechar',
  'common.loading':      'A carregar…',
  'common.retry':        'Tentar novamente',
  'common.back':         'Voltar',
  'common.yes':          'Sim',
  'common.no':           'Não',

  // Navigation (desktop + mobile)
  'nav.home':         'Início',
  'nav.transactions': 'Contas',
  'nav.goals':        'Poupanças',
  'nav.academy':      'Academia',
  'nav.missions':     'Missões',
  'nav.voltix':       'Voltix',
  'nav.badges':       'Conquistas',
  'nav.perspective':  'Perspetiva',
  'nav.simulator':    'Simulador',
  'nav.settings':     'Definições',
  'nav.more':         'Mais',
  'nav.more_title':   'Mais páginas',
  'nav.add_tx_aria':  'Adicionar transação',

  // Dashboard
  'dashboard.welcome_back':    'Bem-vindo de volta, {name}!',
  'dashboard.welcome_new':     'Bem-vindo, {name}!',

  // Settings
  'settings.title':              'Definições',
  'settings.subtitle':           'Gere a tua conta e subscrição',
  'settings.plan_current':       'Plano Atual',
  'settings.plan_on':            'Estás no plano',
  'settings.plan_active':        'Ativo',
  'settings.plan_upgrade':       'Fazer upgrade',
  'settings.notifications':      'Notificações Diárias',
  'settings.notifications_desc': 'Recebe lembretes diários com frases motivacionais para manteres os bons hábitos financeiros.',
  'settings.mascot':             'Mascote',
  'settings.mascot_desc':        'Escolhe o companheiro que te acompanha na jornada financeira. Podes trocar sempre que quiseres.',
  'settings.language':           'Idioma',
  'settings.language_desc':      'Escolhe o idioma da aplicação. A preferência é guardada neste dispositivo.',
  'settings.danger_zone':        'Zona de Perigo',

  // Mascot
  'mascot.voltix_desc': 'Dragão-trovão azul',
  'mascot.penny_desc':  'Gata-anjo creme',

  // Reset
  'reset.button':       'Apagar todas as transações',
  'reset.success':      'Conta reposta ao estado inicial.',
} as const

export const en: Partial<Record<keyof typeof pt, string>> = {
  // Greetings / common
  'common.hello':        'Hello',
  'common.continue':     'Continue',
  'common.cancel':       'Cancel',
  'common.save':         'Save',
  'common.saving':       'Saving…',
  'common.saved':        'Saved',
  'common.close':        'Close',
  'common.loading':      'Loading…',
  'common.retry':        'Retry',
  'common.back':         'Back',
  'common.yes':          'Yes',
  'common.no':           'No',

  // Navigation
  'nav.home':         'Home',
  'nav.transactions': 'Accounts',
  'nav.goals':        'Savings',
  'nav.academy':      'Academy',
  'nav.missions':     'Missions',
  'nav.voltix':       'Voltix',
  'nav.badges':       'Achievements',
  'nav.perspective':  'Insights',
  'nav.simulator':    'Simulator',
  'nav.settings':     'Settings',
  'nav.more':         'More',
  'nav.more_title':   'More pages',
  'nav.add_tx_aria':  'Add transaction',

  // Dashboard
  'dashboard.welcome_back':    'Welcome back, {name}!',
  'dashboard.welcome_new':     'Welcome, {name}!',

  // Settings
  'settings.title':              'Settings',
  'settings.subtitle':           'Manage your account and subscription',
  'settings.plan_current':       'Current Plan',
  'settings.plan_on':            'You are on the',
  'settings.plan_active':        'Active',
  'settings.plan_upgrade':       'Upgrade',
  'settings.notifications':      'Daily Notifications',
  'settings.notifications_desc': 'Get daily reminders with motivational quotes to keep good financial habits.',
  'settings.mascot':             'Mascot',
  'settings.mascot_desc':        'Choose the companion that joins you on your financial journey. You can switch any time.',
  'settings.language':           'Language',
  'settings.language_desc':      'Choose the app language. Your preference is saved on this device.',
  'settings.danger_zone':        'Danger Zone',

  // Mascot
  'mascot.voltix_desc': 'Blue thunder dragon',
  'mascot.penny_desc':  'Cream angel cat',

  // Reset
  'reset.button':       'Delete all transactions',
  'reset.success':      'Account reset to initial state.',
}

export type TranslationKey = keyof typeof pt

export const TABLES: Record<Locale, Partial<Record<TranslationKey, string>>> = {
  pt,
  en,
}
