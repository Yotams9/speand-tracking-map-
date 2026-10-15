import type { SpendscapeDataSnapshot } from './spendscape-repository'
import type { SessionCaptureRecord } from '../features/capture/capture-domain'
import { composeDirectory, type LocalDirectory } from '../features/local-purchases/local-directory'

/** Historical references are a validation context, never seeded purchases. */
export function userApplicationSnapshot(history: SpendscapeDataSnapshot): SpendscapeDataSnapshot {
  return {
    ...history,
    source: { adapter: 'local', classification: 'real', version: 'local-user-v1' },
    profile: { id: 'local-user', name: { en: 'You', he: 'אתם' }, baseCurrency: 'ILS', timezone: '' },
    purchases: [], evidence: [],
  }
}

/** Only reviewed records and their existing references enter ordinary surfaces.
 * Keep stored demos/decisions untouched in the ledger for strict legacy readback.
 */
export function composeUserGraph(history: SpendscapeDataSnapshot, directory: LocalDirectory, records: readonly SessionCaptureRecord[]) {
  const visibleRecords = records.filter(record => !record.synthetic)
  const graph = composeDirectory(history, directory)
  const purchases = visibleRecords.map(record => record.purchase)
  const places = graph.places.filter(place => purchases.some(purchase => purchase.placeId === place.id))
  const merchants = graph.merchants.filter(merchant => purchases.some(purchase => purchase.merchantId === merchant.id) || places.some(place => place.merchantId === merchant.id))
  return { merchants, places, purchases, records: visibleRecords }
}

export function syntheticQaAllowed(enabled: string | undefined, host: string, optIn: unknown): boolean {
  return enabled === '1' && optIn === '1' && /^(127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?$/.test(host)
}
