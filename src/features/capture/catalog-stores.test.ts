import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData } from '../../data/spendscape-fixtures'
import { buildPlaceFeatureCollection } from '../../data/spendscape-globe'
import type { CatalogStoreSummary } from '../../data/price-catalog'
import { catalogChoice, catalogIdForPlace, distanceMeters, followLineEdit, followPublishedPrice, isLocated, restoredStore, setAsideStore, localInputToUtc, nearestCatalogStore, utcToLocalInput, withNowIfEmpty, withPublishedPrice } from './catalog-stores'
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

describe('published price follows the chosen store', () => {
  const line = (input: PurchaseReviewInput, patch: Partial<PurchaseReviewInput['lines'][number]>) => ({ ...input, lines: [{ ...input.lines[0], ...patch }] })
  const atA = (quantity = '') => followPublishedPrice(line(base(), { quantity }), 'shufersal-1', null)
  it('switching from branch A to branch B updates the automatic price and total', () => {
    const a = atA()
    expect(a.input.lines[0]).toMatchObject({ price: '8.50', quantity: '1' }); expect(a.input.amount).toBe('8.50')
    expect(a.fill).toEqual({ storeId: 'shufersal-1', price: '8.50', amount: '8.50' })
    const b = followPublishedPrice(a.input, 'ramilevi-733', a.fill)
    expect(b.input.lines[0].price).toBe('8.20'); expect(b.input.amount).toBe('8.20')
    expect(b.fill).toEqual({ storeId: 'ramilevi-733', price: '8.20', amount: '8.20' })
    const three = followPublishedPrice(atA('3').input, 'ramilevi-733', atA('3').fill)
    expect(three.input.amount).toBe('24.60')
  })
  it('a price typed after the fill is kept on a store change', () => {
    const a = atA()
    const typed = followLineEdit(line(a.input, { price: '7.00' }), a.fill)
    const b = followPublishedPrice(typed.input, 'ramilevi-733', typed.fill)
    expect(b.input.lines[0].price).toBe('7.00')
    // The total was still automatic, so it already follows the typed price.
    expect(b.input.amount).toBe('7.00')
    expect(b.fill?.price).toBe('')
  })
  it('a total typed after the fill is kept while the automatic price follows the store', () => {
    const a = atA()
    const b = followPublishedPrice({ ...a.input, amount: '9.00' }, 'ramilevi-733', a.fill)
    expect(b.input.lines[0].price).toBe('8.20'); expect(b.input.amount).toBe('9.00')
    expect(b.fill).toEqual({ storeId: 'ramilevi-733', price: '8.20', amount: '' })
    // and a later quantity change leaves the typed total alone.
    expect(followLineEdit(line(b.input, { quantity: '2' }), b.fill).input.amount).toBe('9.00')
  })
  it('a quantity change recomputes only an automatic total', () => {
    const a = atA()
    const more = followLineEdit(line(a.input, { quantity: '3' }), a.fill)
    expect(more.input.amount).toBe('25.50'); expect(more.fill?.amount).toBe('25.50')
    expect(followLineEdit({ ...line(a.input, { quantity: '3' }), amount: '30.00' }, a.fill).input.amount).toBe('30.00')
    // Text that is not yet a quantity changes nothing until it is one.
    expect(followLineEdit(line(a.input, { quantity: '3.' }), a.fill).input.amount).toBe('8.50')
    expect(followLineEdit(line(a.input, { quantity: '3' }), null).input.amount).toBe('8.50')
  })
  it('a store without a published price clears only the automatic values', () => {
    const a = atA()
    for (const storeId of ['osherad-24', null]) {
      const cleared = followPublishedPrice(a.input, storeId, a.fill)
      expect(cleared.input.lines[0]).toMatchObject({ price: '', quantity: '1' }); expect(cleared.input.amount).toBe('')
      expect(cleared.fill).toBeNull()
    }
    expect(followPublishedPrice({ ...a.input, amount: '9.00' }, 'osherad-24', a.fill).input).toMatchObject({ amount: '9.00', lines: [{ price: '' }] })
    const typed = line(a.input, { price: '7.00' })
    expect(followPublishedPrice(typed, 'osherad-24', a.fill).input).toBe(typed)
  })
  it('works in exact agorot: 3 × 7.90 = 23.70', () => {
    const priced = { ...base(), catalogPrices: { 'shufersal-2': 7.9 } }
    expect(followPublishedPrice(line(priced, { quantity: '3' }), 'shufersal-2', null).input.amount).toBe('23.70')
    const one = followPublishedPrice(priced, 'shufersal-2', null)
    expect(followLineEdit(line(one.input, { quantity: '3' }), one.fill).input.amount).toBe('23.70')
    expect(followLineEdit(line(one.input, { quantity: '0.333', unit: 'kg' }), one.fill).input.amount).toBe('2.63')
  })
  it('leaves other currencies and multi-item forms as they are, and adds nothing to the purchase', () => {
    const a = atA()
    const usd = { ...a.input, currency: 'USD' as const }
    expect(followPublishedPrice(usd, 'ramilevi-733', a.fill)).toEqual({ input: usd, fill: a.fill })
    const two = { ...a.input, lines: [...a.input.lines, ...a.input.lines] }
    expect(followPublishedPrice(two, 'ramilevi-733', a.fill)).toEqual({ input: two, fill: a.fill })
    expect(followLineEdit(two, a.fill).input).toBe(two)
    // The fill record is returned beside the form values, never inside them.
    expect(Object.keys(followPublishedPrice(a.input, 'ramilevi-733', a.fill).input)).toEqual(Object.keys(a.input))
  })
})

describe('a new store the person was typing survives a store choice', () => {
  const typed = { merchant: { name: 'Fictional corner', category: 'groceries' as const, separate: false }, place: { branch: 'Fictional branch', city: 'Fictional city', country: 'Fictional country', address: 'Fictional street 1', longitude: '34.75', latitude: '32.10', confirmed: true, separate: false } }
  const catalogIntent = { catalogStore: catalogChoice(located(1)) }
  it('is set aside when a catalog branch or saved place replaces it, and kept across further choices', () => {
    const aside = { directoryIntent: typed, merchantId: '' }
    expect(setAsideStore({ directoryIntent: typed, merchantId: '' })).toEqual(aside)
    // A later catalog choice keeps what was set aside first.
    expect(setAsideStore({ directoryIntent: catalogIntent, merchantId: '', setAside: aside })).toEqual(aside)
    expect(setAsideStore({ directoryIntent: undefined, merchantId: 'merchant_x', setAside: aside })).toEqual(aside)
    // A catalog choice itself is never set aside.
    expect(setAsideStore({ directoryIntent: catalogIntent, merchantId: '' })).toBeUndefined()
  })
  it('comes back with every typed detail, but the place must be confirmed again', () => {
    const back = restoredStore(setAsideStore({ directoryIntent: typed, merchantId: '' }))
    expect(back).toEqual({ merchantId: '', directoryIntent: { ...typed, place: { ...typed.place, confirmed: false } } })
    expect(restoredStore(undefined)).toBeUndefined()
    // Nothing is changed in place.
    expect(typed.place.confirmed).toBe(true)
  })
  it('a new branch of an existing store comes back with that store', () => {
    const branch = { place: typed.place }
    const aside = setAsideStore({ directoryIntent: branch, merchantId: 'merchant_nomi' })
    expect(aside).toEqual({ directoryIntent: branch, merchantId: 'merchant_nomi' })
    expect(restoredStore(aside)).toEqual({ merchantId: 'merchant_nomi', directoryIntent: { place: { ...typed.place, confirmed: false } } })
    // A place without any store is never brought back half-made.
    expect(restoredStore({ directoryIntent: branch, merchantId: '' })).toBeUndefined()
  })
  it('without a physical channel only the typed store comes back, never a place', () => {
    const aside = setAsideStore({ directoryIntent: typed, merchantId: '' })
    expect(restoredStore(aside, false)).toEqual({ merchantId: '', directoryIntent: { merchant: typed.merchant } })
    expect(restoredStore({ directoryIntent: { place: typed.place }, merchantId: 'merchant_nomi' }, false)).toBeUndefined()
  })
})

describe('the currency set by a published price', () => {
  it('goes back to unchosen with the automatic values; one the person chose stays', () => {
    const unset = { ...base(), currency: '' as const }
    const a = followPublishedPrice(unset, 'shufersal-1', null)
    expect(a.input.currency).toBe('ILS'); expect(a.fill).toMatchObject({ currencySet: true })
    const b = followPublishedPrice(a.input, 'ramilevi-733', a.fill)
    expect(b.fill).toMatchObject({ currencySet: true })
    const cleared = followPublishedPrice(b.input, null, b.fill)
    expect(cleared.input).toMatchObject({ currency: '', amount: '', lines: [{ price: '' }] })
    // Chosen by the person before the fill: kept.
    const chosen = followPublishedPrice(base(), 'shufersal-1', null)
    expect(chosen.fill).not.toHaveProperty('currencySet')
    expect(followPublishedPrice(chosen.input, null, chosen.fill).input.currency).toBe('ILS')
    // A typed price and total keep the currency too.
    expect(followPublishedPrice({ ...a.input, amount: '9.00', lines: [{ ...a.input.lines[0], price: '9.00' }] }, null, a.fill).input.currency).toBe('ILS')
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
