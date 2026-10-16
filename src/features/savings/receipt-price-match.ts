import type { CatalogCandidate } from '../../data/catalog-search'
import type { GlobePurchase, Place } from '../../data/spendscape-globe'
import { comparisonOrigin } from '../nearby-prices/receipt-comparison'
import type { SavingsBasket } from './purchase-basket'

export function validCandidate(value: unknown): value is CatalogCandidate {
  if (!value || typeof value !== 'object') return false
  const p = value as CatalogCandidate
  if (typeof p.gtin14 !== 'string' || !/^\d{14}$/.test(p.gtin14)) return false
  const sum = [...p.gtin14.slice(0, -1)].reverse().reduce((n, digit, i) => n + Number(digit) * (i % 2 ? 1 : 3), 0)
  return (10 - sum % 10) % 10 === Number(p.gtin14.at(-1)) && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 300 && typeof p.quantity === 'string' && typeof p.manufacturer === 'string' && typeof p.weighted === 'boolean'
}

export const knownPackage = (value: string) => value.trim().length > 0 && !/לא\s*ידוע|unknown/i.test(value)

const cents = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1000000 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? Math.round(n * 100) : null

// An explicit candidate-button click confirms one receipt row only. No name
// guess becomes a barcode and no identity or match is written to the ledger.
export function receiptPriceBasket(purchase: GlobePurchase, itemId: string, candidate: CatalogCandidate, places: readonly Place[]): SavingsBasket | null {
  const item = purchase.items.find(i => i.id === itemId), place = comparisonOrigin(purchase, places)
  if (!item || !validCandidate(candidate) || candidate.weighted || !knownPackage(candidate.quantity) || purchase.originalCurrency !== 'ILS' || item.unit !== 'item' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) return null
  const payable = cents(purchase.originalAmount), rowAmounts = purchase.items.map(i => cents(i.lineTotal))
  const reconciles = rowAmounts.every(n => n !== null) && rowAmounts.reduce<number>((sum, n) => sum + n!, 0) === payable
  // A one-row receipt uses the independent final payable (including receipt
  // adjustments). For multiple rows, don't allocate an unassigned adjustment.
  const paid = purchase.items.length === 1 ? payable : reconciles ? cents(item.lineTotal) : null
  return {
    items: [{ ref: item.id, gtin14: candidate.gtin14, quantity: item.quantity, unit: 'item', ...(paid !== null ? { paidMinor: paid } : {}) }],
    origin: place ? { lat: place.coordinates[1], lon: place.coordinates[0] } : null,
  }
}
