import type { CurrencyCode, GlobePurchase, LocalizedText, PurchaseCategory, PurchaseChannel } from '../../data/spendscape-globe'

/**
 * Deterministic spending insights over the person's purchases.
 *
 * - Pure functions: same purchases + same clock + same time zone = same answer.
 * - Money is integer minor units (agorot for ILS, whole yen for JPY).
 * - Currencies are never mixed and no exchange rate is ever applied.
 * - Every result names the exact purchase IDs it was computed from, so a later
 *   chat layer can show its sources and never needs to invent a number.
 */

export const DEFAULT_TIME_ZONE = 'Asia/Jerusalem'

export type InsightRange =
  | { kind: 'this-month' }
  | { kind: 'last-month' }
  | { kind: 'last-30-days' }
  | { kind: 'this-year' }
  | { kind: 'all' }
  /** Local calendar dates, both inclusive: 'YYYY-MM-DD'. */
  | { kind: 'custom'; from: string; to: string }

export interface InsightFilters {
  category?: PurchaseCategory
  /** A store is a merchant (for example one supermarket chain across its branches). */
  storeId?: string
  currency?: CurrencyCode
  channel?: PurchaseChannel
}

export interface InsightClock {
  now: Date
  timeZone?: string
}

export interface CurrencyAmount {
  currency: CurrencyCode
  /** Integer minor units: agorot for ILS. */
  minor: number
  purchaseCount: number
}

export interface Sourced {
  /** Exact purchases this result was computed from, oldest first. */
  purchaseIds: string[]
}

export interface SpendTotal extends Sourced {
  totals: CurrencyAmount[]
  purchaseCount: number
}

export interface StoreSpend extends SpendTotal { storeId: string }
export interface CategorySpend extends SpendTotal { category: PurchaseCategory }
export interface MonthSpend extends SpendTotal { month: string }

export interface ResolvedRange {
  /** Inclusive UTC instant. */
  from: Date | null
  /** Exclusive UTC instant. */
  to: Date | null
}

const minorFactor = (currency: CurrencyCode) => currency === 'JPY' ? 1 : 100

export function minorAmount(purchase: Pick<GlobePurchase, 'originalAmount' | 'originalCurrency'>): number {
  return Math.round(purchase.originalAmount * minorFactor(purchase.originalCurrency))
}

export function fromMinor(minor: number, currency: CurrencyCode): number {
  return minor / minorFactor(currency)
}

// ---- Time: local calendar boundaries in one named time zone -------------

function zoneParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute'), second: value('second') }
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zoneParts(instant, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000
}

/** The UTC instant of local midnight on a calendar day (month may overflow, e.g. 13 → next January). */
export function localMidnight(year: number, month: number, day: number, timeZone = DEFAULT_TIME_ZONE): Date {
  const guess = Date.UTC(year, month - 1, day)
  const first = guess - zoneOffsetMs(new Date(guess), timeZone)
  return new Date(guess - zoneOffsetMs(new Date(first), timeZone))
}

/** 'YYYY-MM' of an instant in the given time zone. */
export function localMonth(timestamp: string | Date, timeZone = DEFAULT_TIME_ZONE): string {
  const p = zoneParts(typeof timestamp === 'string' ? new Date(timestamp) : timestamp, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}`
}

export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split('-').map(Number)
  const index = year * 12 + value - 1 + delta
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`
}

function monthBounds(month: string, timeZone: string): ResolvedRange {
  const [year, value] = month.split('-').map(Number)
  return { from: localMidnight(year, value, 1, timeZone), to: localMidnight(year, value + 1, 1, timeZone) }
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function resolveRange(range: InsightRange, clock: InsightClock): ResolvedRange {
  const timeZone = clock.timeZone ?? DEFAULT_TIME_ZONE
  const today = zoneParts(clock.now, timeZone)
  const thisMonth = `${today.year}-${String(today.month).padStart(2, '0')}`
  switch (range.kind) {
    case 'all': return { from: null, to: null }
    case 'this-month': return monthBounds(thisMonth, timeZone)
    case 'last-month': return monthBounds(shiftMonth(thisMonth, -1), timeZone)
    case 'this-year': return { from: localMidnight(today.year, 1, 1, timeZone), to: localMidnight(today.year + 1, 1, 1, timeZone) }
    // Today and the 29 days before it, as whole local days.
    case 'last-30-days': return { from: localMidnight(today.year, today.month, today.day - 29, timeZone), to: localMidnight(today.year, today.month, today.day + 1, timeZone) }
    case 'custom': {
      const from = DATE.exec(range.from), to = DATE.exec(range.to)
      if (!from || !to) throw new RangeError('custom range needs YYYY-MM-DD dates')
      const start = localMidnight(Number(from[1]), Number(from[2]), Number(from[3]), timeZone)
      const end = localMidnight(Number(to[1]), Number(to[2]), Number(to[3]) + 1, timeZone)
      if (end.getTime() <= start.getTime()) throw new RangeError('custom range ends before it starts')
      return { from: start, to: end }
    }
  }
}

// ---- Selection -----------------------------------------------------------

export function selectPurchases(
  purchases: readonly GlobePurchase[],
  range: InsightRange = { kind: 'all' },
  filters: InsightFilters = {},
  clock: InsightClock = { now: new Date() },
): GlobePurchase[] {
  const { from, to } = resolveRange(range, clock)
  return purchases
    .filter((purchase) => {
      const time = Date.parse(purchase.timestamp)
      if (!Number.isFinite(time)) return false
      if (from && time < from.getTime()) return false
      if (to && time >= to.getTime()) return false
      if (filters.category && purchase.category !== filters.category) return false
      if (filters.storeId && purchase.merchantId !== filters.storeId) return false
      if (filters.currency && purchase.originalCurrency !== filters.currency) return false
      if (filters.channel && purchase.channel !== filters.channel) return false
      return true
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id))
}

function summarize(purchases: readonly GlobePurchase[]): SpendTotal {
  const byCurrency = new Map<CurrencyCode, CurrencyAmount>()
  for (const purchase of purchases) {
    const entry = byCurrency.get(purchase.originalCurrency) ?? { currency: purchase.originalCurrency, minor: 0, purchaseCount: 0 }
    entry.minor += minorAmount(purchase)
    entry.purchaseCount += 1
    byCurrency.set(purchase.originalCurrency, entry)
  }
  return { totals: orderedTotals([...byCurrency.values()]), purchaseCount: purchases.length, purchaseIds: purchases.map((purchase) => purchase.id) }
}

// ILS first (the home currency), then the others alphabetically.
function orderedTotals(totals: CurrencyAmount[]): CurrencyAmount[] {
  return totals.sort((a, b) => (a.currency === 'ILS' ? -1 : b.currency === 'ILS' ? 1 : a.currency.localeCompare(b.currency)))
}

/** Minor units in one currency, 0 when absent. */
export function amountIn(total: Pick<SpendTotal, 'totals'>, currency: CurrencyCode = 'ILS'): number {
  return total.totals.find((entry) => entry.currency === currency)?.minor ?? 0
}

// Rank by the home currency first, then purchase count, then a stable key.
// Amounts in other currencies are never converted to compete.
function rank<T extends SpendTotal>(entries: T[], key: (entry: T) => string, currency: CurrencyCode): T[] {
  return entries.sort((a, b) => amountIn(b, currency) - amountIn(a, currency) || b.purchaseCount - a.purchaseCount || key(a).localeCompare(key(b)))
}

function groupBy<K extends string>(purchases: readonly GlobePurchase[], key: (purchase: GlobePurchase) => K): Map<K, GlobePurchase[]> {
  const groups = new Map<K, GlobePurchase[]>()
  for (const purchase of purchases) {
    const value = key(purchase)
    groups.set(value, [...(groups.get(value) ?? []), purchase])
  }
  return groups
}

// ---- Public questions ----------------------------------------------------

export interface InsightQuery {
  range?: InsightRange
  filters?: InsightFilters
  clock?: InsightClock
  /** Currency used to rank stores, categories and purchases. Default ILS. */
  rankCurrency?: CurrencyCode
}

export function totalSpent(purchases: readonly GlobePurchase[], query: InsightQuery = {}): SpendTotal {
  return summarize(selectPurchases(purchases, query.range, query.filters, query.clock))
}

export function spendByStore(purchases: readonly GlobePurchase[], query: InsightQuery = {}): StoreSpend[] {
  const groups = groupBy(selectPurchases(purchases, query.range, query.filters, query.clock), (purchase) => purchase.merchantId)
  return rank([...groups].map(([storeId, group]) => ({ storeId, ...summarize(group) })), (entry) => entry.storeId, query.rankCurrency ?? 'ILS')
}

export function spendByCategory(purchases: readonly GlobePurchase[], query: InsightQuery = {}): CategorySpend[] {
  const groups = groupBy(selectPurchases(purchases, query.range, query.filters, query.clock), (purchase) => purchase.category)
  return rank([...groups].map(([category, group]) => ({ category, ...summarize(group) })), (entry) => entry.category, query.rankCurrency ?? 'ILS')
}

/** Calendar months in the person's time zone, oldest first. */
export function spendByMonth(purchases: readonly GlobePurchase[], query: InsightQuery = {}): MonthSpend[] {
  const timeZone = query.clock?.timeZone ?? DEFAULT_TIME_ZONE
  const groups = groupBy(selectPurchases(purchases, query.range, query.filters, query.clock), (purchase) => localMonth(purchase.timestamp, timeZone))
  return [...groups].map(([month, group]) => ({ month, ...summarize(group) })).sort((a, b) => a.month.localeCompare(b.month))
}

/** The store with the most spend in the ranking currency; null when nothing qualifies. */
export function topStore(purchases: readonly GlobePurchase[], query: InsightQuery & { category?: PurchaseCategory } = {}): StoreSpend | null {
  const filters = query.category ? { ...query.filters, category: query.category } : query.filters
  const currency = query.rankCurrency ?? 'ILS'
  return spendByStore(purchases, { ...query, filters }).find((entry) => amountIn(entry, currency) > 0) ?? null
}

export function topCategory(purchases: readonly GlobePurchase[], query: InsightQuery = {}): CategorySpend | null {
  const currency = query.rankCurrency ?? 'ILS'
  return spendByCategory(purchases, query).find((entry) => amountIn(entry, currency) > 0) ?? null
}

export interface RankedPurchase extends Sourced {
  purchaseId: string
  storeId: string
  timestamp: string
  currency: CurrencyCode
  minor: number
}

/** The n largest purchases in one currency (default ILS), largest first. */
export function biggestPurchases(purchases: readonly GlobePurchase[], n: number, query: InsightQuery = {}): RankedPurchase[] {
  const currency = query.rankCurrency ?? query.filters?.currency ?? 'ILS'
  return selectPurchases(purchases, query.range, { ...query.filters, currency }, query.clock)
    .sort((a, b) => minorAmount(b) - minorAmount(a) || b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, Math.floor(n)))
    .map((purchase) => ({ purchaseId: purchase.id, storeId: purchase.merchantId, timestamp: purchase.timestamp, currency, minor: minorAmount(purchase), purchaseIds: [purchase.id] }))
}

export interface CurrencyChange {
  currency: CurrencyCode
  aMinor: number
  bMinor: number
  /** b − a in minor units. */
  deltaMinor: number
  /** Whole-percent change from a to b; null when a is zero. */
  percent: number | null
}

export interface MonthComparison {
  a: MonthSpend
  b: MonthSpend
  changes: CurrencyChange[]
  purchaseIds: string[]
}

/** Compare two calendar months ('YYYY-MM'), currency by currency. */
export function compareMonths(purchases: readonly GlobePurchase[], a: string, b: string, query: Omit<InsightQuery, 'range'> = {}): MonthComparison {
  const timeZone = query.clock?.timeZone ?? DEFAULT_TIME_ZONE
  const month = (value: string): MonthSpend => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new RangeError('month must be YYYY-MM')
    const selected = selectPurchases(purchases, { kind: 'all' }, query.filters, query.clock).filter((purchase) => localMonth(purchase.timestamp, timeZone) === value)
    return { month: value, ...summarize(selected) }
  }
  const first = month(a), second = month(b)
  const currencies = orderedTotals([...new Set([...first.totals, ...second.totals].map((entry) => entry.currency))].map((currency) => ({ currency, minor: 0, purchaseCount: 0 }))).map((entry) => entry.currency)
  const changes = currencies.map((currency) => {
    const aMinor = amountIn(first, currency), bMinor = amountIn(second, currency)
    return { currency, aMinor, bMinor, deltaMinor: bMinor - aMinor, percent: aMinor === 0 ? null : Math.round((bMinor - aMinor) / aMinor * 100) }
  })
  return { a: first, b: second, changes, purchaseIds: [...first.purchaseIds, ...second.purchaseIds] }
}

export interface ItemSummary extends Sourced {
  /** Normalized item name; items are grouped by name, never matched across different products. */
  key: string
  label: LocalizedText
  purchaseCount: number
  /** Whole items bought (unit 'item'). */
  units: number
  /** Kilograms bought (unit 'kg'), to 3 decimals. */
  kilograms: number
  totals: CurrencyAmount[]
}

const itemKey = (label: LocalizedText) => (label.he || label.en).trim().replace(/\s+/g, ' ').toLocaleLowerCase()

/** Items that appear in the most purchases, then by quantity. */
export function mostBoughtItems(purchases: readonly GlobePurchase[], n: number, query: InsightQuery = {}): ItemSummary[] {
  type Accumulator = ItemSummary & { gramTotal: number; byCurrency: Map<CurrencyCode, CurrencyAmount> }
  const items = new Map<string, Accumulator>()
  for (const purchase of selectPurchases(purchases, query.range, query.filters, query.clock)) {
    for (const item of purchase.items) {
      const key = itemKey(item.label)
      if (!key) continue
      const entry: Accumulator = items.get(key) ?? { key, label: { ...item.label }, purchaseCount: 0, units: 0, kilograms: 0, gramTotal: 0, totals: [], purchaseIds: [], byCurrency: new Map() }
      if (!entry.purchaseIds.includes(purchase.id)) { entry.purchaseIds.push(purchase.id); entry.purchaseCount += 1 }
      if (item.unit === 'kg') entry.gramTotal += Math.round(item.quantity * 1000)
      else entry.units += item.quantity
      const money = entry.byCurrency.get(purchase.originalCurrency) ?? { currency: purchase.originalCurrency, minor: 0, purchaseCount: 0 }
      money.minor += Math.round(item.lineTotal * minorFactor(purchase.originalCurrency))
      money.purchaseCount += 1
      entry.byCurrency.set(purchase.originalCurrency, money)
      items.set(key, entry)
    }
  }
  return [...items.values()]
    .map(({ gramTotal, byCurrency, ...entry }) => ({ ...entry, kilograms: gramTotal / 1000, totals: orderedTotals([...byCurrency.values()]) }))
    .sort((a, b) => b.purchaseCount - a.purchaseCount || (b.units + b.kilograms) - (a.units + a.kilograms) || a.key.localeCompare(b.key))
    .slice(0, Math.max(0, Math.floor(n)))
}

export interface AverageBasket extends Sourced {
  currency: CurrencyCode
  /** Rounded to the nearest minor unit. */
  averageMinor: number
  purchaseCount: number
}

/** Average purchase size per currency, optionally for one store. */
export function averageBasket(purchases: readonly GlobePurchase[], storeId?: string, query: InsightQuery = {}): AverageBasket[] {
  const selected = selectPurchases(purchases, query.range, storeId ? { ...query.filters, storeId } : query.filters, query.clock)
  return [...groupBy(selected, (purchase) => purchase.originalCurrency)]
    .map(([currency, group]) => ({ currency, averageMinor: Math.round(group.reduce((sum, purchase) => sum + minorAmount(purchase), 0) / group.length), purchaseCount: group.length, purchaseIds: group.map((purchase) => purchase.id) }))
    .sort((a, b) => (a.currency === 'ILS' ? -1 : b.currency === 'ILS' ? 1 : a.currency.localeCompare(b.currency)))
}

// ---- The "this month" summary shown in Analytics ---------------------------

export interface MonthSummary {
  month: string
  previousMonth: string
  total: SpendTotal
  topStore: StoreSpend | null
  topCategory: CategorySpend | null
  /** ILS change against the previous month; null when last month had no ILS spend. */
  vsPrevious: CurrencyChange | null
  purchaseIds: string[]
}

export function thisMonthSummary(purchases: readonly GlobePurchase[], clock: InsightClock): MonthSummary {
  const timeZone = clock.timeZone ?? DEFAULT_TIME_ZONE
  const month = localMonth(clock.now, timeZone), previousMonth = shiftMonth(month, -1)
  const query: InsightQuery = { range: { kind: 'this-month' }, clock }
  const comparison = compareMonths(purchases, previousMonth, month, { clock })
  const ils = comparison.changes.find((change) => change.currency === 'ILS')
  return {
    month,
    previousMonth,
    total: totalSpent(purchases, query),
    topStore: topStore(purchases, query),
    topCategory: topCategory(purchases, query),
    vsPrevious: ils && ils.aMinor > 0 ? ils : null,
    purchaseIds: comparison.purchaseIds,
  }
}
