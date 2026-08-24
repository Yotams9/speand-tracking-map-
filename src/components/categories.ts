import type { CategoryId } from '@/data/types'
import type { StringKey } from '@/i18n/strings'

/** Category presentation, kept in one place so map, chips and lists agree. */
export const CATEGORY_ORDER: CategoryId[] = [
  'groceries', 'food', 'shopping', 'fuel', 'pharmacy', 'other',
]

export const categoryColor = (c: CategoryId): string => `var(--cat-${c})`

export const categoryLabelKey = (c: CategoryId | 'all'): StringKey =>
  `cat.${c}` as StringKey
