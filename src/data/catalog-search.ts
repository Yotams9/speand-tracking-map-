import { quantityLabel, validGtin14, type PriceCatalogFile } from './price-catalog'

export interface CatalogCandidate { gtin14: string; name: string; manufacturer: string; quantity: string; weighted: boolean }
const PAGE_SIZE = 15
const normalized = (s: string) => s.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// Candidates only. Ranking never establishes product or package identity.
export function searchInCatalog(catalog: PriceCatalogFile, query: string, offset = 0) {
  const text = normalized(query), tokens = text.split(' ').filter(Boolean)
  const empty = { matches: [] as CatalogCandidate[], hasMore: false, nextOffset: 0, total: 0 }
  if (query.trim().length < 2 || query.length > 100 || /[\u0000-\u001f\u007f]/.test(query) || !tokens.length || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) return empty
  const digits = query.trim(), gtin = /^\d{8,14}$/.test(digits) && [8, 12, 13, 14].includes(digits.length) ? digits.padStart(14, '0') : null
  const rank = (name: string) => { const n = normalized(name); return n === text ? 0 : n.startsWith(text + ' ') ? 1 : n.includes(text) ? 2 : 3 }
  const found = Object.entries(catalog.products)
    .filter(([code, p]) => validGtin14(code) && (gtin ? validGtin14(gtin) && code === gtin : tokens.every(token => normalized(p.n + ' ' + p.m + ' ' + p.q).includes(token))))
    .sort(([a, x], [b, y]) => rank(x.n) - rank(y.n) || x.n.length - y.n.length || x.n.localeCompare(y.n, 'he') || a.localeCompare(b))
  const matches = found.slice(offset, offset + PAGE_SIZE).map(([gtin14, p]) => ({ gtin14, name: p.n.trim(), manufacturer: p.m.trim(), quantity: quantityLabel(p.q), weighted: p.w === 1 }))
  const nextOffset = offset + matches.length
  return { matches, hasMore: nextOffset < found.length, nextOffset, total: found.length }
}
