import { validGtin14, type CatalogChain, type PriceCatalogFile } from '../../data/price-catalog'
import type { LocalizedText } from '../../data/spendscape-globe'
import { NEARBY_RADIUS_M } from '../nearby-prices/receipt-comparison'
import { toMinor } from './savings-money'

export { toMinor }

// "You'd save ₪X nearby": deterministic, catalog-only. Products are compared
// only by identical GTIN-14, a basket is never split across stores, and every
// amount is integer agorot. No UI strings live here.

export const DEFAULT_SAVINGS_RADIUS_M = NEARBY_RADIUS_M
export const MAX_SAVINGS_ITEMS = 100

export interface SavingsItemInput {
  /** Caller's own line reference, echoed back unchanged. */
  ref?: string
  gtin14?: string | null
  /** Whole units; anything else is listed as not compared. */
  quantity: number
  unit?: 'item' | 'kg'
  /** What the user paid for this line, in agorot. */
  paidMinor?: number
}

export interface SavingsOrigin { lat: number; lon: number; storeId?: string }

export interface SavingsStore {
  id: string
  chain: CatalogChain
  chainName: LocalizedText
  name: string
  address: string
  location: { lat: number; lon: number }
  /** Straight-line distance from the origin, whole metres. */
  distanceM: number
  isOrigin: boolean
}

export type NotComparedReason = 'no-barcode' | 'invalid-barcode' | 'not-in-catalog' | 'weighted' | 'unsupported-quantity'

export interface NotComparedItem { index: number; ref?: string; gtin14: string | null; reason: NotComparedReason }

export interface ProductOffer { store: SavingsStore; unitMinor: number; lineMinor: number }

export interface ProductComparison {
  index: number
  ref?: string
  gtin14: string
  name: string
  quantityLabel: string
  quantity: number
  /** Every located store within the radius that publishes this barcode: price, then distance, then ID. */
  offers: ProductOffer[]
  cheapest: ProductOffer | null
  reference: { basis: 'origin-shelf'; lineMinor: number } | { basis: 'paid'; lineMinor: number } | null
  /** reference − cheapest line price; may be negative (the reference was already cheaper). */
  differenceMinor: number | null
}

export interface StoreTotal { store: SavingsStore; totalMinor: number }
export interface PartialStore { store: SavingsStore; pricedItems: number; totalItems: number }

export type SavingsBaseline =
  | { basis: 'origin-shelf'; storeId: string; totalMinor: number }
  | { basis: 'paid'; totalMinor: number }

export type SavingsOutcome = 'saving' | 'already-cheapest' | 'no-baseline' | 'no-complete-store' | 'nothing-comparable'

export interface SavingsResult {
  radiusM: number
  priceBasis: string
  generatedAt: string
  publishedLocal: string | null
  originStore: SavingsStore | null
  products: ProductComparison[]
  notCompared: NotComparedItem[]
  /** Stores that price every compared item, cheapest first, then nearest, then ID. */
  complete: StoreTotal[]
  /** Stores with some but not all compared items. Never a savings claim. */
  partial: PartialStore[]
  baseline: SavingsBaseline | null
  best: StoreTotal | null
  /** Positive agorot only when outcome is 'saving'. */
  savingMinor: number | null
  outcome: SavingsOutcome
}

export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}


const validQuantity = (item: SavingsItemInput) => (item.unit ?? 'item') === 'item' && Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 1000
const validPaid = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

export function computeSavings(catalog: PriceCatalogFile, items: readonly SavingsItemInput[], origin: SavingsOrigin, radiusM = DEFAULT_SAVINGS_RADIUS_M): SavingsResult {
  if (items.length > MAX_SAVINGS_ITEMS) throw new RangeError('too-many-items')
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lon) || Math.abs(origin.lat) > 90 || Math.abs(origin.lon) > 180) throw new RangeError('origin')
  if (!Number.isFinite(radiusM) || radiusM <= 0) throw new RangeError('radius')

  // Located stores within the radius (inclusive). Stores without a location never take part.
  const originIndex = origin.storeId ? catalog.stores.findIndex(store => store.id === origin.storeId) : -1
  const nearby = new Map<number, SavingsStore>()
  catalog.stores.forEach((store, index) => {
    if (!store.location) return
    const metres = distanceM(origin, store.location)
    if (metres > radiusM) return
    nearby.set(index, { id: store.id, chain: store.chain, chainName: store.chainName, name: store.name, address: store.address, location: { lat: store.location.lat, lon: store.location.lon }, distanceM: Math.round(metres), isOrigin: index === originIndex })
  })
  // Ties: whole metres (what people see), then store ID.
  const byPlace = (a: { store: SavingsStore }, b: { store: SavingsStore }) =>
    a.store.distanceM - b.store.distanceM || a.store.id.localeCompare(b.store.id)

  const notCompared: NotComparedItem[] = []
  const compared: { index: number; item: SavingsItemInput; gtin14: string; prices: Map<number, number> }[] = []
  items.forEach((item, index) => {
    const gtin14 = typeof item.gtin14 === 'string' && item.gtin14 ? item.gtin14 : null
    const skip = (reason: NotComparedReason) => { notCompared.push({ index, ...(item.ref !== undefined ? { ref: item.ref } : {}), gtin14, reason }) }
    if (!gtin14) return skip('no-barcode')
    if (!validGtin14(gtin14)) return skip('invalid-barcode')
    const entry = Object.hasOwn(catalog.products, gtin14) ? catalog.products[gtin14] : undefined
    if (!entry) return skip('not-in-catalog')
    if (entry.w === 1) return skip('weighted')
    if (!validQuantity(item)) return skip('unsupported-quantity')
    // Every store's published unit price for this exact barcode; the lower wins a duplicate row.
    const prices = new Map<number, number>()
    for (const [storeIndex, price] of entry.p) {
      const minor = toMinor(price)
      if (minor === null || !catalog.stores[storeIndex]) continue
      const known = prices.get(storeIndex)
      if (known === undefined || minor < known) prices.set(storeIndex, minor)
    }
    if (!prices.size) return skip('not-in-catalog')
    compared.push({ index, item, gtin14, prices })
  })

  const products: ProductComparison[] = compared.map(({ index, item, gtin14, prices }) => {
    const entry = catalog.products[gtin14]
    const offers = [...prices].flatMap(([storeIndex, unitMinor]) => {
      const store = nearby.get(storeIndex)
      return store ? [{ store, unitMinor, lineMinor: unitMinor * item.quantity }] : []
    }).sort((a, b) => a.unitMinor - b.unitMinor || byPlace(a, b))
    const cheapest = offers[0] ?? null
    const originPrice = originIndex >= 0 ? prices.get(originIndex) : undefined
    const reference = originPrice !== undefined
      ? { basis: 'origin-shelf' as const, lineMinor: originPrice * item.quantity }
      : validPaid(item.paidMinor) ? { basis: 'paid' as const, lineMinor: item.paidMinor } : null
    return {
      index, ...(item.ref !== undefined ? { ref: item.ref } : {}), gtin14, name: entry.n.trim(), quantityLabel: entry.q.trim(), quantity: item.quantity,
      offers, cheapest, reference,
      differenceMinor: reference && cheapest ? reference.lineMinor - cheapest.lineMinor : null,
    }
  })

  // Never split: a store's basket total exists only when it prices every compared item.
  const complete: StoreTotal[] = [], partial: PartialStore[] = []
  for (const [storeIndex, store] of nearby) {
    if (!compared.length) break
    let total = 0, priced = 0
    for (const { item, prices } of compared) {
      const unit = prices.get(storeIndex)
      if (unit === undefined) continue
      priced++
      total += unit * item.quantity
    }
    if (priced === compared.length) complete.push({ store, totalMinor: total })
    else if (priced > 0) partial.push({ store, pricedItems: priced, totalItems: compared.length })
  }
  complete.sort((a, b) => a.totalMinor - b.totalMinor || byPlace(a, b))
  partial.sort((a, b) => b.pricedItems - a.pricedItems || byPlace(a, b))

  // Same basis only: shelf vs shelf at the origin store, otherwise what the user paid.
  let baseline: SavingsBaseline | null = null
  if (compared.length && originIndex >= 0 && compared.every(({ prices }) => prices.has(originIndex))) {
    baseline = { basis: 'origin-shelf', storeId: catalog.stores[originIndex].id, totalMinor: compared.reduce((sum, { item, prices }) => sum + prices.get(originIndex)! * item.quantity, 0) }
  } else if (compared.length && compared.every(({ item }) => validPaid(item.paidMinor))) {
    baseline = { basis: 'paid', totalMinor: compared.reduce((sum, { item }) => sum + item.paidMinor!, 0) }
  }

  const best = complete[0] ?? null
  let outcome: SavingsOutcome, savingMinor: number | null = null
  if (!compared.length) outcome = 'nothing-comparable'
  else if (!best) outcome = 'no-complete-store'
  else if (!baseline) outcome = 'no-baseline'
  else if (baseline.totalMinor > best.totalMinor) { outcome = 'saving'; savingMinor = baseline.totalMinor - best.totalMinor }
  else outcome = 'already-cheapest'

  const originStore = originIndex >= 0 ? nearby.get(originIndex) ?? null : null
  const published = [...nearby.keys()].map(index => catalog.stores[index].publishedLocal).sort()
  return {
    radiusM, priceBasis: catalog.priceBasis, generatedAt: catalog.generatedAt, publishedLocal: published[0] ?? null,
    originStore, products, notCompared, complete, partial, baseline, best, savingMinor, outcome,
  }
}
