import { describe, expect, it, vi } from 'vitest'
import { canonicalSpendscapeData } from '../../data/spendscape-fixtures'
import { buildPlaceFeatureCollection, type Merchant, type Place } from '../../data/spendscape-globe'
import { fixtureSpendscapeRepository } from '../../data/spendscape-repository'
import { userApplicationSnapshot } from '../../data/spendscape-user'
import type { CatalogStoreSummary } from '../../data/price-catalog'
import { validateBarcode } from '../capture/barcode-domain'
import { demoDraftForSource } from '../capture/capture-domain'
import { blankReview, reviewedRecord, reviewFromDemo, type PurchaseReviewInput } from '../capture/session-purchase-domain'
import { LEGACY_DEVICE_KEY, LEGACY_MIGRATION_KEY, migrateLegacyPurchases, planLegacyImport } from './legacy-device-migration'
import { composeDirectory } from './local-directory'
import { emptyLocalPurchases, LocalStoreError, validateLocalPurchases, type LocalPurchases } from './local-purchase-store'

// The earlier build wrote this shape to localStorage (feature/gal-cleanup-and-look,
// session-purchase-storage.ts): version 1, records, the stores the user added and the sequence.
const legacyMerchants: Merchant[] = [
  { id: 'device_merchant_01', name: { en: 'Synthetic corner grocery', he: 'Synthetic corner grocery' }, category: 'groceries' },
  { id: 'chain_ramilevi', name: { en: 'Rami Levy', he: 'רמי לוי' }, category: 'groceries' },
  { id: 'device_merchant_03', name: { en: 'Synthetic web shop', he: 'Synthetic web shop' }, category: 'retail', onlineOnly: true },
]
const legacyPlaces: Place[] = [
  { id: 'device_place_01', merchantId: 'device_merchant_01', name: { en: 'Synthetic corner grocery', he: 'Synthetic corner grocery' }, branch: { en: 'Pinned by you', he: 'סומן על ידך' }, city: { en: 'My places', he: 'המקומות שלי' }, country: { en: 'Saved on this device', he: 'נשמר במכשיר הזה' }, coordinates: [34.7741, 32.0809], category: 'groceries' },
  { id: 'store_ramilevi_733', merchantId: 'chain_ramilevi', name: { en: 'Rami Levy', he: 'רמי לוי' }, branch: { en: 'Ben Yehuda 23', he: 'Ben Yehuda 23' }, city: { en: 'Tel Aviv-Yafo', he: 'תל אביב-יפו' }, country: { en: 'Israel', he: 'ישראל' }, coordinates: [34.76795, 32.0764], category: 'groceries' },
]
const stores: CatalogStoreSummary[] = [{ id: 'ramilevi-733', chain: 'ramilevi', chainName: { en: 'Rami Levy', he: 'רמי לוי' }, name: 'Ben Yehuda 23', address: 'בן יהודה 23', location: { lat: 32.0764, lon: 34.76795, osm: 'node/1', accuracy: 'address point' } }]
const oldContext = { merchants: [...canonicalSpendscapeData.merchants, ...legacyMerchants], places: [...canonicalSpendscapeData.places, ...legacyPlaces] }
const base = (): PurchaseReviewInput => ({ ...blankReview(), date: '2026-10-02T09:15', currency: 'ILS', payment: 'cash', category: 'groceries' })
const barcode = validateBarcode('7290110115210', 'EAN13')
if (!barcode.valid) throw new Error('fixture barcode')
// The old build labelled its evidence differently; the import rebuilds it.
const legacyRecord = (input: PurchaseReviewInput, sequence: number) => {
  const record = reviewedRecord(input, sequence, oldContext)
  if (!record.synthetic) record.evidence.label = { en: 'Purchase details reviewed by you · saved on this device', he: 'פרטי רכישה שנבדקו על ידך · שמורים במכשיר הזה' }
  return record
}
const legacyLedger = () => ({
  version: 1, nextSequence: 5, merchants: structuredClone(legacyMerchants), places: structuredClone(legacyPlaces),
  records: [
    legacyRecord({ ...base(), channel: 'physical', merchantId: 'device_merchant_01', placeId: 'device_place_01', amount: '42.50' }, 1),
    legacyRecord({ ...base(), source: 'barcode', payment: 'card', channel: 'physical', merchantId: 'chain_ramilevi', placeId: 'store_ramilevi_733', amount: '16.40', lines: [{ name: 'קולה 1.5 ליטר', quantity: '2', unit: 'item', price: '8.20' }], identification: { identity: barcode.identity, method: 'manual', syntheticCatalog: false } }, 2),
    legacyRecord({ ...base(), channel: 'online', merchantId: 'device_merchant_03', currency: 'USD', baseAmount: '37.10', category: 'retail', amount: '9.99' }, 3),
    legacyRecord(reviewFromDemo(demoDraftForSource('receipt')!, 'en'), 4),
  ],
})
const context = () => fixtureSpendscapeRepository.loadSnapshot().then(userApplicationSnapshot)
const storage = (entries: Record<string, string> = {}) => {
  const map = new Map(Object.entries(entries)), writes: [string, string][] = []
  return { writes, map, getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { writes.push([key, value]); map.set(key, value) } }
}

describe('one-time import of the earlier localStorage ledger', () => {
  it('imports valid data through the reviewed boundary with the same IDs, agorot amounts and places', async () => {
    const ctx = await context()
    const plan = planLegacyImport(JSON.stringify(legacyLedger()), ctx, stores)
    if (plan.kind !== 'ready') throw new Error(JSON.stringify(plan))
    expect(plan).toMatchObject({ purchases: 3, demoSkipped: 1 })
    const { data } = plan
    expect(data.records.map(r => r.purchase.id)).toEqual(['session_purchase_manual_01', 'session_purchase_barcode_02', 'session_purchase_manual_03'])
    expect(data.records.every(r => !r.synthetic && r.purchase.provenance === 'user-reviewed-session')).toBe(true)
    // Money stays exact in integer minor units (agorot): no float drift on import.
    expect(data.records.map(r => Math.round(r.purchase.originalAmount * 100))).toEqual([4250, 1640, 999])
    expect(data.records[1].purchase.items.map(i => [Math.round(i.unitPrice * 100), i.quantity, Math.round(i.lineTotal * 100)])).toEqual([[820, 2, 1640]])
    expect(data.records[2].purchase.fx).toMatchObject({ source: 'user-reported-conversion', reportedBaseAmountIls: 37.1 })
    expect(data.records[1].identification?.identity.gtin14).toBe('07290110115210')
    // Stores become directory entries; the device pin keeps its labels, the chain branch becomes a catalog place.
    expect(data.directory.merchants.map(m => [m.id, m.name.en, m.catalogChain ?? null])).toEqual([['local_merchant_1', 'Synthetic corner grocery', null], ['local_merchant_5', 'Rami Levy', 'ramilevi'], ['local_merchant_3', 'Synthetic web shop', null]])
    expect(data.directory.places).toMatchObject([
      { id: 'local_place_1', merchantId: 'local_merchant_1', coordinates: [34.7741, 32.0809], locationMethod: 'device-location', branch: { en: 'Pinned by you', he: 'סומן על ידך' }, address: '' },
      { id: 'local_place_6', merchantId: 'local_merchant_5', coordinates: [34.76795, 32.0764], locationMethod: 'catalog-store', address: 'בן יהודה 23', catalogStore: { storeId: 'ramilevi-733', chain: 'ramilevi', publishedAddress: 'בן יהודה 23' } },
    ])
    expect(data.records.map(r => [r.purchase.merchantId, r.purchase.placeId])).toEqual([['local_merchant_1', 'local_place_1'], ['local_merchant_5', 'local_place_6'], ['local_merchant_3', null]])
    expect(data.nextSequence).toBe(7)
    // Exactly what the IndexedDB store accepts, and the same two pins as before.
    expect(validateLocalPurchases(data, ctx)).toEqual(data)
    const pins = buildPlaceFeatureCollection(composeDirectory(ctx, data.directory).places, data.records.map(r => r.purchase)).features
    expect(pins.map(pin => [pin.properties.placeId, pin.geometry.coordinates])).toEqual([['local_place_1', [34.7741, 32.0809]], ['local_place_6', [34.76795, 32.0764]]])
  })
  it('reads ledgers written before stores existed', async () => {
    const ctx = await context()
    const online = legacyRecord({ ...base(), channel: 'online', merchantId: 'merchant_serein', amount: '12.00', category: 'retail' }, 1)
    const plan = planLegacyImport(JSON.stringify({ version: 1, nextSequence: 2, records: [online] }), ctx, null)
    expect(plan).toMatchObject({ kind: 'ready', purchases: 1 })
  })
  it('skips invalid data as a whole and never imports part of it', async () => {
    const ctx = await context()
    const broken = (patch: (ledger: any) => void) => { const ledger: any = legacyLedger(); patch(ledger); return planLegacyImport(JSON.stringify(ledger), ctx, stores) }
    for (const plan of [
      planLegacyImport('{', ctx, stores),
      planLegacyImport(JSON.stringify({ version: 2, records: [] }), ctx, stores),
      broken(l => { l.records[0].purchase.originalAmount = -1 }),
      broken(l => { l.records[0].purchase.originalAmount = 42.505 }),
      broken(l => { l.records[1].purchase.items[0].lineTotal = 99 }),
      broken(l => { l.records[0].purchase.merchantId = 'missing' }),
      broken(l => { l.records[0].purchase.placeId = 'place_shuk_bograshov' }),
      broken(l => { l.records[1].purchase.id = l.records[0].purchase.id }),
      broken(l => { l.records[0].purchase.timestamp = 'yesterday' }),
      broken(l => { l.records[1].identification.identity.gtin14 = '07290110115211' }),
      broken(l => { l.places[0].coordinates = [34.78, 132] }),
      broken(l => { l.places[1].merchantId = 'device_merchant_01' }),
      broken(l => { l.merchants[1].name = { en: 'Rami', he: 'רמי' } }),
      broken(l => { l.merchants[0].id = canonicalSpendscapeData.merchants[0].id }),
      broken(l => { l.records = l.records.concat(Array.from({ length: 1000 }, () => l.records[0])) }),
    ]) expect(plan.kind).toBe('invalid')
  })
  it('asks for the published store list before importing a chain branch', async () => {
    expect(planLegacyImport(JSON.stringify(legacyLedger()), await context(), null)).toEqual({ kind: 'needs-catalog' })
  })
})

describe('migration run', () => {
  const run = async (store: ReturnType<typeof storage>, current: LocalPurchases = emptyLocalPurchases(), restore = vi.fn(async (data: LocalPurchases) => ({ ...data, revision: 1 }))) => {
    const loadStores = vi.fn(async () => stores)
    const result = await migrateLegacyPurchases({ storage: store, current, context: await context(), loadStores, restore, now: () => new Date('2026-10-15T08:00:00Z') })
    return { ...result, restore, loadStores }
  }
  it('imports into an empty store once, marks it done and never touches the old key', async () => {
    const raw = JSON.stringify(legacyLedger()), store = storage({ [LEGACY_DEVICE_KEY]: raw })
    const first = await run(store)
    expect(first.outcome).toEqual({ status: 'imported', purchases: 3, demoSkipped: 1 })
    expect(first.restore).toHaveBeenCalledTimes(1)
    expect(first.saved?.records).toHaveLength(3)
    expect(store.writes.map(([key]) => key)).toEqual([LEGACY_MIGRATION_KEY])
    expect(store.map.get(LEGACY_DEVICE_KEY)).toBe(raw)
    // A repeat run is a no-op, even if the store were empty again.
    const second = await run(store)
    expect(second.outcome).toEqual({ status: 'already-done' })
    expect(second.restore).not.toHaveBeenCalled()
  })
  it('repeat run without the marker still cannot duplicate: the destination is no longer empty', async () => {
    const store = storage({ [LEGACY_DEVICE_KEY]: JSON.stringify(legacyLedger()) })
    const first = await run(store)
    store.map.delete(LEGACY_MIGRATION_KEY)
    const again = await run(store, first.saved!)
    expect(again.outcome).toEqual({ status: 'skipped-not-empty' })
    expect(again.restore).not.toHaveBeenCalled()
  })
  it('leaves a non-empty destination untouched', async () => {
    const store = storage({ [LEGACY_DEVICE_KEY]: JSON.stringify(legacyLedger()) })
    const plan = planLegacyImport(JSON.stringify(legacyLedger()), await context(), stores)
    if (plan.kind !== 'ready') throw new Error('plan')
    const result = await run(store, { ...plan.data, revision: 3 })
    expect(result.outcome).toEqual({ status: 'skipped-not-empty' })
    expect(result.restore).not.toHaveBeenCalled()
    expect(JSON.parse(store.map.get(LEGACY_MIGRATION_KEY)!)).toMatchObject({ status: 'skipped-not-empty' })
  })
  it('reports invalid legacy data, imports nothing and keeps the old key', async () => {
    const ledger: any = legacyLedger(); ledger.records[2].purchase.originalCurrency = 'QQQ'
    const raw = JSON.stringify(ledger), store = storage({ [LEGACY_DEVICE_KEY]: raw })
    const result = await run(store)
    expect(result.outcome).toMatchObject({ status: 'skipped-invalid' })
    expect(result.restore).not.toHaveBeenCalled()
    expect(store.map.get(LEGACY_DEVICE_KEY)).toBe(raw)
  })
  it('a concurrent write or storage failure is retried on a later load', async () => {
    const store = storage({ [LEGACY_DEVICE_KEY]: JSON.stringify(legacyLedger()) })
    const busy = await run(store, emptyLocalPurchases(), vi.fn(async () => { throw new LocalStoreError('not-empty') }))
    expect(busy.outcome).toEqual({ status: 'skipped-not-empty' })
    const other = storage({ [LEGACY_DEVICE_KEY]: JSON.stringify(legacyLedger()) })
    const failed = await run(other, emptyLocalPurchases(), vi.fn(async () => { throw new LocalStoreError('unavailable') }))
    expect(failed.outcome).toEqual({ status: 'deferred' })
    expect(other.writes).toEqual([])
  })
  it('does nothing without an old ledger', async () => {
    const store = storage()
    const result = await run(store)
    expect(result.outcome).toEqual({ status: 'not-needed' })
    expect(store.writes).toEqual([])
    expect(result.loadStores).not.toHaveBeenCalled()
  })
})
