import type { Account, AccountType } from '@/types'
import { toNumber } from '@/lib/safeNumber'
import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * Net-worth math + account-type metadata. The app is flow-based (it tracks
 * transactions, not balances), so `accounts.balance` is a user-set manual
 * figure — this turns it into an honest net-worth SNAPSHOT (assets minus
 * liabilities), not a reconciled real-time balance.
 *
 * `credit` is the only liability type: its balance represents money OWED,
 * so it subtracts from net worth.
 */

export const ACCOUNT_TYPE_META: Record<AccountType, {
  labelKey:    TranslationKey
  icon:        string
  isLiability: boolean
}> = {
  checking:   { labelKey: 'account.type_checking',   icon: '🏦', isLiability: false },
  savings:    { labelKey: 'account.type_savings',    icon: '🐷', isLiability: false },
  wallet:     { labelKey: 'account.type_wallet',     icon: '👛', isLiability: false },
  investment: { labelKey: 'account.type_investment', icon: '📈', isLiability: false },
  credit:     { labelKey: 'account.type_credit',     icon: '💳', isLiability: true  },
}

export const ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'wallet', 'investment', 'credit']

export function isLiability(type: AccountType): boolean {
  return ACCOUNT_TYPE_META[type]?.isLiability ?? false
}

export interface NetWorth {
  assets:      number
  liabilities: number
  net:         number
}

export function computeNetWorth(accounts: Account[]): NetWorth {
  let assets = 0
  let liabilities = 0
  for (const a of accounts) {
    const bal = toNumber(a.balance)
    if (isLiability(a.type)) liabilities += bal
    else                     assets += bal
  }
  return {
    assets:      Math.round(assets * 100) / 100,
    liabilities: Math.round(liabilities * 100) / 100,
    net:         Math.round((assets - liabilities) * 100) / 100,
  }
}
