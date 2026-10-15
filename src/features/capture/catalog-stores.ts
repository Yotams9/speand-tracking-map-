import type { CatalogStoreSummary } from '@/data/price-catalog'
import type { DirectoryIntent } from '../local-purchases/local-directory'
import { catalogStoreIdOf, catalogText, type CatalogStoreChoice } from '../local-purchases/place-provenance'
import { lineMinorTotal, type PurchaseReviewInput } from './session-purchase-domain'

export type LocatedCatalogStore = CatalogStoreSummary & { location: NonNullable<CatalogStoreSummary['location']> }
export const NEAREST_STORE_METERS = 200

let pending: Promise<CatalogStoreSummary[]> | null = null
// One small request per page; a failure is retried on the next form.
export function loadCatalogStores(): Promise<CatalogStoreSummary[]> {
  pending ??= fetch('/api/catalog/stores', { signal: AbortSignal.timeout(15_000) })
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

// The published name and address become the place's branch and provenance.
export function catalogChoice(store: LocatedCatalogStore): CatalogStoreChoice {
  return { id: store.id, chain: store.chain, name: catalogText(store.name), address: catalogText(store.address), coordinates: [store.location.lon, store.location.lat] }
}

// A chain branch already saved as a place carries its catalog store ID as provenance.
export function catalogIdForPlace(place: unknown): string | null {
  return catalogStoreIdOf(place)
}

// What the form last filled in from a store's published price. Form state only:
// never saved and never part of the reviewed record. An empty value means that
// field was not filled in automatically.
export interface PublishedFill { storeId: string; price: string; amount: string }
const agorot = (minor: number) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`
// The published fill only ever applies to one item priced in ILS.
const fillable = (input: PurchaseReviewInput) => input.lines.length === 1 && (!input.currency || input.currency === 'ILS')
const isAuto = (value: string, filled: string | undefined) => value === '' || (Boolean(filled) && value === filled)

// One identified item at the chosen store: its published price follows the store.
// A price or total is replaced only while it is empty or still exactly what was
// filled in automatically; what the person typed is never overwritten. A store
// without a published price clears only the automatic values.
export function followPublishedPrice<T extends PurchaseReviewInput>(input: T, storeId: string | null, last: PublishedFill | null): { input: T; fill: PublishedFill | null } {
  if (!fillable(input)) return { input, fill: last }
  const [line] = input.lines
  // A typed price stays, and so does everything derived from it.
  if (!isAuto(line.price, last?.price)) return { input, fill: last && { ...last, price: '' } }
  const published = storeId ? input.catalogPrices?.[storeId] : undefined
  const autoAmount = last?.amount ? input.amount === last.amount : false
  if (published === undefined || !storeId) {
    if (!line.price && !autoAmount) return { input, fill: null }
    return { input: { ...input, lines: [{ ...line, price: '' }], amount: autoAmount ? '' : input.amount }, fill: null }
  }
  const filled = { ...line, price: agorot(Math.round(published * 100)), quantity: line.quantity || '1' }
  const total = isAuto(input.amount, last?.amount) ? lineMinorTotal(filled, 'ILS') : null
  const amount = total === null ? (autoAmount ? '' : input.amount) : agorot(total)
  return { input: { ...input, currency: 'ILS', lines: [filled], amount }, fill: { storeId, price: filled.price, amount: total === null ? '' : amount } }
}
// The person edited the item: a total that is still the automatic one follows the
// line (integer agorot); a typed total is never changed.
export function followLineEdit<T extends PurchaseReviewInput>(input: T, last: PublishedFill | null): { input: T; fill: PublishedFill | null } {
  if (!last?.amount || input.amount !== last.amount || !fillable(input)) return { input, fill: last }
  const total = lineMinorTotal(input.lines[0], 'ILS')
  if (total === null) return { input, fill: last }
  const amount = agorot(total)
  return { input: { ...input, amount }, fill: { ...last, amount } }
}
// A new store the person was typing is set aside (form state only) when a catalog
// branch or saved place replaces it, so going back to "no store" or "New store"
// brings their details back instead of an empty form (cf. Shon's 4d5e09a).
export function setAsideStore(current: { directoryIntent?: DirectoryIntent; setAside?: DirectoryIntent }): DirectoryIntent | undefined {
  const d = current.directoryIntent
  return d && !d.catalogStore && (d.merchant || d.place) ? d : current.setAside
}
// Brought back details are the person's own, but a place needs confirming again.
export function restoredStore(aside: DirectoryIntent | undefined): DirectoryIntent | undefined {
  if (!aside) return undefined
  return { ...aside, ...(aside.place ? { place: { ...aside.place, confirmed: false } } : {}) }
}
// One store choice without earlier automatic values.
export function withPublishedPrice<T extends PurchaseReviewInput>(input: T, storeId: string | null): T {
  return followPublishedPrice(input, storeId, null).input
}

// The form keeps dates as UTC minutes ('YYYY-MM-DDTHH:mm'); people read and type
// them in their own local time. Unparseable text passes through for validation.
export function nowUtcMinutes(now = new Date()): string {
  return now.toISOString().slice(0, 16)
}

export function utcToLocalInput(value: string): string {
  const date = new Date(`${value}:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(date.getTime())) return value
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function localInputToUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 16) : value
}

// Choosing a chain store means "I'm shopping there": an empty date becomes now.
// A date the user already typed is never replaced, and "now" stays editable.
export function withNowIfEmpty<T extends Pick<PurchaseReviewInput, 'date'>>(input: T, now = new Date()): T {
  return input.date ? input : { ...input, date: nowUtcMinutes(now) }
}
