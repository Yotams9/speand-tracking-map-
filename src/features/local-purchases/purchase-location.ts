import { needsPointAdjustment, validSearchProvenance, type AddressSearchProvenance } from './address-search'
import type { SessionPurchaseLedger, ReviewContext } from '../capture/session-purchase-domain'
import { composeDirectory, exactObject, proposeDirectory, pruneDirectory } from './local-directory'

export type PurchaseLocationIntent =
  | { kind: 'reuse'; placeId: string; confirmed: boolean }
  | { kind: 'branch'; branch: string; city: string; country: string; address: string; longitude: string; latitude: string; method: 'map-selection' | 'manual-coordinates' | 'address-search'; addressSearch?: AddressSearchProvenance; confirmed: boolean }
export type LocationResult = { ledger: SessionPurchaseLedger; code: 'updated' | 'unchanged' | 'invalid' | 'protected'; errors: Record<string, string> }
export interface LocationUndo { before: SessionPurchaseLedger; after: SessionPurchaseLedger }

// Only local records can be changed. Confirmation means the user reports a
// physical purchase here; neither receipt text nor map position proves that.
export function resolvePurchaseLocation(ledger: SessionPurchaseLedger, purchaseId: string, raw: unknown, baseline: ReviewContext): LocationResult {
  const fail = (code: LocationResult['code'], errors: Record<string, string>): LocationResult => ({ ledger, code, errors })
  const record = ledger.records.find(r => r.purchase.id === purchaseId)
  if (!record || record.purchase.channel === 'online') return fail('protected', { location: 'protected' })
  const graph = composeDirectory(baseline, ledger.directory)
  const merchant = graph.merchants.find(m => m.id === record.purchase.merchantId)
  if (!merchant || merchant.onlineOnly) return fail('protected', { location: 'protected' })
  if (!raw || typeof raw !== 'object') return fail('invalid', { location: 'required' })
  if (!exactObject(raw, Object.keys(raw))) return fail('invalid', { location: 'required' })
  const intent = raw as PurchaseLocationIntent
  if (intent.kind === 'reuse' ? !exactObject(raw, ['kind', 'placeId', 'confirmed']) || typeof intent.placeId !== 'string'
    : intent.kind === 'branch' ? !exactObject(raw, ['kind', 'branch', 'city', 'country', 'address', 'longitude', 'latitude', 'method', 'confirmed', ...(Object.hasOwn(raw,'addressSearch') ? ['addressSearch'] : [])]) || !['map-selection', 'manual-coordinates', 'address-search'].includes(intent.method)
    : true) return fail('invalid', { location: 'required' })
  if (intent.kind === 'branch' && ((intent.addressSearch !== undefined && (!validSearchProvenance(intent.addressSearch) || needsPointAdjustment(intent.addressSearch))) || (intent.method === 'address-search' && !intent.addressSearch))) return fail('invalid', { location: 'adjust-point' })
  if (intent.confirmed !== true) return fail('invalid', { confirmed: 'location' })
  let directory = ledger.directory, nextSequence = ledger.nextSequence, placeId: string
  if (intent.kind === 'reuse') {
    const place = graph.places.find(p => p.id === intent.placeId && p.merchantId === merchant.id)
    if (!place) return fail('invalid', { placeId: 'place' })
    placeId = place.id
  } else {
    const { kind: _kind, method, addressSearch, ...place } = intent
    const proposal = proposeDirectory({ place: { ...place, separate: false } }, merchant.id, 'physical', nextSequence, graph)
    if (Object.keys(proposal.errors).length) return fail('invalid', proposal.errors)
    placeId = proposal.placeId
    directory = { ...directory, places: [...directory.places, { ...proposal.directory.places[0], locationMethod: method, ...(addressSearch ? {addressSearch:{...addressSearch}} : {}) }] }
    nextSequence++
  }
  if (record.purchase.placeId === placeId && record.purchase.channel === 'physical' && record.purchase.resolution === 'confirmed') return fail('unchanged', {})
  // Preserve source/evidence and all financial facts. No new purchase or evidence.
  const records = ledger.records.map(r => r === record ? { ...r, purchase: { ...r.purchase, placeId, channel: 'physical' as const, resolution: 'confirmed' as const } } : r)
  return { code: 'updated', errors: {}, ledger: { ...ledger, records, directory: pruneDirectory(directory, records.map(r => r.purchase)), nextSequence } }
}

// Undo is allowed only while this is still the exact latest ledger. It cannot
// overwrite an intervening save/delete. IDs remain monotonic even after Undo.
export function undoPurchaseLocation(current: SessionPurchaseLedger, undo: LocationUndo): SessionPurchaseLedger | null {
  return current === undo.after ? { ...undo.before, nextSequence: current.nextSequence, undoId: current.undoId } : null
}
