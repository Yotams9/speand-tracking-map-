import { describe, expect, it } from 'vitest'
import { payableReceipt } from '../../../qa/final-payable-mocks'
import { createFixtureSpendscapeRepository } from '../../data/spendscape-repository'
import { buildPlaceFeatureCollection, derivedPurchaseSummary, nestedItemTotal, purchaseItemTotalMinor } from '../../data/spendscape-globe'
import { derivePurchaseAnalytics } from '../../data/spendscape-analytics'
import { emptyLocalPurchases, restoredLedger, validateLocalPurchases, validateLocalPurchaseWrite } from '../local-purchases/local-purchase-store'
import { demoComparison } from '../nearby-demo/comparison'
import { prepareReceiptReview, receiptToReviewDraft } from './receipt-review-adapter'
import { emptySessionLedger, reviewedRecord, saveReviewedPurchase, undoSessionPurchase, validateReview } from './session-purchase-domain'

const data = await createFixtureSpendscapeRepository().loadSnapshot()

function completed() {
  const draft = receiptToReviewDraft(payableReceipt)
  Object.assign(draft.review, { merchantId: 'merchant_shuk', placeId: 'place_shuk_bograshov', channel: 'physical', date: '2013-09-30T11:57', payment: 'cash', category: 'groceries' })
  return draft
}
function input() {
  const result = prepareReceiptReview(completed(), data)
  if (!result.ready) throw new Error('test-review-incomplete')
  return result.input
}

describe('reviewed final payable, independent of product sum', () => {
  it('preserves five printed rows/seven units, both totals, labels, date and unknown barcodes', () => {
    const draft = completed(), before = structuredClone(draft.observations)
    const record = reviewedRecord(input(), 1, data), p = record.purchase
    expect(p.originalAmount).toBe(60.5)
    expect(purchaseItemTotalMinor(p)).toBe(6055)
    expect(nestedItemTotal(p)).toBe(60.55)
    expect(p.items).toHaveLength(5)
    expect(p.items.reduce((sum, item) => sum + item.quantity, 0)).toBe(7)
    expect(p.items.map(item => [item.label.en, item.quantity, item.unitPrice, item.lineTotal])).toEqual(
      payableReceipt.lines.map(item => [item.name, Number(item.quantity), Number(item.unitPrice), Number(item.lineAmount)]))
    expect(p.items.every(item => !Object.hasOwn(item, 'discountMinor'))).toBe(true)
    expect(draft.barcodes).toEqual(Array(5).fill(null))
    expect(p.timestamp).toBe('2013-09-30T11:57:00.000Z') // this mock explicitly chose UTC
    expect(draft.observations).toEqual(before)
  })
  it('requires context and preserves original observations during correction, without side effects', () => {
    const draft = receiptToReviewDraft(payableReceipt)
    expect(prepareReceiptReview(draft, data)).toMatchObject({ ready: false, errors: { date: 'date', payment: 'required', merchantId: 'required' } })
    const corrected = completed(); corrected.review.amount = '60.40'
    expect(prepareReceiptReview(corrected, data)).toMatchObject({ ready: true, input: { amount: '60.40' } })
    expect(corrected.observations.finalAmount).toBe('60.50')
    expect(emptySessionLedger().records).toEqual([])
  })
  it.each(['', '-1', '0', '1e2', '60.501', '60,50'])('still rejects an invalid payable amount %s', amount => {
    const draft = completed(); draft.review.amount = amount
    expect(prepareReceiptReview(draft, data)).toMatchObject({ ready: false, errors: { amount: 'amount' } })
  })
  it('does not use the payable difference to repair a line or waive invalid discounts/quantities', () => {
    const draft = completed(); draft.review.lines[0].printedAmount = '9.95'
    expect(prepareReceiptReview(draft, data)).toMatchObject({ ready: false, errors: { 'printedAmount-0': 'arithmetic' } })
    for (const discount of ['-0.05', '10.01', '', '1e2']) {
      const bad = completed(); bad.review.lines[0].discount = discount
      expect(prepareReceiptReview(bad, data)).toMatchObject({ ready: false, errors: { 'discount-0': 'discount' } })
    }
    const bad = completed(); bad.review.lines[0].quantity = '0'
    expect(prepareReceiptReview(bad, data)).toMatchObject({ ready: false, errors: { 'quantity-0': 'quantity' } })
    const invalidLine = { ...input(), lines: [{ ...input().lines[0], quantity: '0' }] }
    expect(validateReview(invalidLine, data)).toMatchObject({ lines: 'items', 'quantity-0': 'quantity' })
    expect(validateReview(invalidLine, data).amount).toBeUndefined()
    expect(validateReview({ ...invalidLine, amount: '-1' }, data).amount).toBe('amount')
  })
  it('keeps synthetic and non-receipt reconciliation strict', () => {
    for (const source of ['manual', 'product', 'barcode', 'document', 'pdf', 'csv'] as const)
      expect(validateReview({ ...input(), source }, data).amount).toBe('arithmetic')
    expect(validateReview({ ...input(), provenance: 'synthetic-demo' }, data).amount).toBe('arithmetic')
  })
  it('retains zero-net discounts, weighted rounding and explicit foreign ILS without allocating a difference', () => {
    const draft = completed(); draft.review.lines = [
      { name: 'Fictional free item', quantity: '1', unit: 'item', price: '10', discount: '10', printedAmount: '0' },
      { name: 'Fictional weight', quantity: '1.235', unit: 'kg', price: '12.50', discount: '0.44', printedAmount: '15' },
    ]; draft.review.amount = '14.95'; draft.review.currency = 'USD'; draft.review.baseAmount = '47.11'
    const prepared = prepareReceiptReview(draft, data); expect(prepared.ready).toBe(true)
    if (!prepared.ready) throw new Error('test-review-incomplete')
    const record = reviewedRecord(prepared.input, 1, data)
    expect(record.purchase.items.map(i => i.lineTotal)).toEqual([0, 15])
    expect(record.purchase.items[1]).toMatchObject({ unitPrice: 12.5, discountMinor: 44 })
    expect(record.purchase.fx.reportedBaseAmountIls).toBe(47.11)
    expect(validateReview({ ...prepared.input, baseAmount: '' }, data).baseAmount).toBe('conversion')
    const jpy = { ...input(), currency: 'JPY' as const, baseAmount: '1', amount: '199', lines: [{ name: 'Fictional yen item', quantity: '2', unit: 'item' as const, price: '100' }] }
    expect(purchaseItemTotalMinor(reviewedRecord(jpy, 1, data).purchase)).toBe(200)
  })
  it('round trips the same v3 record, validates legacy records read-only and rejects forged line totals', () => {
    const record = reviewedRecord(input(), 1, data)
    const disk = { ...emptyLocalPurchases(), records: [record], nextSequence: 2, revision: 7 }
    const before = JSON.stringify(disk)
    expect(validateLocalPurchaseWrite(disk, data)).toEqual(disk)
    expect(restoredLedger(validateLocalPurchases(JSON.parse(before), data)).records).toEqual([record])
    expect(JSON.stringify(disk)).toBe(before)
    for (const version of [1, 2]) {
      const { directory: _directory, ...legacy } = disk
      const raw = { ...legacy, version }, original = JSON.stringify(raw)
      expect(validateLocalPurchases(raw, data)).toEqual(disk)
      expect(JSON.stringify(raw)).toBe(original)
    }
    const forged = structuredClone(disk); forged.records[0].purchase.items[0].lineTotal = 9.95
    expect(() => validateLocalPurchases(forged, data)).toThrow('invalid')
    expect(() => validateLocalPurchases({ ...disk, version: 4 }, data)).toThrow('invalid')
  })
  it('counts payable in composed spend/pins, preserves item totals and suppresses demo comparisons', () => {
    const record = reviewedRecord(input(), 1, data), graph = [...data.purchases, record.purchase]
    const baseline = derivePurchaseAnalytics(data.purchases, data.evidence).totalBaseAmountIls
    expect(derivePurchaseAnalytics(graph, [...data.evidence, record.evidence]).totalBaseAmountIls).toBe(baseline + 60.5)
    expect(derivedPurchaseSummary(graph, data.places).totalBaseAmountIls).toBe(baseline + 60.5)
    const pins = buildPlaceFeatureCollection(data.places, graph), oldPins = buildPlaceFeatureCollection(data.places, data.purchases)
    expect(pins.features).toHaveLength(12)
    const pin = pins.features.find(p => p.properties.placeId === record.purchase.placeId)!
    const oldPin = oldPins.features.find(p => p.properties.placeId === record.purchase.placeId)!
    expect(pin.properties.totalBaseAmountIls).toBe(oldPin.properties.totalBaseAmountIls + 60.5)
    expect(demoComparison([record], record.purchase.id, null, data.places)).toBeNull()
  })
  it('keeps duplicate detection, explicit override, consumed operations and Undo intact', () => {
    const first = saveReviewedPurchase(emptySessionLedger(), 'payable-one', input(), data, data.purchases)
    expect(first.result.code).toBe('saved')
    expect(saveReviewedPurchase(first.ledger, 'payable-two', input(), data, data.purchases).result.code).toBe('duplicate')
    const second = saveReviewedPurchase(first.ledger, 'payable-two', input(), data, data.purchases, true)
    expect(second.ledger.records).toHaveLength(2)
    expect(undoSessionPurchase(second.ledger).records).toEqual(first.ledger.records)
    expect(saveReviewedPurchase(undoSessionPurchase(second.ledger), 'payable-two', input(), data, data.purchases, true).result.code).toBe('consumed')
    const changed = saveReviewedPurchase(first.ledger, 'different-payable', { ...input(), amount: '60.55' }, data, data.purchases)
    expect(changed.result.code).toBe('saved')
  })
})
