import type { LocalizedText } from '../../data/spendscape-globe'
import { validateBarcode } from '../capture/barcode-domain'

// A read-only boundary, not an activated price provider. Missing evidence stays
// null; it never becomes currency, location, package size or price by default.
export interface PackageBasis { quantity: number; unit: 'g' | 'ml' | 'count'; count: number }
export interface CatalogProduct {
  id: string; label: LocalizedText; brand: string | null; variant: string | null
  package: PackageBasis | null; gtin: string | null
}
export interface PriceSnapshot {
  version: 1
  classification: 'fictional' | 'qualified'
  source: { id: string; label: string; hash: string; publishedAt: string | null; fetchedAt: string; currency: 'ILS' | null; currencyEvidence: string | null; coverage: 'complete' | 'partial' }
  products: CatalogProduct[]
  stores: { id: string; retailerId: string; label: LocalizedText; coordinates: [number, number] | null; coordinateEvidence: string | null }[]
  prices: { storeId: string; productId: string; unitMinor: number | null; basis: 'package' }[]
}
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype
const keys = (x: Record<string, unknown>, allowed: string[]) => Object.keys(x).length === allowed.length && allowed.every(k => Object.hasOwn(x, k))
const text = (x: unknown): x is string => typeof x === 'string' && x.trim() === x && x.length > 0 && x.length <= 160 && !/[\u0000-\u001f\u007f]/.test(x)
const id = (x: unknown): x is string => text(x) && /^[a-zA-Z0-9_-]{1,80}$/.test(x)
const nullableText = (x: unknown) => x === null || text(x)
const localized = (x: unknown) => object(x) && keys(x, ['en', 'he']) && text(x.en) && text(x.he)
const boundedArray = (x: unknown, max: number): x is unknown[] => Array.isArray(x) && x.length <= max && Object.keys(x).length === x.length && Array.from({ length: x.length }, (_, i) => Object.hasOwn(x, i)).every(Boolean)
export const validCoordinates = (x: unknown): x is [number, number] => boundedArray(x, 2) && x.length === 2 && x.every(n => typeof n === 'number' && Number.isFinite(n)) && Math.abs(x[0] as number) <= 180 && Math.abs(x[1] as number) <= 90
export const validTime = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x
export function validGtin(x: unknown): x is string {
  // First slice supports the existing scanned retail formats only. GTIN-14
  // packaging codes need a later explicit extension, not internal-code padding.
  if (typeof x !== 'string') return false
  const format = x.length === 13 ? 'EAN13' : x.length === 12 ? 'UPCA' : x.length === 8 ? 'EAN8' : ''
  return validateBarcode(x, format).valid
}
export function validPackage(x: unknown): x is PackageBasis {
  return object(x) && keys(x, ['quantity', 'unit', 'count']) && typeof x.quantity === 'number' && Number.isFinite(x.quantity) && x.quantity > 0 && x.quantity <= 100000 && ['g', 'ml', 'count'].includes(x.unit as string) && Number.isSafeInteger(x.count) && (x.count as number) > 0 && (x.count as number) <= 1000 && (x.unit !== 'count' || Number.isSafeInteger(x.quantity))
}
export function validatePriceSnapshot(raw: unknown): PriceSnapshot | null {
  if (!object(raw) || !keys(raw, ['version', 'classification', 'source', 'products', 'stores', 'prices']) || raw.version !== 1 || !['fictional', 'qualified'].includes(raw.classification as string)) return null
  const s = raw.source
  if (!object(s) || !keys(s, ['id', 'label', 'hash', 'publishedAt', 'fetchedAt', 'currency', 'currencyEvidence', 'coverage']) || !id(s.id) || !text(s.label) || typeof s.hash !== 'string' || !/^[a-f0-9]{64}$/.test(s.hash) || !(s.publishedAt === null || validTime(s.publishedAt)) || !validTime(s.fetchedAt) || ![null, 'ILS'].includes(s.currency as null | 'ILS') || !nullableText(s.currencyEvidence) || !['complete', 'partial'].includes(s.coverage as string)) return null
  if (!boundedArray(raw.products, 100) || !boundedArray(raw.stores, 20) || !boundedArray(raw.prices, 2000)) return null
  for (const p of raw.products) if (!object(p) || !keys(p, ['id', 'label', 'brand', 'variant', 'package', 'gtin']) || !id(p.id) || !localized(p.label) || !nullableText(p.brand) || !nullableText(p.variant) || !(p.package === null || validPackage(p.package)) || !(p.gtin === null || validGtin(p.gtin))) return null
  for (const p of raw.stores) if (!object(p) || !keys(p, ['id', 'retailerId', 'label', 'coordinates', 'coordinateEvidence']) || !id(p.id) || !id(p.retailerId) || !localized(p.label) || !(p.coordinates === null || validCoordinates(p.coordinates)) || !nullableText(p.coordinateEvidence)) return null
  const productIds = raw.products.map(p => (p as CatalogProduct).id), storeIds = raw.stores.map(p => (p as PriceSnapshot['stores'][number]).id)
  if (new Set(productIds).size !== productIds.length || new Set(storeIds).size !== storeIds.length) return null
  const pairs = new Set<string>()
  for (const p of raw.prices) {
    if (!object(p) || !keys(p, ['storeId', 'productId', 'unitMinor', 'basis']) || !id(p.storeId) || !id(p.productId) || !storeIds.includes(p.storeId) || !productIds.includes(p.productId) || p.basis !== 'package' || !(p.unitMinor === null || (Number.isSafeInteger(p.unitMinor) && (p.unitMinor as number) > 0 && (p.unitMinor as number) <= 100000000))) return null
    const pair = `${p.storeId}/${p.productId}`
    if (pairs.has(pair)) return null
    pairs.add(pair)
  }
  // Detached copy prevents callers changing evidence after validation.
  return structuredClone(raw) as unknown as PriceSnapshot
}
