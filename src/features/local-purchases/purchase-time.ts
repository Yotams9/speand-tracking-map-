import type { SpendscapeDataSnapshot } from '../../data/spendscape-repository'
import { purchaseFingerprint, type SessionPurchaseLedger } from '../capture/session-purchase-domain'
import { receiptTimeCandidates } from '../capture/receipt-review-time'
import { exactObject } from './local-directory'
import { validateLocalPurchases } from './local-purchase-store'

export interface PurchaseTimeIntent { wall: string; zone: string; occurrence: '' | '0' | '1'; confirmed: boolean }
export function purchaseWallTime(timestamp: string, zone: string): string {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp)).map(p => [p.type, p.value]))
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
  } catch { return '' }
}
export function correctPurchaseTime(ledger: SessionPurchaseLedger, id: string, raw: unknown, context: SpendscapeDataSnapshot) {
  const fail = (error: string) => ({ ledger, code: 'invalid' as const, errors: { time: error } })
  const record = ledger.records.find(r => r.purchase.id === id)
  if (!record || record.synthetic || record.source !== 'receipt' || record.purchase.provenance !== 'user-reviewed-session') return fail('protected')
  if (!exactObject(raw, ['wall','zone','occurrence','confirmed'])) return fail('invalid')
  const { wall, zone, occurrence, confirmed } = raw
  if (typeof wall !== 'string' || typeof zone !== 'string' || (occurrence !== '' && occurrence !== '0' && occurrence !== '1')) return fail('invalid')
  if (confirmed !== true) return fail('confirmation')
  const intent: PurchaseTimeIntent = { wall, zone, occurrence, confirmed }
  const candidates = receiptTimeCandidates(intent.wall, intent.zone)
  if (!candidates.length) return fail('invalid')
  if (candidates.length > 1 && intent.occurrence === '') return fail('ambiguous')
  if (candidates.length === 1 && intent.occurrence !== '') return fail('invalid')
  const minute = candidates.length === 1 ? candidates[0] : candidates[Number(intent.occurrence)]
  if (!minute) return fail('invalid')
  const timestamp = minute + ':00.000Z'
  if (record.purchase.timestamp === timestamp) return { ledger, code: 'unchanged' as const, errors: {} }
  // Only the canonical date and its derived bookkeeping timestamps change.
  // IDs, evidence kind/label/provenance, all money/items and place remain intact.
  const corrected = { ...record, purchase: { ...record.purchase, timestamp, fx: { ...record.purchase.fx, effectiveAt: timestamp } }, evidence: { ...record.evidence, observedAt: timestamp } }
  if ([...context.purchases, ...ledger.records.filter(r => r !== record).map(r => r.purchase)].some(p => purchaseFingerprint(p) === purchaseFingerprint(corrected.purchase))) return fail('duplicate')
  const next = { ...ledger, records: ledger.records.map(r => r === record ? corrected : r) }
  try {
    validateLocalPurchases({ version: 4, revision: 0, directory: next.directory, records: next.records, nextSequence: next.nextSequence, decisions: [] }, context)
  } catch { return fail('invalid') }
  return { ledger: next, code: 'updated' as const, errors: {} }
}
