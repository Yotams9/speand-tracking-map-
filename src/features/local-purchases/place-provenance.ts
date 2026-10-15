import type { CatalogChain } from '../../data/price-catalog'
import type { LocalizedText } from '../../data/spendscape-globe'
import { exactObject } from './local-structure'

// A Tel Aviv chain branch from the published-price catalog becomes an ordinary
// confirmed place: the user chose it, and the catalog store ID and published
// address are kept as provenance. Catalog coordinates come from an address
// point; neither they nor the device location prove where a purchase happened.
export const catalogChains: readonly CatalogChain[] = ['shufersal', 'ramilevi', 'osherad']
export const catalogChainNames: Readonly<Record<CatalogChain, LocalizedText>> = {
  shufersal: { en: 'Shufersal', he: 'שופרסל' },
  ramilevi: { en: 'Rami Levy', he: 'רמי לוי' },
  osherad: { en: 'Osher Ad', he: 'אושר עד' },
}
export const catalogArea = { city: { en: 'Tel Aviv-Yafo', he: 'תל אביב-יפו' }, country: { en: 'Israel', he: 'ישראל' } } as const
// Places pinned at the device location by the earlier on-device ledger keep its labels.
export const devicePlaceLabels = { branch: { en: 'Pinned by you', he: 'סומן על ידך' }, city: { en: 'My places', he: 'המקומות שלי' }, country: { en: 'Saved on this device', he: 'נשמר במכשיר הזה' } } as const

export interface CatalogStoreChoice { id: string; chain: CatalogChain; name: string; address: string; coordinates: [longitude: number, latitude: number] }
export interface CatalogPlaceProvenance { storeId: string; chain: CatalogChain; publishedAddress: string }

const text = (value: unknown, optional = false): value is string => typeof value === 'string' && value.length <= 100 && (optional || value.trim().length > 0) && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value)
const storeId = (value: unknown, chain: unknown): value is string => typeof value === 'string' && catalogChains.includes(chain as CatalogChain) && new RegExp(`^${chain}-\\d{1,5}$`).test(value)
export const sameText = (a: unknown, b: LocalizedText) => exactObject(a, ['en', 'he']) && a.en === b.en && a.he === b.he
export const catalogText = (value: string) => value.replace(/\s+/g, ' ').trim()

export function validCatalogStoreChoice(value: unknown): value is CatalogStoreChoice {
  if (!exactObject(value, ['id', 'chain', 'name', 'address', 'coordinates'])) return false
  const c = value.coordinates
  return storeId(value.id, value.chain) && text(value.name) && text(value.address, true)
    && Array.isArray(c) && c.length === 2 && c.every((n, i) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= (i ? 90 : 180))
}
export function validCatalogProvenance(value: unknown): value is CatalogPlaceProvenance {
  return exactObject(value, ['storeId', 'chain', 'publishedAddress']) && storeId(value.storeId, value.chain) && text(value.publishedAddress, true)
}
export function catalogStoreIdOf(place: unknown): string | null {
  const provenance = place && typeof place === 'object' ? (place as { catalogStore?: unknown }).catalogStore : undefined
  return validCatalogProvenance(provenance) ? provenance.storeId : null
}
