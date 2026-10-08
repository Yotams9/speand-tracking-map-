import { describe, expect, it, vi } from 'vitest'
import { createFixtureSpendscapeRepository } from '../../data/spendscape-repository'
import { buildPlaceFeatureCollection } from '../../data/spendscape-globe'
import { derivePurchaseAnalytics } from '../../data/spendscape-analytics'
import { emptyLocalPurchases, validateLocalPurchases } from '../local-purchases/local-purchase-store'
import { emptySessionLedger, reviewedRecord, saveReviewedPurchase, undoSessionPurchase, validateReview } from './session-purchase-domain'
import { prepareReceiptReview, receiptToReviewDraft, validateReceiptObservations, type ReceiptObservations, type ReceiptReviewDraft } from './receipt-review-adapter'

const data = await createFixtureSpendscapeRepository().loadSnapshot()

// Fictional observations only; no live response, reference profile or photo.
const one = (): ReceiptObservations => ({
  merchantName: 'מכולת בדויה בלבד', address: 'רחוב דמיוני 12', date: '2026-10-03', time: '09:15',
  currency: 'ILS', finalAmount: '12.50',
  lines: [{ name: 'קוואקר לדוגמה Oats', quantity: '2', unit: 'item', unitPrice: '6.25', lineAmount: '12.50' }],
})
const fifteen = (): ReceiptObservations => ({
  ...one(), finalAmount: '41.00', lines: [
    { name: 'לחם בדוי Bread', quantity: '2', unit: 'item', unitPrice: '3.25', discount: '0.50', lineAmount: '6.00' },
    { name: 'תפוחים לדוגמה Apples', quantity: '0.375', unit: 'kg', unitPrice: '24.00', lineAmount: '9.00' },
    ...Array.from({ length: 13 }, (_, index) => ({ name: index % 2 ? 'מוצר חוזר בדוי' : `Fictional item ${index}`, quantity: '1', unit: 'item', unitPrice: '2.00', lineAmount: '2.00' })),
  ],
})
function completed(draft: ReceiptReviewDraft): ReceiptReviewDraft {
  // Simulates deliberate review, not matching the fictional observed merchant.
  draft.review.merchantId = data.merchants[0].id
  draft.review.channel = 'unknown'
  draft.review.date = '2026-10-03T06:15' // explicitly reviewed UTC; not inferred from wall clock
  draft.review.payment = 'cash'
  draft.review.category = 'groceries'
  return draft
}
function input(draft: ReceiptReviewDraft) {
  const result = prepareReceiptReview(draft, data)
  expect(result).toMatchObject({ ready: true })
  if (!result.ready) throw new Error('test-review-incomplete')
  return result.input
}
function errors(draft: ReceiptReviewDraft) {
  const result = prepareReceiptReview(draft, data)
  expect(result.ready).toBe(false)
  if (result.ready) throw new Error('test-review-unexpectedly-ready')
  return result.errors
}

const invalidArrayShapes: [string, (entries: unknown[]) => unknown[]][] = [
  ['deleted entry', entries => { const array = [...entries]; delete array[0]; return array }],
  ['leading hole', entries => [, ...entries]],
  ['trailing hole', entries => [...entries, ,]],
  ['all holes', () => Array(2)],
  ['undefined entry', entries => [undefined, ...entries]],
  ['null entry', entries => [null, ...entries]],
  ['enumerable extra key', entries => Object.assign([...entries], { extra: 'synthetic-secret-marker' })],
  ['hidden extra key', entries => Object.defineProperty([...entries], 'extra', { value: 'synthetic-secret-marker' })],
  ['symbol extra key', entries => Object.assign([...entries], { [Symbol('synthetic-private-marker')]: 'synthetic-secret-marker' })],
  ['hidden index', entries => Object.defineProperty([...entries], '0', { enumerable: false })],
  ['accessor index', entries => Object.defineProperty([...entries], '0', { get() { throw new Error('test-array-accessor-read') } })],
  ['inherited index', entries => {
    const array = [...entries]; delete array[0]
    return Object.setPrototypeOf(array, Object.create(Array.prototype, { 0: { value: entries[0] } }))
  }],
]

describe('strict receipt array boundaries', () => {
  it.each(invalidArrayShapes)('rejects %s in observation lines before cloning', (_name, shape) => {
    const raw = { ...one(), lines: shape(one().lines) }
    expect(validateReceiptObservations(raw)).toBe(false)
    expect(() => receiptToReviewDraft(raw)).toThrow(/^receipt-observations-invalid$/)
  })
  it.each(invalidArrayShapes)('rejects %s in ambiguous candidates before cloning', (_name, shape) => {
    const raw = { ...one(), merchantName: { candidates: shape(['Fictional A', 'Fictional B']) } }
    expect(validateReceiptObservations(raw)).toBe(false)
    expect(() => receiptToReviewDraft(raw)).toThrow(/^receipt-observations-invalid$/)
  })
  it.each(invalidArrayShapes)('rejects %s in edited lines without a ready projection', (_name, shape) => {
    const draft = completed(receiptToReviewDraft(one()))
    const changed = { ...draft, review: { ...draft.review, lines: shape(draft.review.lines) } }
    expect(prepareReceiptReview(changed as never, data)).toEqual({ ready: false, errors: { lines: 'items' } })
  })
  it('keeps dense/frozen arrays, maximum line count and ambiguous candidate bounds compatible', () => {
    const raw = one()
    raw.lines = Array.from({ length: 50 }, () => ({ ...one().lines[0] }))
    raw.finalAmount = '625.00'
    Object.freeze(raw.lines)
    const draft = completed(receiptToReviewDraft(raw))
    Object.freeze(draft.review.lines)
    const review = input(draft)
    expect(review.lines).toHaveLength(50)
    const record = reviewedRecord(review, 1, data)
    const envelope = { ...emptyLocalPurchases(), records: [record], nextSequence: 2 }
    expect(validateLocalPurchases(JSON.parse(JSON.stringify(envelope)), data)).toEqual(envelope)
    for (const count of [2, 5]) {
      const candidates = Array.from({ length: count }, (_, index) => `Fictional ${index}`)
      Object.freeze(candidates)
      const observed = { ...one(), merchantName: { candidates } }
      expect(validateReceiptObservations(observed)).toBe(true)
      expect(receiptToReviewDraft(observed).observations.merchantName).toEqual({ candidates })
    }
    for (const count of [0, 1, 6]) expect(validateReceiptObservations({ ...one(), merchantName: { candidates: Array(count).fill('Fictional') } })).toBe(false)
  })
})

describe('offline receipt-to-review adapter', () => {
  it('preserves observations independently, never chooses merchant/place/context/time defaults', () => {
    const raw = one(), before = structuredClone(raw), draft = receiptToReviewDraft(raw)
    expect(draft.observations).toEqual(before)
    expect(draft.review).toMatchObject({ source: 'receipt', provenance: 'user-reviewed', merchantId: '', placeId: '', channel: '', date: '', payment: '', category: '', baseAmount: '' })
    expect(errors(draft)).toMatchObject({ merchantId: 'required', channel: 'required', date: 'date', payment: 'required', category: 'required' })
    draft.review.lines[0].name = 'Explicit edit'
    raw.lines[0].name = 'Changed source'
    expect(draft.observations.lines[0].name).toBe(before.lines[0].name)
  })
  it('drafts and passes the current save/store validator without any VAT or barcode', () => {
    const draft = completed(receiptToReviewDraft(one())), review = input(draft)
    expect(review.lines[0]).toEqual({ name: 'קוואקר לדוגמה Oats', quantity: '2', unit: 'item', price: '6.25' })
    expect(review).not.toHaveProperty('identification')
    expect(validateReview(review, data)).toEqual({})
    const record = reviewedRecord(review, 1, data)
    expect(record.purchase).toMatchObject({ originalAmount: 12.5, placeId: null, channel: 'unknown', provenance: 'user-reviewed-session' })
    const envelope = { ...emptyLocalPurchases(), records: [record], nextSequence: 2 }
    expect(validateLocalPurchases(JSON.parse(JSON.stringify(envelope)), data)).toEqual(envelope)
  })
  it('retains optional missing/ambiguous taxes without making them core save gates', () => {
    const raw = { ...one(), preVat: null, vatAmount: { candidates: ['1.00', '2.00'] }, vatRate: null }
    const draft = completed(receiptToReviewDraft(raw))
    expect(input(draft)).not.toHaveProperty('vatAmount')
    expect(draft.observations).toEqual(raw)
  })
  it('preserves 15 rows, repeated/Hebrew labels, weighted quantity and gross/discount/net facts', () => {
    const draft = completed(receiptToReviewDraft(fifteen())), review = input(draft)
    const record = reviewedRecord(review, 1, data)
    expect(review.lines).toHaveLength(15)
    expect(record.purchase.originalAmount).toBe(41)
    expect(record.purchase.items[0]).toMatchObject({ unitPrice: 3.25, quantity: 2, discountMinor: 50, lineTotal: 6 })
    expect(record.purchase.items[1]).toMatchObject({ unitPrice: 24, quantity: 0.375, unit: 'kg', lineTotal: 9 })
    expect(record.purchase.items[0].label).toEqual({ en: 'לחם בדוי Bread', he: 'לחם בדוי Bread' })
    expect(record).not.toHaveProperty('demoProductIds')
    const envelope = { ...emptyLocalPurchases(), records: [record], nextSequence: 2 }
    expect(validateLocalPurchases(JSON.parse(JSON.stringify(envelope)), data)).toEqual(envelope)
    expect(draft.observations.lines[0].lineAmount).toBe('6.00')
  })
  it('detects a printed line discrepancy even when the existing computed basket validates', () => {
    const raw = one(); raw.lines[0].lineAmount = '12.49'
    const draft = completed(receiptToReviewDraft(raw))
    expect(errors(draft)).toHaveProperty('printedAmount-0', 'arithmetic')
    expect(draft.review.lines[0]).toMatchObject({ price: '6.25', printedAmount: '12.49' })
    expect(draft.review.amount).toBe('12.50')
    draft.review.lines[0].printedAmount = '12.50' // explicit user correction
    expect(input(draft).amount).toBe('12.50')
    expect(draft.observations.lines[0].lineAmount).toBe('12.49')
  })
  it('preserves a different reviewed payable total without inferring fees, discounts or a replacement total', () => {
    const raw = fifteen(); raw.finalAmount = '40.99'
    const draft = completed(receiptToReviewDraft(raw))
    expect(input(draft).amount).toBe('40.99')
    expect(draft.review.amount).toBe('40.99')
    expect(draft.review.lines[1]).not.toHaveProperty('discount')
  })
  it.each(['date', 'time'] as const)('preserves a missing %s without midnight or current-date invention', field => {
    const raw = one(); raw[field] = null
    const draft = receiptToReviewDraft(raw)
    expect(draft.observations[field]).toBeNull()
    expect(draft.review.date).toBe('')
    expect(errors(draft)).toHaveProperty('date')
    expect(input(completed(draft)).date).toBe('2026-10-03T06:15')
  })
  it('leaves missing/ambiguous required facts unresolved and preserves alternatives', () => {
    const raw = one(); raw.finalAmount = null; raw.currency = { candidates: ['ILS', 'USD'] }
    raw.lines[0] = { name: { candidates: ['לחם', 'חלב'] }, quantity: null, unit: null, unitPrice: null, lineAmount: null }
    const draft = completed(receiptToReviewDraft(raw))
    expect(draft.review).toMatchObject({ amount: '', currency: '', lines: [{ name: '', quantity: '', unit: '', price: '', printedAmount: '' }] })
    expect(errors(draft)).toMatchObject({ currency: 'required', 'name-0': 'required', 'quantity-0': 'quantity', 'unit-0': 'required', 'price-0': 'amount', 'printedAmount-0': 'amount' })
    expect(draft.observations).toEqual(raw)
  })
  it.each([null, '', '-1', '100', '1e2', '0.001', 'O.50', { candidates: ['0.50', '0.60'] }])('does not turn an unresolved/invalid printed discount into zero: %j', discount => {
    const raw = one(); raw.lines[0].discount = discount
    expect(errors(completed(receiptToReviewDraft(raw)))).toHaveProperty('discount-0')
  })
  it('retains explicitly printed zero and a fully discounted line', () => {
    const raw = fifteen(); raw.lines[0].discount = '0.00'; raw.lines[0].lineAmount = '6.50'; raw.finalAmount = '41.50'
    expect(input(completed(receiptToReviewDraft(raw))).lines[0].discount).toBe('0.00')
    raw.lines[0].discount = '6.50'; raw.lines[0].lineAmount = '0.00'; raw.finalAmount = '35.00'
    expect(input(completed(receiptToReviewDraft(raw))).lines[0].discount).toBe('6.50')
  })
  it('uses integer half-up weighted arithmetic, without altering printed decimals', () => {
    const raw = one(); raw.finalAmount = '15.44'
    raw.lines[0] = { name: 'Synthetic weight', quantity: '1.235', unit: 'kg', unitPrice: '12.50', lineAmount: '15.44' }
    expect(input(completed(receiptToReviewDraft(raw))).lines[0].price).toBe('12.50')
    raw.lines[0].lineAmount = '15.43'
    expect(errors(completed(receiptToReviewDraft(raw)))).toHaveProperty('printedAmount-0', 'arithmetic')
  })
  it('never derives a missing unit price from a printed amount', () => {
    const raw = one(); raw.lines[0].unitPrice = null
    const draft = completed(receiptToReviewDraft(raw))
    expect(draft.review.lines[0]).toMatchObject({ price: '', printedAmount: '12.50' })
    expect(errors(draft)).toHaveProperty('price-0')
  })
  it('does not map observed names/addresses to a canonical merchant or place', () => {
    const raw = one(); raw.merchantName = data.merchants[0].name.he
    const draft = receiptToReviewDraft(raw)
    expect(draft.review.merchantId).toBe(''); expect(draft.review.placeId).toBe('')
    completed(draft); draft.review.merchantId = 'fictional-unregistered'
    expect(errors(draft)).toHaveProperty('merchantId')
    draft.review.merchantId = 'merchant_unresolved'
    const record = reviewedRecord(input(draft), 1, data)
    expect(record.purchase.placeId).toBeNull()
    expect(buildPlaceFeatureCollection(data.places, [...data.purchases, record.purchase]).features).toHaveLength(12)
  })
  it('requires explicit compatible physical place and never adds a comparison/demo pin', () => {
    const draft = completed(receiptToReviewDraft(one())), place = data.places[0]
    draft.review.channel = 'physical'; draft.review.merchantId = place.merchantId
    expect(errors(draft)).toHaveProperty('placeId')
    draft.review.placeId = place.id
    const record = reviewedRecord(input(draft), 1, data)
    expect(record.purchase.placeId).toBe(place.id)
    expect(buildPlaceFeatureCollection(data.places, [...data.purchases, record.purchase]).features).toHaveLength(12)
    draft.review.channel = 'online'
    expect(errors(draft)).toHaveProperty('placeId')
    draft.review.placeId = ''
    expect(reviewedRecord(input(draft), 2, data).purchase.placeId).toBeNull()
  })
  it('requires reported ILS for foreign currency and never invents a currency/unit', () => {
    const raw = one(); raw.currency = 'USD'
    const draft = completed(receiptToReviewDraft(raw))
    expect(errors(draft)).toHaveProperty('baseAmount', 'conversion')
    draft.review.baseAmount = '47.11'
    expect(reviewedRecord(input(draft), 1, data).purchase.fx.reportedBaseAmountIls).toBe(47.11)
    raw.currency = 'XXX'; raw.lines[0].unit = 'litre'
    const unsupported = completed(receiptToReviewDraft(raw))
    expect(unsupported.observations.currency).toBe('XXX')
    expect(errors(unsupported)).toMatchObject({ currency: 'required', 'unit-0': 'required' })
  })
  it('validates optional barcodes, preserves zeros, and never assigns product/merchant identities', () => {
    const raw = one(); raw.lines[0].barcode = { original: '2000000000015', format: 'EAN13' }
    const draft = completed(receiptToReviewDraft(raw))
    expect(draft.barcodes[0]).toEqual({ original: '2000000000015', format: 'EAN13', gtin14: '02000000000015' })
    expect(input(draft)).not.toHaveProperty('identification') // per-line codes are not a purchase-level Scanner B candidate
    raw.lines[0].barcode.original = '2000000000016'
    expect(() => receiptToReviewDraft(raw)).toThrow('receipt-observations-invalid')
    raw.lines[0].barcode = { original: { candidates: ['2000000000015', '2000000000022'] }, format: 'EAN13' }
    expect(receiptToReviewDraft(raw).barcodes).toEqual([null])
    raw.lines[0].barcode = null
    expect(input(completed(receiptToReviewDraft(raw))).lines).toHaveLength(1)
  })
  it.each([null, {}, { ...one(), image: 'synthetic-private-image' }, { ...one(), token: 'synthetic-secret' },
    { ...one(), lines: Array(51).fill(one().lines[0]) }, { ...one(), finalAmount: 12.5 },
    { ...one(), lines: [{ ...one().lines[0], name: 'bad\nlabel' }] },
    { ...one(), merchantName: { candidates: ['one'] } }, { ...one(), address: 'x'.repeat(501) },
    { ...one(), lines: [{ ...one().lines[0], barcode: { original: 'https://invalid', format: 'QR' } }] },
  ])('fails closed on malformed or extra payload data without leaking it', raw => {
    expect(validateReceiptObservations(raw)).toBe(false)
    expect(() => receiptToReviewDraft(raw)).toThrow(/^receipt-observations-invalid$/)
  })
  it('requires lines, valid dates, positive prices and currency precision before projection', () => {
    const raw = one(); raw.lines = []
    expect(errors(completed(receiptToReviewDraft(raw)))).toHaveProperty('lines')
    const draft = completed(receiptToReviewDraft(one())); draft.review.date = '2026-02-30T09:00'
    expect(errors(draft)).toHaveProperty('date')
    draft.review.date = '2026-10-03T06:15'; draft.review.lines[0].price = '0'
    expect(errors(draft)).toHaveProperty('price-0')
    draft.review.lines[0].price = '6.255'
    expect(errors(draft)).toHaveProperty('price-0')
    draft.review.lines[0].printedAmount = '1e3'
    expect(errors(draft)).toHaveProperty('printedAmount-0')
  })
  it('rejects malformed edited drafts and projects no sidecar/arbitrary fields', () => {
    const draft = completed(receiptToReviewDraft(one()))
    expect(prepareReceiptReview({ ...draft, review: { ...draft.review, lines: null } } as never, data).ready).toBe(false)
    expect(prepareReceiptReview({ ...draft, review: { ...draft.review, lines: [{ ...draft.review.lines[0], printedAmount: 12.5 }] } } as never, data).ready).toBe(false)
    Object.assign(draft.review, { image: 'synthetic-private-image', token: 'synthetic-secret', identification: { forged: true } })
    const projected = input(draft)
    expect(JSON.stringify(projected)).not.toMatch(/synthetic-private-image|synthetic-secret|printedAmount|observations|barcode|identification/)
  })
  it('has no ledger side effect; existing explicit save, operation consumption and Undo still govern additions', () => {
    const before = JSON.stringify(data), ledger = emptySessionLedger(), draft = completed(receiptToReviewDraft(one()))
    const review = input(draft)
    expect(ledger.records).toHaveLength(0)
    const saved = saveReviewedPurchase(ledger, 'mock-receipt-op', review, data, data.purchases)
    expect(saved.result.code).toBe('saved')
    expect(saveReviewedPurchase(saved.ledger, 'mock-receipt-op', review, data, data.purchases).result.code).toBe('consumed')
    expect(saveReviewedPurchase(saved.ledger, 'different-op', review, data, data.purchases).result.code).toBe('duplicate')
    expect(undoSessionPurchase(saved.ledger).records).toHaveLength(0)
    expect(data.purchases).toHaveLength(42); expect(data.places).toHaveLength(12)
    expect(buildPlaceFeatureCollection(data.places, data.purchases).features).toHaveLength(12)
    expect(derivePurchaseAnalytics(data.purchases, data.evidence).totalBaseAmountIls).toBe(6777.38)
    expect(JSON.stringify(data)).toBe(before)
  })
  it('does not call transport, storage or logging during adaptation/preparation', () => {
    const blocked = vi.fn(() => { throw new Error('test-side-effect-forbidden') })
    const log = vi.spyOn(console, 'log').mockImplementation(blocked)
    const error = vi.spyOn(console, 'error').mockImplementation(blocked)
    const warn = vi.spyOn(console, 'warn').mockImplementation(blocked)
    vi.stubGlobal('fetch', blocked)
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked })
    vi.stubGlobal('indexedDB', { open: blocked })
    try {
      input(completed(receiptToReviewDraft(fifteen())))
      expect(blocked).not.toHaveBeenCalled()
    } finally {
      log.mockRestore(); error.mockRestore(); warn.mockRestore(); vi.unstubAllGlobals()
    }
  })
})

it('preserves explicit directory intent through preparation without bypassing printed arithmetic', () => {
  const draft=receiptToReviewDraft(one())
  Object.assign(draft.review,{channel:'physical',date:'2026-10-03T09:15',payment:'cash',category:'groceries',directoryIntent:{merchant:{name:'Fictional reviewed store',category:'groceries',separate:false},place:{branch:'Fictional branch',city:'Fictional city',country:'Fictional country',address:'Fictional address',longitude:'34.75',latitude:'32.1',confirmed:true,separate:false}}})
  const original=JSON.stringify(draft.observations),prepared=prepareReceiptReview(draft,data)
  expect(prepared.ready).toBe(true)
  if(prepared.ready) expect(prepared.input.directoryIntent).toEqual(draft.review.directoryIntent)
  draft.review.lines[0].printedAmount='12.51'
  expect(prepareReceiptReview(draft,data)).toMatchObject({ready:false,errors:{'printedAmount-0':'arithmetic'}})
  expect(JSON.stringify(draft.observations)).toBe(original)
  draft.review.directoryIntent!.place!.confirmed=false
  expect(prepareReceiptReview(draft,data)).toMatchObject({ready:false,errors:{'place-confirmed':'location'}})
})
