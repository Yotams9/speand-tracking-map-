import { describe, expect, it } from 'vitest'
import { canonicalSpendscapeData } from '../../data/spendscape-fixtures'
import { syntheticFx, type CurrencyCode, type GlobePurchase, type PurchaseCategory, type PurchaseItem } from '../../data/spendscape-globe'
import {
  amountIn, averageBasket, biggestPurchases, compareMonths, localMidnight, localMonth, minorAmount, mostBoughtItems,
  resolveRange, selectPurchases, shiftMonth, spendByCategory, spendByMonth, spendByStore, thisMonthSummary,
  topCategory, topStore, totalSpent, type InsightClock, type InsightFilters,
} from './insights-domain'

// Friday 9 October 2026, 23:41 in Tel Aviv (summer time, UTC+3).
const clock: InsightClock = { now: new Date('2026-10-09T20:41:00Z'), timeZone: 'Asia/Jerusalem' }

const item = (label: string, quantity: number, lineTotal: number, unit: PurchaseItem['unit'] = 'item'): PurchaseItem => ({ id: label, label: { en: label, he: label }, quantity, unit, unitPrice: lineTotal / quantity, lineTotal })
function purchase(id: string, merchantId: string, timestamp: string, amount: number, extra: { currency?: CurrencyCode; category?: PurchaseCategory; items?: PurchaseItem[]; channel?: GlobePurchase['channel'] } = {}): GlobePurchase {
  const currency = extra.currency ?? 'ILS'
  return {
    id, merchantId, timestamp, channel: extra.channel ?? 'physical', resolution: 'confirmed', paymentMode: 'card',
    placeId: null, category: extra.category ?? 'groceries', originalAmount: amount, originalCurrency: currency,
    fx: syntheticFx(currency, timestamp), items: extra.items ?? [], evidenceIds: [],
  }
}

const purchases: GlobePurchase[] = [
  purchase('p_sep_shuf', 'chain_shufersal', '2026-09-12T08:00:00Z', 200, { items: [item('חלב 3%', 2, 13.8), item('עגבניות', 1.25, 9.99, 'kg')] }),
  purchase('p_sep_rami', 'chain_ramilevi', '2026-09-20T08:00:00Z', 100.1, { items: [item('חלב  3%', 1, 6.9)] }),
  // 00:30 on 1 October in Tel Aviv, still 30 September in UTC.
  purchase('p_oct_edge', 'chain_ramilevi', '2026-09-30T21:30:00Z', 19.9, { items: [item('Bread', 1, 19.9)] }),
  purchase('p_oct_shuf', 'chain_shufersal', '2026-10-05T10:00:00Z', 250.55, { items: [item('חלב 3%', 3, 20.7)] }),
  purchase('p_oct_cafe', 'merchant_cafe', '2026-10-06T10:00:00Z', 48, { category: 'food' }),
  purchase('p_oct_usd', 'merchant_online', '2026-10-07T10:00:00Z', 36, { currency: 'USD', category: 'retail', channel: 'online' }),
  purchase('p_old', 'chain_shufersal', '2025-12-31T21:59:00Z', 999, {}),
]

describe('time ranges in the person’s time zone', () => {
  it('finds local midnight across summer and winter time', () => {
    expect(localMidnight(2026, 10, 1, 'Asia/Jerusalem').toISOString()).toBe('2026-09-30T21:00:00.000Z')
    expect(localMidnight(2026, 11, 1, 'Asia/Jerusalem').toISOString()).toBe('2026-10-31T22:00:00.000Z')
    expect(localMidnight(2026, 13, 1, 'Asia/Jerusalem').toISOString()).toBe('2026-12-31T22:00:00.000Z')
  })
  it('resolves this month, last month, this year and the last 30 days', () => {
    const iso = (range: Parameters<typeof resolveRange>[0]) => { const r = resolveRange(range, clock); return [r.from?.toISOString(), r.to?.toISOString()] }
    expect(iso({ kind: 'this-month' })).toEqual(['2026-09-30T21:00:00.000Z', '2026-10-31T22:00:00.000Z'])
    expect(iso({ kind: 'last-month' })).toEqual(['2026-08-31T21:00:00.000Z', '2026-09-30T21:00:00.000Z'])
    expect(iso({ kind: 'this-year' })).toEqual(['2025-12-31T22:00:00.000Z', '2026-12-31T22:00:00.000Z'])
    expect(iso({ kind: 'last-30-days' })).toEqual(['2026-09-09T21:00:00.000Z', '2026-10-09T21:00:00.000Z'])
    expect(iso({ kind: 'all' })).toEqual([undefined, undefined])
  })
  it('treats custom dates as whole local days, both inclusive', () => {
    const range = resolveRange({ kind: 'custom', from: '2026-10-01', to: '2026-10-01' }, clock)
    expect([range.from?.toISOString(), range.to?.toISOString()]).toEqual(['2026-09-30T21:00:00.000Z', '2026-10-01T21:00:00.000Z'])
    expect(selectPurchases(purchases, { kind: 'custom', from: '2026-10-01', to: '2026-10-01' }, {}, clock).map((p) => p.id)).toEqual(['p_oct_edge'])
    expect(() => resolveRange({ kind: 'custom', from: '2026-10-05', to: '2026-10-01' }, clock)).toThrow(RangeError)
    expect(() => resolveRange({ kind: 'custom', from: '1/10/2026', to: '2026-10-01' }, clock)).toThrow(RangeError)
  })
  it('places a purchase in its local month', () => {
    expect(localMonth('2026-09-30T21:30:00Z', 'Asia/Jerusalem')).toBe('2026-10')
    expect(localMonth('2026-09-30T20:59:00Z', 'Asia/Jerusalem')).toBe('2026-09')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
})

describe('totals', () => {
  it('uses integer agorot without floating-point drift', () => {
    expect(minorAmount({ originalAmount: 19.9, originalCurrency: 'ILS' })).toBe(1990)
    expect(minorAmount({ originalAmount: 100.1, originalCurrency: 'ILS' })).toBe(10010)
    expect(minorAmount({ originalAmount: 1200, originalCurrency: 'JPY' })).toBe(1200)
  })
  it('keeps currencies apart and names every source purchase', () => {
    const october = totalSpent(purchases, { range: { kind: 'this-month' }, clock })
    expect(october.totals).toEqual([
      { currency: 'ILS', minor: 1990 + 25055 + 4800, purchaseCount: 3 },
      { currency: 'USD', minor: 3600, purchaseCount: 1 },
    ])
    expect(october.purchaseIds).toEqual(['p_oct_edge', 'p_oct_shuf', 'p_oct_cafe', 'p_oct_usd'])
    expect(october.purchaseCount).toBe(4)
  })
  it('filters by category, store, currency and channel', () => {
    const query = (filters: InsightFilters) => totalSpent(purchases, { range: { kind: 'this-year' }, filters, clock }).purchaseIds
    expect(query({ category: 'food' })).toEqual(['p_oct_cafe'])
    expect(query({ storeId: 'chain_ramilevi' })).toEqual(['p_sep_rami', 'p_oct_edge'])
    expect(query({ currency: 'USD' })).toEqual(['p_oct_usd'])
    expect(query({ channel: 'online' })).toEqual(['p_oct_usd'])
    // 23:59 on 31 Dec 2025 in Tel Aviv is outside 2026.
    expect(query({})).not.toContain('p_old')
  })
  it('returns empty, sourced results when nothing matches', () => {
    expect(totalSpent([], { clock })).toEqual({ totals: [], purchaseCount: 0, purchaseIds: [] })
    expect(topStore([], { clock })).toBeNull()
    expect(topCategory([], { clock })).toBeNull()
  })
})

describe('breakdowns', () => {
  it('ranks stores by ILS spend, never by converted foreign amounts', () => {
    const stores = spendByStore(purchases, { range: { kind: 'this-year' }, clock })
    expect(stores.map((s) => [s.storeId, amountIn(s)])).toEqual([
      ['chain_shufersal', 45055], ['chain_ramilevi', 12000], ['merchant_cafe', 4800], ['merchant_online', 0],
    ])
    expect(stores[1].purchaseIds).toEqual(['p_sep_rami', 'p_oct_edge'])
    expect(topStore(purchases, { range: { kind: 'this-month' }, clock })?.storeId).toBe('chain_shufersal')
    expect(topStore(purchases, { range: { kind: 'this-month' }, clock, category: 'food' })?.storeId).toBe('merchant_cafe')
    expect(topStore(purchases, { range: { kind: 'this-month' }, clock, rankCurrency: 'USD' })?.storeId).toBe('merchant_online')
  })
  it('groups by category and by local month', () => {
    expect(spendByCategory(purchases, { range: { kind: 'this-month' }, clock }).map((c) => [c.category, amountIn(c)])).toEqual([
      ['groceries', 27045], ['food', 4800], ['retail', 0],
    ])
    expect(topCategory(purchases, { range: { kind: 'this-month' }, clock })?.category).toBe('groceries')
    expect(spendByMonth(purchases, { range: { kind: 'this-year' }, clock }).map((m) => [m.month, amountIn(m), m.purchaseIds.length])).toEqual([
      ['2026-09', 30010, 2], ['2026-10', 31845, 4],
    ])
  })
  it('lists the biggest purchases in one currency', () => {
    expect(biggestPurchases(purchases, 2, { range: { kind: 'this-year' }, clock }).map((p) => [p.purchaseId, p.minor])).toEqual([['p_oct_shuf', 25055], ['p_sep_shuf', 20000]])
    expect(biggestPurchases(purchases, 5, { rankCurrency: 'USD', clock }).map((p) => p.purchaseId)).toEqual(['p_oct_usd'])
    expect(biggestPurchases(purchases, 0, { clock })).toEqual([])
  })
  it('compares two months currency by currency', () => {
    const comparison = compareMonths(purchases, '2026-09', '2026-10', { clock })
    expect(comparison.changes).toEqual([
      { currency: 'ILS', aMinor: 30010, bMinor: 31845, deltaMinor: 1835, percent: 6 },
      { currency: 'USD', aMinor: 0, bMinor: 3600, deltaMinor: 3600, percent: null },
    ])
    expect(comparison.purchaseIds).toEqual(['p_sep_shuf', 'p_sep_rami', 'p_oct_edge', 'p_oct_shuf', 'p_oct_cafe', 'p_oct_usd'])
    expect(() => compareMonths(purchases, '2026-13', '2026-10')).toThrow(RangeError)
  })
  it('counts the most bought items by name, keeping kilograms apart from units', () => {
    const items = mostBoughtItems(purchases, 2, { range: { kind: 'this-year' }, clock })
    expect(items[0]).toMatchObject({ key: 'חלב 3%', purchaseCount: 3, units: 6, kilograms: 0, purchaseIds: ['p_sep_shuf', 'p_sep_rami', 'p_oct_shuf'] })
    expect(items[0].totals).toEqual([{ currency: 'ILS', minor: 1380 + 690 + 2070, purchaseCount: 3 }])
    expect(items[1]).toMatchObject({ purchaseCount: 1 })
    const tomatoes = mostBoughtItems(purchases, 10, { clock }).find((entry) => entry.key === 'עגבניות')
    expect(tomatoes).toMatchObject({ units: 0, kilograms: 1.25 })
  })
  it('averages a basket per currency, optionally for one store', () => {
    expect(averageBasket(purchases, 'chain_ramilevi', { clock })).toEqual([{ currency: 'ILS', averageMinor: 6000, purchaseCount: 2, purchaseIds: ['p_sep_rami', 'p_oct_edge'] }])
    const all = averageBasket(purchases, undefined, { range: { kind: 'this-month' }, clock })
    expect(all.map((entry) => [entry.currency, entry.averageMinor])).toEqual([['ILS', Math.round(31845 / 3)], ['USD', 3600]])
  })
})

describe('this-month summary', () => {
  it('combines total, top store, top category and the change from last month', () => {
    const summary = thisMonthSummary(purchases, clock)
    expect(summary.month).toBe('2026-10')
    expect(summary.previousMonth).toBe('2026-09')
    expect(amountIn(summary.total)).toBe(31845)
    expect(summary.topStore?.storeId).toBe('chain_shufersal')
    expect(summary.topCategory?.category).toBe('groceries')
    expect(summary.vsPrevious).toEqual({ currency: 'ILS', aMinor: 30010, bMinor: 31845, deltaMinor: 1835, percent: 6 })
  })
  it('has no comparison when last month had no ILS spend', () => {
    expect(thisMonthSummary(purchases.filter((p) => !p.id.startsWith('p_sep')), clock).vsPrevious).toBeNull()
    expect(thisMonthSummary([], clock)).toMatchObject({ topStore: null, topCategory: null, vsPrevious: null, purchaseIds: [] })
  })
})

describe('on the demo story', () => {
  it('agrees with the plain sum of the demo purchases', () => {
    const demo = canonicalSpendscapeData.purchases
    const total = totalSpent(demo, { clock })
    for (const currency of new Set(demo.map((p) => p.originalCurrency))) {
      const expected = demo.filter((p) => p.originalCurrency === currency).reduce((sum, p) => sum + Math.round(p.originalAmount * (currency === 'JPY' ? 1 : 100)), 0)
      expect(amountIn(total, currency)).toBe(expected)
    }
    expect(total.purchaseIds).toHaveLength(demo.length)
    const months = spendByMonth(demo, { clock })
    expect(months.reduce((sum, month) => sum + amountIn(month), 0)).toBe(amountIn(total))
  })
})
