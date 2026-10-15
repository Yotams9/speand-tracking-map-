import type { CatalogStoreSummary } from '../../data/price-catalog'
import type { Merchant, Place } from '../../data/spendscape-globe'
import type { SpendscapeDataSnapshot } from '../../data/spendscape-repository'
import type { SessionCaptureRecord } from '../capture/capture-domain'
import { reviewedRecord, type PurchaseReviewInput } from '../capture/session-purchase-domain'
import { composeDirectory, pruneDirectory, type LocalMerchant, type LocalPlace } from './local-directory'
import { emptyRestoreDestination, LocalStoreError, validateLocalPurchaseWrite, type LocalPurchases } from './local-purchase-store'
import { catalogArea, catalogChainNames, catalogChains, catalogText, devicePlaceLabels } from './place-provenance'
import type { CatalogChain } from '../../data/price-catalog'

// The earlier on-device ledger (feature/gal-cleanup-and-look) kept purchases in
// localStorage. IndexedDB is now the only purchase store. On first load the old
// ledger is imported once, strictly, through the reviewed-save boundary into an
// empty IndexedDB store. Each purchase is checked on its own: one that cannot be
// imported exactly is left out and counted, never repaired. The old key is only ever read.
export const LEGACY_DEVICE_KEY = 'spendscape.device-purchases.v1'
export const LEGACY_MIGRATION_KEY = 'spendscape.device-purchases.v1.migration'

export interface ImportCounts { purchases: number; demoSkipped: number; fixtureSkipped: number; invalidSkipped: number }
export type LegacyPlan =
  | ({ kind: 'ready'; data: LocalPurchases } & ImportCounts)
  | { kind: 'invalid'; reason: string }
  | { kind: 'needs-catalog' }
export type RecordedOutcome =
  | { status: 'skipped-not-empty'; legacyPurchases: number }
  | { status: 'skipped-invalid'; reason: string; legacyPurchases: number }
  // The published store list was unavailable and the person chose to continue without the import.
  | { status: 'skipped-by-user'; legacyPurchases: number }
  | ({ status: 'imported' } & ImportCounts)
export type LegacyMigrationOutcome =
  | { status: 'not-needed' | 'deferred' }
  // Nothing written: the store stays empty and saving stays blocked until the
  // person retries or continues without importing (skipLegacyImport).
  | { status: 'catalog-unavailable'; legacyPurchases: number }
  | RecordedOutcome
  | { status: 'already-done'; previous: (RecordedOutcome & { dismissed?: boolean }) | null }

type Raw = Record<string, unknown>
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)
const deviceMerchant = /^device_merchant_(\d{2,6})$/, chainMerchant = /^chain_(shufersal|ramilevi|osherad)$/
const devicePlace = /^device_place_(\d{2,6})$/, storePlace = /^store_(shufersal|ramilevi|osherad)_(\d{1,5})$/
const purchaseId = /^session_purchase_[a-z]+_(\d{2,6})$/
class Invalid extends Error {}
class NeedsCatalog extends Error {}
// One purchase is left out; the rest of the ledger is still imported.
class Skip extends Error {}
const fail = (reason: string): never => { throw new Invalid(reason) }
const skip = (reason: string): never => { throw new Skip(reason) }
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

    const counts = { demoSkipped: 0, fixtureSkipped: 0, invalidSkipped: 0 }
    const kept: SessionCaptureRecord[] = []
    let highest = 0
    for (const r of stored.records) {
      const match = isObject(r) && isObject(r.purchase) && typeof r.purchase.id === 'string' ? purchaseId.exec(r.purchase.id) : null
      if (match) highest = Math.max(highest, Number(match[1]))
      if (isObject(r) && r.synthetic === true) counts.demoSkipped++
      else if (!match || r.synthetic !== false) counts.invalidSkipped++
      else kept.push(r as unknown as SessionCaptureRecord)
    }
    // As in the old build's own restore, an entry that is not a store the person
    // added is left out on its own (the first copy of an ID wins); purchases that
    // reference it are then skipped below.
    const merchants = new Map<string, Merchant>(), places = new Map<string, Place>()
    for (const m of legacyMerchants) {
      if (isObject(m) && typeof m.id === 'string' && (deviceMerchant.test(m.id) || chainMerchant.test(m.id)) && !merchants.has(m.id) && !context.merchants.some(c => c.id === m.id)) merchants.set(m.id, m as unknown as Merchant)
    }
    for (const p of legacyPlaces) {
      if (isObject(p) && typeof p.id === 'string' && (devicePlace.test(p.id) || storePlace.test(p.id)) && !places.has(p.id) && !context.places.some(c => c.id === p.id)) places.set(p.id, p as unknown as Place)
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
      if (context.merchants.some(m => m.id === id)) return id === 'merchant_unresolved' ? id : skip('fixture-reference')
      const legacy = merchants.get(id) ?? skip('missing-merchant')
      const chain = chainMerchant.exec(id)?.[1] as CatalogChain | undefined
      let local: LocalMerchant
      if (chain) {
        if (!same(legacy.name, catalogChainNames[chain])) return skip('chain-name')
        local = { id: `local_merchant_${next++}`, name: { ...catalogChainNames[chain] }, category: 'groceries', source: 'user-confirmed', catalogChain: chain }
      } else {
        if (!isObject(legacy.name) || typeof legacy.name.en !== 'string' || legacy.name.en !== legacy.name.he) return skip('merchant-name')
        local = { id: `local_merchant_${Number(deviceMerchant.exec(id)![1])}`, name: { en: legacy.name.en, he: legacy.name.en }, category: legacy.category, source: 'user-confirmed' }
      }
      merchantIds.set(id, local.id); directoryMerchants.push(local)
      return local.id
    }
    const mapPlace = (id: string, merchantId: string): string => {
      if (placeIds.has(id)) return placeIds.get(id)!
      if (context.places.some(p => p.id === id)) return skip('fixture-reference')
      const legacy = places.get(id) ?? skip('missing-place')
      if (legacy.merchantId !== merchantId) return skip('place-merchant')
      const merchant = directoryMerchants.find(m => m.id === merchantIds.get(merchantId)) ?? skip('place-merchant')
      const coordinates = Array.isArray(legacy.coordinates) && legacy.coordinates.length === 2 ? [legacy.coordinates[0], legacy.coordinates[1]] as [number, number] : skip('coordinates')
      const store = storePlace.exec(id)
      let local: LocalPlace
      if (store) {
        const chain = store[1] as CatalogChain, storeId = `${chain}-${store[2]}`
        if (!catalogChains.includes(chain) || merchant.catalogChain !== chain || !isObject(legacy.branch) || legacy.branch.en !== legacy.branch.he || typeof legacy.branch.en !== 'string') return skip('store-place')
        if (!catalogStores) throw new NeedsCatalog()
        // A branch must still be in the published catalog; no address is invented.
        const published = catalogStores.find(s => s.id === storeId) ?? skip('unknown-store')
        const address = catalogText(published.address)
        local = { id: `local_place_${next++}`, merchantId: merchant.id, name: { ...merchant.name }, branch: { en: catalogText(legacy.branch.en), he: catalogText(legacy.branch.en) }, city: { ...catalogArea.city }, country: { ...catalogArea.country }, coordinates, category: merchant.category, address, source: 'user-confirmed', locationMethod: 'catalog-store', catalogStore: { storeId, chain, publishedAddress: address } }
      } else {
        if (merchant.catalogChain) return skip('device-place')
        local = { id: `local_place_${Number(devicePlace.exec(id)![1])}`, merchantId: merchant.id, name: { ...merchant.name }, branch: { ...devicePlaceLabels.branch }, city: { ...devicePlaceLabels.city }, country: { ...devicePlaceLabels.country }, coordinates, category: merchant.category, address: '', source: 'user-confirmed', locationMethod: 'device-location' }
      }
      placeIds.set(id, local.id); directoryPlaces.push(local)
      return local.id
    }

    // A purchase that cannot be imported exactly is counted and left out. Fictional
    // demo stores are counted apart; the published store list is still all or nothing.
    const attempt = <T>(step: () => T): T | undefined => {
      try { return step() } catch (error) {
        if (error instanceof NeedsCatalog) throw error
        if (error instanceof Skip && error.message === 'fixture-reference') counts.fixtureSkipped++
        else counts.invalidSkipped++
        return undefined
      }
    }
    const pending = kept.flatMap(r => attempt(() => {
      const p = r.purchase
      const merchantId = mapMerchant(String(p.merchantId))
      const placeId = p.placeId === null ? '' : mapPlace(String(p.placeId), String(p.merchantId))
      return [{ r, merchantId, placeId }]
    }) ?? [])
    const directory = { merchants: directoryMerchants, places: directoryPlaces }
    const graph = composeDirectory(context, directory)
    const sequences = new Set<number>()
    const rebuilt = pending.flatMap(({ r, merchantId, placeId }) => attempt(() => {
      const p = r.purchase
      const sequence = Number(purchaseId.exec(p.id)![1])
      // The first purchase with a sequence number wins, as in the old build.
      if (sequences.has(sequence)) return skip('purchase-id')
      if (!Array.isArray(p.items) || typeof p.timestamp !== 'string' || !isObject(p.fx)) return skip('purchase')
      const input: PurchaseReviewInput = {
        source: r.source, provenance: 'user-reviewed', merchantId, placeId, channel: p.channel,
        date: p.timestamp.slice(0, 16), currency: p.originalCurrency, payment: p.paymentMode, category: p.category,
        amount: String(p.originalAmount), baseAmount: p.originalCurrency === 'ILS' ? '' : String(p.fx.reportedBaseAmountIls ?? ''),
        lines: p.items.map(item => ({ name: String(item.label?.en ?? ''), quantity: String(item.quantity), unit: item.unit, price: String(item.unitPrice) })),
        ...(r.identification ? { identification: r.identification } : {}),
      }
      let record: SessionCaptureRecord
      try { record = reviewedRecord(input, sequence, graph) } catch { return skip('review') }
      // Item labels are single-language user text in the old ledger as well.
      if (!same(facts(record), facts({ ...r, purchase: { ...r.purchase, merchantId, placeId: placeId || null } })) || record.purchase.merchantId !== merchantId || record.purchase.placeId !== (placeId || null)) return skip('facts')
      // The same validator as the final write, for this purchase and its stores alone.
      const alone: LocalPurchases = { version: 4, directory: pruneDirectory(directory, [record.purchase]), revision: 0, records: [record], nextSequence: next, decisions: [] }
      try { validateLocalPurchaseWrite(alone, context) } catch { return skip('validation') }
      sequences.add(sequence)
      return [record]
    }) ?? [])
    // Stores used only by left-out purchases are not imported.
    const data: LocalPurchases = { version: 4, directory: pruneDirectory(directory, rebuilt.map(r => r.purchase)), revision: 0, records: rebuilt, nextSequence: next, decisions: [] }
    try { validateLocalPurchaseWrite(data, context) } catch { return fail('validation') }
    return { kind: 'ready', data, purchases: rebuilt.length, ...counts }
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

function alreadyDone(marker: string | null): Extract<LegacyMigrationOutcome, { status: 'already-done' }> | null {
  if (marker === null) return null
  let previous: (RecordedOutcome & { dismissed?: boolean }) | null = null
  try { const parsed = JSON.parse(marker); if (isObject(parsed) && typeof parsed.status === 'string') previous = parsed as unknown as RecordedOutcome & { dismissed?: boolean } } catch { previous = null }
  return { status: 'already-done', previous }
}
const writeMarker = (storage: Preferences | null, outcome: RecordedOutcome, now: Date) => {
  try { storage?.setItem(LEGACY_MIGRATION_KEY, JSON.stringify({ ...outcome, at: now.toISOString() })) } catch { /* the empty-destination rule still prevents a second import */ }
}

export async function migrateLegacyPurchases(deps: LegacyMigrationDeps): Promise<{ outcome: LegacyMigrationOutcome; saved?: LocalPurchases }> {
  const read = (key: string) => { try { return deps.storage?.getItem(key) ?? null } catch { return null } }
  const mark = (outcome: RecordedOutcome): { outcome: LegacyMigrationOutcome } => {
    // Another tab may have finished the import while this one waited: re-read
    // the marker and never replace an import with a later "skipped" result.
    const latest = alreadyDone(read(LEGACY_MIGRATION_KEY))
    if (latest?.previous?.status === 'imported') return { outcome: latest }
    writeMarker(deps.storage, outcome, deps.now?.() ?? new Date())
    return { outcome }
  }
  const done = alreadyDone(read(LEGACY_MIGRATION_KEY))
  if (done) return { outcome: done }
  const raw = read(LEGACY_DEVICE_KEY)
  if (raw === null) return { outcome: { status: 'not-needed' } }
  const legacyPurchases = legacyPurchaseCount(raw)
  if (!emptyRestoreDestination(deps.current)) return mark({ status: 'skipped-not-empty', legacyPurchases })
  let plan = planLegacyImport(raw, deps.context, null)
  if (plan.kind === 'needs-catalog') {
    let stores: readonly CatalogStoreSummary[]
    // Wait a little longer than the store-list request's own 15 s abort, so a
    // "Try again" always starts a fresh request instead of reusing a doomed one.
    try { stores = await withTimeout(deps.loadStores(), 16_000) } catch { return { outcome: { status: 'catalog-unavailable', legacyPurchases } } }
    plan = planLegacyImport(raw, deps.context, stores)
  }
  if (plan.kind === 'invalid') return mark({ status: 'skipped-invalid', reason: plan.reason, legacyPurchases })
  if (plan.kind !== 'ready') return { outcome: { status: 'deferred' } }
  const counts: ImportCounts = { purchases: plan.purchases, demoSkipped: plan.demoSkipped, fixtureSkipped: plan.fixtureSkipped, invalidSkipped: plan.invalidSkipped }
  // Another tab may have decided meanwhile (imported, or continued without importing).
  const decided = alreadyDone(read(LEGACY_MIGRATION_KEY))
  if (decided) return { outcome: decided }
  if (plan.purchases === 0) return mark({ status: 'imported', ...counts })
  try {
    const saved = await deps.restore(plan.data)
    return { ...mark({ status: 'imported', ...counts }), saved }
  } catch (error) {
    if (error instanceof LocalStoreError && error.code === 'not-empty') return mark({ status: 'skipped-not-empty', legacyPurchases })
    return { outcome: { status: 'deferred' } }
  }
}

// "Continue without importing": recorded once, reported until dismissed. Another
// tab may have finished the import meanwhile; its marker is kept. The old key is not touched.
export function skipLegacyImport(storage: Preferences | null, legacyPurchases: number, now = new Date()): LegacyMigrationOutcome {
  let marker: string | null = null
  try { marker = storage?.getItem(LEGACY_MIGRATION_KEY) ?? null } catch { marker = null }
  const done = alreadyDone(marker)
  if (done) return done
  const outcome: RecordedOutcome = { status: 'skipped-by-user', legacyPurchases }
  writeMarker(storage, outcome, now)
  return outcome
}

// What the person is told. A successful import is reported once; any of their
// own purchases that were not imported stay reported until they dismiss it.
export type LegacyNotice = { kind: 'imported'; purchases: number; demoSkipped: number; skipped: number } | { kind: 'invalid'; purchases: number; capacity: boolean } | { kind: 'not-empty'; purchases: number } | { kind: 'not-moved'; purchases: number }
const count = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0 ? value as number : 0
export function legacyNotice(outcome: LegacyMigrationOutcome | null): LegacyNotice | null {
  if (!outcome) return null
  const recorded = outcome.status === 'already-done' ? (outcome.previous?.dismissed ? null : outcome.previous) : outcome
  if (recorded?.status === 'imported') {
    // Markers written before per-purchase skipping carry no skip counts.
    const purchases = count(recorded.purchases), skipped = count(recorded.fixtureSkipped) + count(recorded.invalidSkipped)
    if (outcome.status === 'already-done' ? skipped === 0 : purchases + skipped === 0) return null
    return { kind: 'imported', purchases, demoSkipped: count(recorded.demoSkipped), skipped }
  }
  if (!recorded || !('legacyPurchases' in recorded) || !(recorded.legacyPurchases > 0)) return null
  if (recorded.status === 'skipped-invalid') return { kind: 'invalid', purchases: recorded.legacyPurchases, capacity: recorded.reason === 'capacity' }
  if (recorded.status === 'skipped-not-empty') return { kind: 'not-empty', purchases: recorded.legacyPurchases }
  if (recorded.status === 'skipped-by-user') return { kind: 'not-moved', purchases: recorded.legacyPurchases }
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