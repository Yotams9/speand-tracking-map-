import { describe, expect, it } from 'vitest'
import { receiptBlockerFields, receiptBlockerLabel } from './receipt-review-readiness'
import { receiptEditorDate, receiptEditorTime } from './receipt-editor-values'
import { receiptToReviewDraft, prepareReceiptReview, type ReceiptObservations } from './receipt-review-adapter'
import { createFixtureSpendscapeRepository } from '../../data/spendscape-repository'
import { saveReviewedPurchase, emptySessionLedger } from './session-purchase-domain'
const context = await createFixtureSpendscapeRepository().loadSnapshot()
const observed = (): ReceiptObservations => ({ merchantName: 'חנות בדויה Prefill', address: 'רחוב בדיוני 8', date: '29/02/2024', time: '09:07', currency: 'ש"ח', finalAmount: '10.05', lines: [{ name: 'פריט בדוי', quantity: '2', unit: null, unitPrice: '5.00', lineAmount: '10.00' }] })
const fields = (d: ReturnType<typeof receiptToReviewDraft>) => { const p = prepareReceiptReview(d, context); return p.ready ? [] : receiptBlockerFields(p.errors) }
describe('actual receipt save blockers, not a parallel validator', () => {
  it('prefills supported values; unresolved location needs no coordinates, pin or guessed context', () => {
    const o = observed(), d = receiptToReviewDraft(o)
    expect(d.review).toMatchObject({ channel: 'unknown', merchantId: '', placeId: '', currency: 'ILS', amount: '10.05', date: '', payment: '', category: '' })
    expect(d.review.lines[0]).toMatchObject({ name: o.lines[0].name, quantity: '2', unit: '', price: '5.00', printedAmount: '10.00' })
    expect(fields(d)).toEqual(['payment', 'category', 'date', 'merchantId', 'unit-0'])
    expect(d.observations).toEqual(o)
  })
  it('new merchant proposal still requires category; explicit unknown place saves without a local place', () => {
    const d = receiptToReviewDraft(observed())
    d.review.directoryIntent = { merchant: { name: d.observations.merchantName as string, category: '', separate: false } }
    expect(fields(d)).toContain('merchantCategory')
    Object.assign(d.review, { date: '2024-02-29T09:07', payment: 'cash', category: 'groceries' })
    d.review.directoryIntent.merchant!.category = 'groceries'; d.review.lines[0].unit = 'item'
    const p = prepareReceiptReview(d, context); expect(p.ready).toBe(true)
    if (!p.ready) throw new Error('mock incomplete')
    const saved = saveReviewedPurchase(emptySessionLedger(), 'fictional-prefill', p.input, context, context.purchases)
    expect(saved.result.code).toBe('saved')
    const r = saved.ledger.records[0]
    expect(r.purchase.originalAmount).toBe(10.05); expect(r.purchase.items[0].lineTotal).toBe(10)
    expect(r.purchase.channel).toBe('unknown'); expect(r.purchase.placeId).toBeNull()
    expect(saved.ledger.directory.places).toEqual([])
  })
  it('still exposes malformed quantities, arithmetic and required facts after unit selection', () => {
    const d = receiptToReviewDraft(observed()); d.review.lines[0].unit = 'item'; d.review.lines[0].quantity = 'broken'
    expect(fields(d)).toContain('quantity-0')
    d.review.lines[0].quantity = '2'; d.review.lines[0].printedAmount = '9.99'
    expect(fields(d)).toContain('printedAmount-0')
    d.review.payment = 'unknown' as any; d.review.category = 'unknown' as any
    expect(fields(d)).toEqual(expect.arrayContaining(['payment', 'category']))
  })
  it('coalesces only actual dependent errors, bounds field labels and keeps other failures', () => {
    expect(receiptBlockerFields({ lines: 'items', 'quantity-0': 'quantity', 'unit-0': 'required', 'price-0': 'amount', 'quantity-1': 'quantity', credentialMarker: 'PRIVATE' })).toEqual(['unit-0', 'price-0', 'quantity-1', 'other'])
    expect(receiptBlockerLabel('credentialMarker', false)).not.toContain('credentialMarker')
    for (const he of [false, true]) for (const f of ['date','payment','category','unit-0','printedAmount-1','merchantCategory','place-confirmed']) expect(receiptBlockerLabel(f, he)).toBeTruthy()
  })
  it('preserves a single supported date or clock so only the missing part needs entry', () => {
    expect(receiptEditorDate('29/02/2024')).toBe('2024-02-29'); expect(receiptEditorTime(null)).toBe('')
    expect(receiptEditorTime('09:07')).toBe('09:07'); expect(receiptEditorDate(null)).toBe('')
    expect(receiptEditorTime('24:00')).toBe(''); expect(receiptEditorTime({ candidates: ['09:07', '10:07'] })).toBe('')
  })
})
