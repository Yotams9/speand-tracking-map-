import { quantityLabel, validGtin14, type PriceCatalogFile } from './price-catalog'
export interface CatalogCandidate { gtin14: string; name: string; manufacturer: string; quantity: string; weighted: boolean }
const normalized = (s: string) => s.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
export function searchInCatalog(catalog: PriceCatalogFile, query: string) {
  const text = normalized(query), tokens = text.split(' ').filter(Boolean)
  if (query.trim().length < 2 || query.length > 100 || /[\u0000-\u001f\u007f]/.test(query) || !tokens.length) return { matches: [] as CatalogCandidate[], hasMore: false }
  const digits = query.trim(), gtin = /^\d{8,14}$/.test(digits) && [8, 12, 13, 14].includes(digits.length) ? digits.padStart(14, '0') : null
  const matches = Object.entries(catalog.products).filter(([code, p]) => validGtin14(code) && (gtin ? validGtin14(gtin) && code === gtin : tokens.every(token => normalized(p.n + ' ' + p.m + ' ' + p.q).includes(token))))
    .sort(([a, x], [b, y]) => Number(normalized(y.n) === text) - Number(normalized(x.n) === text) || x.n.localeCompare(y.n, 'he') || a.localeCompare(b))
  return { matches: matches.slice(0, 15).map(([gtin14, p]) => ({ gtin14, name: p.n.trim(), manufacturer: p.m.trim(), quantity: quantityLabel(p.q), weighted: p.w === 1 })), hasMore: matches.length > 15 }
}
