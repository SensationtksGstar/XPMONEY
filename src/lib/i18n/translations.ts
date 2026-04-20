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

/** Shared cookie name for server+client locale sync. */
export const LOCALE_COOKIE = 'xpmoney-locale'

export const LOCALE_LABELS: Record<Locale, { name: string; flag: string; native: string }> = {
  pt: { name: 'Português', flag: '🇵🇹', native: 'Português' },
  en: { name: 'English',   flag: '🇬🇧', native: 'English'   },
}

// ── Translation tables ───────────────────────────────────────────────────────

export const pt = {
  // ── Common ──────────────────────────────────────────────────────────
  'common.hello':          'Olá',
  'common.continue':       'Continuar',
  'common.cancel':         'Cancelar',
  'common.save':           'Guardar',
  'common.saving':         'A guardar…',
  'common.saved':          'Guardado',
  'common.close':          'Fechar',
  'common.loading':        'A carregar…',
  'common.retry':          'Tentar novamente',
  'common.back':           'Voltar',
  'common.yes':            'Sim',
  'common.no':             'Não',
  'common.delete':         'Eliminar',
  'common.edit':           'Editar',
  'common.confirm':        'Confirmar',
  'common.next':           'Seguinte',
  'common.previous':       'Anterior',
  'common.new':            'Novo',
  'common.error':          'Ocorreu um erro',
  'common.success':        'Sucesso',
  'common.sign_in':        'Entrar',
  'common.sign_up':        'Criar conta',
  'common.create_account': 'Criar conta grátis',
  'common.sign_out':       'Sair',
  'common.free':           'Grátis',
  'common.premium':        'Premium',
  'common.per_month':      '/mês',
  'common.per_year':       '/ano',

  // ── Navigation (sidebar + mobile) ──────────────────────────────────
  'nav.home':              'Início',
  'nav.dashboard':         'Dashboard',
  'nav.transactions':      'Transações',
  'nav.transactions_short':'Contas',
  'nav.goals':             'Poupanças',
  'nav.academy':           'Academia',
  'nav.missions':          'Missões',
  'nav.voltix':            'Voltix',
  'nav.pet':               'Pet',
  'nav.badges':            'Conquistas',
  'nav.perspective':       'Perspetiva',
  'nav.simulator':         'Simulador',
  'nav.settings':          'Definições',
  'nav.budget':            'Orçamento',
  'nav.debt_killer':       'Mata-Dívidas',
  'nav.more':              'Mais',
  'nav.more_title':        'Mais páginas',
  'nav.add_tx_aria':       'Adicionar transação',
  'nav.close_menu':        'Fechar menu',
  'nav.account_label':     'Conta',
  'nav.premium_cta':       'Ver Premium',
  'nav.premium_sub':       'Academia · Perspetiva · Scan',
  'nav.badge_premium':     '👑 PREMIUM',

  // ── Dashboard greeting ─────────────────────────────────────────────
  'dashboard.welcome_back':'Bem-vindo de volta, {name}!',
  'dashboard.welcome_new': 'Bem-vindo, {name}!',

  // ── MonthSelector ──────────────────────────────────────────────────
  'ms.prev_aria':          'Mês anterior',
  'ms.next_aria':          'Mês seguinte',
  'ms.all_history':        'Todo o histórico',
  'ms.this_month':         'Este mês',
  'ms.all_btn':            'Tudo',
  'ms.all_btn_active':     'A ver tudo',

  // ── MonthlySummary ────────────────────────────────────────────────
  'summary.revenues':      'Receitas',
  'summary.expenses':      'Despesas',
  'summary.savings':       'Poupança',
  'summary.rate':          'Taxa: {value}',
  'summary.this_month':    'Este mês',
  'summary.fallback':      'A mostrar {shown} — {current} ainda não tem movimentos registados.',

  // ── ExpenseBreakdown ──────────────────────────────────────────────
  'breakdown.title':       'Onde vai o dinheiro',
  'breakdown.amount_this_month': '{amount} este mês',
  'breakdown.amount_in_month':   '{amount} em {month}',
  'breakdown.empty_title':       'Ainda sem despesas este mês',
  'breakdown.empty_subtitle':    'Regista os teus movimentos e vê onde o dinheiro está a ir.',
  'breakdown.empty_cta':         'Ir para Transações',
  'breakdown.bar_title':         '{pct}% das despesas',
  'breakdown.see_all':           'Ver todas as transações',

  // ── Landing navigation ─────────────────────────────────────────────
  'landing.nav.how_it_works': 'Como funciona',
  'landing.nav.features':     'Funcionalidades',
  'landing.nav.pricing':      'Preços',
  'landing.nav.faq':          'FAQ',
  'landing.nav.sign_in':      'Entrar',
  'landing.nav.cta':          'Começar grátis',

  // ── Landing hero ──────────────────────────────────────────────────
  'landing.hero.badge':          'Early Access · Grátis para sempre',
  'landing.hero.title_l1_a':     'Poupa mais,',
  'landing.hero.title_l1_emph':  'sem tortura',
  'landing.hero.title_l1_b':     '.',
  'landing.hero.title_l2_a':     'Finanças em',
  'landing.hero.title_l2_emph':  'modo RPG',
  'landing.hero.title_l2_b':     '.',
  'landing.hero.sub_a':          'Score financeiro, missões semanais, recibos por foto e um mascote que evolui contigo em',
  'landing.hero.sub_evo':        '6 fases',
  'landing.hero.sub_b':          '. A Academia entrega-te um',
  'landing.hero.sub_cert':       'certificado digital',
  'landing.hero.sub_new':        'NEW',
  'landing.hero.sub_c':          'por cada curso concluído.',
  'landing.hero.cta_primary':    'Criar conta grátis',
  'landing.hero.cta_secondary':  'Ver Premium · €3,33/mês',
  'landing.hero.annual_title':   'Anual €39,99 ≈',
  'landing.hero.annual_month':   '€3,33/mês',
  'landing.hero.annual_savings': '· poupas €20/ano',
  'landing.hero.annual_compare': 'Comparado com o plano mensal a €4,99',
  'landing.hero.trust_reviews':  '· 1.200+ early users',
  'landing.hero.trust_country':  '🇵🇹 Feito em Portugal',
  'landing.hero.trust_gdpr':     'GDPR · dados cifrados',
  'landing.hero.no_card':        'Sem cartão · Cancela quando quiseres · Sem ligação obrigatória ao banco',
  'landing.hero.voltix_alt':     'Voltix — mascote na 4ª evolução',
  'landing.hero.evo_alt':        'Voltix evolução {n}',
  'landing.hero.evo_rail_label': '6 evoluções conforme a tua vida financeira sobe',
  'landing.hero.card_score':     'Score',
  'landing.hero.card_level':     'Nível',
  'landing.hero.card_streak':    'Streak',
  'landing.hero.card_streak_val':'23d',
  'landing.hero.card_says':      'Voltix diz',
  'landing.hero.card_dialogue':  'Boa! Poupaste €180 este mês. Mais 2 missões e subes para a 5ª evolução.',
  'landing.hero.card_xp_label':  'XP · Nível 7',
  'landing.hero.card_xp_val':    '1.240 / 1.500',
  'landing.hero.card_m1':        'Registar 15 transações',
  'landing.hero.card_m2':        'Ficar abaixo de €200 em restaurantes',
  'landing.hero.card_m3':        'Poupar €100 este mês',

  // ── Landing pricing ───────────────────────────────────────────────
  'pricing.eyebrow':       'Preço',
  'pricing.title_a':       'Começa grátis. Desbloqueia tudo por',
  'pricing.title_price':   '€3,33/mês',
  'pricing.title_b':       '.',
  'pricing.subtitle':      'Sem preços-armadilha. Sem letra pequena. Um único plano pago com tudo incluído.',
  'pricing.toggle_aria':   'Escolher período de faturação',
  'pricing.toggle_monthly':'Mensal',
  'pricing.toggle_yearly': 'Anual',
  'pricing.free_title':    'Grátis',
  'pricing.free_duration': 'Para sempre',
  'pricing.free_f1':       'Registo de transações ilimitado',
  'pricing.free_f2':       'Score financeiro + histórico',
  'pricing.free_f3':       'Mascote à escolha — Voltix ou Penny (6 evoluções)',
  'pricing.free_f4':       'XP, níveis e missões do plano grátis',
  'pricing.free_f5':       '2 objetivos de poupança',
  'pricing.free_f6':       'Cursos iniciais da Academia',
  'pricing.free_ads':      'Tem anúncios discretos, não-intrusivos.',
  'pricing.free_cta':      'Começar grátis',
  'pricing.premium_badge': 'TUDO INCLUÍDO',
  'pricing.premium_title': 'Premium',
  'pricing.premium_month_price_y': '€3,33',
  'pricing.premium_month_price_m': '€4,99',
  'pricing.premium_billed_y':      'Cobrado €39,99/ano · poupas €20/ano',
  'pricing.premium_billed_m':      'Cobrado €4,99/mês · cancelas quando quiseres',
  'pricing.premium_savings_chip':  'Poupas 33% vs mensal',
  'pricing.premium_f1':    'Tudo do Grátis, sem anúncios',
  'pricing.premium_f2':    'Scanner de recibos com IA',
  'pricing.premium_f3':    'Import de extratos (PDF / CSV)',
  'pricing.premium_f4':    'Simulador de investimento (DCA)',
  'pricing.premium_f5':    'Perspetiva de Riqueza · horas de trabalho',
  'pricing.premium_f6':    'Relatório financeiro em PDF',
  'pricing.premium_f7':    'Academia completa · todos os cursos',
  'pricing.premium_f8':    'Categorias e objetivos ilimitados',
  'pricing.premium_f9':    'Missões e badges exclusivos',
  'pricing.premium_f10':   'Certificado digital ao concluíres cada curso da Academia',
  'pricing.premium_f11':   'Suporte prioritário · acesso antecipado',
  'pricing.premium_cta_y': 'Quero o anual · €3,33/mês',
  'pricing.premium_cta_m': 'Experimentar mensal · €4,99',
  'pricing.premium_footer':'Cancela a qualquer momento · IVA incluído',
  'pricing.footer_note':   'Preços em EUR · Pagamento seguro via Stripe · GDPR',

  // ── Landing final CTA ─────────────────────────────────────────────
  'landing.cta.title_a':   'O teu mascote está',
  'landing.cta.title_emph':'à tua espera',
  'landing.cta.subtitle':  'Junta-te aos +1.200 early-access que estão a reescrever a relação com o dinheiro — sem folhas de Excel, sem culpa, sem apps a pedirem o login do banco.',
  'landing.cta.button':    'Criar conta grátis',
  'landing.cta.footer':    'Menos de 30 segundos · Sem cartão de crédito · Cancela a qualquer momento',

  // ── Settings ──────────────────────────────────────────────────────
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

  // ── Mascot ────────────────────────────────────────────────────────
  'mascot.voltix_desc': 'Dragão-trovão azul',
  'mascot.penny_desc':  'Gata-anjo creme',

  // ── Reset ─────────────────────────────────────────────────────────
  'reset.button':       'Apagar todas as transações',
  'reset.success':      'Conta reposta ao estado inicial.',
} as const

export const en: Partial<Record<keyof typeof pt, string>> = {
  // ── Common ──────────────────────────────────────────────────────────
  'common.hello':          'Hello',
  'common.continue':       'Continue',
  'common.cancel':         'Cancel',
  'common.save':           'Save',
  'common.saving':         'Saving…',
  'common.saved':          'Saved',
  'common.close':          'Close',
  'common.loading':        'Loading…',
  'common.retry':          'Retry',
  'common.back':           'Back',
  'common.yes':            'Yes',
  'common.no':             'No',
  'common.delete':         'Delete',
  'common.edit':           'Edit',
  'common.confirm':        'Confirm',
  'common.next':           'Next',
  'common.previous':       'Previous',
  'common.new':            'New',
  'common.error':          'Something went wrong',
  'common.success':        'Success',
  'common.sign_in':        'Sign in',
  'common.sign_up':        'Sign up',
  'common.create_account': 'Create free account',
  'common.sign_out':       'Sign out',
  'common.free':           'Free',
  'common.premium':        'Premium',
  'common.per_month':      '/mo',
  'common.per_year':       '/yr',

  // ── Navigation ─────────────────────────────────────────────────────
  'nav.home':              'Home',
  'nav.dashboard':         'Dashboard',
  'nav.transactions':      'Transactions',
  'nav.transactions_short':'Accounts',
  'nav.goals':             'Savings',
  'nav.academy':           'Academy',
  'nav.missions':          'Missions',
  'nav.voltix':            'Voltix',
  'nav.pet':               'Pet',
  'nav.badges':            'Achievements',
  'nav.perspective':       'Insights',
  'nav.simulator':         'Simulator',
  'nav.settings':          'Settings',
  'nav.budget':            'Budget',
  'nav.debt_killer':       'Debt Killer',
  'nav.more':              'More',
  'nav.more_title':        'More pages',
  'nav.add_tx_aria':       'Add transaction',
  'nav.close_menu':        'Close menu',
  'nav.account_label':     'Account',
  'nav.premium_cta':       'See Premium',
  'nav.premium_sub':       'Academy · Insights · Scan',
  'nav.badge_premium':     '👑 PREMIUM',

  // ── Dashboard greeting ─────────────────────────────────────────────
  'dashboard.welcome_back':'Welcome back, {name}!',
  'dashboard.welcome_new': 'Welcome, {name}!',

  // ── MonthSelector ──────────────────────────────────────────────────
  'ms.prev_aria':          'Previous month',
  'ms.next_aria':          'Next month',
  'ms.all_history':        'All history',
  'ms.this_month':         'This month',
  'ms.all_btn':            'All',
  'ms.all_btn_active':     'Showing all',

  // ── MonthlySummary ────────────────────────────────────────────────
  'summary.revenues':      'Income',
  'summary.expenses':      'Expenses',
  'summary.savings':       'Savings',
  'summary.rate':          'Rate: {value}',
  'summary.this_month':    'This month',
  'summary.fallback':      'Showing {shown} — {current} has no transactions yet.',

  // ── ExpenseBreakdown ──────────────────────────────────────────────
  'breakdown.title':       'Where your money goes',
  'breakdown.amount_this_month': '{amount} this month',
  'breakdown.amount_in_month':   '{amount} in {month}',
  'breakdown.empty_title':       'No expenses yet this month',
  'breakdown.empty_subtitle':    'Log your transactions and see where your money is going.',
  'breakdown.empty_cta':         'Go to Transactions',
  'breakdown.bar_title':         '{pct}% of expenses',
  'breakdown.see_all':           'See all transactions',

  // ── Landing navigation ─────────────────────────────────────────────
  'landing.nav.how_it_works': 'How it works',
  'landing.nav.features':     'Features',
  'landing.nav.pricing':      'Pricing',
  'landing.nav.faq':          'FAQ',
  'landing.nav.sign_in':      'Sign in',
  'landing.nav.cta':          'Get started free',

  // ── Landing hero ──────────────────────────────────────────────────
  'landing.hero.badge':          'Early Access · Free forever',
  'landing.hero.title_l1_a':     'Save more,',
  'landing.hero.title_l1_emph':  'without the pain',
  'landing.hero.title_l1_b':     '.',
  'landing.hero.title_l2_a':     'Finance in',
  'landing.hero.title_l2_emph':  'RPG mode',
  'landing.hero.title_l2_b':     '.',
  'landing.hero.sub_a':          'Financial score, weekly missions, photo receipts and a mascot that evolves with you across',
  'landing.hero.sub_evo':        '6 stages',
  'landing.hero.sub_b':          '. The Academy gives you a',
  'landing.hero.sub_cert':       'digital certificate',
  'landing.hero.sub_new':        'NEW',
  'landing.hero.sub_c':          'for every course you finish.',
  'landing.hero.cta_primary':    'Create free account',
  'landing.hero.cta_secondary':  'See Premium · €3.33/mo',
  'landing.hero.annual_title':   'Annual €39.99 ≈',
  'landing.hero.annual_month':   '€3.33/mo',
  'landing.hero.annual_savings': '· save €20/yr',
  'landing.hero.annual_compare': 'Compared to monthly at €4.99',
  'landing.hero.trust_reviews':  '· 1,200+ early users',
  'landing.hero.trust_country':  '🇵🇹 Built in Portugal',
  'landing.hero.trust_gdpr':     'GDPR · encrypted data',
  'landing.hero.no_card':        'No credit card · Cancel anytime · No bank-login required',
  'landing.hero.voltix_alt':     'Voltix — mascot at evolution 4',
  'landing.hero.evo_alt':        'Voltix evolution {n}',
  'landing.hero.evo_rail_label': '6 evolutions as your financial life levels up',
  'landing.hero.card_score':     'Score',
  'landing.hero.card_level':     'Level',
  'landing.hero.card_streak':    'Streak',
  'landing.hero.card_streak_val':'23d',
  'landing.hero.card_says':      'Voltix says',
  'landing.hero.card_dialogue':  'Nice! You saved €180 this month. 2 more missions and you hit evolution 5.',
  'landing.hero.card_xp_label':  'XP · Level 7',
  'landing.hero.card_xp_val':    '1,240 / 1,500',
  'landing.hero.card_m1':        'Log 15 transactions',
  'landing.hero.card_m2':        'Stay under €200 on dining out',
  'landing.hero.card_m3':        'Save €100 this month',

  // ── Landing pricing ───────────────────────────────────────────────
  'pricing.eyebrow':       'Pricing',
  'pricing.title_a':       'Start free. Unlock everything for',
  'pricing.title_price':   '€3.33/mo',
  'pricing.title_b':       '.',
  'pricing.subtitle':      'No pricing traps. No fine print. One paid plan — everything included.',
  'pricing.toggle_aria':   'Choose billing period',
  'pricing.toggle_monthly':'Monthly',
  'pricing.toggle_yearly': 'Annual',
  'pricing.free_title':    'Free',
  'pricing.free_duration': 'Forever',
  'pricing.free_f1':       'Unlimited transactions',
  'pricing.free_f2':       'Financial score + history',
  'pricing.free_f3':       'Pick your mascot — Voltix or Penny (6 evolutions)',
  'pricing.free_f4':       'XP, levels and free-plan missions',
  'pricing.free_f5':       '2 savings goals',
  'pricing.free_f6':       'Starter Academy courses',
  'pricing.free_ads':      'Shows discreet, non-intrusive ads.',
  'pricing.free_cta':      'Start free',
  'pricing.premium_badge': 'EVERYTHING INCLUDED',
  'pricing.premium_title': 'Premium',
  'pricing.premium_month_price_y': '€3.33',
  'pricing.premium_month_price_m': '€4.99',
  'pricing.premium_billed_y':      'Billed €39.99/yr · save €20/yr',
  'pricing.premium_billed_m':      'Billed €4.99/mo · cancel anytime',
  'pricing.premium_savings_chip':  'Save 33% vs monthly',
  'pricing.premium_f1':    'Everything in Free, ad-free',
  'pricing.premium_f2':    'AI receipt scanner',
  'pricing.premium_f3':    'Statement import (PDF / CSV)',
  'pricing.premium_f4':    'Investment simulator (DCA)',
  'pricing.premium_f5':    'Wealth Perspective · hours of work',
  'pricing.premium_f6':    'Financial PDF report',
  'pricing.premium_f7':    'Full Academy · every course',
  'pricing.premium_f8':    'Unlimited categories and goals',
  'pricing.premium_f9':    'Exclusive missions and badges',
  'pricing.premium_f10':   'Digital certificate for every Academy course you finish',
  'pricing.premium_f11':   'Priority support · early access',
  'pricing.premium_cta_y': 'Get annual · €3.33/mo',
  'pricing.premium_cta_m': 'Try monthly · €4.99',
  'pricing.premium_footer':'Cancel anytime · VAT included',
  'pricing.footer_note':   'Prices in EUR · Secure payment via Stripe · GDPR',

  // ── Landing final CTA ─────────────────────────────────────────────
  'landing.cta.title_a':   'Your mascot is',
  'landing.cta.title_emph':'waiting for you',
  'landing.cta.subtitle':  'Join the 1,200+ early-access users rewriting their relationship with money — no spreadsheets, no guilt, no apps asking for your bank login.',
  'landing.cta.button':    'Create free account',
  'landing.cta.footer':    'Under 30 seconds · No credit card · Cancel anytime',

  // ── Settings ──────────────────────────────────────────────────────
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

  // ── Mascot ────────────────────────────────────────────────────────
  'mascot.voltix_desc': 'Blue thunder dragon',
  'mascot.penny_desc':  'Cream angel cat',

  // ── Reset ─────────────────────────────────────────────────────────
  'reset.button':       'Delete all transactions',
  'reset.success':      'Account reset to initial state.',
}

export type TranslationKey = keyof typeof pt

export const TABLES: Record<Locale, Partial<Record<TranslationKey, string>>> = {
  pt,
  en,
}

/**
 * Pure translation helper — works on both server and client. The locale
 * resolver is caller-provided so this file stays framework-agnostic (client
 * side uses the React context; server side passes the cookie-resolved locale).
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const raw = TABLES[locale]?.[key] ?? TABLES.pt[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  )
}
