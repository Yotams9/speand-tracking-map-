import type { Place } from '../../data/spendscape-globe'
import type { SessionCaptureRecord } from '../capture/capture-domain'
import { minorAmount } from '../capture/session-purchase-domain'
import { demoStore } from './demo-prices'

// Only explicitly reviewed receipt records from the current ledger may enter.
// The caller supplies the ID released by the existing Undo-expiry transition.
export function demoComparison(records: readonly SessionCaptureRecord[], readyId: string | null, undoId: string | null, places: readonly Place[]) {
  if (!readyId || undoId) return null
  const record = records.find(r => r.purchase.id === readyId)
  if (!record || !record.synthetic || record.source !== 'receipt' || !record.demoProductIds) return null
  const purchase = record.purchase
  if (purchase.provenance || purchase.originalCurrency !== 'ILS' || purchase.channel !== 'physical' || purchase.resolution !== 'confirmed') return null
  const place = places.find(p => p.id === purchase.placeId && p.merchantId === purchase.merchantId)
  if (!place || !place.coordinates.every(Number.isFinite) || Math.abs(place.coordinates[0]) > 180 || Math.abs(place.coordinates[1]) > 90) return null
  const [lon, lat] = place.coordinates, [otherLon, otherLat] = demoStore.coordinates
  const radians = (n: number) => n * Math.PI / 180
  const h = Math.sin(radians(otherLat - lat) / 2) ** 2 + Math.cos(radians(lat)) * Math.cos(radians(otherLat)) * Math.sin(radians(otherLon - lon) / 2) ** 2
  const distanceM = 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
  if (distanceM <= 0 || distanceM > 5000) return null
  const items = purchase.items.flatMap((item, index) => {
    const price = demoStore.prices.find(p => p.productId === record.demoProductIds?.[index])
    if (!price || item.unit !== price.unit || item.label.en !== price.label.en || item.label.he !== price.label.he || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) return []
    const unitMinor = minorAmount(String(item.unitPrice), 'ILS')
    const paidMinor = minorAmount(String(item.lineTotal), 'ILS', true)
    const comparedMinor = price.unitMinor * item.quantity
    if (unitMinor === null || paidMinor === null || !Number.isSafeInteger(item.discountMinor ?? 0) || (item.discountMinor ?? 0) < 0 || unitMinor * item.quantity - (item.discountMinor ?? 0) !== paidMinor || !Number.isSafeInteger(comparedMinor)) return []
    return [{ productId: price.productId, label: price.label, quantity: item.quantity, paidMinor, comparedMinor }]
  })
  // Duplicate product identities are ambiguous, not an invitation to double count.
  if (!items.length || new Set(items.map(i => i.productId)).size !== items.length) return null
  const paidMinor = items.reduce((sum, i) => sum + i.paidMinor, 0)
  const comparedMinor = items.reduce((sum, i) => sum + i.comparedMinor, 0)
  if (!Number.isSafeInteger(paidMinor) || !Number.isSafeInteger(comparedMinor) || paidMinor <= comparedMinor) return null
  return { purchaseId: purchase.id, timestamp: purchase.timestamp, purchaseAmount: purchase.originalAmount, place, store: demoStore.name, distanceM: Math.round(distanceM), items, itemCount: purchase.items.length, paidMinor, comparedMinor, savingMinor: paidMinor - comparedMinor }
}

export type DemoComparison = NonNullable<ReturnType<typeof demoComparison>>
