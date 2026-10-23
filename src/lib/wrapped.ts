/**
 * Wrapped-lite ("O teu ano na XP Money") — janela e contrato partilhados
 * entre a API (/api/wrapped), a página (/wrapped), o cartão do dashboard e
 * as entradas de navegação.
 *
 * Calendário em Europe/Lisbon (não no fuso do servidor, que é UTC, nem no do
 * dispositivo): o Wrapped abre a 1 de dezembro e fecha a 31; o cartão do
 * dashboard só aparece de 1 a 15.
 *
 * Sem imports de runtime: corre igual no servidor e no cliente.
 * Regra de conteúdo: o Wrapped NUNCA mostra euros — só contagens, dias,
 * percentagens de movimentos e o score (0-100).
 */

export const WRAPPED_MONTH = 12
/** Último dia (inclusive) em que o cartão do dashboard aparece. */
export const WRAPPED_CARD_LAST_DAY = 15
/** Abaixo disto o Wrapped é a versão curta (sem inventar o que não há). */
export const WRAPPED_SHORT_MIN_ACTIVE_DAYS = 7

const lisbonParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Lisbon',
  year: 'numeric', month: '2-digit', day: '2-digit',
})

export interface LisbonDate { year: number; month: number; day: number }

export function lisbonToday(now: Date = new Date()): LisbonDate {
  const parts = lisbonParts.formatToParts(now)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? NaN)
  return { year: get('year'), month: get('month'), day: get('day') }
}

export function isWrappedOpen(now: Date = new Date()): boolean {
  return lisbonToday(now).month === WRAPPED_MONTH
}

export function isWrappedCardWindow(now: Date = new Date()): boolean {
  const d = lisbonToday(now)
  return d.month === WRAPPED_MONTH && d.day <= WRAPPED_CARD_LAST_DAY
}

/** O ano que o Wrapped resume (o ano civil corrente em Lisboa). */
export function wrappedYear(now: Date = new Date()): number {
  return lisbonToday(now).year
}

/**
 * Limites do ano em ISO. Lisboa está em UTC+0 em janeiro (hora de inverno),
 * por isso a meia-noite local de 1/1 coincide com 00:00Z.
 */
export function yearBounds(year: number): { startIso: string; endIso: string; startDate: string; endDate: string } {
  return {
    startIso:  `${year}-01-01T00:00:00Z`,
    endIso:    `${year + 1}-01-01T00:00:00Z`,
    startDate: `${year}-01-01`,
    endDate:   `${year}-12-31`,
  }
}

/** localStorage: o user já abriu o Wrapped deste ano (o cartão some). */
export function wrappedSeenKey(year: number): string {
  return `xpmoney:wrapped_seen:${year}`
}
/** localStorage: o user dispensou o cartão do dashboard deste ano. */
export function wrappedCardDismissKey(year: number): string {
  return `xpmoney:wrapped_card_dismissed:${year}`
}

export interface WrappedTopCategory {
  name:   string
  icon:   string | null
  /** Percentagem (0-100, inteira) dos MOVIMENTOS de despesa do ano. */
  share:  number
  count:  number
}

export interface WrappedScore {
  /** Mês ('YYYY-MM') do primeiro score do ano. */
  fromMonth: string
  from:      number
  to:        number
}

export interface WrappedStats {
  activeDays:        number
  transactions:      number
  longestStreak:     number
  evolutions:        number
  badges:            number
  missions:          number
  xp:                number
  topCategory:       WrappedTopCategory | null
  score:             WrappedScore | null
  mascotGender:      'voltix' | 'penny' | null
  evolutionLevel:    number
  /** 'short' = poucos dados → versão curta e honesta. */
  depth:             'full' | 'short'
  /** Alguma contagem bateu num teto de leitura (números são "pelo menos"). */
  truncated:         boolean
}

export type WrappedResponse =
  | { open: false; preview: false; year: number }
  | { open: true;  preview: boolean; year: number; stats: WrappedStats }
