import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData as data } from '../../data/spendscape-fixtures'
import { buildPlaceFeatureCollection } from '../../data/spendscape-globe'
import { demoDraftForSource } from '../capture/capture-domain'
import { emptySessionLedger, expireSessionPurchaseUndo, resetSessionPurchases, reviewFromDemo, reviewedRecord, saveReviewedPurchase, undoSessionPurchase } from '../capture/session-purchase-domain'
import { demoComparison } from './comparison'

const input = (locale: 'en' | 'he' = 'en') => reviewFromDemo(demoDraftForSource('receipt')!, locale)
const record = () => reviewedRecord(input(), 1, data)
const compare = (r = record()) => demoComparison([r], r.purchase.id, null, data.places)

describe('synthetic nearby comparison', () => {
  it.each(['en', 'he'] as const)('preserves explicit demo identities and exact partial arithmetic: %s', locale => {
    const r = reviewedRecord(input(locale), 1, data)
    const result = compare(r)!
    expect(result).toMatchObject({ itemCount: 4, paidMinor: 4340, comparedMinor: 3790, savingMinor: 550 })
    expect(result.items.map(i => i.productId)).toEqual(['demo_sourdough', 'demo_tahini'])
    expect(result.distanceM).toBeGreaterThan(0)
    expect(result.distanceM).toBeLessThan(1000)
    expect(r.purchase.originalAmount).toBe(86.9)
  })
  it('computes quantities and decimal cents in integer units', () => {
    const r = record(); r.purchase.items[0].quantity = 3; r.purchase.items[0].lineTotal = 55.5
    expect(compare(r)).toMatchObject({ paidMinor: 8040, comparedMinor: 6990, savingMinor: 1050 })
    r.purchase.items[0].unitPrice = 16.01; r.purchase.items[0].lineTotal = 48.03
    expect(compare(r)).toMatchObject({ paidMinor: 7293, comparedMinor: 6990, savingMinor: 303 })
  })
  it('requires save and Undo expiry; Undo/reset/consumed operations cannot resurrect the card', () => {
    const saved = saveReviewedPurchase(emptySessionLedger(), 'demo', input(), data, data.purchases)
    const id = saved.ledger.undoId!
    expect(demoComparison([], id, null, data.places)).toBeNull()
    expect(demoComparison(saved.ledger.records, null, null, data.places)).toBeNull()
    expect(demoComparison(saved.ledger.records, id, id, data.places)).toBeNull()
    const expired = expireSessionPurchaseUndo(saved.ledger, id)
    expect(demoComparison(expired.records, id, expired.undoId, data.places)).not.toBeNull()
    const undone = undoSessionPurchase(saved.ledger)
    expect(demoComparison(undone.records, id, undone.undoId, data.places)).toBeNull()
    expect(saveReviewedPurchase(undone, 'demo', input(), data, data.purchases).result.code).toBe('consumed')
    expect(demoComparison(resetSessionPurchases(expired).records, id, null, data.places)).toBeNull()
    const newer = saveReviewedPurchase(saved.ledger, 'second', input(), data, data.purchases, true).ledger
    expect(expireSessionPurchaseUndo(newer, id)).toBe(newer)
    expect(demoComparison(newer.records, id, newer.undoId, data.places)).toBeNull()
  })
  it('suppresses nonreceipt, nonsynthetic, unconfirmed, unplaced, online and foreign currency records', () => {
    const r = record()
    for (const change of [{ originalCurrency: 'USD' }, { channel: 'online' }, { channel: 'unknown' }, { resolution: 'unresolved' }, { placeId: null }, { placeId: 'absent' }, { merchantId: 'wrong' }, { provenance: 'user-reviewed-session' }] as const) {
      expect(compare({ ...r, purchase: { ...r.purchase, ...change } })).toBeNull()
    }
    expect(compare({ ...r, source: 'barcode' })).toBeNull()
    expect(compare({ ...r, synthetic: false })).toBeNull()
  })
  it('does not match names without explicit identity, edited names, changed units or ambiguous identities', () => {
    const r = record()
    expect(compare({ ...r, demoProductIds: undefined })).toBeNull()
    expect(compare({ ...r, demoProductIds: ['unknown'] })).toBeNull()
    const edited = input(); edited.lines[0].name = 'Different loaf'
    const result = compare(reviewedRecord(edited, 1, data))!
    expect(result.items.map(i => i.productId)).toEqual(['demo_tahini'])
    const changed = record(); changed.purchase.items.forEach(i => { i.unit = 'kg' })
    expect(compare(changed)).toBeNull()
    const duplicate = record(); duplicate.purchase.items.push({ ...duplicate.purchase.items[0] }); duplicate.demoProductIds = [...duplicate.demoProductIds!, 'demo_sourdough']
    expect(compare(duplicate)).toBeNull()
  })
  it('requires positive savings and valid matched line arithmetic', () => {
    const r = record()
    r.purchase.items[0].unitPrice = r.purchase.items[0].lineTotal = 16
    r.purchase.items[2].unitPrice = r.purchase.items[2].lineTotal = 21.9
    expect(compare(r)).toBeNull()
    r.purchase.items[0].unitPrice = r.purchase.items[0].lineTotal = 15
    expect(compare(r)).toBeNull()
    for (const i of [0, 2]) r.purchase.items[i].lineTotal = NaN
    expect(compare(r)).toBeNull()
  })
  it('reads the injected purchase place and never adds a comparison pin', () => {
    const r = record(), before = JSON.stringify(data)
    const places = data.places.map(p => ({ ...p, coordinates: [...p.coordinates] as [number, number] }))
    const place = places.find(p => p.id === r.purchase.placeId)!
    const original = compare(r)!
    place.coordinates[0] += .001
    expect(demoComparison([r], r.purchase.id, null, places)!.distanceM).not.toBe(original.distanceM)
    place.coordinates = [0, 0]
    expect(demoComparison([r], r.purchase.id, null, places)).toBeNull()
    expect(data.purchases).toHaveLength(42); expect(data.places).toHaveLength(12)
    expect(buildPlaceFeatureCollection(data.places, [...data.purchases, r.purchase]).features).toHaveLength(12)
    expect(JSON.stringify(data)).toBe(before)
  })
})
