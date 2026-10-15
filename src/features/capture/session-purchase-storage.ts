import { type EvidenceKind, type FxProvenance, type GlobePurchase, type LocalizedText, type Merchant, type Place, type PurchaseEvidence, type PurchaseItem } from '../../data/spendscape-globe'
import { denseArray, exactObject } from '../local-purchases/local-structure'
import { validateBarcode } from './barcode-domain'
import { type CaptureDraft, type SessionCaptureRecord } from './capture-domain'
import { lineMinorTotal, minorAmount, reviewCategories, reviewCurrencies, validateReview, type ReviewContext } from './session-purchase-domain'

// Added purchases stay in this browser profile until the user removes them.
// Records, the stores the user added and the ID sequence persist; Undo and
// operation idempotency remain page-lifetime state.
export const DEVICE_LEDGER_KEY = 'spendscape.device-purchases.v1'
const STORAGE_VERSION = 1
const MAX_RECORDS = 2000

const sources: readonly CaptureDraft['source'][] = ['receipt', 'product', 'barcode', 'document', 'pdf', 'csv', 'manual']
const evidenceKinds: readonly EvidenceKind[] = ['card-record', 'receipt', 'email-receipt', 'manual-entry']
const fxSources: readonly FxProvenance['source'][] = ['synthetic-fixture-rate', 'identity', 'user-reported-conversion']
const purchaseIdPattern = /^session_purchase_[a-z]+_(\d{2,6})$/
// Stores the user named carry a sequence number; chain stores from the price catalog do not.
const merchantIdPattern = /^(?:device_merchant_(\d{2,6})|chain_(?:shufersal|ramilevi|osherad))$/
const placeIdPattern = /^(?:device_place_(\d{2,6})|store_(?:shufersal|ramilevi|osherad)_\d{1,5})$/
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

type Unknown = Record<string, unknown>
const isObject = (value: unknown): value is Unknown => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
const isPositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const isInstant = (value: unknown): value is string => typeof value === 'string' && instantPattern.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z')
const validStoreName = (v: string) => v.trim().length > 0 && v.length <= 100
const validStoreCoordinates = (v: unknown): v is [number, number] => denseArray(v, 2) && v.length === 2 && v.every((n, i) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= (i ? 90 : 180))
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T => allowed.includes(value as T)

function localized(value: unknown): LocalizedText | null {
  return isObject(value) && isText(value.en) && isText(value.he) ? { en: value.en, he: value.he } : null
}

function storedItem(value: unknown): PurchaseItem | null {
  if (!isObject(value)) return null
  const label = localized(value.label)
  if (!label || !isText(value.id) || !oneOf(value.unit, ['item', 'kg'] as const)) return null
  if (!isPositive(value.quantity) || !isPositive(value.unitPrice) || !isPositive(value.lineTotal)) return null
  return { id: value.id, label, quantity: value.quantity, unit: value.unit, unitPrice: value.unitPrice, lineTotal: value.lineTotal }
}

function storedFx(value: unknown): FxProvenance | null {
  if (!isObject(value)) return null
  const label = localized(value.label)
  if (!label || value.baseCurrency !== 'ILS' || !isPositive(value.rateToBase) || !isInstant(value.effectiveAt) || !oneOf(value.source, fxSources)) return null
  if (value.reportedBaseAmountIls !== undefined && !isPositive(value.reportedBaseAmountIls)) return null
  return { baseCurrency: 'ILS', rateToBase: value.rateToBase, effectiveAt: value.effectiveAt, source: value.source, ...(value.reportedBaseAmountIls === undefined ? {} : { reportedBaseAmountIls: value.reportedBaseAmountIls }), label }
}

function storedPurchase(value: unknown, context: ReviewContext): GlobePurchase | null {
  if (!isObject(value) || typeof value.id !== 'string' || !purchaseIdPattern.test(value.id)) return null
  const merchant = context.merchants.find(entry => entry.id === value.merchantId)
  const fx = storedFx(value.fx)
  if (!merchant || !fx || !isInstant(value.timestamp) || !isPositive(value.originalAmount)) return null
  if (!oneOf(value.channel, ['physical', 'online', 'unknown'] as const) || !oneOf(value.resolution, ['confirmed', 'unresolved'] as const)) return null
  if (!oneOf(value.paymentMode, ['card', 'cash', 'manual'] as const) || !oneOf(value.category, reviewCategories) || !oneOf(value.originalCurrency, reviewCurrencies)) return null
  if (value.provenance !== undefined && value.provenance !== 'user-reviewed-session') return null
  // A pin needs a known place of that merchant; anything else must stay unpinned.
  const place = value.channel === 'physical' ? context.places.find(entry => entry.id === value.placeId) : undefined
  if (value.channel === 'physical' ? !place || place.merchantId !== merchant.id || merchant.onlineOnly : value.placeId !== null) return null
  if (!Array.isArray(value.items) || value.items.length > 50 || !Array.isArray(value.evidenceIds) || value.evidenceIds.length !== 1 || !isText(value.evidenceIds[0])) return null
  const items = value.items.map(storedItem)
  if (items.some(entry => entry === null)) return null
  return { ...(value.provenance ? { provenance: value.provenance } : {}), id: value.id, merchantId: merchant.id, timestamp: value.timestamp, channel: value.channel, resolution: value.resolution, paymentMode: value.paymentMode, placeId: place?.id ?? null, category: value.category, originalAmount: value.originalAmount, originalCurrency: value.originalCurrency, fx, items: items as PurchaseItem[], evidenceIds: [value.evidenceIds[0]] }
}

function storedEvidence(value: unknown, purchase: GlobePurchase): PurchaseEvidence | null {
  if (!isObject(value)) return null
  const label = localized(value.label)
  if (!label || value.id !== purchase.evidenceIds[0] || value.purchaseId !== purchase.id || !oneOf(value.kind, evidenceKinds) || !isInstant(value.observedAt) || typeof value.synthetic !== 'boolean') return null
  return { id: purchase.evidenceIds[0], purchaseId: purchase.id, kind: value.kind, observedAt: value.observedAt, label, synthetic: value.synthetic }
}

function storedIdentification(value: unknown): SessionCaptureRecord['identification'] | null {
  if (!isObject(value) || !isObject(value.identity) || !oneOf(value.method, ['camera', 'manual', 'demo'] as const) || typeof value.syntheticCatalog !== 'boolean') return null
  const { original, format, gtin14 } = value.identity
  if (typeof original !== 'string' || typeof format !== 'string') return null
  const checked = validateBarcode(original, format)
  if (!checked.valid || checked.identity.gtin14 !== gtin14) return null
  return { method: value.method, syntheticCatalog: value.syntheticCatalog, identity: checked.identity }
}

function storedRecord(value: unknown, context: ReviewContext): SessionCaptureRecord | null {
  if (!isObject(value) || !oneOf(value.source, sources) || typeof value.synthetic !== 'boolean') return null
  const purchase = storedPurchase(value.purchase, context)
  const evidence = purchase && storedEvidence(value.evidence, purchase)
  if (!purchase || !evidence) return null
  if (value.identification === undefined) return { purchase, evidence, source: value.source, synthetic: value.synthetic }
  const identification = storedIdentification(value.identification)
  return identification ? { purchase, evidence, source: value.source, synthetic: value.synthetic, identification } : null
}

function storedMerchant(value: unknown, taken: ReadonlySet<string>): Merchant | null {
  if (!isObject(value) || typeof value.id !== 'string' || !merchantIdPattern.test(value.id) || taken.has(value.id)) return null
  const name = localized(value.name)
  if (!name || !validStoreName(name.en) || !validStoreName(name.he) || !oneOf(value.category, reviewCategories)) return null
  if (value.onlineOnly !== undefined && typeof value.onlineOnly !== 'boolean') return null
  return { id: value.id, name, category: value.category, ...(value.onlineOnly ? { onlineOnly: true } : {}) }
}

function storedPlace(value: unknown, merchants: readonly Merchant[], taken: ReadonlySet<string>): Place | null {
  if (!isObject(value) || typeof value.id !== 'string' || !placeIdPattern.test(value.id) || taken.has(value.id)) return null
  const merchant = merchants.find(entry => entry.id === value.merchantId)
  const name = localized(value.name), branch = localized(value.branch), city = localized(value.city), country = localized(value.country)
  if (!merchant || merchant.onlineOnly || !name || !branch || !city || !country || !validStoreCoordinates(value.coordinates) || !oneOf(value.category, reviewCategories)) return null
  return { id: value.id, merchantId: merchant.id, name, branch, city, country, coordinates: [value.coordinates[0], value.coordinates[1]], category: value.category }
}

/** Main's historical localStorage schema. Never written by the integration. */
export interface LegacyMainLedger {
  version: 1
  nextSequence: number
  records: SessionCaptureRecord[]
  merchants?: Merchant[]
  places?: Place[]
}
export class LegacyLedgerError extends Error { constructor() { super('legacy-ledger-invalid') } }
const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const ak = Object.keys(a).sort(), bk = Object.keys(b).sort()
  return ak.length === bk.length && ak.every((k,i) => k === bk[i] && equal((a as Unknown)[k], (b as Unknown)[k]))
}
/** Complete validation, no salvage, source mutation, writes or ID reassignment. */
export function validateLegacyMain(raw: unknown, context: ReviewContext): LegacyMainLedger {
  try {
    if (!isObject(raw) || JSON.stringify(raw).length > 2_000_000 || !exactObject(raw, ['version','nextSequence','records', ...(Object.hasOwn(raw,'merchants') ? ['merchants'] : []), ...(Object.hasOwn(raw,'places') ? ['places'] : [])]) || raw.version !== STORAGE_VERSION || !Number.isSafeInteger(raw.nextSequence) || (raw.nextSequence as number) < 1 || !denseArray(raw.records, MAX_RECORDS)) throw 0
    const merchants: Merchant[] = [], places: Place[] = []
    const merchantIds = new Set(context.merchants.map(m => m.id)), placeIds = new Set(context.places.map(p => p.id))
    if (raw.merchants !== undefined && !denseArray(raw.merchants, MAX_RECORDS)) throw 0
    if (raw.places !== undefined && !denseArray(raw.places, MAX_RECORDS)) throw 0
    let highest = 0
    for (const value of (raw.merchants ?? []) as unknown[]) {
      const m = storedMerchant(value, merchantIds)
      if (!m || !equal(value, m)) throw 0
      merchants.push(m); merchantIds.add(m.id)
      highest = Math.max(highest, Number(merchantIdPattern.exec(m.id)![1] ?? 0))
    }
    for (const value of (raw.places ?? []) as unknown[]) {
      const p = storedPlace(value, [...context.merchants,...merchants], placeIds)
      if (!p || !equal(value, p)) throw 0
      places.push(p); placeIds.add(p.id)
      highest = Math.max(highest, Number(placeIdPattern.exec(p.id)![1] ?? 0))
    }
    const graph = { merchants: [...context.merchants,...merchants], places: [...context.places,...places] }
    const ids = new Set<string>(), evidenceIds = new Set<string>()
    for (const value of raw.records) {
      const r = storedRecord(value, graph)
      if (!r || !equal(value,r) || ids.has(r.purchase.id) || evidenceIds.has(r.evidence.id) || r.synthetic !== r.evidence.synthetic || (!r.synthetic && r.purchase.provenance !== 'user-reviewed-session')) throw 0
      const p = r.purchase
      const errors = validateReview({ source:r.source, provenance:r.synthetic ? 'synthetic-demo' : 'user-reviewed', merchantId:p.merchantId,placeId:p.placeId ?? '',channel:p.channel,date:p.timestamp.slice(0,16),currency:p.originalCurrency,payment:p.paymentMode,category:p.category,amount:String(p.originalAmount),baseAmount:String(p.fx.reportedBaseAmountIls ?? ''),lines:p.items.map(item=>({name:item.label.en,quantity:String(item.quantity),unit:item.unit,price:String(item.unitPrice)})), ...(r.identification ? {identification:r.identification} : {}) },graph)
      if (Object.keys(errors).length) throw 0
      if ((p.channel === 'physical' || p.channel === 'online') && p.resolution !== 'confirmed' || p.channel === 'unknown' && p.resolution !== 'unresolved') throw 0
      // Main's v1 contract required printed-line arithmetic and a matching total.
      // Match main's integer half-up calculation, including weighted half cents.
      // Validate observed line totals; never recalculate or rewrite stored facts.
      const lineAmounts = p.items.map(item => minorAmount(String(item.lineTotal), p.originalCurrency))
      if (p.items.some((item, index) => lineAmounts[index] === null || lineMinorTotal({ name: item.label.en, price: String(item.unitPrice), quantity: String(item.quantity), unit: item.unit }, p.originalCurrency) !== lineAmounts[index]) || p.items.length && lineAmounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0) !== minorAmount(String(p.originalAmount), p.originalCurrency)) throw 0
      ids.add(p.id); evidenceIds.add(r.evidence.id)
      highest = Math.max(highest, Number(purchaseIdPattern.exec(p.id)![1]))
    }
    if ((raw.nextSequence as number) <= highest) throw 0
    return structuredClone(raw) as unknown as LegacyMainLedger
  } catch { throw new LegacyLedgerError() }
}
export function readLegacyMain(raw: string | null, context: ReviewContext): LegacyMainLedger | null {
  if (raw === null) return null
  try { return validateLegacyMain(JSON.parse(raw), context) } catch { throw new LegacyLedgerError() }
}
/** Namespacing is a reversible VIEW projection. Stored original IDs stay intact. */
export function legacyMainGraph(context: ReviewContext, ledger: LegacyMainLedger | null) {
  const records = ledger?.records ?? []
  const merchants = [...context.merchants, ...(ledger?.merchants ?? [])]
  const places = [...context.places, ...(ledger?.places ?? [])]
  const id = (value: string) => `legacy_main:${value}`
  const merchantId = (value: string) => context.merchants.some(m => m.id === value) ? value : id(value)
  const placeId = (value: string) => context.places.some(p => p.id === value) ? value : id(value)
  return {
    merchants: merchants.filter(m => records.some(r => r.purchase.merchantId === m.id)).map(m => ({ ...m, id: merchantId(m.id) })),
    places: places.filter(p => records.some(r => r.purchase.placeId === p.id)).map(p => ({ ...p, id: placeId(p.id), merchantId: merchantId(p.merchantId) })),
    records: records.map(r => ({ ...r, purchase: { ...r.purchase, id: id(r.purchase.id), merchantId: merchantId(r.purchase.merchantId), placeId: r.purchase.placeId ? placeId(r.purchase.placeId) : null, evidenceIds: r.purchase.evidenceIds.map(id) }, evidence: { ...r.evidence, id: id(r.evidence.id), purchaseId: id(r.evidence.purchaseId) } })),
  }
}
