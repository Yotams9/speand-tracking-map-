import { globePurchases, globePlaces } from '../../data/spendscape-fixtures'
import { describe, expect, it } from 'vitest'
import { buildPlaceFeatureCollection, nestedItemTotal } from '../../data/spendscape-globe'
import {
  canConfirmDraft,
  captureReducer,
  combineSessionPurchases,
  createSessionCaptureRecord,
  demoDraftForSource,
  initialCaptureState,
  manualDraft,
  receiptArithmetic,
  validateManualCapture,
  type ManualCaptureInput,
} from './capture-domain'

describe('Slice 1D.3 deterministic Capture domain', () => {
  it('moves through scanner, processing, review, confirmation, retry, and reset states', () => {
    const processing = captureReducer(initialCaptureState, { type: 'choose-source', source: 'receipt' })
    expect(processing).toMatchObject({ step: 'processing', source: 'receipt', attempt: 0 })

    const draft = demoDraftForSource('receipt')!
    const review = captureReducer(processing, { type: 'draft-ready', draft })
    expect(review.step).toBe('review')
    expect(review.draft).toEqual(draft)

    const success = captureReducer(review, { type: 'confirm', purchaseId: 'session_purchase_receipt_01' })
    expect(success).toMatchObject({ step: 'success', lastPurchaseId: 'session_purchase_receipt_01' })

    const failure = captureReducer(initialCaptureState, { type: 'choose-source', source: 'failure' })
    const retry = captureReducer(failure, { type: 'retry' })
    expect(retry).toMatchObject({ step: 'processing', source: 'receipt', attempt: 1 })
    expect(captureReducer(retry, { type: 'reset-flow' })).toEqual(initialCaptureState)
  })

  it('reconciles the synthetic nested receipt exactly', () => {
    const draft = demoDraftForSource('receipt')!
    const arithmetic = receiptArithmetic(draft)

    expect(draft.items).toHaveLength(4)
    expect(draft.items.map((item) => item.lineTotal)).toEqual([18.5, 18, 24.9, 25.5])
    expect(arithmetic).toEqual({ itemTotal: 86.9, purchaseTotal: 86.9, reconciles: true })

    const record = createSessionCaptureRecord(draft, 1)
    expect(nestedItemTotal(record.purchase)).toBe(record.purchase.originalAmount)
  })

  it('validates required manual fields in English and Hebrew', () => {
    const invalid: ManualCaptureInput = {
      merchantId: '', placeId: null, amount: '0', currency: 'ILS', timestamp: '',
      category: 'groceries', paymentMode: 'cash', channel: 'physical',
    }
    expect(validateManualCapture(invalid, 'en')).toEqual({
      merchantId: 'Choose a merchant.',
      amount: 'Enter a positive amount.',
      timestamp: 'Choose a date and time.',
      placeId: 'Choose a physical place or mark it unresolved.',
    })
    expect(validateManualCapture(invalid, 'he').amount).toBe('יש להזין סכום חיובי.')
  })

  it('preserves original currency and fixed synthetic provenance', () => {
    const draft = demoDraftForSource('pdf')!
    const record = createSessionCaptureRecord(draft, 2)

    expect(record.purchase.originalCurrency).toBe('EUR')
    expect(record.purchase.originalAmount).toBe(75)
    expect(record.purchase.fx).toMatchObject({
      baseCurrency: 'ILS',
      rateToBase: 4.05,
      source: 'synthetic-fixture-rate',
    })
    expect(record.evidence.synthetic).toBe(true)
  })

  it('creates stable IDs and keeps session records separate from immutable baseline fixtures', () => {
    const baselineIds = globePurchases.map((purchase) => purchase.id)
    const baselineLength = globePurchases.length
    const draft = demoDraftForSource('receipt')!
    const first = createSessionCaptureRecord(draft, 1)
    const repeated = createSessionCaptureRecord(draft, 1)
    const combined = combineSessionPurchases(globePurchases, [first])

    expect(first).toEqual(repeated)
    expect(first.purchase.id).toBe('session_purchase_receipt_01')
    expect(first.evidence.id).toBe('session_evidence_receipt_01')
    expect(globePurchases).toHaveLength(baselineLength)
    expect(globePurchases.map((purchase) => purchase.id)).toEqual(baselineIds)
    expect(combined).toHaveLength(baselineLength + 1)
    expect(combined).not.toBe(globePurchases)
  })

  it('aggregates an existing physical place into its one canonical pin', () => {
    const before = buildPlaceFeatureCollection(globePlaces, globePurchases)
    const receipt = createSessionCaptureRecord(demoDraftForSource('receipt')!, 1)
    const combined = combineSessionPurchases(globePurchases, [receipt])
    const after = buildPlaceFeatureCollection(globePlaces, combined)
    const beforeShuk = before.features.find((feature) => feature.properties.placeId === 'place_shuk_bograshov')!
    const afterShuk = after.features.find((feature) => feature.properties.placeId === 'place_shuk_bograshov')!

    expect(after.features).toHaveLength(before.features.length)
    expect(afterShuk.properties.visitCount).toBe(beforeShuk.properties.visitCount + 1)
    expect(new Set(after.features.map((feature) => feature.properties.placeId)).size).toBe(after.features.length)
  })

  it('creates no pins for captured online or unresolved purchases', () => {
    const online = createSessionCaptureRecord(demoDraftForSource('document')!, 1)
    const unresolved = createSessionCaptureRecord(manualDraft({
      merchantId: 'merchant_unresolved', placeId: null, amount: '41', currency: 'ILS',
      timestamp: '2026-08-29T17:45', category: 'retail', paymentMode: 'cash', channel: 'unknown',
    }), 2)
    const baselinePins = buildPlaceFeatureCollection(globePlaces, globePurchases).features.length
    const combined = combineSessionPurchases(globePurchases, [online, unresolved])

    expect(online.purchase.placeId).toBeNull()
    expect(unresolved.purchase.placeId).toBeNull()
    expect(buildPlaceFeatureCollection(globePlaces, combined).features).toHaveLength(baselinePins)
  })

  it('does not allow product or barcode recognition alone to confirm a purchase or retain a photo', () => {
    for (const source of ['product', 'barcode'] as const) {
      const draft = demoDraftForSource(source)!
      expect(canConfirmDraft(draft)).toBe(false)
      expect(draft.productCandidateOnly).toBe(true)
      expect(draft.originalAmount).toBeNull()
      expect(JSON.stringify(draft)).not.toMatch(/photo|image|url/i)
    }
  })

  it('can reset the combined session graph back to the canonical baseline', () => {
    const record = createSessionCaptureRecord(demoDraftForSource('receipt')!, 1)
    expect(combineSessionPurchases(globePurchases, [record])).toHaveLength(globePurchases.length + 1)
    expect(combineSessionPurchases(globePurchases, [])).toEqual(globePurchases)
    expect(combineSessionPurchases(globePurchases, [])).not.toBe(globePurchases)
  })
})
