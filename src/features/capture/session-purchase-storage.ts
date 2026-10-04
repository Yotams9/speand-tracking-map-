import { type EvidenceKind, type FxProvenance, type GlobePurchase, type LocalizedText, type Merchant, type Place, type PurchaseEvidence, type PurchaseItem } from '../../data/spendscape-globe'
import { validateBarcode } from './barcode-domain'
import { type CaptureDraft, type SessionCaptureRecord } from './capture-domain'
import { emptySessionLedger, reviewCategories, reviewCurrencies, validStoreCoordinates, validStoreName, type ReviewContext, type SessionPurchaseLedger } from './session-purchase-domain'

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
const isInstant = (value: unknown): value is string => typeof value === 'string' && instantPattern.test(value) && Number.isFinite(Date.parse(value))
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

export function serializeSessionLedger(ledger: SessionPurchaseLedger): string {
  return JSON.stringify({ version: STORAGE_VERSION, nextSequence: ledger.nextSequence, records: ledger.records, merchants: ledger.merchants, places: ledger.places })
}

// Stored text is untrusted: it may be stale, truncated or edited. Records that
// no longer validate against the current merchants and places are dropped, and
// a stored store survives only while a kept record still uses it.
export function restoreSessionLedger(raw: string | null, context: ReviewContext): SessionPurchaseLedger {
  let stored: unknown
  try { stored = raw ? JSON.parse(raw) : null } catch { return emptySessionLedger() }
  if (!isObject(stored) || stored.version !== STORAGE_VERSION || !Array.isArray(stored.records)) return emptySessionLedger()
  const merchants: Merchant[] = [], places: Place[] = []
  const takenMerchants = new Set(context.merchants.map(entry => entry.id)), takenPlaces = new Set(context.places.map(entry => entry.id))
  for (const candidate of Array.isArray(stored.merchants) ? stored.merchants.slice(0, MAX_RECORDS) : []) {
    const merchant = storedMerchant(candidate, takenMerchants)
    if (merchant) { merchants.push(merchant); takenMerchants.add(merchant.id) }
  }
  for (const candidate of Array.isArray(stored.places) ? stored.places.slice(0, MAX_RECORDS) : []) {
    const place = storedPlace(candidate, merchants, takenPlaces)
    if (place) { places.push(place); takenPlaces.add(place.id) }
  }
  const combined: ReviewContext = { merchants: [...context.merchants, ...merchants], places: [...context.places, ...places] }
  const records: SessionCaptureRecord[] = []
  const seen = new Set<string>()
  let highest = 0
  for (const candidate of stored.records.slice(0, MAX_RECORDS)) {
    const record = storedRecord(candidate, combined)
    if (!record || seen.has(record.purchase.id)) continue
    seen.add(record.purchase.id)
    highest = Math.max(highest, Number(purchaseIdPattern.exec(record.purchase.id)![1]))
    records.push(record)
  }
  const usedMerchants = merchants.filter(entry => records.some(record => record.purchase.merchantId === entry.id))
  const usedPlaces = places.filter(entry => records.some(record => record.purchase.placeId === entry.id))
  for (const entry of usedMerchants) highest = Math.max(highest, Number(merchantIdPattern.exec(entry.id)![1] ?? 0))
  for (const entry of usedPlaces) highest = Math.max(highest, Number(placeIdPattern.exec(entry.id)![1] ?? 0))
  const storedNext = Number.isSafeInteger(stored.nextSequence) && (stored.nextSequence as number) > 0 ? stored.nextSequence as number : 1
  // IDs are derived from the sequence, so it must never fall behind a kept entry.
  return { ...emptySessionLedger(), records, merchants: usedMerchants, places: usedPlaces, nextSequence: Math.max(storedNext, highest + 1) }
}
