import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData } from '../../data/spendscape-fixtures'
import { buildPlaceFeatureCollection } from '../../data/spendscape-globe'
import type { CatalogStoreSummary } from '../../data/price-catalog'
import { catalogChoice, catalogIdForPlace, distanceMeters, isLocated, localInputToUtc, nearestCatalogStore, utcToLocalInput, withNowIfEmpty, withPublishedPrice } from './catalog-stores'
import { blankReview, deleteLocalPurchase, emptySessionLedger, saveReviewedPurchase, validateReview, type PurchaseReviewInput, type ReviewContext } from './session-purchase-domain'
import { composeDirectory } from '../local-purchases/local-directory'

const store = (id: string, chain: CatalogStoreSummary['chain'], name: string, lat: number | null, lon = 34.77): CatalogStoreSummary => ({
  id, chain, chainName: { en: chain, he: chain === 'ramilevi' ? 'רמי לוי' : 'שופרסל' }, name, address: 'Synthetic 1',
  location: lat === null ? null : { lat, lon, osm: 'node/1', accuracy: 'address point' },
})
const stores = [store('shufersal-1', 'shufersal', 'Ben Yehuda', 32.0814), store('ramilevi-733', 'ramilevi', 'Ben Yehuda 23', 32.0763), store('shufersal-9', 'shufersal', 'Unlocated', null)]
const fixtures: ReviewContext = canonicalSpendscapeData
const base = (): PurchaseReviewInput => ({ ...blankReview(), source: 'barcode', provenance: 'user-reviewed', channel: 'physical', date: '2026-10-04T09:15', currency: 'ILS', payment: 'card', category: 'groceries', amount: '', lines: [{ name: 'Synthetic cola 1.5 L', quantity: '', price: '', unit: 'item' }], catalogPrices: { 'shufersal-1': 8.5, 'ramilevi-733': 8.2 } })
const located = (index: number) => { const s = stores[index]; if (!isLocated(s)) throw new Error('fixture'); return s }

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
})

describe('chain store purchases', () => {
  // A chosen chain branch is a directory intent; the reviewed save turns it into a
  // confirmed place with the catalog store ID and published address as provenance.
  const chosen = (index = 0, date = '2026-10-04T09:15') => ({ ...withPublishedPrice({ ...base(), date }, stores[index].id), directoryIntent: { catalogStore: catalogChoice(located(index)) } })
  it('requires a valid located chain store on a physical purchase', () => {
    expect(validateReview(chosen(), fixtures)).toEqual({})
    expect(validateReview({ ...chosen(), channel: 'online' }, fixtures)).toHaveProperty('placeId')
    expect(validateReview({ ...chosen(), directoryIntent: { catalogStore: { ...catalogChoice(located(0)), id: 'ramilevi-1' } } }, fixtures)).toHaveProperty('directory')
    expect(validateReview({ ...chosen(), directoryIntent: { catalogStore: { ...catalogChoice(located(0)), coordinates: [34.77, 132] } } }, fixtures)).toHaveProperty('directory')
    expect(validateReview({ ...chosen(), directoryIntent: { catalogStore: catalogChoice(located(0)), merchant: { name: 'Both', category: 'groceries', separate: false } } }, fixtures)).toHaveProperty('directory')
  })
  it('creates one chain merchant and one store place, reused by a second purchase', () => {
    const first = saveReviewedPurchase(emptySessionLedger(), 'op-1', chosen(), fixtures, canonicalSpendscapeData.purchases)
    expect(first.result.code).toBe('saved')
    expect(first.ledger.directory.merchants).toEqual([{ id: 'local_merchant_1', name: { en: 'Shufersal', he: 'שופרסל' }, category: 'groceries', source: 'user-confirmed', catalogChain: 'shufersal' }])
    expect(first.ledger.directory.places).toMatchObject([{ id: 'local_place_1', merchantId: 'local_merchant_1', branch: { en: 'Ben Yehuda', he: 'Ben Yehuda' }, coordinates: [34.77, 32.0814], address: 'Synthetic 1', source: 'user-confirmed', locationMethod: 'catalog-store', catalogStore: { storeId: 'shufersal-1', chain: 'shufersal', publishedAddress: 'Synthetic 1' } }])
    expect(first.ledger.records[0].purchase).toMatchObject({ merchantId: 'local_merchant_1', placeId: 'local_place_1', originalAmount: 8.5 })
    const second = saveReviewedPurchase(first.ledger, 'op-2', chosen(0, '2026-10-05T09:15'), composeDirectory(fixtures, first.ledger.directory), canonicalSpendscapeData.purchases)
    expect(second.result.code).toBe('saved')
    expect(second.ledger.directory).toEqual(first.ledger.directory)
    const pins = buildPlaceFeatureCollection(composeDirectory(fixtures, second.ledger.directory).places, second.ledger.records.map(record => record.purchase)).features
    expect(pins.map(pin => [pin.properties.placeId, pin.properties.visitCount])).toEqual([['local_place_1', 2]])
    // A saved chain place is found again by its catalog store ID.
    expect(catalogIdForPlace(second.ledger.directory.places[0])).toBe('shufersal-1')
    expect(catalogIdForPlace(fixtures.places[0])).toBeNull()
    // Removed with its last purchase.
    const emptied = deleteLocalPurchase(deleteLocalPurchase(second.ledger, 'session_purchase_barcode_01'), 'session_purchase_barcode_02')
    expect(emptied.directory).toEqual({ merchants: [], places: [] })
  })
  it('a second branch of the same chain reuses the chain merchant', () => {
    const first = saveReviewedPurchase(emptySessionLedger(), 'op-1', chosen(), fixtures, canonicalSpendscapeData.purchases)
    const other = { ...store('shufersal-2', 'shufersal', 'Dizengoff', 32.08), address: 'Synthetic 2' }
    if (!isLocated(other)) throw new Error('fixture')
    const second = saveReviewedPurchase(first.ledger, 'op-2', { ...base(), lines: [{ name: 'Item', quantity: '1', unit: 'item', price: '3.00' }], amount: '3.00', directoryIntent: { catalogStore: catalogChoice(other) } }, composeDirectory(fixtures, first.ledger.directory), canonicalSpendscapeData.purchases)
    expect(second.result.code).toBe('saved')
    expect(second.ledger.directory.merchants).toHaveLength(1)
    expect(second.ledger.directory.places.map(place => [place.id, place.merchantId, place.catalogStore?.storeId])).toEqual([['local_place_1', 'local_merchant_1', 'shufersal-1'], ['local_place_2', 'local_merchant_1', 'shufersal-2']])
  })
})
describe('date defaults for a chosen chain store', () => {
  const now = new Date('2026-10-09T20:41:37.000Z')
  it('fills an empty date with the current minute', () => {
    expect(withNowIfEmpty({ ...base(), date: '' }, now).date).toBe('2026-10-09T20:41')
  })
  it('never replaces a date the user typed', () => {
    expect(withNowIfEmpty(base(), now).date).toBe('2026-10-04T09:15')
  })
  it('shows stored UTC minutes in local time and stores local input as UTC', () => {
    const local = utcToLocalInput('2026-10-09T20:41')
    const expected = new Date('2026-10-09T20:41:00Z')
    expect(new Date(local).getTime()).toBe(expected.getTime())
    expect(localInputToUtc(local)).toBe('2026-10-09T20:41')
    expect(localInputToUtc(utcToLocalInput('2026-03-27T00:30'))).toBe('2026-03-27T00:30')
  })
  it('passes empty and partial text through unchanged', () => {
    expect(utcToLocalInput('')).toBe('')
    expect(localInputToUtc('')).toBe('')
    expect(localInputToUtc('2026-10-0')).toBe('2026-10-0')
  })
})
