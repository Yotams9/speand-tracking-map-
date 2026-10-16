import { describe, it, expect } from 'vitest'
import { fictionalPurchase, fictionalOrigin } from '../../../qa/nearby-preview-fixtures'
import { receiptPriceBasket, validCandidate } from './receipt-price-match'
const candidate = { gtin14: '05060639129102', name: 'Fictional packaged drink', quantity: '500 ml', manufacturer: '', weighted: false }
const one = () => { const p = fictionalPurchase(); p.items = [{ ...p.items[0], quantity: 3, unitPrice: 12, lineTotal: 36 }]; p.originalAmount = 34; return p }
describe('explicit receipt row matching for candidate savings cards', () => {
  it('preserves receipt facts and uses independent final payable for a single row', () => {
    const p = one(), before = structuredClone(p), basket = receiptPriceBasket(p, p.items[0].id, candidate, [fictionalOrigin])
    expect(basket).toEqual({ items: [{ ref: p.items[0].id, gtin14: candidate.gtin14, quantity: 3, unit: 'item', paidMinor: 3400 }], origin: { lon: 12, lat: 45 } }); expect(p).toEqual(before)
  })
  it('does not allocate receipt-level adjustments across multiple rows', () => {
    const p = fictionalPurchase()
    expect(receiptPriceBasket(p, p.items[0].id, candidate, [fictionalOrigin])?.items[0]).not.toHaveProperty('paidMinor')
    p.originalAmount = 31.45
    expect(receiptPriceBasket(p, p.items[0].id, candidate, [fictionalOrigin])?.items[0].paidMinor).toBe(400)
  })
  it('does not guess a barcode from a receipt label and refuses unsupported packages/units', () => {
    const p = one(), id = p.items[0].id
    for (const c of [{ ...candidate, gtin14: '05060639129103' }, { ...candidate, weighted: true }, { ...candidate, quantity: '' }, { ...candidate, quantity: '1 לא ידוע' }]) expect(receiptPriceBasket(p, id, c, [fictionalOrigin])).toBeNull()
    expect(receiptPriceBasket(p, 'missing-row', candidate, [fictionalOrigin])).toBeNull()
    p.items[0].quantity = 1.5; expect(receiptPriceBasket(p, id, candidate, [fictionalOrigin])).toBeNull()
    p.items[0].quantity = 1; p.originalCurrency = 'USD'; expect(receiptPriceBasket(p, id, candidate, [fictionalOrigin])).toBeNull()
  })
  it('requires the purchase-owned confirmed point and never substitutes a different merchant place', () => {
    const p = one(); p.resolution = 'unresolved'
    expect(receiptPriceBasket(p, p.items[0].id, candidate, [fictionalOrigin])?.origin).toBeNull()
    p.resolution = 'confirmed'
    expect(receiptPriceBasket(p, p.items[0].id, candidate, [{ ...fictionalOrigin, merchantId: 'other' }])?.origin).toBeNull()
  })
  it('accepts a missing optional manufacturer but rejects invalid candidate responses', () => {
    expect(validCandidate(candidate)).toBe(true); expect(validCandidate(null)).toBe(false); expect(validCandidate({ ...candidate, name: '' })).toBe(false); expect(validCandidate({ ...candidate, weighted: 'false' })).toBe(false)
  })
})
