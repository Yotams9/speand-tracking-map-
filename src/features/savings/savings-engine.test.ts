import { describe, expect, it } from 'vitest'
import { validGtin14, type CatalogChain, type PriceCatalogFile } from '../../data/price-catalog'
import { computeSavings, distanceM, toMinor, MAX_SAVINGS_ITEMS } from './savings-engine'
import { parseSavingsRequest } from './savings-request'
import { priceDateNote } from './savings-copy'
import { loadTelAvivCatalog } from '../../data/price-catalog'
import { POST } from '../../app/api/savings/route'

// GTIN-14 with a correct check digit from 13 digits.
const gtin = (body: string) => {
  const sum = [...body].reverse().reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 1 : 3), 0)
  return body + String((10 - sum % 10) % 10)
}
const BROKEN = gtin('0729000000006'), EMPTY = gtin('0729000000007')
const MILK = gtin('0729000000001'), BREAD = gtin('0729000000002'), CHEESE = gtin('0729000000003'), TOMATO = gtin('0729000000004'), SOAP = gtin('0729000000005'), UNKNOWN = gtin('0729000000009')

const origin = { lat: 32.08, lon: 34.78 }
const store = (id: string, chain: CatalogChain, lat: number | null) => ({
  id, chain, chainName: { en: chain, he: chain }, storeId: id.split('-')[1], name: `Branch ${id}`, address: `Street ${id}`, file: `${id}.gz`, publishedLocal: '2026-10-04 03:00',
  location: lat === null ? null : { lat, lon: origin.lon, osm: 'node/1', accuracy: 'address point' as const },
})
// 0.01° of latitude ≈ 1112 m.
const catalog: PriceCatalogFile = {
  version: 1, generatedAt: '2026-10-04T17:21:33Z', area: { en: 'Tel Aviv-Yafo', he: 'תל אביב-יפו' }, currency: 'ILS', priceBasis: 'Published ordinary shelf price', source: 'fixture',
  stores: [
    store('shufersal-1', 'shufersal', 32.08), // 0: origin branch, 0 m
    store('ramilevi-2', 'ramilevi', 32.09), // 1: ≈1112 m north
    store('osherad-3', 'osherad', 32.10), // 2: ≈2224 m
    store('shufersal-4', 'shufersal', null), // 3: no location
    store('ramilevi-5', 'ramilevi', 32.13), // 4: ≈5560 m, outside 5 km
    store('shufersal-6', 'shufersal', 32.07), // 5: ≈1112 m south, ties with 1
  ],
  products: {
    [MILK]: { n: 'Milk 1L', m: 'Dairy', q: '1.00 ליטר', w: 0, p: [[0, 7.9], [1, 6.9], [2, 7.5], [3, 1], [4, 1], [5, 6.9]] },
    [BREAD]: { n: 'Bread', m: 'Bakery', q: '750 גרם', w: 0, p: [[0, 12], [1, 11], [2, 10]] },
    [CHEESE]: { n: 'Cheese', m: 'Dairy', q: '200 גרם', w: 0, p: [[0, 20], [2, 18.5]] },
    [TOMATO]: { n: 'Tomatoes', m: '', q: '1 קג', w: 1, p: [[0, 9.9], [1, 5.9]] },
    [SOAP]: { n: 'Soap', m: '', q: '1 יחידות', w: 0, p: [[0, 1.1], [1, 1.1], [2, 1.1]] },
    // Listed at stores 1 (price 0), 2 (negative), 99 (no such store) and 0 (valid).
    [BROKEN]: { n: 'Broken rows', m: '', q: '', w: 0, p: [[1, 0], [2, -3], [99, 2], [0, 4.5]] },
    // Only bad rows: behaves as if not in the catalog.
    [EMPTY]: { n: 'No valid price', m: '', q: '', w: 0, p: [[1, 0], [99, 2]] },
  },
}

describe('savings engine', () => {
  it('fixtures use valid GTIN-14 barcodes', () => {
    for (const code of [MILK, BREAD, CHEESE, TOMATO, SOAP, UNKNOWN]) expect(validGtin14(code)).toBe(true)
  })

  it('compares identical barcodes only and lists every other line with a reason', () => {
    const result = computeSavings(catalog, [
      { ref: 'a', gtin14: MILK, quantity: 1 },
      { ref: 'b', gtin14: UNKNOWN, quantity: 1 },
      { ref: 'c', gtin14: null, quantity: 1 },
      { ref: 'd', gtin14: MILK.slice(0, -1) + ((Number(MILK.at(-1)) + 1) % 10), quantity: 1 },
      { ref: 'e', gtin14: TOMATO, quantity: 1 },
      { ref: 'f', gtin14: BREAD, quantity: 1.5 },
      { ref: 'g', gtin14: BREAD, quantity: 2, unit: 'kg' },
    ], origin)
    expect(result.products.map(p => p.ref)).toEqual(['a'])
    expect(result.notCompared).toEqual([
      { index: 1, ref: 'b', gtin14: UNKNOWN, reason: 'not-in-catalog' },
      { index: 2, ref: 'c', gtin14: null, reason: 'no-barcode' },
      { index: 3, ref: 'd', gtin14: expect.any(String), reason: 'invalid-barcode' },
      { index: 4, ref: 'e', gtin14: TOMATO, reason: 'weighted' },
      { index: 5, ref: 'f', gtin14: BREAD, reason: 'unsupported-quantity' },
      { index: 6, ref: 'g', gtin14: BREAD, reason: 'unsupported-quantity' },
    ])
  })

  it('never splits a basket: a store missing one item is partial and never the saving', () => {
    const result = computeSavings(catalog, [{ gtin14: MILK, quantity: 1 }, { gtin14: CHEESE, quantity: 1 }], { ...origin, storeId: 'shufersal-1' })
    // ramilevi-2 has the cheapest milk but no cheese.
    expect(result.complete.map(s => [s.store.id, s.totalMinor])).toEqual([['osherad-3', 750 + 1850], ['shufersal-1', 790 + 2000]])
    expect(result.partial.map(s => [s.store.id, s.pricedItems, s.totalItems])).toEqual([['ramilevi-2', 1, 2], ['shufersal-6', 1, 2]])
    expect(result.baseline).toEqual({ basis: 'origin-shelf', storeId: 'shufersal-1', totalMinor: 2790 })
    expect(result.best?.store.id).toBe('osherad-3')
    expect(result).toMatchObject({ outcome: 'saving', savingMinor: 2790 - 2600 })
  })

  it('excludes stores without a location and stores outside the radius', () => {
    const result = computeSavings(catalog, [{ gtin14: MILK, quantity: 1, paidMinor: 790 }], origin)
    const ids = result.products[0].offers.map(o => o.store.id)
    expect(ids).not.toContain('shufersal-4')
    expect(ids).not.toContain('ramilevi-5')
    expect(result.complete.every(s => s.store.id !== 'shufersal-4' && s.store.id !== 'ramilevi-5')).toBe(true)
  })

  it('includes a store exactly on the radius boundary and drops it just inside', () => {
    const edge = distanceM(origin, { lat: 32.10, lon: origin.lon })
    const ids = (radius: number) => computeSavings(catalog, [{ gtin14: BREAD, quantity: 1 }], origin, radius).complete.map(s => s.store.id)
    expect(ids(edge)).toContain('osherad-3')
    expect(ids(edge - 0.001)).not.toContain('osherad-3')
  })

  it('keeps money in integer agorot without float drift', () => {
    expect(toMinor(7.9)).toBe(790)
    expect(toMinor(1.1)).toBe(110)
    expect(toMinor(0)).toBeNull()
    expect(toMinor(Number.NaN)).toBeNull()
    const milk = computeSavings(catalog, [{ gtin14: MILK, quantity: 3, paidMinor: 3 * 790 }], { ...origin, storeId: 'shufersal-1' })
    expect(milk.baseline).toEqual({ basis: 'origin-shelf', storeId: 'shufersal-1', totalMinor: 2370 })
    expect(milk.products[0].offers.find(o => o.store.id === 'shufersal-1')?.lineMinor).toBe(2370)
    const soap = computeSavings(catalog, [{ gtin14: SOAP, quantity: 3 }], origin)
    expect(soap.complete.map(s => s.totalMinor)).toEqual([330, 330, 330])
    for (const value of [...milk.complete, ...soap.complete].map(s => s.totalMinor)) expect(Number.isInteger(value)).toBe(true)
  })

  it('breaks ties by price, then distance, then store ID', () => {
    const result = computeSavings(catalog, [{ gtin14: MILK, quantity: 1, paidMinor: 900 }], origin)
    // ramilevi-2 and shufersal-6 share price and distance; the ID decides.
    expect(result.products[0].offers.map(o => o.store.id)).toEqual(['ramilevi-2', 'shufersal-6', 'osherad-3', 'shufersal-1'])
    expect(result.complete.map(s => s.store.id)).toEqual(['ramilevi-2', 'shufersal-6', 'osherad-3', 'shufersal-1'])
    const soap = computeSavings(catalog, [{ gtin14: SOAP, quantity: 1 }], origin)
    expect(soap.complete.map(s => [s.store.id, s.store.distanceM])).toEqual([['shufersal-1', 0], ['ramilevi-2', 1112], ['osherad-3', 2224]])
    expect(computeSavings(catalog, [{ gtin14: MILK, quantity: 1, paidMinor: 900 }], origin)).toEqual(result)
  })

  it('reports no saving when the user already paid the lowest nearby price', () => {
    const cheaper = computeSavings(catalog, [{ gtin14: MILK, quantity: 1, paidMinor: 650 }], origin)
    expect(cheaper).toMatchObject({ outcome: 'already-cheapest', savingMinor: null, baseline: { basis: 'paid', totalMinor: 650 } })
    const equal = computeSavings(catalog, [{ gtin14: MILK, quantity: 1, paidMinor: 690 }], origin)
    expect(equal).toMatchObject({ outcome: 'already-cheapest', savingMinor: null })
    const atCheapest = computeSavings(catalog, [{ gtin14: BREAD, quantity: 1 }], { lat: 32.10, lon: origin.lon, storeId: 'osherad-3' })
    expect(atCheapest).toMatchObject({ outcome: 'already-cheapest', savingMinor: null, best: { store: { id: 'osherad-3', isOrigin: true } } })
  })

  it('uses shelf vs shelf at a catalog origin, otherwise what the user paid', () => {
    const shelf = computeSavings(catalog, [{ gtin14: MILK, quantity: 2, paidMinor: 2000 }], { ...origin, storeId: 'shufersal-1' })
    expect(shelf.baseline).toEqual({ basis: 'origin-shelf', storeId: 'shufersal-1', totalMinor: 1580 })
    expect(shelf).toMatchObject({ outcome: 'saving', savingMinor: 1580 - 1380 })
    expect(shelf.products[0]).toMatchObject({ reference: { basis: 'origin-shelf', lineMinor: 1580 }, differenceMinor: 200 })
    const paid = computeSavings(catalog, [{ gtin14: MILK, quantity: 2, paidMinor: 2000 }], origin)
    expect(paid.baseline).toEqual({ basis: 'paid', totalMinor: 2000 })
    expect(paid).toMatchObject({ outcome: 'saving', savingMinor: 2000 - 1380 })
    // Origin branch without the barcode: fall back to the paid amount.
    const fallback = computeSavings(catalog, [{ gtin14: CHEESE, quantity: 1, paidMinor: 2100 }], { lat: 32.09, lon: origin.lon, storeId: 'ramilevi-2' })
    expect(fallback.baseline).toEqual({ basis: 'paid', totalMinor: 2100 })
    expect(computeSavings(catalog, [{ gtin14: MILK, quantity: 1 }], origin)).toMatchObject({ outcome: 'no-baseline', savingMinor: null })
  })

  it('handles empty and out-of-range input', () => {
    expect(computeSavings(catalog, [{ gtin14: null, quantity: 1 }], origin)).toMatchObject({ outcome: 'nothing-comparable', complete: [], partial: [] })
    expect(computeSavings(catalog, [{ gtin14: MILK, quantity: 1, paidMinor: 1 }], { lat: 31, lon: 35 })).toMatchObject({ outcome: 'no-complete-store', best: null })
    expect(() => computeSavings(catalog, Array.from({ length: MAX_SAVINGS_ITEMS + 1 }, () => ({ gtin14: MILK, quantity: 1 })), origin)).toThrow(RangeError)
    expect(() => computeSavings(catalog, [], { lat: 91, lon: 0 })).toThrow(RangeError)
  })
})

describe('savings engine robustness', () => {
  it('accepts exactly 100 items and rejects 101, in the engine and the request', () => {
    const items = (n: number) => Array.from({ length: n }, () => ({ gtin14: SOAP, quantity: 1 }))
    expect(computeSavings(catalog, items(100), origin).complete[0].totalMinor).toBe(100 * 110)
    expect(() => computeSavings(catalog, items(101), origin)).toThrow(RangeError)
    expect(parseSavingsRequest({ items: items(100), origin }).ok).toBe(true)
    expect(parseSavingsRequest({ items: items(101), origin })).toEqual({ ok: false, error: 'items' })
  })
  it('rejects zero and negative quantities, and lists fractional ones as not compared', () => {
    for (const quantity of [0, -1, -0.5]) expect(parseSavingsRequest({ items: [{ gtin14: MILK, quantity }], origin })).toEqual({ ok: false, error: 'quantity' })
    const fractional = parseSavingsRequest({ items: [{ gtin14: MILK, quantity: 1.5 }], origin })
    expect(fractional.ok).toBe(true)
    if (fractional.ok) expect(computeSavings(catalog, fractional.request.items, origin).notCompared).toEqual([{ index: 0, gtin14: MILK, reason: 'unsupported-quantity' }])
    expect(computeSavings(catalog, [{ gtin14: MILK, quantity: 0 }], origin).notCompared[0].reason).toBe('unsupported-quantity')
  })
  it('keeps duplicate barcodes as separate lines whose totals equal the merged quantity', () => {
    const split = computeSavings(catalog, [{ ref: 'a', gtin14: MILK, quantity: 1, paidMinor: 790 }, { ref: 'b', gtin14: MILK, quantity: 2, paidMinor: 1580 }], origin)
    const merged = computeSavings(catalog, [{ gtin14: MILK, quantity: 3, paidMinor: 2370 }], origin)
    expect(split.products.map(p => p.ref)).toEqual(['a', 'b'])
    expect(split.complete.map(s => [s.store.id, s.totalMinor])).toEqual(merged.complete.map(s => [s.store.id, s.totalMinor]))
    expect(split.savingMinor).toBe(merged.savingMinor)
  })
  it('includes an origin exactly on the radius boundary of a store', () => {
    // Move the origin so osherad-3 is exactly radiusM away.
    const radius = distanceM({ lat: 32.08, lon: origin.lon }, { lat: 32.10, lon: origin.lon })
    expect(computeSavings(catalog, [{ gtin14: BREAD, quantity: 1 }], { lat: 32.08, lon: origin.lon }, radius).complete.map(s => s.store.id)).toContain('osherad-3')
  })
  it('ignores catalog rows with price 0, a negative price or a missing store', () => {
    const result = computeSavings(catalog, [{ gtin14: BROKEN, quantity: 1 }], origin)
    expect(result.products[0].offers.map(o => [o.store.id, o.unitMinor])).toEqual([['shufersal-1', 450]])
    expect(result.complete.map(s => s.store.id)).toEqual(['shufersal-1'])
    expect(computeSavings(catalog, [{ gtin14: EMPTY, quantity: 1 }], origin).notCompared).toEqual([{ index: 0, gtin14: EMPTY, reason: 'not-in-catalog' }])
  })
  it('never returns the stores without a location, in the real catalog', async () => {
    const real = await loadTelAvivCatalog()
    const unlocated = real.stores.flatMap((store, index) => store.location ? [] : [index])
    expect(unlocated).toHaveLength(6)
    const unlocatedIds = new Set(unlocated.map(index => real.stores[index].id))
    // Products the unlocated stores publish, often cheapest there.
    const codes = Object.entries(real.products).filter(([, p]) => p.w === 0 && p.p.some(([index]) => unlocated.includes(index))).slice(0, 60).map(([code]) => code)
    expect(codes.length).toBeGreaterThan(10)
    for (const code of codes) {
      const result = computeSavings(real, [{ gtin14: code, quantity: 1, paidMinor: 100 }], { lat: 32.08, lon: 34.78 }, 20_000)
      const ids = [...result.products.flatMap(p => p.offers.map(o => o.store.id)), ...result.complete.map(s => s.store.id), ...result.partial.map(s => s.store.id)]
      expect(ids.filter(id => unlocatedIds.has(id))).toEqual([])
    }
  })
})

describe('price-date note', () => {
  it('comes from the publication times of the stores used, never a literal', () => {
    const result = computeSavings(catalog, [{ gtin14: MILK, quantity: 1 }], origin)
    expect(result.published).toEqual({ earliest: '2026-10-04 03:00', latest: '2026-10-04 03:00' })
    expect(priceDateNote(result, 'he')).toBe('מחירי מדף שפורסמו ב-4.10.2026, ללא מבצעים')
    expect(priceDateNote(result, 'en')).toBe('Shelf prices published on 4.10.2026, without promotions')
    const later = { ...catalog, stores: catalog.stores.map((s, i) => i === 2 ? { ...s, publishedLocal: '2026-11-02 06:00' } : s) }
    const mixed = computeSavings(later, [{ gtin14: MILK, quantity: 1 }], origin)
    expect(mixed.published).toEqual({ earliest: '2026-10-04 03:00', latest: '2026-11-02 06:00' })
    expect(priceDateNote(mixed, 'he')).toBe('מחירי מדף שפורסמו בין 4.10.2026 ל-2.11.2026, ללא מבצעים')
    expect(priceDateNote(mixed, 'en')).toBe('Shelf prices published between 4.10.2026 and 2.11.2026, without promotions')
    // Nothing nearby: fall back to the catalog build date.
    const none = computeSavings(catalog, [{ gtin14: MILK, quantity: 1 }], { lat: 31, lon: 35 })
    expect(none.published).toBeNull()
    expect(priceDateNote(none, 'en')).toBe('Shelf prices published on 4.10.2026, without promotions')
  })
})

describe('savings request validation and route', () => {
  const good = { items: [{ gtin14: MILK, quantity: 1, paidMinor: 790 }], origin }
  it('accepts a well-formed request and applies the default radius', () => {
    expect(parseSavingsRequest(good)).toMatchObject({ ok: true, request: { radiusM: 5000 } })
    expect(parseSavingsRequest({ ...good, items: [{ gtin14: null, quantity: 1 }] }).ok).toBe(true)
  })
  it.each([
    ['bad check digit', { ...good, items: [{ gtin14: MILK.slice(0, -1) + ((Number(MILK.at(-1)) + 1) % 10), quantity: 1 }] }],
    ['13 digits', { ...good, items: [{ gtin14: MILK.slice(1), quantity: 1 }] }],
    ['zero quantity', { ...good, items: [{ gtin14: MILK, quantity: 0 }] }],
    ['negative quantity', { ...good, items: [{ gtin14: MILK, quantity: -1 }] }],
    ['string quantity', { ...good, items: [{ gtin14: MILK, quantity: '1' }] }],
    ['fractional paid', { ...good, items: [{ gtin14: MILK, quantity: 1, paidMinor: 7.9 }] }],
    ['unknown item field', { ...good, items: [{ gtin14: MILK, quantity: 1, name: 'x' }] }],
    ['no items', { ...good, items: [] }],
    ['too many items', { ...good, items: Array.from({ length: 101 }, () => ({ gtin14: MILK, quantity: 1 })) }],
    ['latitude out of range', { ...good, origin: { lat: 91, lon: 34 } }],
    ['missing origin', { items: good.items }],
    ['bad store ID', { ...good, origin: { ...origin, storeId: '../etc' } }],
    ['radius too large', { ...good, radiusM: 50_000 }],
    ['unknown top-level field', { ...good, debug: true }],
  ])('rejects %s', (_, body) => {
    expect(parseSavingsRequest(body).ok).toBe(false)
  })
  it('the route answers 400 on bad input and computes from the real catalog', async () => {
    const post = (body: string) => POST(new Request('http://127.0.0.1/api/savings', { method: 'POST', body }))
    expect((await post('not json')).status).toBe(400)
    expect((await post(JSON.stringify({ ...good, origin: { lat: 'x', lon: 1 } }))).status).toBe(400)
    expect((await post('x'.repeat(40_000))).status).toBe(400)
    // A real published barcode (Goldstar 6×330 ml) bought at Shufersal Ben Yehuda.
    const response = await post(JSON.stringify({ items: [{ gtin14: '07290008464741', quantity: 1 }], origin: { lat: 32.081361, lon: 34.770485, storeId: 'shufersal-1' } }))
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result).toMatchObject({ radiusM: 5000, notCompared: [], baseline: { basis: 'origin-shelf', storeId: 'shufersal-1' }, originStore: { id: 'shufersal-1', distanceM: 0 } })
    expect(result.complete.length).toBeGreaterThan(10)
    expect(result.complete.every((s: { store: { distanceM: number } }) => s.store.distanceM <= 5000)).toBe(true)
    expect(Number.isInteger(result.best.totalMinor)).toBe(true)
    if (result.outcome === 'saving') expect(result.savingMinor).toBe(result.baseline.totalMinor - result.best.totalMinor)
  })
})
