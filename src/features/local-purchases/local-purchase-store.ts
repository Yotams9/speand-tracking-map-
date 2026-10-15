import { legacyMainGraph, validateLegacyMain, type LegacyMainLedger } from '../capture/session-purchase-storage'
import { composeDirectory, denseArray, emptyDirectory, exactObject, pruneDirectory, validateDirectory, type LocalDirectory } from './local-directory'
import type { SpendscapeDataSnapshot } from '../../data/spendscape-repository'
import { emptySessionLedger, reviewedRecord, type PurchaseReviewInput, type SessionPurchaseLedger } from '../capture/session-purchase-domain'
import type { SessionCaptureRecord } from '../capture/capture-domain'
import type { SmartInboxDecision } from '../inbox/smart-inbox-domain'

export const LOCAL_DB = 'spendscape-local-purchases'
export const LOCAL_CHANNEL = 'spendscape-local-purchases-changed'
export interface LocalPurchases { version: 4 | 5; legacyMain?: LegacyMainLedger | null; directory: LocalDirectory; revision: number; records: readonly SessionCaptureRecord[]; nextSequence: number; decisions: readonly SmartInboxDecision[] }
export const emptyLocalPurchases = (): LocalPurchases => ({ version: 5, legacyMain: null, directory: emptyDirectory(), revision: 0, records: [], nextSequence: 1, decisions: [] })
export class LocalStoreError extends Error {
  constructor(public readonly code: 'invalid' | 'unavailable' | 'conflict' | 'capacity' | 'rejected' | 'not-empty') { super(code) }
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const ak = Object.keys(a).sort(), bk = Object.keys(b).sort()
  return ak.length === bk.length && ak.every((k, i) => k === bk[i] && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
// Stored data is untrusted. Rebuild every record through the existing reviewed
// save boundary, then require exact structural equality: no extra media/URL or
// arbitrary evidence fields can survive hydration or enter the write payload.
export function validateLocalPurchases(raw: unknown, context: SpendscapeDataSnapshot): LocalPurchases {
  try {
    if (!raw || typeof raw !== 'object' || !exactObject(raw, Object.keys(raw)) || JSON.stringify(raw).length > 4_000_000) throw 0
    const data = raw as Omit<LocalPurchases, 'version'> & { version: number }
    if ((data.version !== 1 && data.version !== 2 && data.version !== 3 && data.version !== 4 && data.version !== 5) || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Number.isSafeInteger(data.nextSequence) || data.nextSequence < 1 || !denseArray(data.records, 1000) || !denseArray(data.decisions, context.smartInboxCases.length)) throw 0
    if (JSON.stringify(data.version === 5 ? { ...data, legacyMain: null } : data).length > 2_000_000) throw 0
    const legacyMain = data.version === 5 ? (data.legacyMain === null ? null : validateLegacyMain(data.legacyMain, context)) : null
    const legacyGraph = legacyMainGraph(context, legacyMain)
    const validationContext = { merchants: [...context.merchants,...legacyGraph.merchants.filter(m => !context.merchants.some(existing => existing.id === m.id))], places: [...context.places,...legacyGraph.places.filter(p => !context.places.some(existing => existing.id === p.id))] }
    const directory = data.version >= 3 ? validateDirectory(data.directory, validationContext, data.nextSequence) : emptyDirectory()
    // Legacy envelopes did not support unknown context; never reinterpret them.
    if (data.version < 4 && (directory.places.some(p => p.locationMethod !== 'manual-coordinates' || p.addressSearch !== undefined) || directory.merchants.some(m => m.category === 'unknown') || data.records.some(r => r.purchase.paymentMode === 'unknown' || r.purchase.category === 'unknown'))) throw 0
    const graph = composeDirectory(validationContext, directory)
    const sequences = new Set<number>()
    const records = data.records.map((r: SessionCaptureRecord) => {
      const p = r.purchase
      if (!denseArray(p.items, 50) || p.items.some((item: SessionCaptureRecord['purchase']['items'][number]) => !item.label || typeof item.label.en !== 'string' || typeof item.label.he !== 'string' || item.label.en.length > 100 || item.label.he.length > 100 || !same(item.label, { en: item.label.en, he: item.label.he }))) throw 0
      if (r.demoProductIds !== undefined && (!denseArray(r.demoProductIds, 50) || r.demoProductIds.length !== p.items.length || r.demoProductIds.some(id => id !== null && (typeof id !== 'string' || id.length > 100)))) throw 0
      // V1 never carried discounts; accepting one would reinterpret old data.
      if (p.items.some(item => Object.hasOwn(item, 'discountMinor') &&
        (data.version === 1 || !Number.isSafeInteger(item.discountMinor) || item.discountMinor! < 0))) throw 0
      const match = /^session_purchase_[a-z]+_(\d+)$/.exec(p.id)
      const sequence = match ? Number(match[1]) : NaN
      if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence >= data.nextSequence || sequences.has(sequence)) throw 0
      sequences.add(sequence)
      const input: PurchaseReviewInput = {
        source: r.source, provenance: r.synthetic ? 'synthetic-demo' : 'user-reviewed',
        merchantId: p.merchantId, placeId: p.placeId ?? '', channel: p.channel,
        date: p.timestamp.slice(0, 16), currency: p.originalCurrency, payment: p.paymentMode,
        category: p.category, amount: String(p.originalAmount),
        baseAmount: String(p.fx.reportedBaseAmountIls ?? ''),
        lines: p.items.map((item, i) => ({ name: item.label.en, quantity: String(item.quantity), unit: item.unit, price: String(item.unitPrice), ...(Object.hasOwn(item, 'discountMinor') ? { discount: String(item.discountMinor! / (p.originalCurrency === 'JPY' ? 1 : 100)) } : {}), ...(r.synthetic ? { originalLabel: { ...item.label }, demoProductId: r.demoProductIds?.[i] ?? undefined } : {}) })),
        ...(r.identification ? { identification: r.identification } : {}),
      }
      const rebuilt = reviewedRecord(input, sequence, graph)
      if (!same(r, rebuilt)) throw 0
      return rebuilt
    })
    const cases = new Set<string>()
    const decisions = data.decisions.map(d => {
      const c = context.smartInboxCases.find(c => c.id === d.caseId && c.material)
      if (!c || cases.has(d.caseId)) throw 0
      cases.add(d.caseId)
      const clean: SmartInboxDecision = d.status === 'deferred' ? { caseId: d.caseId, status: 'deferred' } : { caseId: d.caseId, status: 'resolved', placeId: d.status === 'resolved' ? d.placeId : '' }
      if (clean.status === 'resolved' && (!c.candidates.some(p => p.placeId === clean.placeId) || !context.places.some(p => p.id === clean.placeId))) throw 0
      if (!same(d, clean)) throw 0
      return clean
    })
    const clean: LocalPurchases = { version: 5, legacyMain, directory, revision: data.revision, records, nextSequence: data.nextSequence, decisions }
    // Historical envelopes are validated before an in-memory-only migration.
    const { legacyMain: _archive, ...v4 } = clean
    const { directory: _directory, ...legacy } = v4
    if (!same(data, data.version === 5 ? clean : data.version >= 3 ? { ...v4, version: data.version } : { ...legacy, version: data.version })) throw 0
    if (!same(directory, pruneDirectory(directory, records.map(r => r.purchase)))) throw 0
    return clean
  } catch { throw new LocalStoreError('invalid') }
}
export function restoredLedger(data: LocalPurchases): SessionPurchaseLedger {
  // No persisted timer, draft, consumed-operation list or private navigation.
  return { ...emptySessionLedger(), directory: data.directory, records: data.records, nextSequence: data.nextSequence }
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = () => { if (!settled) { settled = true; clearTimeout(timer); reject(new LocalStoreError('unavailable')) } }
    const timer = setTimeout(fail, 5000)
    try {
      const request = indexedDB.open(LOCAL_DB, 1)
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('state')) request.result.createObjectStore('state') }
      request.onblocked = fail
      request.onerror = fail
      request.onsuccess = () => {
        if (settled) { request.result.close(); return }
        settled = true; clearTimeout(timer)
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
    } catch { fail() }
  })
}
export async function readLocalPurchases(context: SpendscapeDataSnapshot): Promise<LocalPurchases> {
  const db = await openDatabase()
  try {
    const raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('state', 'readonly'), request = tx.objectStore('state').get('current')
      const timer = setTimeout(() => { try { tx.abort() } catch { /* already finished */ } }, 5000)
      tx.oncomplete = () => { clearTimeout(timer); resolve(request.result) }
      tx.onabort = tx.onerror = () => { clearTimeout(timer); reject(new LocalStoreError('unavailable')) }
    })
    return raw === undefined ? emptyLocalPurchases() : validateLocalPurchases(raw, context)
  } finally { db.close() }
}
// Prospective write rejection must not mark the previously persisted data invalid.
export function validateLocalPurchaseWrite(next: LocalPurchases, context: SpendscapeDataSnapshot): LocalPurchases {
  if (next.records.length > 1000 || JSON.stringify(next.version === 5 ? { ...next, legacyMain: null } : next).length > 2_000_000 || JSON.stringify(next.legacyMain ?? null).length > 2_000_000) throw new LocalStoreError('capacity')
  try { return validateLocalPurchases(next, context) }
  catch { throw new LocalStoreError('rejected') }
}
export async function writeLocalPurchases(next: LocalPurchases, context: SpendscapeDataSnapshot, erase = false): Promise<LocalPurchases> {
  return persistLocalPurchases(next, context, erase ? 'erase' : 'write')
}
export function emptyRestoreDestination(data: LocalPurchases): boolean {
  return (data.legacyMain?.records.length ?? 0) === 0 && (data.legacyMain?.merchants?.length ?? 0) === 0 && (data.legacyMain?.places?.length ?? 0) === 0 && data.records.length === 0 && data.directory.merchants.length === 0 && data.directory.places.length === 0 && data.decisions.length === 0
}
export async function restoreLocalPurchases(data: LocalPurchases, context: SpendscapeDataSnapshot, expectedRevision: number): Promise<LocalPurchases> {
  // Validate all imported facts before opening a write transaction. Only the
  // destination's revision may participate in its concurrency protection.
  const clean = validateLocalPurchases(data, context)
  return persistLocalPurchases({ ...clean, revision: expectedRevision }, context, 'restore')
}
async function persistLocalPurchases(next: LocalPurchases, context: SpendscapeDataSnapshot, mode: 'write' | 'erase' | 'restore'): Promise<LocalPurchases> {
  const erase = mode === 'erase'
  const clean = validateLocalPurchaseWrite(next, context)
  const db = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state')
      let result = clean, reason: 'conflict' | 'invalid' | 'unavailable' | 'not-empty' = 'unavailable'
      const timer = setTimeout(() => { try { tx.abort() } catch { /* already finished */ } }, 5000)
      const request = store.get('current')
      request.onsuccess = () => {
        try {
          const current = erase ? request.result : request.result === undefined ? emptyLocalPurchases() : validateLocalPurchases(request.result, context)
          if (mode === 'restore' && !emptyRestoreDestination(current)) { reason = 'not-empty'; tx.abort(); return }
          if (mode === 'restore' && current.revision === Number.MAX_SAFE_INTEGER) { tx.abort(); return }
          if (!erase && current.revision !== clean.revision) { reason = 'conflict'; tx.abort(); return }
          // Keep an empty revision tombstone after explicit deletion so a stale
          // tab cannot recreate deleted purchases. It contains no purchase data.
          const revision = Number.isSafeInteger(current?.revision) && current.revision < Number.MAX_SAFE_INTEGER ? current.revision + 1 : 1
          result = { ...(erase ? emptyLocalPurchases() : clean), revision, ...(mode === 'restore' ? { nextSequence: Math.max(clean.nextSequence, current.nextSequence) } : {}) }
          store.put(result, 'current')
        } catch (e) { reason = e instanceof LocalStoreError && e.code === 'invalid' ? 'invalid' : 'unavailable'; tx.abort() }
      }
      tx.oncomplete = () => { clearTimeout(timer); resolve(result) }
      tx.onabort = tx.onerror = () => { clearTimeout(timer); reject(new LocalStoreError(reason)) }
    })
  } finally { db.close() }
}
