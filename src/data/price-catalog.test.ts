import { describe, expect, it } from 'vitest'
import { catalogStoreSummaries, loadTelAvivCatalog, lookupInCatalog, quantityLabel, validGtin14, type PriceCatalogFile } from './price-catalog'

const store = (id: string, chain: 'shufersal' | 'ramilevi', name: string) => ({ id, chain, chainName: { en: chain, he: chain }, storeId: id, name, address: 'Synthetic 1', file: `${id}.gz`, publishedLocal: '2026-10-04 03:00', location: null })
const catalog: PriceCatalogFile = {
  version: 1, generatedAt: '2026-10-04T17:00:00Z', area: { en: 'Tel Aviv-Yafo', he: 'תל אביב-יפו' }, currency: 'ILS', priceBasis: 'shelf', source: 'synthetic',
  stores: [store('a', 'shufersal', 'Alpha'), store('b', 'ramilevi', 'Beta'), store('c', 'ramilevi', 'Gamma')],
  products: {
    '07290000000015': { n: ' Synthetic milk ', m: 'Dairy', q: '1.00 ליטר', w: 0, p: [[0, 7.35], [1, 6.9], [2, 6.9]] },
    '00000000000017': { n: 'Broken', m: '', q: '', w: 0, p: [[9, 1], [0, -2]] },
  },
}

describe('Tel Aviv price catalog lookup', () => {
  it('validates GTIN-14 digits and checksum only', () => {
    expect(validGtin14('07290000000015')).toBe(true)
    for (const value of ['7290000000015', '07290000000016', '0729000000001a', '']) expect(validGtin14(value)).toBe(false)
  })
  it('returns every store price cheapest first with stable ties', () => {
    const product = lookupInCatalog(catalog, '07290000000015')!
    expect(product).toMatchObject({ name: 'Synthetic milk', quantity: '1 ליטר', weighted: false, currency: 'ILS', storesInArea: 3 })
    expect(product.prices.map(entry => [entry.store.id, entry.price])).toEqual([['b', 6.9], ['c', 6.9], ['a', 7.35]])
    expect(product.prices[0].store).not.toHaveProperty('file')
  })
  it('ignores unknown stores and non-positive prices, and misses cleanly', () => {
    expect(lookupInCatalog(catalog, '00000000000017')).toBeNull()
    expect(lookupInCatalog(catalog, '07290000000022')).toBeNull()
    expect(lookupInCatalog(catalog, 'not-a-gtin')).toBeNull()
  })
  it('formats package quantities without trailing zeros', () => {
    expect(quantityLabel('1.00 ליטר')).toBe('1 ליטר')
    expect(quantityLabel('0.50 קג')).toBe('0.5 קג')
    expect(quantityLabel('200.00  גרם')).toBe('200 גרם')
    expect(quantityLabel('')).toBe('')
  })
  it('the checked-in Tel Aviv snapshot is well formed', async () => {
    const real = await loadTelAvivCatalog()
    expect(real).toMatchObject({ version: 1, currency: 'ILS' })
    expect(new Set(real.stores.map(entry => entry.chain))).toEqual(new Set(['shufersal', 'ramilevi', 'osherad']))
    const codes = Object.keys(real.products)
    expect(codes.length).toBeGreaterThan(1000)
    expect(codes.every(validGtin14)).toBe(true)
    expect(Object.values(real.products).every(entry => entry.p.length > 0 && entry.p.every(([index, price]) => real.stores[index] && price > 0))).toBe(true)
    // Located stores sit inside Tel Aviv; unmatched addresses stay unlocated.
    const located = catalogStoreSummaries(real).filter(entry => entry.location)
    expect(located.length).toBeGreaterThan(20)
    expect(located.every(({ location }) => location!.lat > 32.02 && location!.lat < 32.16 && location!.lon > 34.73 && location!.lon < 34.86)).toBe(true)
    expect(real.locationSource).toContain('OpenStreetMap')
  })
})
