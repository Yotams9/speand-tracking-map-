import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData as history } from '../../data/spendscape-fixtures'
import type { CatalogStoreSummary } from '../../data/price-catalog'
import { catalogProposal, clearCatalogSelection, distanceMeters, isLocated, nearestCatalogStore } from './catalog-stores'
import { blankReview, emptySessionLedger, saveReviewedPurchase, undoSessionPurchase, validateReview } from './session-purchase-domain'
import { composeDirectory } from '../local-purchases/local-directory'
import { emptyLocalPurchases, validateLocalPurchases } from '../local-purchases/local-purchase-store'
import { buildPlaceFeatureCollection } from '../../data/spendscape-globe'
const fixtures = { ...history, source: { adapter: 'fixture' as const, classification: 'synthetic' as const, version: history.fixtureVersion } }
const store: CatalogStoreSummary = { id: 'shufersal-1', chain: 'shufersal', chainName: { en: 'Synthetic chain', he: 'רשת בדיקה' }, name: 'Synthetic branch', address: 'Synthetic 1', publishedLocal: '2026-10-04 03:00', location: { lat: 32.0814, lon: 34.77, osm: 'node/1', accuracy: 'address point' } }
export const catalogFixture = store
const context = { merchants: [], places: [] }
describe('catalog selection through the canonical directory authority', () => {
  it('proposes facts only; never sets payment, date, quantity or paid prices', () => {
    if (!isLocated(store)) throw 0
    const proposal = catalogProposal(store,context)
    expect(proposal.directoryIntent?.place).toMatchObject({ confirmed: false, catalogStoreId: store.id })
    expect(Object.keys(proposal)).toEqual(['merchantId','placeId','directoryIntent'])
    expect(nearestCatalogStore([store], [34.77,32.0814])?.store.id).toBe(store.id)
    expect(nearestCatalogStore([store], [34,31])).toBeNull()
    expect(distanceMeters([34.77,32.08], [34.77,32.09])).toBeCloseTo(1112,-1)
  })
  it('requires explicit place/category confirmation; saves one canonical pin and reuses it', () => {
    if (!isLocated(store)) throw 0
    const proposal = catalogProposal(store,context)
    const input = { ...blankReview(), ...proposal, source: 'manual' as const, provenance: 'user-reviewed' as const, channel: 'physical' as const, date: '2026-10-04T10:15', currency: 'ILS' as const, payment: 'unknown' as const, category: 'groceries' as const, amount: '12.50' }
    expect(validateReview(input,context)).toHaveProperty('place-confirmed')
    const intent = proposal.directoryIntent!
    intent.merchant!.category = 'groceries'; intent.place!.confirmed = true
    const first = saveReviewedPurchase(emptySessionLedger(),'one',input,context,[])
    expect(first.result.code).toBe('saved')
    const graph = composeDirectory(context,first.ledger.directory)
    expect(first.ledger.directory.places[0]).toMatchObject({ locationMethod: 'catalog-selection', catalogStoreId: store.id, address: store.address })
    const reuse = catalogProposal(store,graph)
    expect(reuse.directoryIntent).toBeUndefined()
    const second = saveReviewedPurchase(first.ledger,'two',{ ...input, ...reuse, date: '2026-10-05T10:15', amount: '14.00' },graph,first.ledger.records.map(r => r.purchase))
    expect(second.result.code).toBe('saved')
    expect(second.ledger.directory.places).toHaveLength(1)
    const pins = buildPlaceFeatureCollection(graph.places,second.ledger.records.map(r => r.purchase))
    expect(pins.features).toHaveLength(1); expect(pins.features[0].properties.visitCount).toBe(2)
    const stored = validateLocalPurchases({ ...emptyLocalPurchases(), directory: second.ledger.directory, records: second.ledger.records, nextSequence: second.ledger.nextSequence },fixtures)
    expect(stored.records.map(r => r.purchase.originalAmount)).toEqual([12.5,14])
    expect(undoSessionPurchase(second.ledger).records).toHaveLength(1)
  })
})


describe('clearing only catalog-owned review values', () => {
  const proposal = catalogProposal(store as Parameters<typeof catalogProposal>[0], context)
  it('clears an untouched proposal, including merchant, address, coordinates and confirmation', () => {
    const before = blankReview(), applied = { ...before, ...proposal }
    const cleared = clearCatalogSelection(applied, { before, applied })
    expect(cleared).toEqual({ merchantId: '', placeId: '', directoryIntent: undefined })
  })
  it('restores independently entered details present before catalog selection', () => {
    const before = { ...blankReview(), merchantId: 'independent-merchant', directoryIntent: { place: { branch: 'User branch', city: 'User city', country: 'User country', address: 'User address', longitude: '1', latitude: '2', confirmed: true, separate: false } } }
    const applied = { ...before, ...proposal }
    expect(clearCatalogSelection(applied, { before, applied })).toEqual({ merchantId: before.merchantId, placeId: '', directoryIntent: before.directoryIntent })
  })
  it('keeps later independent edits, clears unchanged catalog values and requires reconfirmation', () => {
    const before = blankReview(), applied = { ...before, ...proposal }
    const edited = { ...applied, directoryIntent: { merchant: { ...applied.directoryIntent!.merchant!, name: 'Independent merchant', category: 'unknown' as const }, place: { ...applied.directoryIntent!.place!, address: 'Independent address', longitude: '1', latitude: '2', confirmed: true } } }
    const result = clearCatalogSelection(edited, { before, applied })
    expect(result.directoryIntent?.merchant).toMatchObject({ name: 'Independent merchant', category: 'unknown' })
    expect(result.directoryIntent?.place).toMatchObject({ address: 'Independent address', longitude: '1', latitude: '2', branch: '', city: '', country: '', confirmed: false })
    expect(result.directoryIntent?.place).not.toHaveProperty('catalogStoreId')
    expect(edited.directoryIntent.place.catalogStoreId).toBe(store.id)
  })
  it('does not clear an independently chosen existing place or removed proposal', () => {
    const before = blankReview(), applied = { ...before, ...proposal }
    const current = { merchantId: 'user-merchant', placeId: 'user-place', directoryIntent: undefined }
    expect(clearCatalogSelection(current, { before, applied })).toEqual(current)
  })
})
