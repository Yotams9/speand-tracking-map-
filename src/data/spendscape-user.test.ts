import { describe, expect, it } from 'vitest'
import { createFixtureSpendscapeRepository } from './spendscape-repository'
import { composeUserGraph, syntheticQaAllowed, userApplicationSnapshot } from './spendscape-user'
import { buildPlaceFeatureCollection, derivedPurchaseSummary } from './spendscape-globe'
import { derivePurchaseAnalytics } from './spendscape-analytics'
import { blankReview, emptySessionLedger, saveReviewedPurchase, reviewedRecord, undoSessionPurchase } from '../features/capture/session-purchase-domain'
import { emptyLocalPurchases, validateLocalPurchases, validateLocalPurchaseWrite } from '../features/local-purchases/local-purchase-store'

const history = await createFixtureSpendscapeRepository().loadSnapshot()
const context = userApplicationSnapshot(history)
const place = history.places[0]
const input = { ...blankReview(), source: 'receipt' as const, merchantId: place.merchantId, placeId: place.id, channel: 'physical' as const, date: '2013-09-30T09:57', currency: 'ILS' as const, payment: 'unknown' as const, category: 'unknown' as const, amount: '12.05', lines: [{ name: 'מוצר בדיקה', quantity: '2', unit: 'item' as const, price: '6.00' }] }
const record = reviewedRecord(input, 1, history)
const current = { ...emptyLocalPurchases(), revision: 7, records: [record], nextSequence: 2 }

describe('ordinary local-user graph and historical storage compatibility', () => {
  it('starts empty while retaining the exact validation references', () => {
    expect(context.purchases).toEqual([]); expect(context.evidence).toEqual([])
    expect(context.merchants).toBe(history.merchants); expect(context.places).toBe(history.places)
    expect(context.smartInboxCases).toBe(history.smartInboxCases)
    expect(context.source).toMatchObject({ classification: 'real', adapter: 'local' })
    const graph = composeUserGraph(context, emptyLocalPurchases().directory, [])
    expect(graph.merchants).toEqual([]); expect(graph.places).toEqual([])
    expect(buildPlaceFeatureCollection(graph.places, graph.purchases).features).toEqual([])
    expect(derivePurchaseAnalytics(graph.purchases, []).purchaseCount).toBe(0)
  })
  it('retains reviewed IDs, amounts and known references without seeding other entities', () => {
    const before = structuredClone(current)
    const hydrated = validateLocalPurchases(current, context)
    expect(hydrated).toEqual(before); expect(current).toEqual(before)
    const graph = composeUserGraph(context, hydrated.directory, hydrated.records)
    expect(graph.purchases).toEqual([record.purchase]); expect(graph.places).toEqual([place])
    expect(graph.merchants.map(m => m.id)).toEqual([place.merchantId])
    expect(buildPlaceFeatureCollection(graph.places, graph.purchases).features).toHaveLength(1)
    expect(derivedPurchaseSummary(graph.purchases, graph.places).totalBaseAmountIls).toBe(12.05)
    expect(graph.purchases[0].items.reduce((sum, i) => sum + Math.round(i.lineTotal * 100), 0)).toBe(1200)
  })
  for (const version of [1, 2, 3, 4]) it(`strict v${version} read-only migration preserves referenced legacy entities`, () => {
    const legacyRecord = reviewedRecord({ ...input, source: 'manual', amount: '12.00', payment: 'cash', category: 'groceries' }, 1, history)
    const raw: any = { ...current, version, records: [legacyRecord], decisions: [{ caseId: history.smartInboxCases[0].id, status: 'deferred' }] }
    delete raw.legacyMain
    if (version < 3) delete raw.directory
    const before = structuredClone(raw)
    const hydrated = validateLocalPurchases(raw, context)
    expect(raw).toEqual(before); expect(hydrated.records).toEqual(before.records)
    expect(hydrated.revision).toBe(7); expect(hydrated.nextSequence).toBe(2)
    expect(hydrated.decisions).toEqual(before.decisions); expect(hydrated.version).toBe(5)
    expect(validateLocalPurchaseWrite(hydrated, context)).toEqual(hydrated)
  })
  it('keeps discounts and fully discounted lines unchanged', () => {
    const discounted = reviewedRecord({ ...input, amount: '1.00', lines: [{ name: 'Zero net', quantity: '1', unit: 'item', price: '6.00', discount: '6.00' }] }, 1, history)
    const saved = validateLocalPurchases({ ...current, records: [discounted] }, context)
    expect(saved.records[0].purchase.items[0]).toMatchObject({ discountMinor: 600, lineTotal: 0, unitPrice: 6 })
  })
  it('preserves hidden historical synthetic additions and decisions in storage only', () => {
    const synthetic = reviewedRecord({ ...input, provenance: 'synthetic-demo', payment: 'cash', category: 'groceries', amount: '12.00' }, 1, history)
    const raw = { ...current, records: [synthetic], decisions: [{ caseId: history.smartInboxCases[0].id, status: 'deferred' as const }] }
    const hydrated = validateLocalPurchases(raw, context)
    expect(hydrated).toEqual(raw)
    expect(composeUserGraph(context, hydrated.directory, hydrated.records).purchases).toEqual([])
  })
  it('keeps online/unresolved records unpinned and merges shared physical places', () => {
    const online = reviewedRecord({ ...input, channel: 'online', placeId: '' }, 2, history)
    const unresolved = reviewedRecord({ ...input, channel: 'unknown', placeId: '' }, 3, history)
    const second = reviewedRecord({ ...input, date: '2013-10-01T09:57' }, 4, history)
    const graph = composeUserGraph(context, current.directory, [record, online, unresolved, second])
    expect(graph.purchases).toHaveLength(4); expect(graph.places).toHaveLength(1)
    expect(buildPlaceFeatureCollection(graph.places, graph.purchases).features).toHaveLength(1)
  })
  it('creates a real-user merchant without fixture lookup, retains it on hydration, and undoes without mutating input', () => {
    const saved = saveReviewedPurchase(emptySessionLedger(), 'new', { ...input, channel: 'unknown', placeId: '', merchantId: '', directoryIntent: { merchant: { name: 'Fictional QA merchant', category: 'unknown', separate: false } } }, { merchants: [], places: [] }, [])
    expect(saved.result.code).toBe('saved')
    const raw = { ...emptyLocalPurchases(), directory: saved.ledger.directory, records: saved.ledger.records, nextSequence: saved.ledger.nextSequence }
    expect(validateLocalPurchases(raw, context)).toEqual(raw)
    const graph = composeUserGraph(context, raw.directory, raw.records)
    expect(graph.merchants.map(m => m.id)).toEqual(['local_merchant_1']); expect(graph.places).toEqual([])
    expect(undoSessionPurchase(saved.ledger).records).toEqual([]); expect(saved.ledger.records).toHaveLength(1)
    expect(saveReviewedPurchase(saved.ledger, 'other', input, history, [record.purchase]).result.code).toBe('duplicate')
  })
  for (const alter of [(r: any) => { r.version = 6 }, (r: any) => { r.records[0].purchase.merchantId = 'missing' }, (r: any) => { r.records[0].purchase.items[0].lineTotal = 11 }, (r: any) => { r.directory.merchants = [{}] }]) it('rejects corrupt/future graphs instead of partial salvage', () => {
    const raw = structuredClone(current); alter(raw)
    expect(() => validateLocalPurchases(raw, context)).toThrow('invalid')
  })
})

it('requires server opt-in AND loopback AND explicit synthetic QA path', () => {
  expect(syntheticQaAllowed('1', '127.0.0.1:3191', '1')).toBe(true)
  for (const [enabled, host, opt] of [[undefined, '127.0.0.1', '1'], ['1', 'example.com', '1'], ['1', '127.0.0.1.evil', '1'], ['1', 'localhost', undefined], ['1', 'localhost', ['1']]]) expect(syntheticQaAllowed(enabled as string | undefined, host as string, opt)).toBe(false)
})
