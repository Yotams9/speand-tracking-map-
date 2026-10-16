import { describe, it, expect } from 'vitest'
import type { CatalogProduct, CatalogStoreSummary } from '../../data/price-catalog'
import { loadTelAvivCatalog, lookupInCatalog, catalogStoreSummaries } from '../../data/price-catalog'
import { fictionalPurchase, fictionalOrigin } from '../../../qa/nearby-preview-fixtures'
import { catalogReceiptComparison, validCatalogQuote } from './catalog-receipt-comparison'
const stores = [{ id: 'shufersal-1', chain: 'shufersal', chainName: { en: 'Fictional chain', he: 'רשת בדויה' }, name: 'Fictional shop', address: 'Fictional 1', location: { lon: 12, lat: 45.001, osm: 'node/1', accuracy: 'address point' } }, { id: 'shufersal-2', chain: 'shufersal', chainName: { en: 'Fictional chain', he: 'רשת בדויה' }, name: 'Distant shop', address: 'Fictional 2', location: { lon: 12, lat: 46, osm: 'node/2', accuracy: 'address point' } }] as CatalogStoreSummary[]
const product = { gtin14: '05060639129102', name: 'Fictional drink', manufacturer: 'Fictional brand', quantity: '500 ml', weighted: false, currency: 'ILS', prices: stores.map(store => ({ store: { ...store, publishedLocal: '2026-10-04 03:00' }, price: 4.2 })) } as CatalogProduct
const purchase = () => { const p = fictionalPurchase(); p.items = [{ ...p.items[0], quantity: 3, unit: 'item', lineTotal: 15 }]; p.originalAmount = 14; p.originalCurrency = 'ILS'; return p }
const run = (p = purchase(), pr = product, confirmed = true, shops = stores, radius = 5000) => catalogReceiptComparison(p, [fictionalOrigin], shops, { [p.items[0].id]: { product: pr, confirmed } }, radius)
describe('historical catalog receipt comparison', () => {
 it('uses only the purchase-owned confirmed pin and does not mutate any input', () => { const p = purchase(), before = structuredClone(p); expect(run(p).stores).toHaveLength(1); expect(p).toEqual(before); expect(run({ ...p, resolution: 'unresolved' }).state).toBe('location-unresolved'); expect(run({ ...p, merchantId: 'different' }).state).toBe('location-unresolved') })
 it('requires explicit product/package confirmation', () => { expect(run(purchase(), product, false).stores).toEqual([]); expect(run(purchase(), { ...product, quantity: '' }).stores).toEqual([]); expect(run(purchase(), { ...product, name: '' }).stores).toEqual([]); expect(run(purchase(), { ...product, manufacturer: '' }).stores).toHaveLength(1) })
 it('quotes quantities and compares complete coverage to independent final payable only as a historical difference', () => { const r = run().stores[0]; expect(r).toMatchObject({ totalMinor: 1260, complete: true, historicalDifferenceMinor: 140, matchedCount: 1 }); expect(r.rows[0].publishedLocal).toBe('2026-10-04 03:00') })
 it('does not promote partial coverage to a basket or savings', () => { const p = purchase(); p.items.push({ ...p.items[0], id: 'unmatched-row' }); const r = run(p).stores[0]; expect(r.complete).toBe(false); expect(r.historicalDifferenceMinor).toBeNull(); expect(r.matchedCount).toBe(1) })
 it('excludes unlocated or unsupported address points and validates radius', () => { expect(run(purchase(), product, true, [{ ...stores[0], location: null }]).stores).toEqual([]); expect(run(purchase(), product, true, [{ ...stores[0], location: { ...stores[0].location!, osm: '' } }]).stores).toEqual([]); expect(run(purchase(), product, true, stores, 9999).state).toBe('invalid-radius') })
 it('bounds the radius inclusively in meters and can widen to 10km', () => { const s = [{ ...stores[0], location: { ...stores[0].location!, lat: 45 + 6000 / 111195.0802335329 } }]; expect(run(purchase(), product, true, s).stores).toHaveLength(0); expect(run(purchase(), product, true, s, 10000).stores).toHaveLength(1) })
 it('rejects weighted/fractional quantity, foreign currency and non-cent prices', () => { for (const p of [{ ...purchase(), originalCurrency: 'USD' as const }, { ...purchase(), items: [{ ...purchase().items[0], unit: 'kg' as const }] }, { ...purchase(), items: [{ ...purchase().items[0], quantity: 1.5 }] }]) expect(run(p).stores).toEqual([]); expect(run(purchase(), { ...product, weighted: true }).stores).toEqual([]); expect(run(purchase(), { ...product, prices: [{ ...product.prices[0], price: 4.211 }] }).stores).toEqual([]) })
 it('validates product responses and retains archival publication time', () => { expect(validCatalogQuote(product)).toBe(true); expect(validCatalogQuote({ ...product, currency: 'USD' })).toBe(false); expect(validCatalogQuote({ ...product, prices: [{ ...product.prices[0], price: Infinity }] })).toBe(false) })
 it('compares the bundled Mango identity even when the optional manufacturer field is empty', async () => {
   const catalog = await loadTelAvivCatalog(), quote = lookupInCatalog(catalog, '05060639129102')!
   expect(quote.manufacturer).toBe(''); expect(validCatalogQuote(quote)).toBe(true)
   const shops = catalogStoreSummaries(catalog), shop = shops.find(s => s.location && quote.prices.some(p => p.store.id === s.id))!
   const origin = { ...fictionalOrigin, coordinates: [shop.location!.lon, shop.location!.lat] as [number, number] }, p = purchase()
   const result = catalogReceiptComparison(p, [origin], shops, { [p.items[0].id]: { product: quote, confirmed: true } })
   expect(result.state).toBe('reference-prices'); expect(result.stores.find(s => s.store.id === shop.id)).toMatchObject({ complete: true, matchedCount: 1, distanceM: 0 })
   expect(result.stores.every(s => s.rows[0].publishedLocal?.startsWith('2026-10-04'))).toBe(true)
 })
})
