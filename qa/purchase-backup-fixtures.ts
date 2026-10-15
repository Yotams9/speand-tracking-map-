import { canonicalSpendscapeData as history } from '../src/data/spendscape-fixtures'
import type { SpendscapeDataSnapshot } from '../src/data/spendscape-repository'
import { blankReview, emptySessionLedger, saveReviewedPurchase } from '../src/features/capture/session-purchase-domain'
import { composeDirectory } from '../src/features/local-purchases/local-directory'
import { emptyLocalPurchases, validateLocalPurchases } from '../src/features/local-purchases/local-purchase-store'
import { resolvePurchaseLocation } from '../src/features/local-purchases/purchase-location'

const context: SpendscapeDataSnapshot = { ...history, source: { adapter: 'fixture', classification: 'synthetic', version: history.fixtureVersion } }

// Synthetic structured records only. No image, provider, historical artifact or key.
export function fictionalBackupLedger() {
  let ledger = emptySessionLedger()
  const first = saveReviewedPurchase(ledger, 'fictional-first', {
    ...blankReview(), source: 'receipt', channel: 'unknown', date: '2024-02-29T09:07', currency: 'ILS',
    payment: 'unknown', category: 'unknown', amount: '12.40',
    lines: [{ name: 'Fictional package · מוצר בדוי', quantity: '2', unit: 'item', price: '6.25' }],
    directoryIntent: { merchant: { name: 'Fictional backup shop · חנות בדויה', category: 'unknown', separate: false } },
  }, context, []).ledger
  const location = resolvePurchaseLocation(first, first.records[0].purchase.id, {
    kind: 'branch', branch: 'Fictional confirmed branch', city: 'Fictional city', country: 'Fictional country',
    address: 'Fictional street 8', longitude: '34.75', latitude: '32.1', method: 'address-search', confirmed: true,
    addressSearch: { provider: 'geoapify', precision: 'building', match: 'full', pointAdjusted: false },
  }, context)
  if (location.code !== 'updated') throw Error('fictional-location-invalid')
  ledger = location.ledger
  const merchantId = ledger.records[0].purchase.merchantId, placeId = ledger.records[0].purchase.placeId!
  ledger = saveReviewedPurchase(ledger, 'fictional-shared', {
    ...blankReview(), source: 'receipt', merchantId, placeId, channel: 'physical', date: '2024-03-01T10:00', currency: 'ILS',
    payment: 'cash', category: 'groceries', amount: '7.00', lines: [{ name: 'Fictional discounted item', quantity: '2', unit: 'item', price: '4', discount: '1' }],
  }, composeDirectory(context, ledger.directory), ledger.records.map(r => r.purchase)).ledger
  ledger = saveReviewedPurchase(ledger, 'fictional-unresolved', {
    ...blankReview(), source: 'receipt', channel: 'unknown', date: '2024-03-02T11:05', currency: 'ILS', payment: 'unknown', category: 'unknown',
    amount: '9', lines: [{ name: 'Fictional weighed ingredient', quantity: '0.375', unit: 'kg', price: '24' }],
    directoryIntent: { merchant: { name: 'Fictional unresolved shop', category: 'unknown', separate: false } },
  }, composeDirectory(context, ledger.directory), ledger.records.map(r => r.purchase)).ledger
  ledger = saveReviewedPurchase(ledger, 'fictional-online', {
    ...blankReview(), source: 'manual', merchantId, channel: 'online', date: '2024-03-03T12:10', currency: 'USD', payment: 'unknown',
    category: 'unknown', amount: '10.23', baseAmount: '38', lines: [],
  }, composeDirectory(context, ledger.directory), ledger.records.map(r => r.purchase)).ledger
  if (ledger.records.length !== 4) throw Error('fictional-backup-invalid')
  return validateLocalPurchases({ ...emptyLocalPurchases(), revision: 23, records: ledger.records, directory: ledger.directory, nextSequence: ledger.nextSequence }, context)
}
export { context as backupFixtureContext }
