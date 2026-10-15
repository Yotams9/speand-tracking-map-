// Test-only fictional products/stores. Not imported by application code.
import type { GlobePurchase, Place } from '../src/data/spendscape-globe'
import type { PriceSnapshot } from '../src/features/nearby-prices/price-contract'

export const fictionalTime = '2026-10-11T12:00:00.000Z'
export function fictionalSnapshot(point: [number, number] = [12, 45], now = fictionalTime): PriceSnapshot {
  return { version: 1, classification: 'fictional', source: { id: 'fictional-source', label: 'FICTIONAL QA prices', hash: 'a'.repeat(64), publishedAt: now, fetchedAt: now, currency: 'ILS', currencyEvidence: 'fictional-test-only', coverage: 'complete' },
    products: Array.from({ length: 5 }, (_, i) => ({ id: `fictional-product-${i}`, label: { en: `Fictional product ${i + 1}`, he: `מוצר בדוי ${i + 1}` }, brand: 'Fictional Cedar', variant: i === 1 ? 'Original cookies' : 'Original', package: { quantity: i === 2 ? 1000 : 250, unit: i === 2 ? 'ml' as const : 'g' as const, count: 1 }, gtin: null })),
    stores: [0, 1].map(i => ({ id: `fictional-store-${i}`, retailerId: 'fictional-retailer', label: { en: `Fictional store ${i + 1}`, he: `חנות בדיונית ${i + 1}` }, coordinates: [point[0] + .005 * (i + 1), point[1]] as [number, number], coordinateEvidence: 'fictional-test-only' })),
    prices: [0, 1].flatMap(store => Array.from({ length: store === 0 ? 5 : 2 }, (_, i) => ({ storeId: `fictional-store-${store}`, productId: `fictional-product-${i}`, unitMinor: (i + 1) * 100 + store * 50, basis: 'package' as const }))) }
}
export function fictionalPurchase(): GlobePurchase {
  return { id: 'fictional-purchase', merchantId: 'fictional-merchant', timestamp: '2013-09-30T11:57:00.000Z', channel: 'physical', resolution: 'confirmed', paymentMode: 'unknown', placeId: 'fictional-origin', category: 'unknown', originalAmount: 31.50, originalCurrency: 'ILS', provenance: 'user-reviewed-session', fx: { baseCurrency: 'ILS', rateToBase: 1, effectiveAt: '2013-09-30T11:57:00.000Z', source: 'identity', label: { en: 'Identity', he: 'זהות' } }, evidenceIds: [], items: [1, 1, 2, 1, 2].map((q, i) => ({ id: `fictional-item-${i}`, label: { en: `Fictional receipt row ${i + 1}`, he: `שורת קבלה בדויה ${i + 1}` }, quantity: q, unit: 'item', unitPrice: [4, 10, 3, 5.45, 3][i], lineTotal: [4, 10, 6, 5.45, 6][i] })) }
}
export const fictionalOrigin: Place = { id: 'fictional-origin', merchantId: 'fictional-merchant', name: { en: 'Fictional shop', he: 'חנות בדויה' }, branch: { en: 'Fictional origin', he: 'מקום בדוי' }, city: { en: 'Fictional city', he: 'עיר בדויה' }, country: { en: 'Fictional country', he: 'ארץ בדויה' }, coordinates: [12, 45], category: 'unknown' }
