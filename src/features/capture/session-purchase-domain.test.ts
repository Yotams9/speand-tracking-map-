import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData } from '../../data/spendscape-fixtures'
import { availableTimelineMonths, baseAmountIlsForPurchase, buildPlaceFeatureCollection, defaultPurchaseQuery, filterPurchases } from '../../data/spendscape-globe'
import { derivePurchaseAnalytics } from '../../data/spendscape-analytics'
import { demoDraftForSource, combineSessionPurchases } from './capture-domain'
import { allocateReviewOperationId, blankReview, emptySessionLedger, expireSessionPurchaseUndo, lineMinorTotal, minorAmount, resetSessionPurchases, reviewFromDemo, reviewedRecord, saveReviewedPurchase, undoSessionPurchase, validateReview } from './session-purchase-domain'
const context = canonicalSpendscapeData
const manual = () => ({ ...blankReview(), merchantId: context.merchants[0].id, channel: 'online' as const, date: '2026-09-12T14:35', currency: 'ILS' as const, payment: 'cash' as const, category: 'retail' as const, amount: '12.50' })
const receipt = () => reviewFromDemo(demoDraftForSource('receipt')!, 'en')

describe('Scanner E reviewed session integration', () => {
  it('requires explicit factual context before saving', () => {
    expect(Object.keys(validateReview(blankReview(), context)).sort()).toEqual(['amount', 'category', 'channel', 'currency', 'date', 'merchantId', 'payment', 'baseAmount'].sort())
    expect(validateReview(manual(), context)).toEqual({})
  })
  it('rejects malformed amounts, precision and quantities without repair', () => {
    for (const value of ['', '-1', '0', 'NaN', 'Infinity', '1e3', '1O.00', '1.005', ' 12 ', '10000000']) expect(minorAmount(value, 'ILS')).toBeNull()
    expect(minorAmount('100.00', 'JPY')).toBeNull(); expect(minorAmount('100', 'JPY')).toBe(100)
    expect(lineMinorTotal({ name: 'Weight', quantity: '1.235', unit: 'kg', price: '12.50' }, 'ILS')).toBe(1544)
    expect(lineMinorTotal({ name: 'Item', quantity: '1.2', unit: 'item', price: '12.50' }, 'ILS')).toBeNull()
  })
  it('rejects invalid UTC dates and enum values', () => {
    for (const date of ['', '2026-02-30T10:00', '2026-13-01T10:00', '2026-09-12T25:00', '0001-01-01T00:00']) expect(validateReview({ ...manual(), date }, context)).toHaveProperty('date')
    expect(validateReview({ ...manual(), payment: 'wire' as never, currency: 'QQQ' as never, category: 'other' as never }, context)).toMatchObject({ payment: 'required', currency: 'required', category: 'required' })
  })
  it('rejects mismatched merchants, unknown IDs and online pins', () => {
    expect(validateReview({ ...manual(), merchantId: 'missing' }, context)).toHaveProperty('merchantId')
    expect(validateReview({ ...manual(), channel: 'physical', placeId: 'place_shuk_bograshov' }, { ...context, places: [] })).toHaveProperty('placeId')
    expect(validateReview({ ...manual(), placeId: context.places[0].id }, context)).toHaveProperty('placeId')
  })
  it('receipt arithmetic is a save gate, including changed quantities', () => {
    const draft = receipt(); expect(validateReview(draft, context)).toEqual({})
    draft.amount = '1.00'; expect(validateReview(draft, context).amount).toBe('arithmetic')
    expect(() => reviewedRecord(draft, 1, context)).toThrow('review-invalid')
    draft.amount = '86.90'; draft.lines[0].quantity = '2'; expect(validateReview(draft, context).amount).toBe('arithmetic')
  })
  it('barcode candidates cannot save without reviewed price, quantity and name', () => {
    const draft = { ...manual(), source: 'barcode' as const, lines: [{ name: '', price: '', quantity: '', unit: 'item' as const }] }
    expect(validateReview(draft, context)).toMatchObject({ 'name-0': 'required', 'quantity-0': 'quantity', 'price-0': 'amount' })
  })
  it('foreign user amounts require reported ILS and never reuse synthetic rates', () => {
    const draft = { ...manual(), currency: 'USD' as const }
    expect(validateReview(draft, context).baseAmount).toBe('conversion')
    draft.baseAmount = '47.11'
    const r = reviewedRecord(draft, 1, context)
    expect(r.synthetic).toBe(false); expect(r.evidence.kind).toBe('manual-entry'); expect(r.evidence.synthetic).toBe(false)
    expect(r.purchase.fx.source).toBe('user-reported-conversion'); expect(baseAmountIlsForPurchase(r.purchase)).toBe(47.11)
    expect(r.purchase.originalAmount).toBe(12.5)
    const analytics = derivePurchaseAnalytics([r.purchase], [r.evidence])
    expect(analytics.totalBaseAmountIls).toBe(47.11); expect(analytics.currencies[0]).toMatchObject({ syntheticRatesToBase: [], reportedPurchaseCount: 1 })
  })
  it('preserves synthetic FX and bilingual demo provenance', () => {
    const r = reviewedRecord(reviewFromDemo(demoDraftForSource('pdf')!, 'he'), 1, context)
    expect(r.purchase.fx.source).toBe('synthetic-fixture-rate'); expect(r.purchase.fx.rateToBase).toBe(4.05); expect(r.synthetic).toBe(true)
  })
  it('single operation remains consumed after duplicate events, Undo and reset', () => {
    const first = saveReviewedPurchase(emptySessionLedger(), 'op-1', manual(), context, context.purchases)
    expect(first.result.code).toBe('saved')
    for (const ledger of [first.ledger, undoSessionPurchase(first.ledger), resetSessionPurchases(first.ledger)]) {
      const again = saveReviewedPurchase(ledger, 'op-1', manual(), context, context.purchases, true)
      expect(again.result.code).toBe('consumed'); expect(again.ledger).toBe(ledger)
    }
  })
  it('expires only the matching Undo window without deleting the saved purchase', () => {
    const first = saveReviewedPurchase(emptySessionLedger(), 'expiry-1', manual(), context, context.purchases).ledger
    const staleExpiry = expireSessionPurchaseUndo(first, 'another-purchase')
    expect(staleExpiry).toBe(first)
    const expired = expireSessionPurchaseUndo(first, first.undoId!)
    expect(expired.records).toEqual(first.records)
    expect(expired.consumed).toEqual(first.consumed)
    expect(expired.undoId).toBeNull()
  })
  it('warns on identical separate purchases but permits explicit confirmation', () => {
    const first = saveReviewedPurchase(emptySessionLedger(), 'a', manual(), context, context.purchases)
    expect(saveReviewedPurchase(first.ledger, 'b', manual(), context, context.purchases).result.code).toBe('duplicate')
    const second = saveReviewedPurchase(first.ledger, 'b', manual(), context, context.purchases, true)
    expect(second.ledger.records).toHaveLength(2)
    const undone = undoSessionPurchase(second.ledger)
    expect(undone.records).toEqual(first.ledger.records); expect(undone.undoId).toBeNull()
    const third = saveReviewedPurchase(undone, 'c', { ...manual(), amount: '13.00' }, context, context.purchases)
    expect(third.ledger.records[1].purchase.id).toBe('session_purchase_manual_03')
  })
  it('same graph updates totals, pins, search, months and returns baseline on Undo', () => {
    const before = JSON.stringify(context)
    const saved = saveReviewedPurchase(emptySessionLedger(), 'receipt', receipt(), context, context.purchases).ledger
    const purchases = combineSessionPurchases(context.purchases, saved.records)
    const evidence = [...context.evidence, ...saved.records.map(r => r.evidence)]
    expect(purchases).toHaveLength(43); expect(context.places).toHaveLength(12)
    expect(buildPlaceFeatureCollection(context.places, purchases).features).toHaveLength(12)
    expect(derivePurchaseAnalytics(purchases, evidence).totalBaseAmountIls).toBe(6864.28)
    expect(filterPurchases({ ...defaultPurchaseQuery, search: 'Olive sourdough' }, purchases, context.places, context.merchants).some(p => p.id.startsWith('session_'))).toBe(true)
    const online = reviewedRecord(manual(), 2, context).purchase
    const unresolved = reviewedRecord({ ...manual(), channel: 'unknown', merchantId: 'merchant_unresolved' }, 3, context).purchase
    expect(availableTimelineMonths([...purchases, online])).toContain('2026-09')
    expect(buildPlaceFeatureCollection(context.places, [...purchases, online, unresolved]).features).toHaveLength(12)
    expect(derivePurchaseAnalytics(combineSessionPurchases(context.purchases, undoSessionPurchase(saved).records), context.evidence).totalBaseAmountIls).toBe(6777.38)
    expect(JSON.stringify(context)).toBe(before)
  })
  it('does not persist arbitrary input keys or image values in a record', () => {
    const r = reviewedRecord({ ...manual(), image: 'private-image', token: 'private-token' } as never, 1, context)
    expect(JSON.stringify(r)).not.toMatch(/private-image|private-token/)
  })
  it('keeps candidate catalog provenance separate from all user-completed purchase facts', () => {
    for (const method of ['camera', 'manual', 'demo'] as const) {
      const draft = { ...manual(), source: 'barcode' as const, currency: 'USD' as const,
        identification: { identity: { original: '2000000000015', format: 'EAN13' as const, gtin14: '02000000000015' }, method, syntheticCatalog: true },
        lines: [{ name: 'Demo oats', quantity: '1', price: '12.50', unit: 'item' as const }] }
      expect(validateReview(draft, context).baseAmount).toBe('conversion')
      expect(validateReview({ ...draft, provenance: 'synthetic-demo' }, context)).toHaveProperty('provenance')
      const record = reviewedRecord({ ...draft, baseAmount: '47.11' }, 1, context)
      expect(record.identification).toEqual(draft.identification)
      expect(record.synthetic).toBe(false)
      expect(record.evidence).toMatchObject({ synthetic: false, kind: 'manual-entry' })
      expect(record.purchase.provenance).toBe('user-reviewed-session')
      expect(record.purchase.fx.source).toBe('user-reported-conversion')
      expect(baseAmountIlsForPurchase(record.purchase)).toBe(47.11)
    }
  })
  it('allocates distinct operation IDs across drafts, save, undo and reset without browser APIs', () => {
    const firstId = allocateReviewOperationId()
    const saved = saveReviewedPurchase(emptySessionLedger(), firstId, manual(), context, context.purchases)
    const secondId = allocateReviewOperationId()
    const reset = resetSessionPurchases(undoSessionPurchase(saved.ledger))
    const thirdId = allocateReviewOperationId()
    expect(new Set([firstId, secondId, thirdId]).size).toBe(3)
    expect(saveReviewedPurchase(reset, firstId, manual(), context, context.purchases).result.code).toBe('consumed')
    expect(saveReviewedPurchase(reset, thirdId, manual(), context, context.purchases).result.code).toBe('saved')
  })

})
