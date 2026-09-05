import {
  localized,
  merchantForId,
  type CategoryFilter,
  type ChannelFilter,
  type CurrencyFilter,
  type DateRangeFilter,
  type GlobePurchase,
  type LocaleCode,
  type Merchant,
  type Place,
} from '../../data/spendscape-globe'

export type AnalyticsView = 'overview' | 'timeline' | 'channels' | 'categories' | 'places' | 'currencies'
export type AskRegion = { kind: 'city' | 'country'; value: string }
export type AskFilterPatch = {
  search?: string
  category?: CategoryFilter
  currency?: CurrencyFilter
  channel?: ChannelFilter
  dateRange?: DateRangeFilter
}

export type AskAction =
  | { type: 'map.flyToPlace'; placeId: string }
  | { type: 'map.flyToRegion'; region: AskRegion }
  | { type: 'map.fitVisiblePurchases' }
  | { type: 'map.resetGlobe' }
  | { type: 'filters.set'; patch: AskFilterPatch }
  | { type: 'filters.clear' }
  | { type: 'timeline.setMonth'; month: string | null }
  | { type: 'purchases.open' }
  | { type: 'selection.openPurchase'; purchaseId: string }
  | { type: 'analytics.open'; view: AnalyticsView }

export interface AskCandidate {
  id: string
  label: string
  detail: string
  action: AskAction
}

export type AskParseResult =
  | { kind: 'empty' }
  | { kind: 'single'; action: AskAction; summary: string }
  | { kind: 'plan'; actions: AskAction[]; summary: string }
  | { kind: 'ambiguous'; summary: string; candidates: AskCandidate[] }
  | { kind: 'invalid'; summary: string }
  | { kind: 'unsupported'; summary: string }

export interface AskContext {
  merchants: readonly Merchant[]
  places: readonly Place[]
  purchases: readonly GlobePurchase[]
  timelineMonths: readonly string[]
}

const currencyCodes = ['ILS', 'EUR', 'GBP', 'USD', 'JPY', 'AUD', 'MXN', 'ZAR'] as const
const analyticsViews: AnalyticsView[] = ['overview', 'timeline', 'channels', 'categories', 'places', 'currencies']
const categoryFilters: CategoryFilter[] = ['all', 'groceries', 'food', 'retail', 'travel']
const currencyFilters: CurrencyFilter[] = ['all', ...currencyCodes]
const channelFilters: ChannelFilter[] = ['all', 'physical', 'online', 'cash-manual', 'unresolved']
const dateRangeFilters: DateRangeFilter[] = ['all', '30d', '90d', 'year']
const analyticsViewLabelsHe: Record<AnalyticsView, string> = {
  overview: 'סקירה',
  timeline: 'ציר זמן',
  channels: 'ערוצים',
  categories: 'קטגוריות',
  places: 'מקומות',
  currencies: 'מטבעות',
}

const unsupportedPatterns = [
  /\b(delete|remove|erase|edit|change|rewrite|correct|resolve|approve|decline)\b/i,
  /\b(upload|scan|camera|photo|receipt|gmail|email|ocr|barcode)\b/i,
  /\b(share|privacy|permission|connect|account|login|provider|api|backend|database)\b/i,
  /\b(replay|life replay|send|pay|refund|purchase for me)\b/i,
  /(מחק|מחיקה|ערוך|שנה|תקן|פתור|אשר|דחה|העלה|סרוק|מצלמה|קבלה|שיתוף|פרטיות|חבר חשבון|שלח|שלם)/,
]

const normalize = (value: string) => value
  .normalize('NFKD')
  .toLocaleLowerCase('en-US')
  .replace(/[\u0591-\u05c7]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

const matches = (input: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(input))

function localizedPair(value: { en: string; he: string }, locale: LocaleCode): string {
  return localized(value, locale)
}

function summary(locale: LocaleCode, en: string, he: string): string {
  return locale === 'he' ? he : en
}

function regionMatches(target: string, places: readonly Place[], kind: AskRegion['kind']) {
  const key = kind === 'city' ? 'city' : 'country'
  const normalizedTarget = normalize(target)
  const unique = new Map<string, { value: string; label: string; placeIds: string[] }>()
  for (const place of places) {
    const value = place[key].en
    const identity = normalize(value)
    const aliases = [normalize(place[key].en), normalize(place[key].he)]
    if (!aliases.some((alias) => alias === normalizedTarget || alias.includes(normalizedTarget))) continue
    const current = unique.get(identity) ?? { value, label: place[key].en, placeIds: [] }
    current.placeIds.push(place.id)
    unique.set(identity, current)
  }
  return [...unique.values()]
}

function placeMatches(target: string, places: readonly Place[]) {
  const normalizedTarget = normalize(target)
  return places.filter((place) => {
    const labels = [
      place.id,
      place.name.en,
      place.name.he,
      `${place.name.en} ${place.branch.en}`,
      `${place.name.he} ${place.branch.he}`,
      place.branch.en,
      place.branch.he,
    ].map(normalize)
    return labels.some((label) => label === normalizedTarget || label.includes(normalizedTarget))
  })
}

function regionResult(target: string, locale: LocaleCode, context: AskContext): AskParseResult | null {
  for (const kind of ['city', 'country'] as const) {
    const regions = regionMatches(target, context.places, kind)
    if (regions.length === 1) {
      const region = regions[0]
      return {
        kind: 'single',
        action: { type: 'map.flyToRegion', region: { kind, value: region.value } },
        summary: summary(locale, `Fly to ${region.label}`, `טיסה אל ${localizedPair(context.places.find((place) => place[kind].en === region.value)![kind], 'he')}`),
      }
    }
  }
  return null
}

function flyResult(target: string, locale: LocaleCode, context: AskContext): AskParseResult {
  const exactRegion = regionResult(target, locale, context)
  if (exactRegion) return exactRegion

  const places = placeMatches(target, context.places).slice(0, 4)
  if (places.length === 1) {
    const place = places[0]
    return {
      kind: 'single',
      action: { type: 'map.flyToPlace', placeId: place.id },
      summary: summary(locale, `Fly to ${place.name.en} · ${place.branch.en}`, `טיסה אל ${place.name.he} · ${place.branch.he}`),
    }
  }
  if (places.length > 1) {
    return {
      kind: 'ambiguous',
      summary: summary(locale, 'Choose the physical place you meant.', 'יש לבחור את המקום הפיזי שאליו התכוונת.'),
      candidates: places.map((place) => ({
        id: place.id,
        label: localizedPair(place.name, locale),
        detail: `${localizedPair(place.branch, locale)} · ${localizedPair(place.city, locale)}`,
        action: { type: 'map.flyToPlace', placeId: place.id },
      })),
    }
  }
  return {
    kind: 'invalid',
    summary: summary(locale, 'That place or region is not in the synthetic fixture graph.', 'המקום או האזור אינם קיימים בגרף הנתונים הסינתטי.'),
  }
}

function filterResult(input: string, locale: LocaleCode): AskParseResult | null {
  const normalized = normalize(input)
  const categoryAliases: Array<[CategoryFilter, string[]]> = [
    ['groceries', ['groceries', 'grocery', 'מכולת', 'סופר']],
    ['food', ['food', 'restaurants', 'cafes', 'אוכל', 'מסעדות', 'בתי קפה']],
    ['retail', ['retail', 'shopping', 'קניות', 'קמעונאות']],
    ['travel', ['travel', 'נסיעות', 'תיירות']],
  ]
  for (const [category, aliases] of categoryAliases) {
    if (aliases.some((alias) => normalized.includes(normalize(alias)))) {
      return { kind: 'single', action: { type: 'filters.set', patch: { category } }, summary: summary(locale, `Filter to ${category}`, `סינון לקטגוריית ${aliases.at(-1)}`) }
    }
  }

  const channelAliases: Array<[ChannelFilter, string[]]> = [
    ['physical', ['physical', 'in store', 'פיזי', 'בחנות']],
    ['online', ['online', 'אונליין', 'מקוון']],
    ['cash-manual', ['cash', 'manual', 'מזומן', 'ידני']],
    ['unresolved', ['unresolved', 'uncertain', 'לא פתור', 'לא ודאי']],
  ]
  for (const [channel, aliases] of channelAliases) {
    if (aliases.some((alias) => normalized.includes(normalize(alias)))) {
      return { kind: 'single', action: { type: 'filters.set', patch: { channel } }, summary: summary(locale, `Filter to ${channel}`, `סינון לערוץ ${aliases.at(-1)}`) }
    }
  }

  const currency = currencyCodes.find((code) => new RegExp(`\\b${code}\\b`, 'i').test(input))
  if (currency) {
    return { kind: 'single', action: { type: 'filters.set', patch: { currency } }, summary: summary(locale, `Filter to ${currency}`, `סינון למטבע ${currency}`) }
  }

  const dateRange: DateRangeFilter | null = /\b30\s*days?\b|30\s*יום/i.test(input)
    ? '30d'
    : /\b90\s*days?\b|90\s*יום/i.test(input)
      ? '90d'
      : /\b(year|this year)\b|שנה/i.test(input)
        ? 'year'
        : null
  if (dateRange) {
    return { kind: 'single', action: { type: 'filters.set', patch: { dateRange } }, summary: summary(locale, `Set date range to ${dateRange}`, `הגדרת טווח תאריכים ${dateRange}`) }
  }
  return null
}

function analyticsResult(input: string, locale: LocaleCode): AskParseResult | null {
  const normalized = normalize(input)
  if (!/(analytics|stats|analysis|ניתוח|נתונים)/i.test(normalized)) return null
  const aliases: Array<[AnalyticsView, string[]]> = [
    ['timeline', ['timeline', 'time', 'זמן', 'ציר זמן']],
    ['channels', ['channels', 'channel', 'ערוצים', 'ערוץ']],
    ['categories', ['categories', 'category', 'קטגוריות', 'קטגוריה']],
    ['places', ['places', 'place', 'מקומות', 'מקום']],
    ['currencies', ['currencies', 'currency', 'מטבעות', 'מטבע']],
    ['overview', ['overview', 'summary', 'סקירה', 'סיכום']],
  ]
  const view = aliases.find(([, values]) => values.some((value) => normalized.includes(normalize(value))))?.[0] ?? 'overview'
  return { kind: 'single', action: { type: 'analytics.open', view }, summary: summary(locale, `Open analytics · ${view}`, `פתיחת ניתוחים · ${analyticsViewLabelsHe[view]}`) }
}

export function parseAskCommand(rawInput: string, locale: LocaleCode, context: AskContext): AskParseResult {
  const input = rawInput.trim()
  if (!input) return { kind: 'empty' }

  if (unsupportedPatterns.some((pattern) => pattern.test(input))) {
    return {
      kind: 'unsupported',
      summary: summary(locale, 'This local demo cannot change facts, capture data, connect services, share, or perform destructive actions.', 'ההדגמה המקומית אינה יכולה לשנות עובדות, לקלוט נתונים, לחבר שירותים, לשתף או לבצע פעולות הרסניות.'),
    }
  }

  if (matches(input, [/^(clear|reset) (all )?(filters|search)$/i, /^(נקה|אפס) (את )?(כל )?(המסננים|החיפוש)$/])) {
    return { kind: 'single', action: { type: 'filters.clear' }, summary: summary(locale, 'Clear shared filters', 'ניקוי המסננים המשותפים') }
  }
  if (matches(input, [/^(reset|show) (the )?globe$/i, /^(אפס|הצג) (את )?הגלובוס$/])) {
    return { kind: 'single', action: { type: 'map.resetGlobe' }, summary: summary(locale, 'Reset the globe', 'איפוס הגלובוס') }
  }
  if (matches(input, [/^(fit|show) (all )?(visible )?purchases$/i, /^(התאם|הצג) (את )?(כל )?הרכישות( הגלויות)?$/])) {
    return { kind: 'single', action: { type: 'map.fitVisiblePurchases' }, summary: summary(locale, 'Fit visible physical purchases', 'התאמת המפה לרכישות הפיזיות הגלויות') }
  }
  if (matches(input, [/^(open|show) (my )?purchases$/i, /^(פתח|הצג) (את )?הרכישות( שלי)?$/])) {
    return { kind: 'single', action: { type: 'purchases.open' }, summary: summary(locale, 'Open purchases', 'פתיחת הרכישות') }
  }

  const analytics = analyticsResult(input, locale)
  if (analytics) return analytics

  const latestPurchase = matches(input, [/^(open|show) (my )?latest purchase$/i, /^(פתח|הצג) (את )?הרכישה האחרונה( שלי)?$/])
    ? [...context.purchases].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
    : undefined
  if (latestPurchase) {
    const merchant = merchantForId(latestPurchase.merchantId, context.merchants)
    return {
      kind: 'single',
      action: { type: 'selection.openPurchase', purchaseId: latestPurchase.id },
      summary: summary(locale, `Open latest purchase · ${merchant?.name.en ?? latestPurchase.id}`, `פתיחת הרכישה האחרונה · ${merchant?.name.he ?? latestPurchase.id}`),
    }
  }

  const purchaseIdMatch = input.match(/(?:open|show|פתח|הצג)\s+(?:purchase|רכישה)\s+([\w-]+)/i)
  if (purchaseIdMatch) {
    const purchase = context.purchases.find((candidate) => candidate.id === purchaseIdMatch[1])
    if (!purchase) return { kind: 'invalid', summary: summary(locale, 'That purchase ID is not in the synthetic fixture graph.', 'מזהה הרכישה אינו קיים בגרף הנתונים הסינתטי.') }
    return { kind: 'single', action: { type: 'selection.openPurchase', purchaseId: purchase.id }, summary: summary(locale, `Open purchase ${purchase.id}`, `פתיחת רכישה ${purchase.id}`) }
  }

  const monthMatch = input.match(/(?:month|timeline|חודש|ציר זמן)\s+(\d{4}-\d{2}|all|הכל)/i)
  if (monthMatch) {
    const month = /^(all|הכל)$/i.test(monthMatch[1]) ? null : monthMatch[1]
    if (month && !context.timelineMonths.includes(month)) {
      return { kind: 'invalid', summary: summary(locale, 'That month is outside the synthetic fixture timeline.', 'החודש אינו קיים בציר הזמן הסינתטי.') }
    }
    return { kind: 'single', action: { type: 'timeline.setMonth', month }, summary: month ? summary(locale, `Set timeline to ${month}`, `הגדרת ציר הזמן ל־${month}`) : summary(locale, 'Show all months', 'הצגת כל החודשים') }
  }

  const regionPlanMatch = input.match(/(?:show|find)\s+(?:my\s+)?purchases\s+(?:in|at)\s+(.+)/i)
    ?? input.match(/(?:הצג|מצא)\s+(?:את\s+)?(?:הרכישות|רכישות)(?:\s+שלי)?\s+ב(?:תוך\s+)?(.+)/)
  if (regionPlanMatch) {
    const target = regionPlanMatch[1].trim()
    const region = regionResult(target, locale, context)
    if (region?.kind === 'single' && region.action.type === 'map.flyToRegion') {
      const flyRegionAction = region.action
      const display = locale === 'he'
        ? localizedPair(context.places.find((place) => place[flyRegionAction.region.kind].en === flyRegionAction.region.value)![flyRegionAction.region.kind], 'he')
        : flyRegionAction.region.value
      return {
        kind: 'plan',
        actions: [
          { type: 'filters.set', patch: { search: display } },
          flyRegionAction,
        ],
        summary: summary(locale, `Filter purchases and frame ${display}`, `סינון רכישות והתמקדות ב־${display}`),
      }
    }
    return { kind: 'invalid', summary: summary(locale, 'That city or country is not in the synthetic fixture graph.', 'העיר או המדינה אינן קיימות בגרף הנתונים הסינתטי.') }
  }

  const flyMatch = input.match(/^(?:fly|go|jump|טוס|עבור|קפוץ)\s+(?:to|אל|ל)?\s*(.+)$/i)
  if (flyMatch) return flyResult(flyMatch[1], locale, context)

  const explicitSearch = input.match(/^(?:search|find|חפש|מצא)\s+(.+)$/i)
  if (explicitSearch) {
    return { kind: 'single', action: { type: 'filters.set', patch: { search: explicitSearch[1].trim() } }, summary: summary(locale, `Search for ${explicitSearch[1].trim()}`, `חיפוש ${explicitSearch[1].trim()}`) }
  }

  const filter = filterResult(input, locale)
  if (filter) return filter

  return {
    kind: 'unsupported',
    summary: summary(locale, 'I could not map that request to a safe local demo action. Try one of the suggestions.', 'לא ניתן למפות את הבקשה לפעולת הדגמה מקומית ובטוחה. אפשר לנסות אחת מההצעות.'),
  }
}

export function describeAskAction(
  action: AskAction,
  locale: LocaleCode,
  context: AskContext,
): string {
  const isHebrew = locale === 'he'
  switch (action.type) {
    case 'map.flyToPlace': {
      const place = context.places.find((candidate) => candidate.id === action.placeId)
      return place
        ? (isHebrew ? `טיסה אל ${place.name.he} · ${place.branch.he}` : `Fly to ${place.name.en} · ${place.branch.en}`)
        : action.placeId
    }
    case 'map.flyToRegion': {
      const place = context.places.find(
        (candidate) => candidate[action.region.kind].en === action.region.value,
      )
      const regionLabel = place ? localizedPair(place[action.region.kind], locale) : action.region.value
      return isHebrew ? `התמקדות באזור ${regionLabel}` : `Frame ${regionLabel}`
    }
    case 'map.fitVisiblePurchases': return isHebrew ? 'התאמת המפה לרכישות הגלויות' : 'Fit visible purchases'
    case 'map.resetGlobe': return isHebrew ? 'איפוס הגלובוס' : 'Reset globe'
    case 'filters.set': return isHebrew ? 'עדכון המסננים המשותפים' : 'Update shared filters'
    case 'filters.clear': return isHebrew ? 'ניקוי המסננים' : 'Clear filters'
    case 'timeline.setMonth': return isHebrew ? `הגדרת חודש ${action.month ?? 'הכל'}` : `Set month ${action.month ?? 'all'}`
    case 'purchases.open': return isHebrew ? 'פתיחת הרכישות' : 'Open purchases'
    case 'selection.openPurchase': return isHebrew ? 'פתיחת הרכישה האחרונה' : 'Open latest purchase'
    case 'analytics.open': return isHebrew ? `פתיחת ניתוחים · ${analyticsViewLabelsHe[action.view]}` : `Open analytics · ${action.view}`
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return (prototype === Object.prototype || prototype === null)
    && Reflect.ownKeys(value).every((key) => 'value' in Object.getOwnPropertyDescriptor(value, key)!)
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(record)
  return keys.length === expected.length
    && keys.every((key) => typeof key === 'string' && expected.includes(key))
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Reflect.ownKeys(record)
  return keys.length > 0
    && keys.every((key) => typeof key === 'string' && allowed.includes(key))
}

export function isAllowedAskAction(value: unknown, context: AskContext): value is AskAction {
  try {
    if (!isPlainRecord(value) || typeof value.type !== 'string') return false

    switch (value.type) {
      case 'map.flyToPlace':
        return hasExactKeys(value, ['type', 'placeId'])
          && typeof value.placeId === 'string'
          && context.places.some((place) => place.id === value.placeId)
      case 'map.flyToRegion': {
        if (!hasExactKeys(value, ['type', 'region']) || !isPlainRecord(value.region)) return false
        if (!hasExactKeys(value.region, ['kind', 'value'])) return false
        const kind = value.region.kind
        const regionValue = value.region.value
        if ((kind !== 'city' && kind !== 'country') || typeof regionValue !== 'string') return false
        return context.places.some((place) => place[kind].en === regionValue)
      }
      case 'map.fitVisiblePurchases':
      case 'map.resetGlobe':
      case 'filters.clear':
      case 'purchases.open':
        return hasExactKeys(value, ['type'])
      case 'filters.set': {
        if (!hasExactKeys(value, ['type', 'patch']) || !isPlainRecord(value.patch)) return false
        const patch = value.patch
        if (!hasOnlyKeys(patch, ['search', 'category', 'currency', 'channel', 'dateRange'])) return false
        if ('search' in patch && typeof patch.search !== 'string') return false
        if ('category' in patch && !categoryFilters.includes(patch.category as CategoryFilter)) return false
        if ('currency' in patch && !currencyFilters.includes(patch.currency as CurrencyFilter)) return false
        if ('channel' in patch && !channelFilters.includes(patch.channel as ChannelFilter)) return false
        if ('dateRange' in patch && !dateRangeFilters.includes(patch.dateRange as DateRangeFilter)) return false
        return true
      }
      case 'timeline.setMonth':
        return hasExactKeys(value, ['type', 'month'])
          && (value.month === null || (typeof value.month === 'string' && context.timelineMonths.includes(value.month)))
      case 'selection.openPurchase':
        return hasExactKeys(value, ['type', 'purchaseId'])
          && typeof value.purchaseId === 'string'
          && context.purchases.some((purchase) => purchase.id === value.purchaseId)
      case 'analytics.open':
        return hasExactKeys(value, ['type', 'view'])
          && typeof value.view === 'string'
          && analyticsViewIsValid(value.view)
      default:
        return false
    }
  } catch {
    return false
  }
}

export function isAllowedAskActionPlan(value: unknown, context: AskContext): value is AskAction[] {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length === 0) return false
    if (Reflect.ownKeys(value).length !== value.length + 1) return false
    for (let index = 0; index < value.length; index += 1) {
      const entry = Object.getOwnPropertyDescriptor(value, String(index))
      if (!entry || !('value' in entry) || !isAllowedAskAction(entry.value, context)) return false
    }
    return true
  } catch {
    return false
  }
}

export function analyticsViewIsValid(value: string): value is AnalyticsView {
  return analyticsViews.includes(value as AnalyticsView)
}
