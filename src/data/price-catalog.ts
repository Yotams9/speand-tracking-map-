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

export type CatalogStoreSummary = Pick<CatalogStore, 'id' | 'chain' | 'chainName' | 'name' | 'address' | 'location'>

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
  return { gtin14, name: entry.n.trim(), manufacturer: entry.m.trim(), quantity: quantityLabel(entry.q), weighted: entry.w === 1, currency: 'ILS', area: catalog.area, storesInArea: catalog.stores.length, generatedAt: catalog.generatedAt, prices }
}

export function catalogStoreSummaries(catalog: PriceCatalogFile): CatalogStoreSummary[] {
  return catalog.stores.map(({ id, chain, chainName, name, address, location }) => ({ id, chain, chainName, name, address, location: location ?? null }))
}

let telAviv: Promise<PriceCatalogFile> | null = null
export function loadTelAvivCatalog(): Promise<PriceCatalogFile> {
  telAviv ??= readFile(path.join(process.cwd(), 'data', 'catalog', 'tel-aviv.json'), 'utf8').then(text => JSON.parse(text) as PriceCatalogFile)
  telAviv.catch(() => { telAviv = null })
  return telAviv
}
