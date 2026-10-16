import { describe, it, expect } from 'vitest'
import { searchInCatalog } from './catalog-search'
import { loadTelAvivCatalog, type PriceCatalogFile } from './price-catalog'
const data = { products: { '07290000000015': { n: 'Fictional milk 1 litre', m: 'Fictional dairy', q: '1.00 litre', w: 0, p: [] }, '05060639129102': { n: 'Fictional mango 500 ml', m: 'Fictional brand', q: '500.00 ml', w: 0, p: [] } } } as unknown as PriceCatalogFile
 describe('existing catalog candidate search', () => {
  it('finds explicit barcode forms without inventing an identifier from a name', () => { expect(searchInCatalog(data, '7290000000015').matches[0].gtin14).toBe('07290000000015'); expect(searchInCatalog(data, '7290000000016').matches).toEqual([]) })
  it('requires every normalized query token and leaves selection unconfirmed', () => { expect(searchInCatalog(data, 'MILK dairy').matches).toHaveLength(1); expect(searchInCatalog(data, 'milk mango').matches).toEqual([]); expect(searchInCatalog(data, 'milk').matches[0]).not.toHaveProperty('confirmed') })
  it('rejects empty/control/long queries', () => { for (const q of ['', 'm', 'milk\n', 'x'.repeat(101)]) expect(searchInCatalog(data, q).matches).toEqual([]) })
  it('searches the actual bundled catalog without provider access', async () => { const results = searchInCatalog(await loadTelAvivCatalog(), '5060639129102'); expect(results.matches).toHaveLength(1); expect(results.matches[0]).toMatchObject({ gtin14: '05060639129102', weighted: false }) })
 })
