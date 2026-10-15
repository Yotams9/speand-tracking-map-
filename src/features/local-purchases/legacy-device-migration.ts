import type { CatalogStoreSummary } from '../../data/price-catalog'
import type { Merchant, Place } from '../../data/spendscape-globe'
import type { SpendscapeDataSnapshot } from '../../data/spendscape-repository'
import type { SessionCaptureRecord } from '../capture/capture-domain'
import { reviewedRecord, type PurchaseReviewInput } from '../capture/session-purchase-domain'
import { composeDirectory, type LocalMerchant, type LocalPlace } from './local-directory'
import { emptyRestoreDestination, LocalStoreError, validateLocalPurchaseWrite, type LocalPurchases } from './local-purchase-store'
import { catalogArea, catalogChainNames, catalogChains, catalogText, devicePlaceLabels } from './place-provenance'
import type { CatalogChain } from '../../data/price-catalog'

// The earlier on-device ledger (feature/gal-cleanup-and-look) kept purchases in
// localStorage. IndexedDB is now the only purchase store. On first load the old
// ledger is imported once, strictly and completely, through the reviewed-save
// boundary into an empty IndexedDB store. The old key is only ever read.
export const LEGACY_DEVICE_KEY = 'spendscape.device-purchases.v1'
export const LEGACY_MIGRATION_KEY = 'spendscape.device-purchases.v1.migration'

export type LegacyPlan =
  | { kind: 'ready'; data: LocalPurchases; purchases: number; demoSkipped: number }
  | { kind: 'invalid'; reason: string }
  | { kind: 'needs-catalog' }
export type RecordedOutcome =
  | { status: 'skipped-not-empty'; legacyPurchases: number }
  | { status: 'skipped-invalid'; reason: string; legacyPurchases: number }
  | { status: 'imported'; purchases: number; demoSkipped: number }
export type LegacyMigrationOutcome =
  | { status: 'not-needed' | 'deferred' }
  | RecordedOutcome
  | { status: 'already-done'; previous: (RecordedOutcome & { dismissed?: boolean }) | null }

type Raw = Record<string, unknown>
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)
const deviceMerchant = /^device_merchant_(\d{2,6})$/, chainMerchant = /^chain_(shufersal|ramilevi|osherad)$/
const devicePlace = /^device_place_(\d{2,6})$/, storePlace = /^store_(shufersal|ramilevi|osherad)_(\d{1,5})$/
const purchaseId = /^session_purchase_[a-z]+_(\d{2,6})$/
class Invalid extends Error {}
class NeedsCatalog extends Error {}
const fail = (reason: string): never => { throw new Invalid(reason) }
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Only the facts a reviewed purchase is made of are compared; labels written by
// the old build (for example its evidence wording) are rebuilt, not trusted.
function facts(record: SessionCaptureRecord) {
  const p = record.purchase
  return [record.source, record.synthetic, p.id, p.timestamp, p.channel, p.resolution, p.paymentMode, p.category, p.originalAmount, p.originalCurrency, p.provenance,
    p.fx?.baseCurrency, p.fx?.source, p.fx?.reportedBaseAmountIls, p.evidenceIds, record.evidence?.id, record.evidence?.purchaseId, record.evidence?.kind,
    (p.items ?? []).map(i => [i.label?.en, i.label?.he, i.quantity, i.unit, i.unitPrice, i.lineTotal, i.discountMinor ?? 0]),
    record.identification ? [record.identification.method, record.identification.syntheticCatalog, record.identification.identity?.original, record.identification.identity?.format, record.identification.identity?.gtin14] : null]
}

export function planLegacyImport(raw: string, context: SpendscapeDataSnapshot, catalogStores: readonly CatalogStoreSummary[] | null): LegacyPlan {
  try {
    let stored: unknown
    try { stored = JSON.parse(raw) } catch { return fail('not-json') }
    if (!isObject(stored) || stored.version !== 1 || !Array.isArray(stored.records)) return fail('unknown-format')
    const legacyMerchants = stored.merchants === undefined ? [] : Array.isArray(stored.merchants) ? stored.merchants : fail('merchants')
    const legacyPlaces = stored.places === undefined ? [] : Array.isArray(stored.places) ? stored.places : fail('places')
    if (stored.records.length > 1000 || legacyMerchants.length > 1000 || legacyPlaces.length > 1000) return fail('capacity')

    const records: SessionCaptureRecord[] = stored.records.map(r => isObject(r) && isObject(r.purchase) && typeof r.synthetic === 'boolean' ? r as unknown as SessionCaptureRecord : fail('record'))
    const ids = new Set<string>()
    let highest = 0
    for (const r of records) {
      const match = purchaseId.exec(String(r.purchase.id))
      if (!match || ids.has(r.purchase.id)) return fail('purchase-id')
      ids.add(r.purchase.id); highest = Math.max(highest, Number(match[1]))
    }
    const kept = records.filter(r => !r.synthetic)
    const merchants = new Map<string, Merchant>(), places = new Map<string, Place>()
    for (const m of legacyMerchants) {
      if (!isObject(m) || typeof m.id !== 'string' || !(deviceMerchant.test(m.id) || chainMerchant.test(m.id)) || merchants.has(m.id) || context.merchants.some(c => c.id === m.id)) return fail('merchant')
      merchants.set(m.id, m as unknown as Merchant)
    }
    for (const p of legacyPlaces) {
      if (!isObject(p) || typeof p.id !== 'string' || !(devicePlace.test(p.id) || storePlace.test(p.id)) || places.has(p.id) || context.places.some(c => c.id === p.id)) return fail('place')
      places.set(p.id, p as unknown as Place)
    }

    // Map only what kept purchases use; IDs carrying a sequence keep it.
    const storedNext = Number.isSafeInteger(stored.nextSequence) && (stored.nextSequence as number) > 0 ? stored.nextSequence as number : 1
    let next = Math.max(storedNext, highest + 1)
    for (const id of [...merchants.keys(), ...places.keys()]) { const n = deviceMerchant.exec(id)?.[1] ?? devicePlace.exec(id)?.[1]; if (n) next = Math.max(next, Number(n) + 1) }
    const merchantIds = new Map<string, string>(), placeIds = new Map<string, string>()
    const directoryMerchants: LocalMerchant[] = [], directoryPlaces: LocalPlace[] = []
    const mapMerchant = (id: string): string => {
      if (merchantIds.has(id)) return merchantIds.get(id)!
      // Fictional demo stores are never imported as the person's own; only the
      // built-in "store not identified" choice may be referenced.
      if (context.merchants.some(m => m.id === id)) return id === 'merchant_unresolved' ? id : fail('fixture-reference')
      const legacy = merchants.get(id) ?? fail('missing-merchant')
      const chain = chainMerchant.exec(id)?.[1] as CatalogChain | undefined
      let local: LocalMerchant
      if (chain) {
        if (!same(legacy.name, catalogChainNames[chain])) return fail('chain-name')
        local = { id: `local_merchant_${next++}`, name: { ...catalogChainNames[chain] }, category: 'groceries', source: 'user-confirmed', catalogChain: chain }
      } else {
        if (!isObject(legacy.name) || typeof legacy.name.en !== 'string' || legacy.name.en !== legacy.name.he) return fail('merchant-name')
        local = { id: `local_merchant_${Number(deviceMerchant.exec(id)![1])}`, name: { en: legacy.name.en, he: legacy.name.en }, category: legacy.category, source: 'user-confirmed' }
      }
      merchantIds.set(id, local.id); directoryMerchants.push(local)
      return local.id
    }
    const mapPlace = (id: string, merchantId: string): string => {
      if (placeIds.has(id)) return placeIds.get(id)!
      if (context.places.some(p => p.id === id)) return fail('fixture-reference')
      const legacy = places.get(id) ?? fail('missing-place')
      if (legacy.merchantId !== merchantId) return fail('place-merchant')
      const merchant = directoryMerchants.find(m => m.id === merchantIds.get(merchantId)) ?? fail('place-merchant')
      const coordinates = Array.isArray(legacy.coordinates) && legacy.coordinates.length === 2 ? [legacy.coordinates[0], legacy.coordinates[1]] as [number, number] : fail('coordinates')
      const store = storePlace.exec(id)
      let local: LocalPlace
      if (store) {
        const chain = store[1] as CatalogChain, storeId = `${chain}-${store[2]}`
        if (!catalogChains.includes(chain) || merchant.catalogChain !== chain || !isObject(legacy.branch) || legacy.branch.en !== legacy.branch.he || typeof legacy.branch.en !== 'string') return fail('store-place')
        if (!catalogStores) throw new NeedsCatalog()
        // A branch must still be in the published catalog; no address is invented.
        const published = catalogStores.find(s => s.id === storeId) ?? fail('unknown-store')
        const address = catalogText(published.address)
        local = { id: `local_place_${next++}`, merchantId: merchant.id, name: { ...merchant.name }, branch: { en: catalogText(legacy.branch.en), he: catalogText(legacy.branch.en) }, city: { ...catalogArea.city }, country: { ...catalogArea.country }, coordinates, category: merchant.category, address, source: 'user-confirmed', locationMethod: 'catalog-store', catalogStore: { storeId, chain, publishedAddress: address } }
      } else {
        if (merchant.catalogChain) return fail('device-place')
        local = { id: `local_place_${Number(devicePlace.exec(id)![1])}`, merchantId: merchant.id, name: { ...merchant.name }, branch: { ...devicePlaceLabels.branch }, city: { ...devicePlaceLabels.city }, country: { ...devicePlaceLabels.country }, coordinates, category: merchant.category, address: '', source: 'user-confirmed', locationMethod: 'device-location' }
      }
      placeIds.set(id, local.id); directoryPlaces.push(local)
      return local.id
    }

    const pending = kept.map(r => {
      const p = r.purchase
      const merchantId = mapMerchant(String(p.merchantId))
      const placeId = p.placeId === null ? '' : mapPlace(String(p.placeId), String(p.merchantId))
      return { r, merchantId, placeId }
    })
    const directory = { merchants: directoryMerchants, places: directoryPlaces }
    const graph = composeDirectory(context, directory)
    const rebuilt = pending.map(({ r, merchantId, placeId }) => {
      const p = r.purchase
      if (!Array.isArray(p.items) || typeof p.timestamp !== 'string' || !isObject(p.fx)) return fail('purchase')
      const input: PurchaseReviewInput = {
        source: r.source, provenance: 'user-reviewed', merchantId, placeId, channel: p.channel,
        date: p.timestamp.slice(0, 16), currency: p.originalCurrency, payment: p.paymentMode, category: p.category,
        amount: String(p.originalAmount), baseAmount: p.originalCurrency === 'ILS' ? '' : String(p.fx.reportedBaseAmountIls ?? ''),
        lines: p.items.map(item => ({ name: String(item.label?.en ?? ''), quantity: String(item.quantity), unit: item.unit, price: String(item.unitPrice) })),
        ...(r.identification ? { identification: r.identification } : {}),
      }
      let record: SessionCaptureRecord
      try { record = reviewedRecord(input, Number(purchaseId.exec(p.id)![1]), graph) } catch { return fail('review') }
      // Item labels are single-language user text in the old ledger as well.
      if (!same(facts(record), facts({ ...r, purchase: { ...r.purchase, merchantId, placeId: placeId || null } })) || record.purchase.merchantId !== merchantId || record.purchase.placeId !== (placeId || null)) return fail('facts')
      return record
    })
    const data: LocalPurchases = { version: 4, directory, revision: 0, records: rebuilt, nextSequence: next, decisions: [] }
    try { validateLocalPurchaseWrite(data, context) } catch { return fail('validation') }
    return { kind: 'ready', data, purchases: rebuilt.length, demoSkipped: records.length - kept.length }
  } catch (error) {
    if (error instanceof NeedsCatalog) return { kind: 'needs-catalog' }
    return { kind: 'invalid', reason: error instanceof Invalid ? error.message : 'invalid' }
  }
}
type Preferences = Pick<Storage, 'getItem' | 'setItem'>
export interface LegacyMigrationDeps {
  storage: Preferences | null
  current: LocalPurchases
  context: SpendscapeDataSnapshot
  loadStores: () => Promise<readonly CatalogStoreSummary[]>
  // Shon's empty-only atomic restore: it refuses any non-empty destination.
  restore: (data: LocalPurchases) => Promise<LocalPurchases>
  now?: () => Date
}

// Purchases the person saved in the old ledger (demo records are never theirs to import).
function legacyPurchaseCount(raw: string): number {
  try { const stored = JSON.parse(raw) as { records?: unknown }; return Array.isArray(stored.records) ? stored.records.filter(r => isObject(r) && r.synthetic === false).length : 0 } catch { return 0 }
}
// Some loads must never wait forever for the published store list.
const withTimeout = <T>(promise: Promise<T>, ms: number) => Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

export async function migrateLegacyPurchases(deps: LegacyMigrationDeps): Promise<{ outcome: LegacyMigrationOutcome; saved?: LocalPurchases }> {
  const read = (key: string) => { try { return deps.storage?.getItem(key) ?? null } catch { return null } }
  const mark = (outcome: RecordedOutcome) => {
    try { deps.storage?.setItem(LEGACY_MIGRATION_KEY, JSON.stringify({ ...outcome, at: (deps.now?.() ?? new Date()).toISOString() })) } catch { /* the empty-destination rule still prevents a second import */ }
    return { outcome }
  }
  const marker = read(LEGACY_MIGRATION_KEY)
  if (marker !== null) {
    let previous: (RecordedOutcome & { dismissed?: boolean }) | null = null
    try { const parsed = JSON.parse(marker); if (isObject(parsed) && typeof parsed.status === 'string') previous = parsed as unknown as RecordedOutcome & { dismissed?: boolean } } catch { previous = null }
    return { outcome: { status: 'already-done', previous } }
  }
  const raw = read(LEGACY_DEVICE_KEY)
  if (raw === null) return { outcome: { status: 'not-needed' } }
  const legacyPurchases = legacyPurchaseCount(raw)
  if (!emptyRestoreDestination(deps.current)) return mark({ status: 'skipped-not-empty', legacyPurchases })
  let plan = planLegacyImport(raw, deps.context, null)
  if (plan.kind === 'needs-catalog') {
    let stores: readonly CatalogStoreSummary[]
    try { stores = await withTimeout(deps.loadStores(), 10_000) } catch { return { outcome: { status: 'deferred' } } }
    plan = planLegacyImport(raw, deps.context, stores)
  }
  if (plan.kind === 'invalid') return mark({ status: 'skipped-invalid', reason: plan.reason, legacyPurchases })
  if (plan.kind !== 'ready') return { outcome: { status: 'deferred' } }
  if (plan.purchases === 0) return mark({ status: 'imported', purchases: 0, demoSkipped: plan.demoSkipped })
  try {
    const saved = await deps.restore(plan.data)
    return { ...mark({ status: 'imported', purchases: plan.purchases, demoSkipped: plan.demoSkipped }), saved }
  } catch (error) {
    if (error instanceof LocalStoreError && error.code === 'not-empty') return mark({ status: 'skipped-not-empty', legacyPurchases })
    return { outcome: { status: 'deferred' } }
  }
}

// What the person is told. A successful import is reported once; a skipped
// import of their own purchases stays visible until they dismiss it.
export type LegacyNotice = { kind: 'imported'; purchases: number; demoSkipped: number } | { kind: 'invalid'; purchases: number; capacity: boolean } | { kind: 'not-empty'; purchases: number }
export function legacyNotice(outcome: LegacyMigrationOutcome | null): LegacyNotice | null {
  if (!outcome) return null
  if (outcome.status === 'imported') return outcome.purchases > 0 ? { kind: 'imported', purchases: outcome.purchases, demoSkipped: outcome.demoSkipped } : null
  const recorded = outcome.status === 'already-done' ? (outcome.previous?.dismissed ? null : outcome.previous) : outcome
  if (!recorded || !('legacyPurchases' in recorded) || !(recorded.legacyPurchases > 0)) return null
  if (recorded.status === 'skipped-invalid') return { kind: 'invalid', purchases: recorded.legacyPurchases, capacity: recorded.reason === 'capacity' }
  if (recorded.status === 'skipped-not-empty') return { kind: 'not-empty', purchases: recorded.legacyPurchases }
  return null
}
// Dismissal updates only this module's own marker; the old ledger stays untouched.
export function dismissLegacyNotice(storage: Preferences | null): void {
  try {
    const marker = storage?.getItem(LEGACY_MIGRATION_KEY)
    if (!marker) return
    const parsed = JSON.parse(marker)
    if (isObject(parsed)) storage?.setItem(LEGACY_MIGRATION_KEY, JSON.stringify({ ...parsed, dismissed: true }))
  } catch { /* storage blocked: the notice returns next time */ }
}