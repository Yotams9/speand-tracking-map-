import type { CatalogStoreSummary } from '@/data/price-catalog'
import type { DirectoryIntent } from '../local-purchases/local-directory'
import type { ReviewContext } from './session-purchase-domain'

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

/** Explicit catalog selection proposes a directory entry, never paid facts. */
export function catalogProposal(store: LocatedCatalogStore, context: ReviewContext) {
  const merchant = context.merchants.find(m => m.name.en === store.chainName.en || m.name.he === store.chainName.he)
  const existing = context.places.find(p => (p as typeof p & { catalogStoreId?: string }).catalogStoreId === store.id)
  if (existing) return { merchantId: existing.merchantId, placeId: existing.id, directoryIntent: undefined }
  const directoryIntent: DirectoryIntent = {
    ...(!merchant ? { merchant: { name: store.chainName.en, category: '' as const, separate: false } } : {}),
    place: { branch: store.name, address: store.address, city: 'תל אביב', country: 'ישראל', longitude: String(store.location.lon), latitude: String(store.location.lat), confirmed: false, separate: false, catalogStoreId: store.id },
  }
  return { merchantId: merchant?.id ?? '', placeId: '', directoryIntent }
}
