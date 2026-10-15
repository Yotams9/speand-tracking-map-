import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { LocalizedText } from './spendscape-globe'

// Published shelf prices from the chains' legally mandated price files, built
// offline by tools/nearby-prices/build_catalog.py. Server-side only.
export type CatalogChain = 'shufersal' | 'ramilevi' | 'osherad'

export interface CatalogStore {
  id: string
  chain: CatalogChain
  chainName: LocalizedText
  storeId: string
  name: string
  address: string
  file: string
  publishedLocal: string
  /** OpenStreetMap address point; null when no house-level match exists. */
  location: { lat: number; lon: number; osm: string; accuracy: 'address point' } | null
}

export type CatalogStoreSummary = Pick<CatalogStore, 'id' | 'chain' | 'chainName' | 'name' | 'address' | 'location' | 'publishedLocal'>

export interface PriceCatalogFile {
  version: 1
  generatedAt: string
  area: LocalizedText
  currency: 'ILS'
  priceBasis: string
  source: string
  locationSource?: string
  stores: CatalogStore[]
  products: Record<string, { n: string; m: string; q: string; w: 0 | 1; p: [storeIndex: number, price: number][] }>
}

export interface CatalogPrice {
  store: Pick<CatalogStore, 'id' | 'chain' | 'chainName' | 'name' | 'address' | 'publishedLocal'>
  price: number
}

export interface CatalogProduct {
  gtin14: string
  name: string
  manufacturer: string
  quantity: string
  weighted: boolean
  currency: 'ILS'
  area: LocalizedText
  storesInArea: number
  generatedAt: string
  /** Cheapest first; one entry per store that publishes this barcode. */
  prices: CatalogPrice[]
  priceStatus: 'expired' | 'publication-time-unqualified'
  source: string
  locationSource: string | null
}

export function validGtin14(value: string): boolean {
  if (!/^\d{14}$/.test(value)) return false
  const sum = [...value.slice(0, -1)].reverse().reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 1 : 3), 0)
  return (10 - sum % 10) % 10 === Number(value.at(-1))
}

// "1.00 ליטר" -> "1 ליטר", "0.50 קג" -> "0.5 קג".
export function quantityLabel(raw: string): string {
  return raw.replace(/(\d+)\.(\d*?)0+(?!\d)/g, (_, whole: string, fraction: string) => fraction ? `${whole}.${fraction}` : whole).replace(/\s+/g, ' ').trim()
}

export function lookupInCatalog(catalog: PriceCatalogFile, gtin14: string): CatalogProduct | null {
  const entry = validGtin14(gtin14) ? catalog.products[gtin14] : undefined
  if (!entry) return null
  const prices = entry.p
    .filter(([index, price]) => catalog.stores[index] && Number.isFinite(price) && price > 0)
    .map(([index, price]) => {
      const { id, chain, chainName, name, address, publishedLocal } = catalog.stores[index]
      return { store: { id, chain, chainName, name, address, publishedLocal }, price }
    })
    .sort((a, b) => a.price - b.price || a.store.id.localeCompare(b.store.id))
  if (!prices.length) return null
  return { gtin14, name: entry.n.trim(), manufacturer: entry.m.trim(), quantity: quantityLabel(entry.q), weighted: entry.w === 1, currency: 'ILS', area: catalog.area, storesInArea: catalog.stores.length, generatedAt: catalog.generatedAt, prices, source: catalog.source, locationSource: catalog.locationSource ?? null, priceStatus: catalogPriceStatus(catalog) }
}

export function catalogStoreSummaries(catalog: PriceCatalogFile): CatalogStoreSummary[] {
  return catalog.stores.map(({ id, chain, chainName, name, address, location, publishedLocal }) => ({ id, chain, chainName, name, address, publishedLocal, location: location ?? null }))
}

let telAviv: Promise<PriceCatalogFile> | null = null
export function loadTelAvivCatalog(): Promise<PriceCatalogFile> {
  telAviv ??= readFile(path.join(process.cwd(), 'data', 'catalog', 'tel-aviv.json'), 'utf8').then(text => validateCatalog(JSON.parse(text)))
  telAviv.catch(() => { telAviv = null })
  return telAviv
}

// The retained file supplies local publication strings without a timezone.
// Never promote them to verified current prices. A conservative +14h bound
// permits an unambiguous expired classification without inventing a timezone.
export function catalogPriceStatus(catalog: PriceCatalogFile, now = Date.now()): 'expired' | 'publication-time-unqualified' {
  const latestPossible = Math.max(...catalog.stores.map(s => Date.parse(s.publishedLocal.replace(' ', 'T') + ':00Z') + 14 * 3600_000))
  return Number.isFinite(latestPossible) && now - latestPossible > 24 * 3600_000 ? 'expired' : 'publication-time-unqualified'
}
export function validateCatalog(raw: unknown): PriceCatalogFile {
  const c = raw as PriceCatalogFile
  const text = (v: unknown, max = 1000): v is string => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f]/.test(v)
  const localized = (v: LocalizedText) => v && text(v.en) && text(v.he)
  if (!c || c.version !== 1 || c.currency !== 'ILS' || !text(c.generatedAt) || !Number.isFinite(Date.parse(c.generatedAt)) || !localized(c.area) || !text(c.source) || !text(c.priceBasis) || !Array.isArray(c.stores) || c.stores.length > 500 || !c.products || typeof c.products !== 'object' || Array.isArray(c.products) || Object.keys(c.products).length > 100000) throw new Error('catalog-invalid')
  const ids = new Set<string>()
  for (const s of c.stores) {
    if (!['shufersal','ramilevi','osherad'].includes(s.chain) || !/^\d{1,5}$/.test(s.storeId) || s.id !== `${s.chain}-${s.storeId}` || ids.has(s.id) || !localized(s.chainName) || !text(s.name) || !text(s.address) || !text(s.file) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s.publishedLocal) || !Number.isFinite(Date.parse(s.publishedLocal.replace(' ','T') + ':00Z'))) throw new Error('catalog-invalid')
    ids.add(s.id)
    if (s.location !== null && (!s.location || s.location.accuracy !== 'address point' || !/^(node|way|relation)\/\d+$/.test(s.location.osm) || !Number.isFinite(s.location.lon) || Math.abs(s.location.lon) > 180 || !Number.isFinite(s.location.lat) || Math.abs(s.location.lat) > 90)) throw new Error('catalog-invalid')
  }
  for (const [gtin,p] of Object.entries(c.products)) {
    if (!validGtin14(gtin) || !p || !text(p.n) || !p.n.trim() || !text(p.m) || !text(p.q) || ![0,1].includes(p.w) || !Array.isArray(p.p) || !p.p.length || p.p.length > c.stores.length) throw new Error('catalog-invalid')
    const seen = new Set<number>()
    for (const pair of p.p) {
      if (!Array.isArray(pair) || pair.length !== 2 || !Number.isInteger(pair[0]) || !c.stores[pair[0]] || seen.has(pair[0]) || !Number.isFinite(pair[1]) || pair[1] <= 0 || pair[1] > 9999999 || Math.abs(pair[1]*100 - Math.round(pair[1]*100)) > 1e-6) throw new Error('catalog-invalid')
      seen.add(pair[0])
    }
  }
  return c
}
