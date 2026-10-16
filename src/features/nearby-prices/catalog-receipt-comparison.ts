import type { CatalogProduct, CatalogStoreSummary } from '../../data/price-catalog'
import type { GlobePurchase, Place } from '../../data/spendscape-globe'
import { comparisonOrigin, distanceM } from './receipt-comparison'
import { validCoordinates } from './price-contract'
export type CatalogSelections = Readonly<Record<string, { product: CatalogProduct; confirmed: boolean } | undefined>>
const minor = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1000000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001 ? Math.round(value * 100) : null
export function catalogReceiptComparison(purchase: GlobePurchase, places: readonly Place[], stores: readonly CatalogStoreSummary[], selected: CatalogSelections, radiusM = 5000) {
  const origin = comparisonOrigin(purchase, places)
  if (!origin) return { state: 'location-unresolved' as const, stores: [] }
  if (![5000, 10000, 20000].includes(radiusM)) return { state: 'invalid-radius' as const, stores: [] }
  const results = stores.flatMap(store => {
    const location = store.location
    if (!location || location.accuracy !== 'address point' || !/^(node|way|relation)\/\d+$/.test(location.osm) || !validCoordinates([location.lon, location.lat])) return []
    const distance = distanceM(origin.coordinates, [location.lon, location.lat]); if (distance > radiusM) return []
    const rows = purchase.items.map(item => {
      const selection = Object.hasOwn(selected, item.id) ? selected[item.id] : undefined, product = selection?.product
      const quote = product?.prices.find(p => p.store.id === store.id)
      let reason = !selection?.confirmed ? 'unconfirmed' : !product?.name.trim() || !product.quantity.trim() ? 'identity-unknown' : product.weighted || item.unit !== 'item' || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ? 'unsupported-unit' : purchase.originalCurrency !== 'ILS' || product.currency !== 'ILS' ? 'currency-unsupported' : !quote || minor(quote.price) === null || quote.price <= 0 ? 'no-price' : 'available'
      const amount = reason === 'available' ? minor(quote!.price)! * item.quantity : null
      if (amount !== null && (!Number.isSafeInteger(amount) || amount > 100000000)) reason = 'unsupported-unit'
      const paid = minor(item.lineTotal)
      return { itemId: item.id, reason, amountMinor: reason === 'available' ? amount : null, paidMinor: paid, publishedLocal: quote?.store.publishedLocal ?? null }
    })
    const count = rows.filter(r => r.amountMinor !== null).length
    if (!count) return []
    const total = rows.reduce((sum, r) => sum + (r.amountMinor ?? 0), 0), complete = purchase.items.length > 0 && count === purchase.items.length && Number.isSafeInteger(total) && total <= 100000000
    const paid = minor(purchase.originalAmount)
    return [{ store, distanceM: Math.round(distance), rows, matchedCount: count, totalMinor: total, complete, historicalDifferenceMinor: complete && paid !== null ? paid - total : null }]
  }).sort((a, b) => Number(b.complete) - Number(a.complete) || (a.complete && b.complete ? a.totalMinor - b.totalMinor : b.matchedCount - a.matchedCount) || a.distanceM - b.distanceM || a.store.id.localeCompare(b.store.id))
  return { state: results.length ? 'reference-prices' as const : 'no-matched-prices' as const, stores: results }
}
export function validCatalogQuote(v: unknown): v is CatalogProduct {
  if (!v || typeof v !== 'object') return false
  const p = v as CatalogProduct
  return typeof p.gtin14 === 'string' && /^\d{14}$/.test(p.gtin14) && (10 - [...p.gtin14.slice(0, -1)].reverse().reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 1 : 3), 0) % 10) % 10 === Number(p.gtin14.at(-1)) && typeof p.name === 'string' && p.name.length <= 300 && typeof p.manufacturer === 'string' && typeof p.quantity === 'string' && typeof p.weighted === 'boolean' && p.currency === 'ILS' && Array.isArray(p.prices) && p.prices.length <= 100 && p.prices.every(q => q && q.store && typeof q.store.id === 'string' && typeof q.store.name === 'string' && typeof q.store.address === 'string' && typeof q.store.publishedLocal === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(q.store.publishedLocal) && typeof q.price === 'number' && minor(q.price) !== null && q.price > 0)
}
