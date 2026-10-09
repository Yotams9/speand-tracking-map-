import type { CatalogStoreSummary } from '@/data/price-catalog'
import type { CatalogStoreChoice, PurchaseReviewInput } from './session-purchase-domain'

export type LocatedCatalogStore = CatalogStoreSummary & { location: NonNullable<CatalogStoreSummary['location']> }
export const NEAREST_STORE_METERS = 200

let pending: Promise<CatalogStoreSummary[]> | null = null
// One small request per page; a failure is retried on the next form.
export function loadCatalogStores(): Promise<CatalogStoreSummary[]> {
  pending ??= fetch('/api/catalog/stores')
    .then(response => response.ok ? response.json() as Promise<{ stores: CatalogStoreSummary[] }> : Promise.reject(new Error('stores')))
    .then(body => body.stores)
  pending.catch(() => { pending = null })
  return pending
}

export function isLocated(store: CatalogStoreSummary): store is LocatedCatalogStore {
  return store.location !== null
}

// Great-circle distance on a mean-radius sphere; straight line, not a walking route.
export function distanceMeters([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)))
}

// A suggestion only: the closest located store within reach, never proof of where the user shopped.
export function nearestCatalogStore(stores: readonly CatalogStoreSummary[], position: [number, number], maxMeters = NEAREST_STORE_METERS): { store: LocatedCatalogStore; meters: number } | null {
  let best: { store: LocatedCatalogStore; meters: number } | null = null
  for (const store of stores) {
    if (!isLocated(store)) continue
    const meters = distanceMeters(position, [store.location.lon, store.location.lat])
    if (meters <= maxMeters && (!best || meters < best.meters)) best = { store, meters }
  }
  return best
}

export function catalogChoice(store: LocatedCatalogStore): CatalogStoreChoice {
  return { id: store.id, chain: store.chain, chainName: { ...store.chainName }, name: store.name, coordinates: [store.location.lon, store.location.lat] }
}

// 'store_shufersal_117' -> 'shufersal-117' for chain stores already on the map.
export function catalogIdForPlace(placeId: string): string | null {
  return /^store_[a-z]+_\d+$/.test(placeId) ? placeId.slice('store_'.length).replace('_', '-') : null
}

// One identified item at a store with a published price: fill the unit price
// (and an empty quantity and total), never overwrite what the user typed.
export function withPublishedPrice(input: PurchaseReviewInput, storeId: string | null): PurchaseReviewInput {
  const price = storeId ? input.catalogPrices?.[storeId] : undefined
  const [line] = input.lines
  if (price === undefined || input.lines.length !== 1 || line.price || (input.currency && input.currency !== 'ILS')) return input
  const quantity = line.quantity || '1'
  return { ...input, currency: 'ILS', lines: [{ ...line, price: price.toFixed(2), quantity }], amount: input.amount || (Math.round(price * 100 * Number(quantity)) / 100).toFixed(2) }
}
