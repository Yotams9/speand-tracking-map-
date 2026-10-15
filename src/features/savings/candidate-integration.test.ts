import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData } from '../../data/spendscape-fixtures'
import { fixtureSpendscapeRepository } from '../../data/spendscape-repository'
import { userApplicationSnapshot } from '../../data/spendscape-user'
import type { CatalogStoreSummary } from '../../data/price-catalog'
import type { Merchant, Place } from '../../data/spendscape-globe'
import { validateBarcode } from '../capture/barcode-domain'
import { catalogChoice, followPublishedPrice, isLocated } from '../capture/catalog-stores'
import { demoDraftForSource } from '../capture/capture-domain'
import { blankReview, emptySessionLedger, reviewedRecord, reviewFromDemo, saveReviewedPurchase, type PurchaseReviewInput } from '../capture/session-purchase-domain'
import { composeDirectory } from '../local-purchases/local-directory'
import { planLegacyImport } from '../local-purchases/legacy-device-migration'
import { savingsBasket } from './purchase-basket'

// integration/candidate: the savings engine on top of fix/integration-review.
const barcode = validateBarcode('7290110115210', 'EAN13')
if (!barcode.valid) throw new Error('fixture barcode')
const identification = { identity: barcode.identity, method: 'manual' as const, syntheticCatalog: false }
const store: CatalogStoreSummary = { id: 'ramilevi-733', chain: 'ramilevi', chainName: { en: 'Rami Levy', he: 'רמי לוי' }, name: 'Ben Yehuda 23', address: 'בן יהודה 23', location: { lat: 32.0764, lon: 34.76795, osm: 'node/1', accuracy: 'address point' } }
if (!isLocated(store)) throw new Error('fixture store')
const context = () => fixtureSpendscapeRepository.loadSnapshot().then(userApplicationSnapshot)
const base = (): PurchaseReviewInput => ({ ...blankReview(), source: 'barcode', provenance: 'user-reviewed', channel: 'physical', date: '2026-10-04T09:15', currency: 'ILS', payment: 'card', category: 'groceries', amount: '', lines: [{ name: 'Cola 1.5 L', quantity: '', price: '', unit: 'item' }], identification, catalogPrices: { 'ramilevi-733': 8.2 } })

describe('savings panel on the integration candidate', () => {
  it('(a) a branch suggested by the device location and then confirmed gets a panel from that branch', async () => {
    const ctx = await context()
    // FIX 7 fills the published price; FIX 4 needs the confirmation before saving.
    const filled = followPublishedPrice(base(), store.id, null).input
    const input = { ...filled, directoryIntent: { catalogStore: catalogChoice(store), locationSuggested: { confirmed: true } } }
    expect(saveReviewedPurchase(emptySessionLedger(), 'op-0', { ...input, directoryIntent: { ...input.directoryIntent, locationSuggested: { confirmed: false } } }, ctx, []).result.code).toBe('invalid')
    const saved = saveReviewedPurchase(emptySessionLedger(), 'op-1', input, ctx, [])
    expect(saved.result.code).toBe('saved')
    const record = saved.ledger.records[0]
    const basket = savingsBasket(record.purchase, record, composeDirectory(ctx, saved.ledger.directory).places)
    expect(basket).toEqual({ items: [{ ref: record.purchase.items[0].id, gtin14: barcode.identity.gtin14, quantity: 1, unit: 'item', paidMinor: 820 }], origin: { lat: 32.0764, lon: 34.76795, storeId: 'ramilevi-733' } })
  })
  it('(b) a purchase migrated from the old ledger at a chain branch gets the right origin', async () => {
    const ctx = await context()
    const merchants: Merchant[] = [{ id: 'chain_ramilevi', name: { en: 'Rami Levy', he: 'רמי לוי' }, category: 'groceries' }]
    const places: Place[] = [{ id: 'store_ramilevi_733', merchantId: 'chain_ramilevi', name: { en: 'Rami Levy', he: 'רמי לוי' }, branch: { en: 'Ben Yehuda 23', he: 'Ben Yehuda 23' }, city: { en: 'Tel Aviv-Yafo', he: 'תל אביב-יפו' }, country: { en: 'Israel', he: 'ישראל' }, coordinates: [34.76795, 32.0764], category: 'groceries' }]
    const old = { merchants: [...canonicalSpendscapeData.merchants, ...merchants], places: [...canonicalSpendscapeData.places, ...places] }
    const legacy = reviewedRecord({ ...base(), merchantId: 'chain_ramilevi', placeId: 'store_ramilevi_733', amount: '16.40', lines: [{ name: 'Cola 1.5 L', quantity: '2', unit: 'item', price: '8.20' }] }, 1, old)
    const plan = planLegacyImport(JSON.stringify({ version: 1, nextSequence: 2, merchants, places, records: [legacy] }), ctx, [store])
    if (plan.kind !== 'ready') throw new Error(JSON.stringify(plan))
    const record = plan.data.records[0]
    const basket = savingsBasket(record.purchase, record, composeDirectory(ctx, plan.data.directory).places)
    expect(basket?.origin).toEqual({ lat: 32.0764, lon: 34.76795, storeId: 'ramilevi-733' })
    expect(basket?.items).toEqual([{ ref: record.purchase.items[0].id, gtin14: barcode.identity.gtin14, quantity: 2, unit: 'item', paidMinor: 1640 }])
  })
  it('(c) demo purchases never get a panel', async () => {
    const ctx = await context()
    const demo = reviewedRecord(reviewFromDemo(demoDraftForSource('receipt')!, 'en'), 1, ctx)
    expect(demo.synthetic).toBe(true)
    expect(savingsBasket(demo.purchase, demo, ctx.places)).toBeNull()
    for (const purchase of canonicalSpendscapeData.purchases) expect(savingsBasket(purchase, undefined, ctx.places)).toBeNull()
  })
})
