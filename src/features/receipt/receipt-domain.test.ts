import { describe, expect, it } from 'vitest'
import { receiptToReviewInput, validateReceipt, type ReceiptExtraction } from './receipt-domain'
import { validateReview } from '../capture/session-purchase-domain'

const base = (patch: Partial<ReceiptExtraction>): ReceiptExtraction => ({
  storeName: 'סופר דמו', currency: 'ILS', lines: [], discounts: [], total: 0, ...patch,
})

describe('validateReceipt', () => {
  it('accepts an exact synthetic receipt', () => {
    const r = base({
      lines: [
        { name: 'חלב 3%', quantity: 2, unit: 'item', unitPrice: 6.9, lineTotal: 13.8 },
        { name: 'לחם', quantity: 1, unit: 'item', unitPrice: 9.5, lineTotal: 9.5 },
      ],
      total: 23.3,
    })
    const v = validateReceipt(r)
    expect(v.ok).toBe(true)
    expect(v.sums).toEqual({ lines: 2330, discounts: 0, expectedTotal: 2330, printedTotal: 2330 })
  })

  it('tolerates a 1 agora rounding difference on item lines but not 2', () => {
    const ok = validateReceipt(base({ lines: [{ name: 'שוקולד', quantity: 3, unit: 'item', unitPrice: 3.33, lineTotal: 10.0 }], total: 10 }))
    expect(ok.ok).toBe(true)
    const bad = validateReceipt(base({ lines: [{ name: 'שוקולד', quantity: 3, unit: 'item', unitPrice: 3.33, lineTotal: 10.02 }], total: 10.02 }))
    expect(bad.lineIssues[0]?.[0].code).toBe('line-arithmetic')
  })

  it('allows 2 agorot on weighted items', () => {
    // 1.236 kg * 12.90 = 15.9444 -> 15.94; printed 15.96 is within the weighed tolerance
    const v = validateReceipt(base({ lines: [{ name: 'עגבניות', quantity: 1.236, unit: 'kg', unitPrice: 12.9, lineTotal: 15.96 }], total: 15.96 }))
    expect(v.ok).toBe(true)
    const off = validateReceipt(base({ lines: [{ name: 'עגבניות', quantity: 1.236, unit: 'kg', unitPrice: 12.9, lineTotal: 15.98 }], total: 15.98 }))
    expect(off.lineIssues[0]?.[0].code).toBe('line-arithmetic')
  })

  it('includes negative discount lines in the total', () => {
    const v = validateReceipt(base({
      lines: [{ name: 'קפה', quantity: 1, unit: 'item', unitPrice: 20, lineTotal: 20 }],
      discounts: [{ label: 'מבצע קפה', amount: -3 }],
      total: 17,
    }))
    expect(v.ok).toBe(true)
    expect(v.sums.discounts).toBe(-300)
  })

  it('flags a total mismatch without changing any number', () => {
    const r = base({ lines: [{ name: 'גבינה', quantity: 1, unit: 'item', unitPrice: 12, lineTotal: 12 }], total: 13.5 })
    const v = validateReceipt(r)
    expect(v.ok).toBe(false)
    expect(v.totalIssues[0]).toMatchObject({ code: 'total-mismatch', expected: 1200, actual: 1350 })
    expect(r.total).toBe(13.5)
  })

  it('flags positive discounts, fractional item quantities, bad numbers and empty receipts', () => {
    expect(validateReceipt(base({ lines: [{ name: 'א', quantity: 1, unit: 'item', unitPrice: 5, lineTotal: 5 }], discounts: [{ label: 'x', amount: 1 }], total: 6 })).discountIssues[0][0].code).toBe('discount-sign')
    expect(validateReceipt(base({ lines: [{ name: 'א', quantity: 1.5, unit: 'item', unitPrice: 4, lineTotal: 6 }], total: 6 })).lineIssues[0][0].code).toBe('fractional-item-quantity')
    expect(validateReceipt(base({ lines: [{ name: 'א', quantity: 1, unit: 'item', unitPrice: Number.NaN, lineTotal: 5 }], total: 5 })).lineIssues[0][0].code).toBe('invalid-number')
    expect(validateReceipt(base({ total: 0 })).totalIssues.map(i => i.code)).toContain('no-lines')
  })

  it('avoids float drift by working in agorot', () => {
    const v = validateReceipt(base({
      lines: [
        { name: 'א', quantity: 1, unit: 'item', unitPrice: 0.1, lineTotal: 0.1 },
        { name: 'ב', quantity: 1, unit: 'item', unitPrice: 0.2, lineTotal: 0.2 },
      ],
      total: 0.3,
    }))
    expect(v.ok).toBe(true)
  })
})

describe('receiptToReviewInput', () => {
  const receipt = base({
    purchasedAt: '2026-09-01T18:42',
    lines: [{ name: 'חלב', quantity: 2, unit: 'item', unitPrice: 6.9, lineTotal: 13.8 }],
    total: 13.8,
  })

  it('leaves merchant, place, payment and category empty for the user', () => {
    const { input, notes } = receiptToReviewInput(receipt)
    expect(input).toMatchObject({ source: 'receipt', provenance: 'user-reviewed', merchantId: '', placeId: '', payment: '', category: '', channel: '', currency: 'ILS', date: '2026-09-01T18:42', amount: '13.80' })
    expect(input.lines).toEqual([{ name: 'חלב', quantity: '2', unit: 'item', price: '6.90' }])
    expect(notes).toEqual([])
  })

  it('produces only the still-empty-field errors in the existing review validation', () => {
    const errors = validateReview(receiptToReviewInput(receipt).input, { merchants: [], places: [] })
    expect(Object.keys(errors).sort()).toEqual(['category', 'channel', 'merchantId', 'payment'])
  })

  it('surfaces discounts and a missing date instead of hiding them', () => {
    const { input, notes } = receiptToReviewInput({ ...receipt, purchasedAt: undefined, discounts: [{ label: 'מבצע', amount: -1 }], total: 12.8 })
    expect(notes).toEqual(['discounts-not-representable', 'date-missing'])
    expect(input.date).toBe('')
    expect(validateReview(input, { merchants: [], places: [] }).amount).toBe('arithmetic')
  })
})
