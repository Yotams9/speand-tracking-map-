import { describe, expect, it, vi } from 'vitest'
import { canonicalSpendscapeData } from '../../data/spendscape-fixtures'
import { buildPlaceFeatureCollection, type Merchant, type Place } from '../../data/spendscape-globe'
import { fixtureSpendscapeRepository } from '../../data/spendscape-repository'
import { userApplicationSnapshot } from '../../data/spendscape-user'
import type { CatalogStoreSummary } from '../../data/price-catalog'
import { validateBarcode } from '../capture/barcode-domain'
import { demoDraftForSource } from '../capture/capture-domain'
import { blankReview, reviewedRecord, reviewFromDemo, type PurchaseReviewInput } from '../capture/session-purchase-domain'
import { dismissLegacyNotice, LEGACY_DEVICE_KEY, LEGACY_MIGRATION_KEY, legacyNotice, migrateLegacyPurchases, planLegacyImport, skipLegacyImport } from './legacy-device-migration'
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
    const online = legacyRecord({ ...base(), channel: 'unknown', merchantId: 'merchant_unresolved', amount: '12.00', category: 'retail' }, 1)
    const plan = planLegacyImport(JSON.stringify({ version: 1, nextSequence: 2, records: [online] }), ctx, null)
    expect(plan).toMatchObject({ kind: 'ready', purchases: 1 })
  })
  it('rejects a ledger only when the ledger itself is unreadable or over capacity', async () => {
    const ctx = await context()
    const ledger: any = legacyLedger(); ledger.records = ledger.records.concat(Array.from({ length: 1000 }, () => ledger.records[0]))
    for (const plan of [
      planLegacyImport('{', ctx, stores),
      planLegacyImport(JSON.stringify({ version: 2, records: [] }), ctx, stores),
      planLegacyImport(JSON.stringify({ ...legacyLedger(), merchants: {} }), ctx, stores),
      planLegacyImport(JSON.stringify(ledger), ctx, stores),
    ]) expect(plan.kind).toBe('invalid')
  })
  it('leaves out each purchase that cannot be imported exactly and imports the rest unchanged', async () => {
    const ctx = await context()
    const broken = (patch: (ledger: any) => void, catalog: CatalogStoreSummary[] = stores) => { const ledger: any = legacyLedger(); patch(ledger); return planLegacyImport(JSON.stringify(ledger), ctx, catalog) }
    const cases: [string, ReturnType<typeof planLegacyImport>, string][] = [
      ['negative amount', broken(l => { l.records[0].purchase.originalAmount = -1 }), 'session_purchase_manual_01'],
      ['sub-agora amount', broken(l => { l.records[0].purchase.originalAmount = 42.505 }), 'session_purchase_manual_01'],
      ['line total', broken(l => { l.records[1].purchase.items[0].lineTotal = 99 }), 'session_purchase_barcode_02'],
      ['missing store', broken(l => { l.records[0].purchase.merchantId = 'missing' }), 'session_purchase_manual_01'],
      ['timestamp', broken(l => { l.records[0].purchase.timestamp = 'yesterday' }), 'session_purchase_manual_01'],
      ['barcode identity', broken(l => { l.records[1].identification.identity.gtin14 = '07290110115211' }), 'session_purchase_barcode_02'],
      ['currency', broken(l => { l.records[2].purchase.originalCurrency = 'QQQ' }), 'session_purchase_manual_03'],
      ['pin coordinates', broken(l => { l.places[0].coordinates = [34.78, 132] }), 'session_purchase_manual_01'],
      ['place of another store', broken(l => { l.places[1].merchantId = 'device_merchant_01' }), 'session_purchase_barcode_02'],
      ['chain name', broken(l => { l.merchants[1].name = { en: 'Rami', he: 'רמי' } }), 'session_purchase_barcode_02'],
      ['store colliding with a built-in ID', broken(l => { l.merchants[0].id = canonicalSpendscapeData.merchants[0].id }), 'session_purchase_manual_01'],
      // A later copy of a sequence number is left out; the first one stays.
      ['duplicate sequence', broken(l => { l.records[1].purchase.id = l.records[0].purchase.id }), 'session_purchase_barcode_02'],
      // A chain branch no longer in the published catalog gets no invented address.
      ['branch not in the catalog', broken(() => {}, []), 'session_purchase_barcode_02'],
    ]
    for (const [name, plan, left] of cases) {
      if (plan.kind !== 'ready') throw new Error(`${name}: ${JSON.stringify(plan)}`)
      expect([name, plan.purchases, plan.invalidSkipped, plan.fixtureSkipped, plan.demoSkipped]).toEqual([name, 2, 1, 0, 1])
      expect(plan.data.records.map(r => r.purchase.id)).not.toContain(left)
      // Stores used only by the left-out purchase are not imported; the rest is exactly what the store accepts.
      expect(plan.data.directory.places.every(p => plan.data.records.some(r => r.purchase.placeId === p.id))).toBe(true)
      expect(validateLocalPurchases(plan.data, ctx)).toEqual(plan.data)
    }
  })
  it('imports three real purchases and counts the one at a fictional demo store', async () => {
    const ctx = await context()
    const ledger = legacyLedger()
    ledger.records.splice(1, 0, legacyRecord({ ...base(), channel: 'physical', merchantId: 'merchant_shuk', placeId: 'place_shuk_bograshov', amount: '12.00' }, 5))
    const plan = planLegacyImport(JSON.stringify(ledger), ctx, stores)
    if (plan.kind !== 'ready') throw new Error(JSON.stringify(plan))
    expect(plan).toMatchObject({ purchases: 3, fixtureSkipped: 1, invalidSkipped: 0, demoSkipped: 1 })
    expect(plan.data.records.map(r => r.purchase.id)).toEqual(['session_purchase_manual_01', 'session_purchase_barcode_02', 'session_purchase_manual_03'])
    // Fictional demo stores never become the person's own places.
    expect(plan.data.directory.places.map(p => p.catalogStore?.storeId ?? p.locationMethod)).toEqual(['device-location', 'ramilevi-733'])
    expect(plan.data.records.every(r => !r.purchase.merchantId.startsWith('merchant_') && !String(r.purchase.placeId).startsWith('place_'))).toBe(true)
    // An online purchase at a demo store is counted the same way.
    const online = planLegacyImport(JSON.stringify({ version: 1, nextSequence: 2, records: [legacyRecord({ ...base(), channel: 'online', merchantId: 'merchant_serein', amount: '12.00', category: 'retail' }, 1)] }), ctx, stores)
    expect(online).toMatchObject({ kind: 'ready', purchases: 0, fixtureSkipped: 1 })
  })
  // Shon's 951e75f: the old build rounded weighted lines as Math.round(price × quantity),
  // half-up on half agorot; such purchases must still import unchanged.
  it.each([['0.25', '0.58', 0.15], ['0.29', '0.5', 0.15], ['0.45', '0.7', 0.32], ['0.50', '0.29', 0.15], ['1.00', '0.5', 0.5]] as const)('imports a weighted purchase %s × %s kg = %s unchanged', async (price, quantity, total) => {
    const ctx = await context()
    // The old build's own arithmetic, written out independently of the current helpers.
    const oldTotal = Math.round(Math.round(Number(price) * 100) * Math.round(Number(quantity) * 1000) / 1000) / 100
    expect(oldTotal).toBe(total)
    const record = legacyRecord({ ...base(), channel: 'online', merchantId: 'device_merchant_03', category: 'retail', amount: total.toFixed(2), lines: [{ name: 'Fictional loose produce', quantity, unit: 'kg', price }] }, 1)
    expect(record.purchase.items[0]).toMatchObject({ quantity: Number(quantity), unitPrice: Number(price), lineTotal: total })
    const plan = planLegacyImport(JSON.stringify({ version: 1, nextSequence: 2, merchants: [legacyMerchants[2]], records: [record] }), ctx, stores)
    if (plan.kind !== 'ready') throw new Error(JSON.stringify(plan))
    expect(plan).toMatchObject({ purchases: 1, invalidSkipped: 0 })
    expect(plan.data.records[0].purchase.items[0]).toMatchObject({ quantity: Number(quantity), unitPrice: Number(price), lineTotal: total })
    expect(plan.data.records[0].purchase.originalAmount).toBe(total)
    // One agora off is still left out, never repaired.
    const off = structuredClone(record); off.purchase.items[0].lineTotal = Number((total + 0.01).toFixed(2)); off.purchase.originalAmount = off.purchase.items[0].lineTotal
    expect(planLegacyImport(JSON.stringify({ version: 1, nextSequence: 2, merchants: [legacyMerchants[2]], records: [off] }), ctx, stores)).toMatchObject({ kind: 'ready', purchases: 0, invalidSkipped: 1 })
  })
  it('imports the rest when one record is not even a purchase', async () => {
    const ctx = await context()
    const ledger: any = legacyLedger(); ledger.records.splice(2, 0, { purchase: null, synthetic: false }, 'text')
    const plan = planLegacyImport(JSON.stringify(ledger), ctx, stores)
    expect(plan).toMatchObject({ kind: 'ready', purchases: 3, invalidSkipped: 2, fixtureSkipped: 0, demoSkipped: 1 })
  })
  it('asks for the published store list before importing a chain branch', async () => {
    expect(planLegacyImport(JSON.stringify(legacyLedger()), await context(), null)).toEqual({ kind: 'needs-catalog' })
  })
})

describe('migration run', () => {
  const run = async (store: ReturnType<typeof storage>, current: LocalPurchases = emptyLocalPurchases(), restore = vi.fn(async (data: LocalPurchases) => ({ ...data, revision: 1 })), loadStores = vi.fn(async (): Promise<readonly CatalogStoreSummary[]> => stores)) => {
    const result = await migrateLegacyPurchases({ storage: store, current, context: await context(), loadStores, restore, now: () => new Date('2026-10-15T08:00:00Z') })
    return { ...result, restore, loadStores }
  }
  it('imports into an empty store once, marks it done and never touches the old key', async () => {
    const raw = JSON.stringify(legacyLedger()), store = storage({ [LEGACY_DEVICE_KEY]: raw })
    const first = await run(store)
    expect(first.outcome).toEqual({ status: 'imported', purchases: 3, demoSkipped: 1, fixtureSkipped: 0, invalidSkipped: 0 })
    expect(legacyNotice(first.outcome)).toEqual({ kind: 'imported', purchases: 3, demoSkipped: 1, skipped: 0 })
    expect(first.restore).toHaveBeenCalledTimes(1)
    expect(first.saved?.records).toHaveLength(3)
    expect(store.writes.map(([key]) => key)).toEqual([LEGACY_MIGRATION_KEY])
    expect(store.map.get(LEGACY_DEVICE_KEY)).toBe(raw)
    // A repeat run is a no-op, even if the store were empty again.
    const second = await run(store)
    expect(second.outcome).toMatchObject({ status: 'already-done', previous: { status: 'imported', purchases: 3 } })
    expect(legacyNotice(second.outcome)).toBeNull()
    expect(second.restore).not.toHaveBeenCalled()
  })
  it('repeat run without the marker still cannot duplicate: the destination is no longer empty', async () => {
    const store = storage({ [LEGACY_DEVICE_KEY]: JSON.stringify(legacyLedger()) })
    const first = await run(store)
    store.map.delete(LEGACY_MIGRATION_KEY)
    const again = await run(store, first.saved!)
    expect(again.outcome).toEqual({ status: 'skipped-not-empty', legacyPurchases: 3 })
    expect(again.restore).not.toHaveBeenCalled()
  })
  it('leaves a non-empty destination untouched', async () => {
    const store = storage({ [LEGACY_DEVICE_KEY]: JSON.stringify(legacyLedger()) })
    const plan = planLegacyImport(JSON.stringify(legacyLedger()), await context(), stores)
    if (plan.kind !== 'ready') throw new Error('plan')
    const result = await run(store, { ...plan.data, revision: 3 })
    expect(result.outcome).toEqual({ status: 'skipped-not-empty', legacyPurchases: 3 })
    expect(result.restore).not.toHaveBeenCalled()
    expect(JSON.parse(store.map.get(LEGACY_MIGRATION_KEY)!)).toMatchObject({ status: 'skipped-not-empty' })
    // The person is told on every load until they dismiss it; dismissal never touches the old key.
    const later = await run(store)
    expect(legacyNotice(later.outcome)).toEqual({ kind: 'not-empty', purchases: 3 })
    const raw = store.map.get(LEGACY_DEVICE_KEY)
    dismissLegacyNotice(store)
    expect(legacyNotice((await run(store)).outcome)).toBeNull()
    expect(store.map.get(LEGACY_DEVICE_KEY)).toBe(raw)
  })
  it('reports an unreadable ledger, imports nothing and keeps the old key', async () => {
    const ledger: any = legacyLedger(); ledger.merchants = 'broken'
    const raw = JSON.stringify(ledger), store = storage({ [LEGACY_DEVICE_KEY]: raw })
    const result = await run(store)
    expect(result.outcome).toMatchObject({ status: 'skipped-invalid', legacyPurchases: 3 })
    expect(legacyNotice(result.outcome)).toEqual({ kind: 'invalid', purchases: 3, capacity: false })
    expect(result.restore).not.toHaveBeenCalled()
    expect(store.map.get(LEGACY_DEVICE_KEY)).toBe(raw)
  })
  it('imports the rest when some purchases are left out, and reports those until dismissed', async () => {
    const ledger: any = legacyLedger(); ledger.records[2].purchase.originalCurrency = 'QQQ'
    ledger.records.push(legacyRecord({ ...base(), channel: 'physical', merchantId: 'merchant_nomi', placeId: 'place_nomi_dizengoff', amount: '30.00', category: 'food' }, 5))
    const raw = JSON.stringify(ledger), store = storage({ [LEGACY_DEVICE_KEY]: raw })
    const result = await run(store)
    expect(result.outcome).toEqual({ status: 'imported', purchases: 2, demoSkipped: 1, fixtureSkipped: 1, invalidSkipped: 1 })
    expect(result.restore).toHaveBeenCalledTimes(1)
    expect(result.saved?.records.map(r => r.purchase.id)).toEqual(['session_purchase_manual_01', 'session_purchase_barcode_02'])
    expect(legacyNotice(result.outcome)).toEqual({ kind: 'imported', purchases: 2, demoSkipped: 1, skipped: 2 })
    // The left-out purchases stay reported on later loads until dismissed; the old key is untouched.
    expect(legacyNotice((await run(store)).outcome)).toEqual({ kind: 'imported', purchases: 2, demoSkipped: 1, skipped: 2 })
    dismissLegacyNotice(store)
    expect(legacyNotice((await run(store)).outcome)).toBeNull()
    expect(store.map.get(LEGACY_DEVICE_KEY)).toBe(raw)
  })
  it('a concurrent write or storage failure is retried on a later load', async () => {
    const store = storage({ [LEGACY_DEVICE_KEY]: JSON.stringify(legacyLedger()) })
    const busy = await run(store, emptyLocalPurchases(), vi.fn(async () => { throw new LocalStoreError('not-empty') }))
    expect(busy.outcome).toEqual({ status: 'skipped-not-empty', legacyPurchases: 3 })
    const other = storage({ [LEGACY_DEVICE_KEY]: JSON.stringify(legacyLedger()) })
    const failed = await run(other, emptyLocalPurchases(), vi.fn(async () => { throw new LocalStoreError('unavailable') }))
    expect(failed.outcome).toEqual({ status: 'deferred' })
    expect(other.writes).toEqual([])
  })
  const unavailable = () => vi.fn(async (): Promise<readonly CatalogStoreSummary[]> => { throw new Error('503') })
  it('a second tab never replaces an imported marker with skipped-not-empty', async () => {
    const raw = JSON.stringify(legacyLedger()), store = storage({ [LEGACY_DEVICE_KEY]: raw })
    // Both tabs saw an empty store and no marker. Tab A's import lands first, so
    // tab B's empty-only restore is refused.
    const tabB = vi.fn(async (): Promise<LocalPurchases> => {
      const tabA = await run(store)
      expect(tabA.outcome).toMatchObject({ status: 'imported', purchases: 3 })
      throw new LocalStoreError('not-empty')
    })
    const second = await run(store, emptyLocalPurchases(), tabB)
    expect(tabB).toHaveBeenCalledTimes(1)
    expect(second.outcome).toMatchObject({ status: 'already-done', previous: { status: 'imported', purchases: 3 } })
    expect(JSON.parse(store.map.get(LEGACY_MIGRATION_KEY)!)).toMatchObject({ status: 'imported', purchases: 3 })
    expect(store.writes.filter(([key]) => key === LEGACY_MIGRATION_KEY)).toHaveLength(1)
    expect(legacyNotice(second.outcome)).toBeNull()
    expect(store.map.get(LEGACY_DEVICE_KEY)).toBe(raw)
  })
  it('store list unavailable: writes nothing and keeps the store empty; a retry then imports', async () => {
    const raw = JSON.stringify(legacyLedger()), store = storage({ [LEGACY_DEVICE_KEY]: raw })
    const waiting = await run(store, emptyLocalPurchases(), undefined, unavailable())
    expect(waiting.outcome).toEqual({ status: 'catalog-unavailable', legacyPurchases: 3 })
    expect(waiting.restore).not.toHaveBeenCalled()
    expect(waiting.saved).toBeUndefined()
    // No marker, no notice: the app shows Try again / Continue without importing instead.
    expect(store.writes).toEqual([])
    expect(legacyNotice(waiting.outcome)).toBeNull()
    // Try again, the list is back: one import into the still-empty store, all purchases.
    const retried = await run(store)
    expect(retried.outcome).toEqual({ status: 'imported', purchases: 3, demoSkipped: 1, fixtureSkipped: 0, invalidSkipped: 0 })
    expect(retried.restore).toHaveBeenCalledTimes(1)
    expect(retried.saved?.records).toHaveLength(3)
    expect(store.map.get(LEGACY_DEVICE_KEY)).toBe(raw)
  })
  it('store list unavailable: continuing without importing is recorded and reported until dismissed', async () => {
    const raw = JSON.stringify(legacyLedger()), store = storage({ [LEGACY_DEVICE_KEY]: raw })
    const waiting = await run(store, emptyLocalPurchases(), undefined, unavailable())
    if (waiting.outcome.status !== 'catalog-unavailable') throw new Error('state')
    const skipped = skipLegacyImport(store, waiting.outcome.legacyPurchases, new Date('2026-10-15T08:00:00Z'))
    expect(skipped).toEqual({ status: 'skipped-by-user', legacyPurchases: 3 })
    expect(legacyNotice(skipped)).toEqual({ kind: 'not-moved', purchases: 3 })
    expect(JSON.parse(store.map.get(LEGACY_MIGRATION_KEY)!)).toEqual({ status: 'skipped-by-user', legacyPurchases: 3, at: '2026-10-15T08:00:00.000Z' })
    // Later loads never import, even into an empty store, and keep telling the person until dismissed.
    const later = await run(store)
    expect(later.outcome).toMatchObject({ status: 'already-done', previous: { status: 'skipped-by-user' } })
    expect(later.restore).not.toHaveBeenCalled()
    expect(legacyNotice(later.outcome)).toEqual({ kind: 'not-moved', purchases: 3 })
    dismissLegacyNotice(store)
    expect(legacyNotice((await run(store)).outcome)).toBeNull()
    // The old ledger was only ever read.
    expect(store.writes.every(([key]) => key === LEGACY_MIGRATION_KEY)).toBe(true)
    expect(store.map.get(LEGACY_DEVICE_KEY)).toBe(raw)
  })
  it('a decision another tab made while this one waited for the store list is kept', async () => {
    const store = storage({ [LEGACY_DEVICE_KEY]: JSON.stringify(legacyLedger()) })
    // The other tab continued without importing while this tab's store list was loading.
    const slow = vi.fn(async (): Promise<readonly CatalogStoreSummary[]> => { skipLegacyImport(store, 3); return stores })
    const result = await run(store, emptyLocalPurchases(), undefined, slow)
    expect(result.outcome).toMatchObject({ status: 'already-done', previous: { status: 'skipped-by-user' } })
    expect(result.restore).not.toHaveBeenCalled()
    expect(JSON.parse(store.map.get(LEGACY_MIGRATION_KEY)!)).toMatchObject({ status: 'skipped-by-user' })
  })
  it('continuing without importing keeps an import another tab already finished', async () => {
    const store = storage({ [LEGACY_DEVICE_KEY]: JSON.stringify(legacyLedger()) })
    await run(store)
    const before = store.map.get(LEGACY_MIGRATION_KEY)
    expect(skipLegacyImport(store, 3)).toMatchObject({ status: 'already-done', previous: { status: 'imported', purchases: 3 } })
    expect(store.map.get(LEGACY_MIGRATION_KEY)).toBe(before)
  })
  it('does nothing without an old ledger', async () => {
    const store = storage()
    const result = await run(store)
    expect(result.outcome).toEqual({ status: 'not-needed' })
    expect(store.writes).toEqual([])
    expect(result.loadStores).not.toHaveBeenCalled()
  })
})
