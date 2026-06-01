import type { TranslationKey } from '@/lib/i18n/translations'

/**
 * Mission title/description i18n.
 *
 * Missions are created from MISSION_TEMPLATES (src/lib/gamification.ts) with
 * their PT title + description copied into the `missions` row at creation time.
 * Those frozen strings are what the DB returns — so for EN users they'd render
 * in Portuguese. We resolve them back to translation keys at RENDER time, keyed
 * on the template's stable identity `${type}_${target_value}` (the only field
 * combo that uniquely identifies a template — `keep_daily_streak` appears twice
 * with targets 7 and 30).
 *
 * Same shape as debtCategoryLabel.ts: a Record<id, TranslationKey> resolved with
 * t() in render, with a fallback to the raw DB string for any unknown combo
 * (e.g. a future template not yet mapped, or a user on an old mission row). The
 * fallback guarantees we never show a blank — at worst it's the original PT.
 */

type TFn = (key: TranslationKey, args?: Record<string, string | number>) => string

const MISSION_TITLE_KEY: Record<string, TranslationKey> = {
  register_transactions_5:   'missions.tpl.register_transactions_5.title',
  keep_daily_streak_7:       'missions.tpl.keep_daily_streak_7.title',
  improve_score_5:           'missions.tpl.improve_score_5.title',
  categorize_all_1:          'missions.tpl.categorize_all_1.title',
  reach_savings_goal_10:     'missions.tpl.reach_savings_goal_10.title',
  keep_daily_streak_30:      'missions.tpl.keep_daily_streak_30.title',
  reduce_category_spend_20:  'missions.tpl.reduce_category_spend_20.title',
}

const MISSION_DESC_KEY: Record<string, TranslationKey> = {
  register_transactions_5:   'missions.tpl.register_transactions_5.desc',
  keep_daily_streak_7:       'missions.tpl.keep_daily_streak_7.desc',
  improve_score_5:           'missions.tpl.improve_score_5.desc',
  categorize_all_1:          'missions.tpl.categorize_all_1.desc',
  reach_savings_goal_10:     'missions.tpl.reach_savings_goal_10.desc',
  keep_daily_streak_30:      'missions.tpl.keep_daily_streak_30.desc',
  reduce_category_spend_20:  'missions.tpl.reduce_category_spend_20.desc',
}

interface MissionLike {
  type:         string
  target_value: number
  title:        string
  description:  string
}

/** Locale-aware mission title — falls back to the raw DB title for unknown combos. */
export function missionTitle(m: MissionLike, t: TFn): string {
  const key = MISSION_TITLE_KEY[`${m.type}_${m.target_value}`]
  return key ? t(key) : m.title
}

/** Locale-aware mission description — falls back to the raw DB description. */
export function missionDescription(m: MissionLike, t: TFn): string {
  const key = MISSION_DESC_KEY[`${m.type}_${m.target_value}`]
  return key ? t(key) : m.description
}
