import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData } from '../../data/spendscape-fixtures'
import { buildPlaceFeatureCollection } from '../../data/spendscape-globe'
import type { CatalogStoreSummary } from '../../data/price-catalog'
import { catalogChoice, catalogIdForPlace, distanceMeters, isLocated, nearestCatalogStore, withPublishedPrice } from './catalog-stores'
import { blankReview, catalogPlaceId, emptySessionLedger, removeSessionPurchase, saveReviewedPurchase, validateReview, type PurchaseReviewInput, type ReviewContext, type SessionPurchaseLedger } from './session-purchase-domain'
import { restoreSessionLedger, serializeSessionLedger } from './session-purchase-storage'

const store = (id: string, chain: CatalogStoreSummary['chain'], name: string, lat: number | null, lon = 34.77): CatalogStoreSummary => ({
  id, chain, chainName: { en: chain, he: chain === 'ramilevi' ? 'רמי לוי' : 'שופרסל' }, name, address: 'Synthetic 1',
  location: lat === null ? null : { lat, lon, osm: 'node/1', accuracy: 'address point' },
})
const stores = [store('shufersal-1', 'shufersal', 'Ben Yehuda', 32.0814), store('ramilevi-733', 'ramilevi', 'Ben Yehuda 23', 32.0763), store('shufersal-9', 'shufersal', 'Unlocated', null)]
const fixtures: ReviewContext = canonicalSpendscapeData
const base = (): PurchaseReviewInput => ({ ...blankReview(), source: 'barcode', provenance: 'user-reviewed', channel: 'physical', date: '2026-10-04T09:15', currency: 'ILS', payment: 'card', category: 'groceries', amount: '', lines: [{ name: 'Synthetic cola 1.5 L', quantity: '', price: '', unit: 'item' }], catalogPrices: { 'shufersal-1': 8.5, 'ramilevi-733': 8.2 } })
const located = (index: number) => { const s = stores[index]; if (!isLocated(s)) throw new Error('fixture'); return s }
const contextOf = (ledger: SessionPurchaseLedger): ReviewContext => ({ merchants: [...fixtures.merchants, ...ledger.merchants], places: [...fixtures.places, ...ledger.places] })

describe('nearest catalog store', () => {
  it('measures straight-line distance', () => {
    expect(distanceMeters([34.77, 32.08], [34.77, 32.08])).toBe(0)
    expect(distanceMeters([34.77, 32.08], [34.77, 32.09])).toBeCloseTo(1112, -1)
  })
  it('suggests the closest located store within 200 m only', () => {
    expect(nearestCatalogStore(stores, [34.77, 32.0812])).toMatchObject({ store: { id: 'shufersal-1' } })
    expect(nearestCatalogStore(stores, [34.77, 32.0766])?.store.id).toBe('ramilevi-733')
    expect(nearestCatalogStore(stores, [34.77, 32.0790])).toBeNull()
    expect(nearestCatalogStore([stores[2]], [34.77, 32.0814])).toBeNull()
  })
})

describe('published price fill', () => {
  it('fills an empty single item with the chosen store price and a matching total', () => {
    const filled = withPublishedPrice(base(), 'ramilevi-733')
    expect(filled.lines[0]).toMatchObject({ price: '8.20', quantity: '1' })
    expect(filled.amount).toBe('8.20')
    expect(withPublishedPrice({ ...base(), lines: [{ ...base().lines[0], quantity: '3' }] }, 'shufersal-1')).toMatchObject({ amount: '25.50' })
  })
  it('never overwrites what the user typed or guesses for other cases', () => {
    const typed = { ...base(), lines: [{ ...base().lines[0], price: '7.00' }] }
    expect(withPublishedPrice(typed, 'shufersal-1')).toBe(typed)
    expect(withPublishedPrice(base(), 'osherad-24')).toEqual(base())
    expect(withPublishedPrice({ ...base(), currency: 'USD' }, 'shufersal-1').lines[0].price).toBe('')
    expect(withPublishedPrice({ ...base(), lines: [...base().lines, ...base().lines] }, 'shufersal-1').lines[0].price).toBe('')
    expect(withPublishedPrice({ ...base(), amount: '20.00' }, 'shufersal-1').amount).toBe('20.00')
  })
  it('maps chain places back to catalog store IDs', () => {
    expect(catalogIdForPlace(catalogPlaceId('shufersal-117'))).toBe('shufersal-117')
    expect(catalogIdForPlace('place_shuk_bograshov')).toBeNull()
  })
})

describe('chain store purchases', () => {
  it('requires a valid located chain store on a physical purchase', () => {
    const chosen = { ...withPublishedPrice(base(), 'shufersal-1'), catalogStore: catalogChoice(located(0)) }
    expect(validateReview(chosen, fixtures)).toEqual({})
    expect(validateReview({ ...chosen, channel: 'online' }, fixtures)).toHaveProperty('placeId')
    expect(validateReview({ ...chosen, catalogStore: { ...chosen.catalogStore, id: 'ramilevi-1' } }, fixtures)).toHaveProperty('placeId')
    expect(validateReview({ ...chosen, catalogStore: { ...chosen.catalogStore, coordinates: [34.77, 132] } }, fixtures)).toHaveProperty('placeId')
    expect(validateReview({ ...chosen, newStore: { name: 'Both', coordinates: null } }, fixtures)).toHaveProperty('placeId')
  })
  it('creates one chain merchant and one store place, reused by a second purchase', () => {
    const first = saveReviewedPurchase(emptySessionLedger(), 'op-1', { ...withPublishedPrice(base(), 'shufersal-1'), catalogStore: catalogChoice(located(0)) }, fixtures, canonicalSpendscapeData.purchases)
    expect(first.result.code).toBe('saved')
    expect(first.ledger.merchants).toEqual([{ id: 'chain_shufersal', name: { en: 'shufersal', he: 'שופרסל' }, category: 'groceries' }])
    expect(first.ledger.places).toMatchObject([{ id: 'store_shufersal_1', merchantId: 'chain_shufersal', branch: { he: 'Ben Yehuda' }, coordinates: [34.77, 32.0814] }])
    expect(first.ledger.records[0].purchase).toMatchObject({ merchantId: 'chain_shufersal', placeId: 'store_shufersal_1', originalAmount: 8.5 })
    const second = saveReviewedPurchase(first.ledger, 'op-2', { ...withPublishedPrice({ ...base(), date: '2026-10-05T09:15' }, 'shufersal-1'), catalogStore: catalogChoice(located(0)) }, contextOf(first.ledger), canonicalSpendscapeData.purchases)
    expect(second.ledger.merchants).toHaveLength(1)
    expect(second.ledger.places).toHaveLength(1)
    const pins = buildPlaceFeatureCollection(contextOf(second.ledger).places, second.ledger.records.map(record => record.purchase)).features
    expect(pins.map(pin => [pin.properties.placeId, pin.properties.visitCount])).toEqual([['store_shufersal_1', 2]])
    // Stored and restored, then removed with its last purchase.
    const restored = restoreSessionLedger(serializeSessionLedger(second.ledger), fixtures)
    expect(restored).toMatchObject({ merchants: second.ledger.merchants, places: second.ledger.places, records: second.ledger.records })
    const emptied = removeSessionPurchase(removeSessionPurchase(restored, 'session_purchase_barcode_01'), 'session_purchase_barcode_02')
    expect(emptied).toMatchObject({ records: [], merchants: [], places: [] })
  })
})
