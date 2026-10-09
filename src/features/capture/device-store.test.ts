import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData } from '../../data/spendscape-fixtures'
import { buildPlaceFeatureCollection } from '../../data/spendscape-globe'
import { blankReview, emptySessionLedger, removeSessionPurchase, resetSessionPurchases, saveReviewedPurchase, undoSessionPurchase, validateReview, type PurchaseReviewInput, type ReviewContext, type SessionPurchaseLedger } from './session-purchase-domain'
import { restoreSessionLedger, serializeSessionLedger } from './session-purchase-storage'

const fixtures: ReviewContext = canonicalSpendscapeData
const telAviv: [number, number] = [34.7818, 32.0853]
const base = (amount = '12.50'): PurchaseReviewInput => ({ ...blankReview(), channel: 'physical', date: '2026-10-02T09:15', currency: 'ILS', payment: 'cash', category: 'groceries', amount })
const pinned = (name: string, amount?: string): PurchaseReviewInput => ({ ...base(amount), newStore: { name, coordinates: telAviv } })
const contextOf = (ledger: SessionPurchaseLedger): ReviewContext => ({ merchants: [...fixtures.merchants, ...ledger.merchants], places: [...fixtures.places, ...ledger.places] })
const add = (ledger: SessionPurchaseLedger, operationId: string, input: PurchaseReviewInput) => {
  const saved = saveReviewedPurchase(ledger, operationId, input, contextOf(ledger), canonicalSpendscapeData.purchases)
  expect(saved.result.code).toBe('saved')
  return saved.ledger
}

describe('stores added by the user', () => {
  it('requires a name, a unique name and an explicit location for a pinned place', () => {
    expect(validateReview({ ...base(), newStore: { name: '  ', coordinates: telAviv } }, fixtures)).toEqual({ newStoreName: 'required' })
    expect(validateReview({ ...base(), newStore: { name: 'x'.repeat(61), coordinates: telAviv } }, fixtures)).toEqual({ newStoreName: 'required' })
    expect(validateReview({ ...base(), newStore: { name: `  ${fixtures.merchants[0].name.en.toUpperCase()} `, coordinates: telAviv } }, fixtures)).toEqual({ newStoreName: 'storeExists' })
    expect(validateReview({ ...base(), newStore: { name: 'Corner grocery', coordinates: null } }, fixtures)).toEqual({ newStoreLocation: 'location' })
    expect(validateReview({ ...base(), newStore: { name: 'Corner grocery', coordinates: [34.78, 132] } }, fixtures)).toEqual({ newStoreLocation: 'location' })
    expect(validateReview({ ...base(), newStore: { name: 'Corner grocery', coordinates: [Number.NaN, 32] } }, fixtures)).toEqual({ newStoreLocation: 'location' })
    expect(validateReview({ ...base(), merchantId: fixtures.merchants[0].id, newStore: { name: 'Corner grocery', coordinates: telAviv } }, fixtures)).toHaveProperty('newStoreName')
    expect(validateReview(pinned('Corner grocery'), fixtures)).toEqual({})
  })
  it('needs no location for an online or unpinned new store', () => {
    for (const channel of ['online', 'unknown'] as const) expect(validateReview({ ...base(), channel, newStore: { name: 'Corner grocery', coordinates: null } }, fixtures)).toEqual({})
  })
  it('a pinned new store creates one merchant, one place and one map pin', () => {
    const ledger = add(emptySessionLedger(), 'op-1', pinned('  Corner   grocery '))
    expect(ledger.merchants).toEqual([{ id: 'device_merchant_01', name: { en: 'Corner grocery', he: 'Corner grocery' }, category: 'groceries' }])
    expect(ledger.places).toMatchObject([{ id: 'device_place_01', merchantId: 'device_merchant_01', coordinates: telAviv, category: 'groceries' }])
    expect(ledger.records[0].purchase).toMatchObject({ merchantId: 'device_merchant_01', placeId: 'device_place_01', channel: 'physical', resolution: 'confirmed', provenance: 'user-reviewed-session' })
    const pins = buildPlaceFeatureCollection(contextOf(ledger).places, ledger.records.map(record => record.purchase)).features
    expect(pins.map(pin => [pin.properties.placeId, pin.properties.visitCount, pin.geometry.coordinates])).toEqual([['device_place_01', 1, telAviv]])
  })
  it('online and unpinned new stores never create a place', () => {
    let ledger = add(emptySessionLedger(), 'op-1', { ...base(), channel: 'online', newStore: { name: 'Web shop', coordinates: telAviv } })
    ledger = add(ledger, 'op-2', { ...base(), channel: 'unknown', newStore: { name: 'Corner grocery', coordinates: telAviv } })
    expect(ledger.places).toEqual([])
    expect(ledger.merchants.map(merchant => [merchant.id, merchant.onlineOnly ?? false])).toEqual([['device_merchant_01', true], ['device_merchant_02', false]])
    expect(ledger.records.map(record => [record.purchase.placeId, record.purchase.resolution])).toEqual([[null, 'confirmed'], [null, 'unresolved']])
  })
  it('an added store can be chosen again and its pin counts both visits', () => {
    let ledger = add(emptySessionLedger(), 'op-1', pinned('Corner grocery'))
    expect(validateReview(pinned('corner grocery'), contextOf(ledger))).toEqual({ newStoreName: 'storeExists' })
    ledger = add(ledger, 'op-2', { ...base('30.00'), merchantId: 'device_merchant_01', placeId: 'device_place_01' })
    expect(ledger.merchants).toHaveLength(1)
    const pins = buildPlaceFeatureCollection(contextOf(ledger).places, ledger.records.map(record => record.purchase)).features
    expect(pins.map(pin => pin.properties.visitCount)).toEqual([2])
  })
  it('Undo, removal and reset drop a store once no purchase uses it', () => {
    const one = add(emptySessionLedger(), 'op-1', pinned('Corner grocery'))
    expect(undoSessionPurchase(one)).toMatchObject({ records: [], merchants: [], places: [], undoId: null })
    const two = add(one, 'op-2', { ...base('30.00'), merchantId: 'device_merchant_01', placeId: 'device_place_01' })
    const afterFirst = removeSessionPurchase(two, 'session_purchase_manual_01')
    expect(afterFirst.records.map(record => record.purchase.id)).toEqual(['session_purchase_manual_02'])
    expect(afterFirst.merchants).toHaveLength(1)
    expect(afterFirst.undoId).toBe('session_purchase_manual_02')
    expect(removeSessionPurchase(afterFirst, 'session_purchase_manual_02')).toMatchObject({ records: [], merchants: [], places: [], undoId: null })
    expect(removeSessionPurchase(two, 'missing')).toBe(two)
    expect(resetSessionPurchases(two)).toMatchObject({ records: [], merchants: [], places: [] })
  })
})

describe('stored stores', () => {
  const stored = (ledger: SessionPurchaseLedger) => JSON.parse(serializeSessionLedger(ledger))
  const restore = (value: unknown) => restoreSessionLedger(JSON.stringify(value), fixtures)
  it('round-trips added stores with their purchases', () => {
    let ledger = add(emptySessionLedger(), 'op-1', pinned('Corner grocery'))
    ledger = add(ledger, 'op-2', { ...base(), channel: 'online', newStore: { name: 'Web shop', coordinates: null } })
    const restored = restoreSessionLedger(serializeSessionLedger(ledger), fixtures)
    expect(restored).toMatchObject({ records: ledger.records, merchants: ledger.merchants, places: ledger.places, nextSequence: 3 })
  })
  it('reads storage written before stores existed', () => {
    const ledger = add(emptySessionLedger(), 'op-1', { ...base(), channel: 'online', merchantId: fixtures.merchants[0].id })
    const value = stored(ledger); delete value.merchants; delete value.places
    expect(restore(value)).toMatchObject({ records: ledger.records, merchants: [], places: [] })
  })
  it('drops a purchase whose store is missing or invalid, and a store no purchase uses', () => {
    const value = stored(add(emptySessionLedger(), 'op-1', pinned('Corner grocery')))
    const broken = (patch: (copy: any) => void) => { const copy = structuredClone(value); patch(copy); return restore(copy) }
    const empty = { records: [], merchants: [], places: [] }
    expect(broken(copy => { copy.merchants = [] })).toMatchObject(empty)
    expect(broken(copy => { copy.places = [] })).toMatchObject(empty)
    expect(broken(copy => { copy.places[0].coordinates = [34.78, 132] })).toMatchObject(empty)
    expect(broken(copy => { copy.places[0].merchantId = fixtures.merchants[0].id })).toMatchObject(empty)
    expect(broken(copy => { copy.merchants[0].name = { en: '', he: '' } })).toMatchObject(empty)
    expect(broken(copy => { copy.records = [] })).toMatchObject(empty)
  })
  it('cannot replace a snapshot merchant or place through storage', () => {
    const value = stored(add(emptySessionLedger(), 'op-1', pinned('Corner grocery')))
    value.merchants.push({ ...value.merchants[0], id: fixtures.merchants[0].id })
    value.places.push({ ...value.places[0], id: fixtures.places[0].id })
    const restored = restore(value)
    expect(restored.merchants.map(merchant => merchant.id)).toEqual(['device_merchant_01'])
    expect(restored.places.map(place => place.id)).toEqual(['device_place_01'])
  })
  it('keeps the sequence ahead of every kept store', () => {
    let ledger = add(emptySessionLedger(), 'op-1', { ...base(), channel: 'online', merchantId: fixtures.merchants[0].id })
    ledger = add(ledger, 'op-2', pinned('Corner grocery'))
    const value = stored(removeSessionPurchase(ledger, 'session_purchase_manual_01'))
    value.nextSequence = 1
    expect(restore(value).nextSequence).toBe(3)
  })
})
