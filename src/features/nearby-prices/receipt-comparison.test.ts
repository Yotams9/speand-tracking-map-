import { describe, it, expect } from 'vitest'
import { fictionalOrigin, fictionalPurchase, fictionalSnapshot, fictionalTime } from '../../../qa/nearby-preview-fixtures'
import { receiptComparison, comparisonOrigin, distanceM, nearbyQaAllowed, MAX_PRICE_AGE_MS, type Matches } from './receipt-comparison'

const now = Date.parse(fictionalTime)
const confirmed = (): Matches => Object.fromEntries(fictionalPurchase().items.map((i, n) => [i.id, { productId: `fictional-product-${n}`, confirmed: true }]))
const run = (s: unknown = fictionalSnapshot(), m: Matches = confirmed(), p = fictionalPurchase(), t = now) => receiptComparison(p, [fictionalOrigin], s, m, t)
describe('receipt nearby preview', () => {
  it('requires exactly one explicit QA flag on a literal loopback host', () => {
    for (const host of ['127.0.0.1', 'localhost', '[::1]']) expect(nearbyQaAllowed(host, '?nearbyPricesQa=1')).toBe(true)
    for (const host of ['spendscape.example', 'localhost.example', '192.168.1.2']) expect(nearbyQaAllowed(host, '?nearbyPricesQa=1')).toBe(false)
    for (const search of ['', '?nearbyPricesQa=0', '?nearbyPricesQa=1&nearbyPricesQa=1']) expect(nearbyQaAllowed('localhost', search)).toBe(false)
  })
  it('keeps origin ownership, physical confirmation and coordinate validation explicit', () => {
    for (const p of [{ ...fictionalPurchase(), channel: 'online' as const }, { ...fictionalPurchase(), resolution: 'unresolved' as const }, { ...fictionalPurchase(), merchantId: 'other' }]) expect(comparisonOrigin(p, [fictionalOrigin])).toBeNull()
    expect(comparisonOrigin(fictionalPurchase(), [{ ...fictionalOrigin, coordinates: [Infinity, 45] }])).toBeNull()
    expect(run(null).state).toBe('prices-unavailable')
  })
  it('requires explicit per-row selection and identity/package confirmation', () => {
    expect(run(undefined, {}).stores[0].rows.every(r => r.state === 'unmatched')).toBe(true)
    expect(run(undefined, { 'fictional-item-0': { productId: 'fictional-product-0', confirmed: false } }).stores[0].rows[0].state).toBe('confirm-match')
    expect(run(undefined, { 'fictional-item-0': { productId: 'absent', confirmed: true } }).stores[0].rows[0].state).toBe('unmatched')
  })
  it('calculates only current equivalent basket prices, never historical savings; partial prices stay partial', () => {
    const p = fictionalPurchase(), before = structuredClone(p), r = run(undefined, confirmed(), p)
    expect(r.stores[0]).toMatchObject({ complete: true, matchedCount: 5, subtotalMinor: 2300 })
    expect(r.stores[1]).toMatchObject({ complete: false, matchedCount: 2, subtotalMinor: 400 })
    expect(p).toEqual(before); expect(p.items.reduce((s, i) => s + Math.round(i.lineTotal * 100), 0)).toBe(3145); expect(p.originalAmount).toBe(31.5)
    expect(JSON.stringify(r)).not.toMatch(/saving|paidMinor|discountMinor/)
  })
  it('does not compare unknown brands, variants, packages, currencies or weight bases', () => {
    const s = fictionalSnapshot(); s.products[0].brand = null; s.products[1].variant = null; s.products[2].package = null
    expect(run(s).stores[0].rows.slice(0, 3).map(r => r.state)).toEqual(['identity-unknown', 'identity-unknown', 'package-unknown'])
    s.source.currencyEvidence = null; expect(run(s).stores[0].rows[3].state).toBe('currency-unknown')
    const p = fictionalPurchase(); p.items[0].unit = 'kg'; expect(run(undefined, confirmed(), p).stores[0].rows[0].state).toBe('unsupported-unit')
    p.items[0].unit = 'item'; p.items[0].quantity = 1.5; expect(run(undefined, confirmed(), p).stores[0].rows[0].state).toBe('unsupported-unit')
  })
  it('bounds freshness by publication, not a replay/fetch; rejects future timestamps', () => {
    expect(run(undefined, confirmed(), undefined, now + MAX_PRICE_AGE_MS).stores[0].complete).toBe(true)
    expect(run(undefined, confirmed(), undefined, now + MAX_PRICE_AGE_MS + 1).stores[0].rows[0].state).toBe('stale')
    const s = fictionalSnapshot(); s.source.publishedAt = null; expect(run(s).stores[0].rows[0].state).toBe('stale')
    const f = fictionalSnapshot(); f.source.fetchedAt = new Date(now + 1).toISOString(); expect(run(f).stores[0].rows[0].state).toBe('stale')
    expect(run(undefined, confirmed(), undefined, now - 1).stores[0].rows[0].state).toBe('stale')
  })
  it('requires coverage for whole basket claims and permits no price without substitution', () => {
    const s = fictionalSnapshot(); s.source.coverage = 'partial'; expect(run(s).stores[0].complete).toBe(false)
    s.prices[0].unitMinor = null; expect(run(s).stores[0].rows[0]).toMatchObject({ state: 'no-price', amountMinor: null })
  })
  it('uses longitude/latitude explicitly and a 5 km inclusive straight-line radius', () => {
    expect(distanceM([0, 0], [0, 1])).toBeCloseTo(111195.08, 1)
    const s = fictionalSnapshot(); s.stores[0].coordinates = [50, 12]; s.stores[1].coordinateEvidence = null; expect(run(s).state).toBe('no-qualified-stores')
    const b = fictionalSnapshot(); b.stores[0].coordinates = [12, 45 + 4999 / 111195.0802335329]; b.stores[1].coordinates = [12, 45 + 5001 / 111195.0802335329]; expect(run(b).stores).toHaveLength(1)
  })
  it('revalidates untrusted snapshots and refuses unsafe arithmetic', () => {
    const s = fictionalSnapshot(); s.prices.push(s.prices[0]); expect(run(s).state).toBe('prices-unavailable')
    const p = fictionalPurchase(); p.items[0].quantity = Number.MAX_SAFE_INTEGER; expect(run(undefined, confirmed(), p).stores[0].rows[0].amountMinor).toBeNull()
  })
})
