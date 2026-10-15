import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData as data } from '../../data/spendscape-fixtures'
import { fixtureSpendscapeRepository } from '../../data/spendscape-repository'
import { userApplicationSnapshot } from '../../data/spendscape-user'
import { blankReview, saveReviewedPurchase, emptySessionLedger, validateReview, type PurchaseReviewInput } from '../capture/session-purchase-domain'
import { composeDirectory, proposeDirectory, validateDirectory, validDirectoryIntent, type LocalDirectory } from './local-directory'
import { validateLocalPurchases } from './local-purchase-store'
import { exportPurchaseBackup, inspectPurchaseBackup } from './purchase-backup'
import { catalogArea, devicePlaceLabels, type CatalogStoreChoice } from './place-provenance'

const choice = (id = 'ramilevi-733', name = 'Ben Yehuda 23'): CatalogStoreChoice => ({ id, chain: id.split('-')[0] as CatalogStoreChoice['chain'], name, address: 'Ben Yehuda 23', coordinates: [34.76795, 32.0764] })
const proposed = () => proposeDirectory({ catalogStore: choice() }, '', 'physical', 1, data)

describe('Tel Aviv catalog stores as confirmed places', () => {
  it('proposes a chain merchant and a catalog-store place with published provenance', () => {
    const p = proposed()
    expect(p.errors).toEqual({})
    expect(p.directory.merchants).toEqual([{ id: 'local_merchant_1', name: { en: 'Rami Levy', he: 'רמי לוי' }, category: 'groceries', source: 'user-confirmed', catalogChain: 'ramilevi' }])
    expect(p.directory.places[0]).toEqual({ id: 'local_place_1', merchantId: 'local_merchant_1', name: { en: 'Rami Levy', he: 'רמי לוי' }, branch: { en: 'Ben Yehuda 23', he: 'Ben Yehuda 23' }, city: { ...catalogArea.city }, country: { ...catalogArea.country }, coordinates: [34.76795, 32.0764], category: 'groceries', address: 'Ben Yehuda 23', source: 'user-confirmed', locationMethod: 'catalog-store', catalogStore: { storeId: 'ramilevi-733', chain: 'ramilevi', publishedAddress: 'Ben Yehuda 23' } })
    expect(validateDirectory(p.directory, data, 2)).toEqual(p.directory)
  })
  it('reuses an existing catalog place instead of creating a second one', () => {
    const p = proposed(), context = composeDirectory(data, p.directory)
    const again = proposeDirectory({ catalogStore: choice() }, '', 'physical', 2, context)
    expect(again).toMatchObject({ errors: {}, merchantId: 'local_merchant_1', placeId: 'local_place_1', directory: { merchants: [], places: [] } })
    const branch = proposeDirectory({ catalogStore: choice('ramilevi-12', 'Dizengoff') }, '', 'physical', 2, context)
    expect(branch.directory.merchants).toEqual([])
    expect(branch.directory.places.map(p => [p.id, p.merchantId])).toEqual([['local_place_2', 'local_merchant_1']])
  })
  it('never takes a catalog place for an online or unresolved purchase', () => {
    expect(proposeDirectory({ catalogStore: choice() }, '', 'online', 1, data).errors).toHaveProperty('placeId')
    expect(proposeDirectory({ catalogStore: choice() }, '', 'unknown', 1, data).errors).toHaveProperty('placeId')
  })
  it('fails closed on tampered provenance, labels or duplicate stores', () => {
    const p = proposed().directory
    for (const mutate of [
      (d: any) => { d.places[0].catalogStore.storeId = 'shufersal-733' },
      (d: any) => { d.places[0].catalogStore.chain = 'osherad' },
      (d: any) => { d.places[0].address = 'Somewhere else' },
      (d: any) => { d.places[0].city = { en: 'Haifa', he: 'Haifa' } },
      (d: any) => { delete d.places[0].catalogStore },
      (d: any) => { d.places[0].locationMethod = 'manual-coordinates' },
      (d: any) => { d.places[0].addressSearch = { provider: 'x' } },
      (d: any) => { d.places[0].catalogStore.extra = true },
      (d: any) => { d.merchants[0].name = { en: 'Rami Levy', he: 'Rami Levy' } },
      (d: any) => { d.merchants[0].category = 'food'; d.places[0].category = 'food' },
      (d: any) => { delete d.merchants[0].catalogChain },
      (d: any) => { d.merchants[0].catalogChain = 'unknownchain' },
      (d: any) => { d.places.push({ ...structuredClone(d.places[0]), id: 'local_place_2' }) },
      (d: any) => { d.merchants.push({ ...structuredClone(d.merchants[0]), id: 'local_merchant_2' }) },
    ]) {
      const d = structuredClone(p); mutate(d)
      expect(() => validateDirectory(d, data, 3)).toThrow()
    }
  })
  it('accepts device-location places only with their own fixed labels and no address', () => {
    const merchant = { id: 'local_merchant_1', name: { en: 'Corner', he: 'Corner' }, category: 'groceries' as const, source: 'user-confirmed' as const }
    const place = { id: 'local_place_1', merchantId: 'local_merchant_1', name: { en: 'Corner', he: 'Corner' }, branch: { ...devicePlaceLabels.branch }, city: { ...devicePlaceLabels.city }, country: { ...devicePlaceLabels.country }, coordinates: [34.77, 32.08] as [number, number], category: 'groceries' as const, address: '', source: 'user-confirmed' as const, locationMethod: 'device-location' as const }
    const directory: LocalDirectory = { merchants: [merchant], places: [place] }
    expect(validateDirectory(directory, data, 2)).toEqual(directory)
    expect(() => validateDirectory({ merchants: [merchant], places: [{ ...place, address: 'Typed' }] }, data, 2)).toThrow()
    expect(() => validateDirectory({ merchants: [merchant], places: [{ ...place, branch: { en: 'Corner', he: 'Corner' } }] }, data, 2)).toThrow()
  })
  it('a branch suggested by the device location cannot be saved until the person confirms it', async () => {
    const context = userApplicationSnapshot(await fixtureSpendscapeRepository.loadSnapshot())
    const review = (locationSuggested?: { confirmed: boolean }): PurchaseReviewInput => ({ ...blankReview(), channel: 'physical', date: '2026-10-04T09:15', currency: 'ILS', payment: 'card', category: 'groceries', amount: '8.20', lines: [{ name: 'Cola', quantity: '1', unit: 'item', price: '8.20' }], directoryIntent: { catalogStore: choice(), ...(locationSuggested ? { locationSuggested } : {}) } })
    // Suggested, not confirmed: the review and the save both refuse, and nothing is written.
    expect(validateReview(review({ confirmed: false }), context)).toMatchObject({ 'catalog-confirmed': 'location' })
    const blocked = saveReviewedPurchase(emptySessionLedger(), 'op-1', review({ confirmed: false }), context, [])
    expect(blocked.result).toMatchObject({ code: 'invalid', errors: { 'catalog-confirmed': 'location' } })
    expect(blocked.ledger).toEqual(emptySessionLedger())
    // Confirmed: the same confirmed catalog place as a branch picked from the list.
    const confirmed = saveReviewedPurchase(emptySessionLedger(), 'op-2', review({ confirmed: true }), context, [])
    const picked = saveReviewedPurchase(emptySessionLedger(), 'op-3', review(), context, [])
    expect(confirmed.result.code).toBe('saved')
    expect(confirmed.ledger.directory).toEqual(picked.ledger.directory)
    expect(confirmed.ledger.directory.places[0]).toMatchObject({ source: 'user-confirmed', locationMethod: 'catalog-store', catalogStore: { storeId: 'ramilevi-733' } })
    // The same holds when the suggested branch is already one of the person's places.
    const known = composeDirectory(context, confirmed.ledger.directory)
    expect(proposeDirectory({ catalogStore: choice(), locationSuggested: { confirmed: false } }, '', 'physical', 3, known)).toMatchObject({ errors: { 'catalog-confirmed': 'location' }, placeId: 'local_place_1' })
    expect(proposeDirectory({ catalogStore: choice(), locationSuggested: { confirmed: true } }, '', 'physical', 3, known)).toMatchObject({ errors: {}, placeId: 'local_place_1', directory: { merchants: [], places: [] } })
    // The flag exists only with a catalog branch and only in its exact shape.
    for (const intent of [{ locationSuggested: { confirmed: true } }, { catalogStore: choice(), locationSuggested: { confirmed: 'yes' } }, { catalogStore: choice(), locationSuggested: { confirmed: true, by: 'gps' } }, { catalogStore: choice(), locationSuggested: true }])
      expect(validDirectoryIntent(intent)).toBe(false)
  })
  it('round-trips through the IndexedDB envelope and the backup file', async () => {
    const context = userApplicationSnapshot(await fixtureSpendscapeRepository.loadSnapshot())
    const input: PurchaseReviewInput = { ...blankReview(), channel: 'physical', date: '2026-10-04T09:15', currency: 'ILS', payment: 'card', category: 'groceries', amount: '8.20', lines: [{ name: 'Cola', quantity: '1', unit: 'item', price: '8.20' }], directoryIntent: { catalogStore: choice() } }
    const saved = saveReviewedPurchase(emptySessionLedger(), 'op-1', input, context, [])
    expect(saved.result.code).toBe('saved')
    const envelope = { version: 4 as const, directory: saved.ledger.directory, revision: 0, records: saved.ledger.records, nextSequence: saved.ledger.nextSequence, decisions: [] }
    expect(validateLocalPurchases(envelope, context)).toEqual(envelope)
    const backup = await exportPurchaseBackup(envelope, context)
    const preview = await inspectPurchaseBackup(backup, context)
    expect(preview).toMatchObject({ purchases: 1, merchants: 1, places: 1 })
    expect(preview.data.directory.places[0].catalogStore).toEqual({ storeId: 'ramilevi-733', chain: 'ramilevi', publishedAddress: 'Ben Yehuda 23' })
    // Older envelope versions never carried catalog places.
    expect(() => validateLocalPurchases({ ...envelope, version: 3 }, context)).toThrow()
  })
})
