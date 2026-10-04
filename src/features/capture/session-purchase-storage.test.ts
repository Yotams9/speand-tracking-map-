import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData } from '../../data/spendscape-fixtures'
import { demoDraftForSource } from './capture-domain'
import { validateBarcode } from './barcode-domain'
import { blankReview, emptySessionLedger, resetSessionPurchases, reviewFromDemo, saveReviewedPurchase, undoSessionPurchase, type PurchaseReviewInput, type SessionPurchaseLedger } from './session-purchase-domain'
import { restoreSessionLedger, serializeSessionLedger } from './session-purchase-storage'

const context = canonicalSpendscapeData
const manual = (amount = '12.50'): PurchaseReviewInput => ({ ...blankReview(), merchantId: context.merchants[0].id, channel: 'online', date: '2026-09-12T14:35', currency: 'ILS', payment: 'cash', category: 'retail', amount })
const add = (ledger: SessionPurchaseLedger, operationId: string, input: PurchaseReviewInput) => {
  const saved = saveReviewedPurchase(ledger, operationId, input, context, context.purchases)
  expect(saved.result.code).toBe('saved')
  return saved.ledger
}
const stored = (ledger: SessionPurchaseLedger) => JSON.parse(serializeSessionLedger(ledger))
const restore = (value: unknown) => restoreSessionLedger(JSON.stringify(value), context)

describe('device purchase storage', () => {
  it('round-trips reviewed, receipt and barcode records without session-only state', () => {
    const identity = validateBarcode('4006381333931', 'EAN13')
    if (!identity.valid) throw new Error('fixture barcode')
    const barcode: PurchaseReviewInput = { ...manual('9.90'), source: 'barcode', identification: { identity: identity.identity, method: 'manual', syntheticCatalog: false }, lines: [{ name: 'Marker', quantity: '1', unit: 'item', price: '9.90' }] }
    let ledger = add(emptySessionLedger(), 'op-1', manual())
    ledger = add(ledger, 'op-2', reviewFromDemo(demoDraftForSource('receipt')!, 'he'))
    ledger = add(ledger, 'op-3', barcode)
    const restored = restoreSessionLedger(serializeSessionLedger(ledger), context)
    expect(restored.records).toEqual(ledger.records)
    expect(restored).toMatchObject({ nextSequence: 4, consumed: [], undoId: null })
  })
  it('a restored ledger accepts a fresh operation with a new ID', () => {
    const restored = restoreSessionLedger(serializeSessionLedger(add(emptySessionLedger(), 'session_review_1', manual())), context)
    const next = add(restored, 'session_review_1', manual('13.00'))
    expect(next.records.map(record => record.purchase.id)).toEqual(['session_purchase_manual_01', 'session_purchase_manual_02'])
  })
  it('Undo and reset are reflected in the stored records', () => {
    const ledger = add(add(emptySessionLedger(), 'op-1', manual()), 'op-2', manual('13.00'))
    expect(stored(undoSessionPurchase(ledger)).records).toHaveLength(1)
    expect(stored(resetSessionPurchases(ledger))).toMatchObject({ records: [], nextSequence: 3 })
  })
  it('returns an empty ledger for missing, corrupt or unknown-version storage', () => {
    for (const raw of [null, '', '{', 'null', '[]', '"text"', JSON.stringify({ version: 2, records: [] }), JSON.stringify({ version: 1, records: 'none' })]) {
      expect(restoreSessionLedger(raw, context)).toEqual(emptySessionLedger())
    }
  })
  it('drops records that no longer validate and keeps the rest', () => {
    const value = stored(add(add(emptySessionLedger(), 'op-1', manual()), 'op-2', manual('13.00')))
    const broken = (patch: (record: any) => void) => { const copy = structuredClone(value); patch(copy.records[0]); return restore(copy).records.map(record => record.purchase.id) }
    const kept = ['session_purchase_manual_02']
    expect(broken(record => { record.purchase.merchantId = 'missing' })).toEqual(kept)
    expect(broken(record => { record.purchase.originalAmount = -1 })).toEqual(kept)
    expect(broken(record => { record.purchase.originalCurrency = 'QQQ' })).toEqual(kept)
    expect(broken(record => { record.purchase.timestamp = 'yesterday' })).toEqual(kept)
    expect(broken(record => { record.purchase.placeId = context.places[0].id })).toEqual(kept)
    expect(broken(record => { record.purchase.id = 'purchase_fixture_01' })).toEqual(kept)
    expect(broken(record => { record.evidence.purchaseId = 'session_purchase_manual_02' })).toEqual(kept)
    expect(broken(record => { record.purchase.fx.rateToBase = 'free' })).toEqual(kept)
    expect(broken(record => { record.identification = { method: 'camera', syntheticCatalog: false, identity: { original: '4006381333932', format: 'EAN13', gtin14: '04006381333932' } } })).toEqual(kept)
  })
  it('rejects a physical record whose place belongs to another merchant', () => {
    const receipt = stored(add(emptySessionLedger(), 'op-1', reviewFromDemo(demoDraftForSource('receipt')!, 'en')))
    expect(restore(receipt).records).toHaveLength(1)
    receipt.records[0].purchase.placeId = context.places.find(place => place.merchantId !== receipt.records[0].purchase.merchantId)!.id
    expect(restore(receipt).records).toHaveLength(0)
  })
  it('ignores duplicate IDs and never reuses a kept sequence number', () => {
    const value = stored(add(emptySessionLedger(), 'op-1', manual()))
    value.records.push(structuredClone(value.records[0]))
    value.nextSequence = 1
    const restored = restore(value)
    expect(restored.records).toHaveLength(1)
    expect(restored.nextSequence).toBe(2)
    expect(restore({ ...value, nextSequence: 'soon' }).nextSequence).toBe(2)
  })
  it('strips unknown properties from stored records', () => {
    const value = stored(add(emptySessionLedger(), 'op-1', manual()))
    value.records[0].purchase.injected = '<script>'
    value.records[0].extra = true
    const [record] = restore(value).records
    expect(record).not.toHaveProperty('extra')
    expect(record.purchase).not.toHaveProperty('injected')
  })
})
