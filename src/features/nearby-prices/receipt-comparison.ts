import type { GlobePurchase, Place } from '../../data/spendscape-globe'
import { validCoordinates, validTime, validatePriceSnapshot } from './price-contract'

export const NEARBY_RADIUS_M = 5000
export const MAX_PRICE_AGE_MS = 24 * 60 * 60 * 1000
export function nearbyQaAllowed(hostname: string, search: string) {
  const flags = new URLSearchParams(search).getAll('nearbyPricesQa')
  return ['127.0.0.1', 'localhost', '[::1]'].includes(hostname) && flags.length === 1 && flags[0] === '1'
}
export interface ProductMatch { productId: string; confirmed: boolean }
export type Matches = Readonly<Record<string, ProductMatch | undefined>>
export type RowState = 'unmatched' | 'confirm-match' | 'package-unknown' | 'identity-unknown' | 'unsupported-unit' | 'currency-unknown' | 'stale' | 'no-price' | 'available'
export function distanceM(a: [number, number], b: [number, number]) {
  const r = (n: number) => n * Math.PI / 180
  const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}
export function comparisonOrigin(purchase: GlobePurchase, places: readonly Place[]) {
  if (purchase.channel !== 'physical' || purchase.resolution !== 'confirmed') return null
  return places.find(p => p.id === purchase.placeId && p.merchantId === purchase.merchantId && validCoordinates(p.coordinates)) ?? null
}
export function receiptComparison(purchase: GlobePurchase, places: readonly Place[], raw: unknown, matches: Matches, now: number) {
  const origin = comparisonOrigin(purchase, places)
  const snapshot = validatePriceSnapshot(raw)
  if (!origin) return { state: 'location-unresolved' as const, stores: [], snapshot }
  if (!snapshot) return { state: 'prices-unavailable' as const, stores: [], snapshot: null }
  const published = snapshot.source.publishedAt, fetched = snapshot.source.fetchedAt
  const fresh = Number.isFinite(now) && validTime(published) && Date.parse(published) <= Date.parse(fetched) && Date.parse(fetched) <= now && now - Date.parse(published) >= 0 && now - Date.parse(published) <= MAX_PRICE_AGE_MS
  const stores = snapshot.stores.flatMap(store => {
    if (!store.coordinates || !store.coordinateEvidence) return []
    const distance = distanceM(origin.coordinates, store.coordinates)
    if (distance > NEARBY_RADIUS_M) return []
    const rows = purchase.items.map(item => {
      const match = Object.hasOwn(matches, item.id) ? matches[item.id] : undefined
      const product = snapshot.products.find(p => p.id === match?.productId)
      let state: RowState = 'available'
      if (!product) state = 'unmatched'
      else if (!product.brand || !product.variant) state = 'identity-unknown'
      else if (!product.package) state = 'package-unknown'
      else if (match?.confirmed !== true) state = 'confirm-match'
      else if (item.unit !== 'item' || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) state = 'unsupported-unit'
      else if (!snapshot.source.currency || !snapshot.source.currencyEvidence) state = 'currency-unknown'
      else if (!fresh) state = 'stale'
      const price = snapshot.prices.find(p => p.storeId === store.id && p.productId === product?.id)
      if (state === 'available' && !price?.unitMinor) state = 'no-price'
      const amount = state === 'available' ? price!.unitMinor! * item.quantity : null
      if (amount !== null && (!Number.isSafeInteger(amount) || amount > 100000000)) state = 'unsupported-unit'
      return { itemId: item.id, state, amountMinor: state === 'available' ? amount : null }
    })
    const matchedCount = rows.filter(r => r.state === 'available').length
    const sum = rows.reduce((n, r) => n + (r.amountMinor ?? 0), 0)
    const complete = purchase.items.length > 0 && matchedCount === purchase.items.length && snapshot.source.coverage === 'complete' && Number.isSafeInteger(sum)
    return [{ id: store.id, label: store.label, distanceM: Math.round(distance), rows, matchedCount, subtotalMinor: Number.isSafeInteger(sum) ? sum : null, complete }]
  }).sort((a, b) => a.distanceM - b.distanceM || a.id.localeCompare(b.id))
  return { state: stores.length ? 'preview' as const : 'no-qualified-stores' as const, stores, snapshot }
}
