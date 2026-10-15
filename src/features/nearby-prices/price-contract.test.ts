import { describe, it, expect } from 'vitest'
import { fictionalSnapshot } from '../../../qa/nearby-preview-fixtures'
import { validatePriceSnapshot, validGtin } from './price-contract'

describe('strict read-only snapshot', () => {
  it('validates a detached snapshot without inventing missing facts', () => {
    const raw = fictionalSnapshot(); raw.products[0].package = null; raw.source.currency = null; raw.stores[0].coordinates = null; raw.prices[0].unitMinor = null
    const result = validatePriceSnapshot(raw)!; expect(result).toEqual(raw); raw.source.label = 'Changed'; expect(result.source.label).not.toBe(raw.source.label)
  })
  for (const [name, mutate] of [
    ['unknown version', (s: any) => { s.version = 2 }], ['unknown top-level field', (s: any) => { s.token = 'synthetic-secret' }],
    ['unknown source field', (s: any) => { s.source.receipt = 'private' }], ['unknown product field', (s: any) => { s.products[0].price = 4 }],
    ['bad currency', (s: any) => { s.source.currency = 'NIS' }], ['bad date', (s: any) => { s.source.publishedAt = '2026-02-30T12:00:00.000Z' }],
    ['bad hash', (s: any) => { s.source.hash = 'hash' }], ['internal code as GTIN', (s: any) => { s.products[0].gtin = '12345' }],
    ['bad package', (s: any) => { s.products[0].package.quantity = -1 }], ['fractional count', (s: any) => { s.products[0].package.count = 1.5 }],
    ['NaN geometry', (s: any) => { s.stores[0].coordinates[0] = NaN }], ['latitude range', (s: any) => { s.stores[0].coordinates[1] = 91 }],
    ['duplicate product', (s: any) => { s.products.push(s.products[0]) }], ['duplicate store', (s: any) => { s.stores.push(s.stores[0]) }],
    ['duplicate price', (s: any) => { s.prices.push(s.prices[0]) }], ['orphan price', (s: any) => { s.prices[0].storeId = 'absent' }],
    ['negative price', (s: any) => { s.prices[0].unitMinor = -1 }], ['fractional price', (s: any) => { s.prices[0].unitMinor = .5 }],
    ['unsafe price', (s: any) => { s.prices[0].unitMinor = Number.MAX_SAFE_INTEGER }], ['conditional promotion', (s: any) => { s.prices[0].basis = 'promotion' }],
    ['sparse products', (s: any) => { delete s.products[1] }], ['extra array key', (s: any) => { s.products.other = 'secret' }],
    ['oversize catalog', (s: any) => { s.products = Array(101).fill(s.products[0]) }], ['control text', (s: any) => { s.source.label = 'bad\ntext' }],
  ] as const) it(`rejects ${name}`, () => { const s = fictionalSnapshot(); mutate(s); expect(validatePriceSnapshot(s)).toBeNull() })
  it('does not accept coercion or missing mandatory keys', () => { expect(validatePriceSnapshot(null)).toBeNull(); const s = fictionalSnapshot(); delete (s as any).classification; expect(validatePriceSnapshot(s)).toBeNull() })
  it('uses existing-standard GTIN checksum semantics, never padding internal codes into GTINs', () => { expect(validGtin('4006381333931')).toBe(true); expect(validGtin('4006381333932')).toBe(false); expect(validGtin('000123')).toBe(false) })
})
