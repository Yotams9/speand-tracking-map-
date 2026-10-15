import type { GlobePurchase, Place } from '../../data/spendscape-globe'
import type { SessionCaptureRecord } from '../capture/capture-domain'
import { validateBarcode } from '../capture/barcode-domain'
import { catalogStoreIdOf } from '../local-purchases/place-provenance'
import type { SavingsItemInput, SavingsOrigin } from './savings-engine'

export interface SavingsBasket {
  items: SavingsItemInput[]
  /** The saved place's coordinates, or null when the purchase has no confirmed located place. */
  origin: SavingsOrigin | null
}

// A saved purchase carries at most one barcode, on its record, not per line.
// It belongs to a line only when the purchase has exactly one line; otherwise
// every line is sent without a barcode and listed as not compared. Demo and
// synthetic purchases never qualify. Read-only: nothing here is written back.
export function savingsBasket(purchase: GlobePurchase, record: SessionCaptureRecord | undefined, places: readonly Place[]): SavingsBasket | null {
  if (!record || record.synthetic || record.purchase.id !== purchase.id || purchase.provenance !== 'user-reviewed-session') return null
  const identification = record.identification
  if (!identification || identification.syntheticCatalog || purchase.items.length === 0) return null
  // Same check as the save boundary: the scanned code must still yield this GTIN-14.
  const checked = validateBarcode(identification.identity.original, identification.identity.format)
  const gtin14 = identification.identity.gtin14
  if (!checked.valid || checked.identity.gtin14 !== gtin14) return null
  const ils = purchase.originalCurrency === 'ILS'
  const items: SavingsItemInput[] = purchase.items.map(item => ({
    ref: item.id,
    gtin14: purchase.items.length === 1 ? gtin14 : null,
    quantity: item.quantity,
    unit: item.unit,
    ...(ils && Number.isFinite(item.lineTotal) && item.lineTotal >= 0 ? { paidMinor: Math.round(item.lineTotal * 100) } : {}),
  }))
  const place = purchase.channel === 'physical' && purchase.resolution === 'confirmed' && purchase.placeId
    ? places.find(p => p.id === purchase.placeId && p.merchantId === purchase.merchantId)
    : undefined
  const [lon, lat] = place?.coordinates ?? [Number.NaN, Number.NaN]
  const located = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  const storeId = place ? catalogStoreIdOf(place) : null
  return { items, origin: located ? { lat, lon, ...(storeId ? { storeId } : {}) } : null }
}
