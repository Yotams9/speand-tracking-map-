/**
 * ============================================================================
 *  DERIVATION LAYER
 * ============================================================================
 *
 *  Every money figure, count, average, interval, trend, and saving shown
 *  anywhere in the UI is computed here from `fixtures.ts`.
 *
 *  Screens must never hard-code such a value. If two screens disagree about a
 *  merchant's average purchase, it is because one of them stopped calling into
 *  this file — not because the fixtures are ambiguous.
 *
 *  The only values that are NOT computed are route distances and durations and
 *  the per-trip transport cost, which are declared constants in the fixtures
 *  because Phase 1 has no routing engine. They are labelled as estimates
 *  wherever they surface.
 * ============================================================================
 */

import { fixtures } from './fixtures'
import type {
  BasketEntry, CategoryId, Merchant, Product, Purchase, RouteComparison,
} from './types'

/** Refundable container charge, in ILS, per returnable bottle. */
export const DEPOSIT_PER_BOTTLE = 0.3

/** Equivalence groups whose products carry a bottle deposit. */
const DEPOSIT_GROUPS = new Set(['g_cola_regular_1500', 'g_cola_zero_1500'])

/** Days in an average month, used to turn a repeat interval into a monthly rate. */
const DAYS_PER_MONTH = 30.44

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const merchantById = new Map(fixtures.merchants.map((m) => [m.id, m]))
const productById = new Map(fixtures.products.map((p) => [p.id, p]))
const clusterById = new Map(fixtures.clusters.map((c) => [c.id, c]))

export const getMerchant = (id: string): Merchant | undefined => merchantById.get(id)
export const getProduct = (id: string): Product | undefined => productById.get(id)
export const getCluster = (id: string) => clusterById.get(id)

/** Price of one unit at one merchant, or undefined when not stocked there. */
export function priceOf(merchantId: string, productId: string): number | undefined {
  return fixtures.prices[merchantId]?.[productId]
}

// ---------------------------------------------------------------------------
// Rounding
//
// Money is held to 2 decimals throughout. Rounding happens once, at the point
// of computation, so that a sum of rounded parts always equals the rounded sum.
// ---------------------------------------------------------------------------

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

export interface DerivedLine {
  product: Product
  qty: number
  unitPrice: number
  lineTotal: number
}

/** Expands a purchase's basket entries into priced lines. */
export function linesOf(purchase: Purchase): DerivedLine[] {
  if (!purchase.merchantId) return []
  const merchantId = purchase.merchantId
  const out: DerivedLine[] = []
  for (const entry of purchase.items) {
    const product = productById.get(entry.productId)
    const unitPrice = priceOf(merchantId, entry.productId)
    if (!product || unitPrice === undefined) continue
    out.push({ product, qty: entry.qty, unitPrice, lineTotal: round2(unitPrice * entry.qty) })
  }
  return out
}

export function subtotalOf(purchase: Purchase): number {
  return round2(linesOf(purchase).reduce((sum, l) => sum + l.lineTotal, 0))
}

/** The deposit a basket should carry, per the single rule above. */
export function depositForBasket(basket: BasketEntry[]): number {
  let bottles = 0
  for (const entry of basket) {
    const product = productById.get(entry.productId)
    if (product && DEPOSIT_GROUPS.has(product.equivalenceGroup)) bottles += entry.qty
  }
  return round2(bottles * DEPOSIT_PER_BOTTLE)
}

/**
 * The number shown to the user.
 *
 *   itemized:     sum(line totals) - discount + deposit
 *   card feed:    the amount as it arrived, with no line items to explain it
 */
export function totalOf(purchase: Purchase): number {
  if (purchase.flatTotal !== undefined) return round2(purchase.flatTotal)
  return round2(subtotalOf(purchase) - (purchase.discount ?? 0) + (purchase.deposit ?? 0))
}

/** Purchases that have been attached to a merchant, newest first. */
export function resolvedPurchases(extra: Purchase[] = []): Purchase[] {
  return [...fixtures.purchases, ...extra]
    .filter((p) => p.merchantId !== null && p.matchState !== 'ambiguous')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export function purchasesForMerchant(merchantId: string, extra: Purchase[] = []): Purchase[] {
  return resolvedPurchases(extra).filter((p) => p.merchantId === merchantId)
}

// ---------------------------------------------------------------------------
// Merchant statistics
// ---------------------------------------------------------------------------

export interface MerchantStats {
  merchant: Merchant
  visits: number
  totalSpend: number
  avgPurchase: number
  lastVisit: string | null
  firstVisit: string | null
  /** Mean days between visits, or null when there is only one visit. */
  meanIntervalDays: number | null
  frequentProducts: { product: Product; timesBought: number; totalQty: number }[]
}

export function merchantStats(merchantId: string, extra: Purchase[] = []): MerchantStats | null {
  const merchant = merchantById.get(merchantId)
  if (!merchant) return null

  const purchases = purchasesForMerchant(merchantId, extra)
  const totalSpend = round2(purchases.reduce((sum, p) => sum + totalOf(p), 0))
  const visits = purchases.length

  const counts = new Map<string, { timesBought: number; totalQty: number }>()
  for (const p of purchases) {
    for (const entry of p.items) {
      const c = counts.get(entry.productId) ?? { timesBought: 0, totalQty: 0 }
      c.timesBought += 1
      c.totalQty += entry.qty
      counts.set(entry.productId, c)
    }
  }

  const frequentProducts = [...counts.entries()]
    .map(([productId, c]) => ({ product: productById.get(productId)!, ...c }))
    .filter((r) => r.product)
    .sort((a, b) => b.timesBought - a.timesBought || b.totalQty - a.totalQty)

  const sortedAsc = [...purchases].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const firstVisit = sortedAsc[0]?.timestamp ?? null
  const lastVisit = sortedAsc[sortedAsc.length - 1]?.timestamp ?? null

  let meanIntervalDays: number | null = null
  if (sortedAsc.length > 1) {
    const spanDays = daysBetween(sortedAsc[0].timestamp, sortedAsc[sortedAsc.length - 1].timestamp)
    meanIntervalDays = round2(spanDays / (sortedAsc.length - 1))
  }

  return {
    merchant,
    visits,
    totalSpend,
    avgPurchase: visits > 0 ? round2(totalSpend / visits) : 0,
    lastVisit,
    firstVisit,
    meanIntervalDays,
    frequentProducts,
  }
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export const demoToday = (): Date => new Date(`${fixtures.demoToday}T12:00:00`)

export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso.length <= 10 ? `${aIso}T12:00:00` : aIso)
  const b = new Date(bIso.length <= 10 ? `${bIso}T12:00:00` : bIso)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export function daysAgo(iso: string): number {
  return daysBetween(iso.slice(0, 10), fixtures.demoToday)
}

// ---------------------------------------------------------------------------
// Basket pricing and substitution
//
// This is where product equivalence is enforced. A basket may only be priced at
// an alternative merchant using either the identical product, or a product in
// the SAME equivalence group that the comparison has explicitly accepted.
//
// A cheaper product in a different group is never silently used, however
// tempting the arithmetic.
// ---------------------------------------------------------------------------

export interface PricedBasketLine {
  product: Product
  qty: number
  unitPrice: number
  lineTotal: number
  /** Set when this line was priced via an accepted equivalent product. */
  substitutedFor?: Product
}

export interface PricedBasket {
  lines: PricedBasketLine[]
  subtotal: number
  deposit: number
  total: number
  /** Basket entries that could not be priced at this merchant at all. */
  unavailable: Product[]
}

export function priceBasketAt(
  merchantId: string,
  basket: BasketEntry[],
  comparison?: RouteComparison,
): PricedBasket {
  const lines: PricedBasketLine[] = []
  const unavailable: Product[] = []

  for (const entry of basket) {
    const product = productById.get(entry.productId)
    if (!product) continue

    // 1. The identical product, if this merchant stocks it.
    const direct = priceOf(merchantId, entry.productId)
    if (direct !== undefined) {
      lines.push({ product, qty: entry.qty, unitPrice: direct, lineTotal: round2(direct * entry.qty) })
      continue
    }

    // 2. An explicitly ACCEPTED substitution, and only within the same group.
    const sub = comparison?.substitutions.find(
      (s) => s.accepted && s.fromProductId === entry.productId,
    )
    if (sub) {
      const replacement = productById.get(sub.toProductId)
      const subPrice = priceOf(merchantId, sub.toProductId)
      if (
        replacement &&
        subPrice !== undefined &&
        replacement.equivalenceGroup === product.equivalenceGroup
      ) {
        lines.push({
          product: replacement,
          qty: entry.qty,
          unitPrice: subPrice,
          lineTotal: round2(subPrice * entry.qty),
          substitutedFor: product,
        })
        continue
      }
    }

    // 3. Nothing legitimate available. Say so rather than improvising.
    unavailable.push(product)
  }

  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0))
  const deposit = depositForBasket(basket)
  return { lines, subtotal, deposit, total: round2(subtotal + deposit), unavailable }
}

// ---------------------------------------------------------------------------
// Route-aware comparison
// ---------------------------------------------------------------------------

export interface ComparisonResult {
  comparison: RouteComparison
  current: { merchant: Merchant; basket: PricedBasket }
  alternative: { merchant: Merchant; basket: PricedBasket }
  /** Difference for one basket. Positive means the alternative is cheaper. */
  perBasketSaving: number
  addedTravelMin: number
  addedDistanceKm: number
  /** Baskets per month, from the observed shopping interval. */
  basketsPerMonth: number
  grossMonthlySaving: number
  monthlyTransportCost: number
  /** What is actually left after the extra travel is paid for. */
  netMonthlySaving: number
  /** Per-product differences, cheapest wins first. */
  itemDeltas: { product: Product; currentUnit: number; altUnit: number; altProduct: Product; delta: number }[]
}

export function compare(comparisonId: string, extra: Purchase[] = []): ComparisonResult | null {
  const comparison = fixtures.routeComparisons.find((c) => c.id === comparisonId)
  if (!comparison) return null

  const current = merchantById.get(comparison.currentMerchantId)
  const alternative = merchantById.get(comparison.alternativeMerchantId)
  if (!current || !alternative) return null

  const currentBasket = priceBasketAt(current.id, comparison.basket, comparison)
  const altBasket = priceBasketAt(alternative.id, comparison.basket, comparison)

  const perBasketSaving = round2(currentBasket.total - altBasket.total)

  // Shopping frequency comes from the real visit history, not from a guess.
  const stats = merchantStats(current.id, extra)
  const interval = stats?.meanIntervalDays ?? 7
  const basketsPerMonth = round2(DAYS_PER_MONTH / interval)

  const grossMonthlySaving = round2(perBasketSaving * basketsPerMonth)
  const monthlyTransportCost = round2(comparison.transportCostPerTrip * basketsPerMonth)

  const itemDeltas = currentBasket.lines
    .map((line) => {
      const altLine = altBasket.lines.find(
        (l) => l.product.equivalenceGroup === line.product.equivalenceGroup,
      )
      if (!altLine) return null
      return {
        product: line.product,
        altProduct: altLine.product,
        currentUnit: line.unitPrice,
        altUnit: altLine.unitPrice,
        delta: round2((line.unitPrice - altLine.unitPrice) * line.qty),
      }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => b.delta - a.delta)

  return {
    comparison,
    current: { merchant: current, basket: currentBasket },
    alternative: { merchant: alternative, basket: altBasket },
    perBasketSaving,
    addedTravelMin: comparison.alternativeLeg.durationMin - comparison.currentLeg.durationMin,
    addedDistanceKm: round2(comparison.alternativeLeg.distanceKm - comparison.currentLeg.distanceKm),
    basketsPerMonth,
    grossMonthlySaving,
    monthlyTransportCost,
    netMonthlySaving: round2(grossMonthlySaving - monthlyTransportCost),
    itemDeltas,
  }
}

/**
 * Prices an arbitrary basket at both ends of a comparison. Used by the
 * proactive recommendation, whose predicted basket is larger than the weekly
 * one because it includes items that have come due again.
 */
export function compareBasket(comparisonId: string, basket: BasketEntry[]) {
  const comparison = fixtures.routeComparisons.find((c) => c.id === comparisonId)
  if (!comparison) return null
  const current = priceBasketAt(comparison.currentMerchantId, basket, comparison)
  const alternative = priceBasketAt(comparison.alternativeMerchantId, basket, comparison)
  return { current, alternative, saving: round2(current.total - alternative.total) }
}

// ---------------------------------------------------------------------------
// Habit learning: repurchase intervals and what is likely needed soon
// ---------------------------------------------------------------------------

export interface RepurchaseFact {
  product: Product
  /** Mean days between purchases containing this product. */
  meanIntervalDays: number
  lastBoughtIso: string
  daysSinceLast: number
  /** daysSinceLast / meanIntervalDays. At or above 0.85 the item reads as due. */
  ratio: number
  timesBought: number
}

/** Items bought at least three times, so an interval means something. */
export function repurchaseFacts(extra: Purchase[] = []): RepurchaseFact[] {
  const byProduct = new Map<string, string[]>()

  for (const p of resolvedPurchases(extra)) {
    for (const entry of p.items) {
      const list = byProduct.get(entry.productId) ?? []
      list.push(p.timestamp)
      byProduct.set(entry.productId, list)
    }
  }

  const facts: RepurchaseFact[] = []
  for (const [productId, stampsRaw] of byProduct) {
    const product = productById.get(productId)
    if (!product || stampsRaw.length < 3) continue

    const stamps = [...stampsRaw].sort()
    const spanDays = daysBetween(stamps[0], stamps[stamps.length - 1])
    const meanIntervalDays = round2(spanDays / (stamps.length - 1))
    if (meanIntervalDays <= 0) continue

    const lastBoughtIso = stamps[stamps.length - 1]
    const daysSinceLast = daysAgo(lastBoughtIso)

    facts.push({
      product,
      meanIntervalDays,
      lastBoughtIso,
      daysSinceLast,
      ratio: round2(daysSinceLast / meanIntervalDays),
      timesBought: stamps.length,
    })
  }

  return facts.sort((a, b) => b.ratio - a.ratio)
}

/** The threshold at which an item is presented as likely needed soon. */
export const DUE_RATIO = 0.85

export function likelyNeededSoon(extra: Purchase[] = []): RepurchaseFact[] {
  return repurchaseFacts(extra).filter((f) => f.ratio >= DUE_RATIO)
}

// ---------------------------------------------------------------------------
// Habits: when does this person actually shop
// ---------------------------------------------------------------------------

export interface HabitFact {
  merchant: Merchant
  visits: number
  /** 0 = Sunday. The weekday the majority of visits fall on. */
  dominantWeekday: number
  dominantWeekdayShare: number
  /** Mean hour of day across visits, rounded. */
  typicalHour: number
  meanIntervalDays: number | null
}

export function habitFor(merchantId: string, extra: Purchase[] = []): HabitFact | null {
  const stats = merchantStats(merchantId, extra)
  if (!stats || stats.visits === 0) return null

  const purchases = purchasesForMerchant(merchantId, extra)
  const weekdayCounts = new Array(7).fill(0) as number[]
  let hourSum = 0

  for (const p of purchases) {
    const d = new Date(p.timestamp)
    weekdayCounts[d.getDay()] += 1
    hourSum += d.getHours() + d.getMinutes() / 60
  }

  let dominantWeekday = 0
  for (let i = 1; i < 7; i++) {
    if (weekdayCounts[i] > weekdayCounts[dominantWeekday]) dominantWeekday = i
  }

  return {
    merchant: stats.merchant,
    visits: stats.visits,
    dominantWeekday,
    dominantWeekdayShare: round2(weekdayCounts[dominantWeekday] / purchases.length),
    typicalHour: Math.round(hourSum / purchases.length),
    meanIntervalDays: stats.meanIntervalDays,
  }
}

// ---------------------------------------------------------------------------
// Category totals and trend
// ---------------------------------------------------------------------------

export interface CategoryTotal {
  category: CategoryId
  total: number
  count: number
  share: number
}

export function categoryTotals(extra: Purchase[] = [], sinceDays?: number): CategoryTotal[] {
  const purchases = resolvedPurchases(extra).filter(
    (p) => sinceDays === undefined || daysAgo(p.timestamp) <= sinceDays,
  )

  const map = new Map<CategoryId, { total: number; count: number }>()
  for (const p of purchases) {
    const merchant = merchantById.get(p.merchantId!)
    if (!merchant) continue
    const cur = map.get(merchant.category) ?? { total: 0, count: 0 }
    cur.total = round2(cur.total + totalOf(p))
    cur.count += 1
    map.set(merchant.category, cur)
  }

  const grand = round2([...map.values()].reduce((s, v) => s + v.total, 0))
  return [...map.entries()]
    .map(([category, v]) => ({
      category,
      total: v.total,
      count: v.count,
      share: grand > 0 ? round2(v.total / grand) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export interface CategoryTrend {
  category: CategoryId
  recentTotal: number
  priorTotal: number
  /** Positive means spending rose in the recent window. */
  changePct: number
}

/** Compares the last `windowDays` against the `windowDays` before that. */
export function categoryTrends(windowDays = 30, extra: Purchase[] = []): CategoryTrend[] {
  const recent = new Map<CategoryId, number>()
  const prior = new Map<CategoryId, number>()

  for (const p of resolvedPurchases(extra)) {
    const merchant = merchantById.get(p.merchantId!)
    if (!merchant) continue
    const age = daysAgo(p.timestamp)
    const bucket = age <= windowDays ? recent : age <= windowDays * 2 ? prior : null
    if (!bucket) continue
    bucket.set(merchant.category, round2((bucket.get(merchant.category) ?? 0) + totalOf(p)))
  }

  const categories = new Set([...recent.keys(), ...prior.keys()])
  return [...categories]
    .map((category) => {
      const recentTotal = recent.get(category) ?? 0
      const priorTotal = prior.get(category) ?? 0
      const changePct = priorTotal > 0 ? round2(((recentTotal - priorTotal) / priorTotal) * 100) : 0
      return { category, recentTotal, priorTotal, changePct }
    })
    .filter((t) => t.priorTotal > 0 && t.recentTotal > 0)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
}

// ---------------------------------------------------------------------------
// Map aggregation
// ---------------------------------------------------------------------------

export interface MerchantPin {
  merchant: Merchant
  visits: number
  totalSpend: number
}

export interface ClusterPin {
  clusterId: string
  name: { en: string; he: string }
  center: [number, number]
  merchantCount: number
  purchaseCount: number
  totalSpend: number
}

export function merchantPins(
  category: CategoryId | 'all',
  extra: Purchase[] = [],
  sinceDays?: number,
): MerchantPin[] {
  return fixtures.merchants
    .filter((m) => category === 'all' || m.category === category)
    .map((m) => {
      const purchases = purchasesForMerchant(m.id, extra).filter(
        (p) => sinceDays === undefined || daysAgo(p.timestamp) <= sinceDays,
      )
      return {
        merchant: m,
        visits: purchases.length,
        totalSpend: round2(purchases.reduce((s, p) => s + totalOf(p), 0)),
      }
    })
    .filter((pin) => pin.visits > 0)
}

export function clusterPins(
  category: CategoryId | 'all',
  extra: Purchase[] = [],
  sinceDays?: number,
): ClusterPin[] {
  const pins = merchantPins(category, extra, sinceDays)
  return fixtures.clusters
    .map((cluster) => {
      const inCluster = pins.filter((p) => p.merchant.clusterId === cluster.id)
      return {
        clusterId: cluster.id,
        name: cluster.name,
        center: cluster.center,
        merchantCount: inCluster.length,
        purchaseCount: inCluster.reduce((s, p) => s + p.visits, 0),
        totalSpend: round2(inCluster.reduce((s, p) => s + p.totalSpend, 0)),
      }
    })
    .filter((c) => c.merchantCount > 0)
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

/** The actual first and last purchase in the data, for honest period labels. */
export function historyRange(extra: Purchase[] = []): { from: string; to: string } | null {
  const all = resolvedPurchases(extra)
  if (all.length === 0) return null
  const sorted = [...all].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  return { from: sorted[0].timestamp, to: sorted[sorted.length - 1].timestamp }
}

export function totalSpend(extra: Purchase[] = [], sinceDays?: number): number {
  return round2(
    resolvedPurchases(extra)
      .filter((p) => sinceDays === undefined || daysAgo(p.timestamp) <= sinceDays)
      .reduce((s, p) => s + totalOf(p), 0),
  )
}
