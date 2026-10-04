import { globePurchases, globeEvidenceRecords, globePlaces, globeMerchants } from './spendscape-fixtures'
import { describe, expect, it } from 'vitest'
import { derivePurchaseAnalytics } from './spendscape-analytics'
import { defaultPurchaseQuery, filterPurchases } from './spendscape-globe'

describe('Spendscape deterministic analytics', () => {
  it('reconciles headline metrics and channel totals to the canonical fixture graph', () => {
    const analytics = derivePurchaseAnalytics(globePurchases, globeEvidenceRecords)

    expect(analytics.purchaseCount).toBe(42)
    expect(analytics.totalBaseAmountIls).toBe(6777.38)
    expect(analytics.averageBaseAmountIls).toBe(161.37)
    expect(analytics.channels.map(({ key, purchaseCount }) => [key, purchaseCount])).toEqual([
      ['physical', 39],
      ['online', 2],
      ['unresolved', 1],
    ])
    expect(analytics.channels.reduce((sum, item) => sum + item.purchaseCount, 0)).toBe(42)
    expect(analytics.channels.reduce((sum, item) => sum + item.totalBaseAmountIls, 0)).toBeCloseTo(6777.38, 2)
  })

  it('derives category, time, place, currency, and evidence views without a second fixture source', () => {
    const analytics = derivePurchaseAnalytics(globePurchases, globeEvidenceRecords)

    expect(analytics.categories.reduce((sum, item) => sum + item.purchaseCount, 0)).toBe(42)
    expect(analytics.categories.reduce((sum, item) => sum + item.totalBaseAmountIls, 0)).toBeCloseTo(6777.38, 2)
    expect(analytics.months.map((item) => item.month)).toEqual([
      '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
      '2026-05', '2026-06', '2026-07', '2026-08',
    ])
    expect(analytics.months.reduce((sum, item) => sum + item.purchaseCount, 0)).toBe(42)
    expect(analytics.topPhysicalPlaces[0]).toEqual({
      placeId: 'place_shuk_bograshov',
      merchantId: 'merchant_shuk',
      purchaseCount: 14,
      totalBaseAmountIls: 3060.1,
    })
    expect(analytics.topPhysicalPlaces).toHaveLength(12)
    expect(analytics.currencies.map((item) => item.currency)).toEqual([
      'ILS', 'EUR', 'USD', 'GBP', 'JPY', 'AUD', 'ZAR', 'MXN',
    ])
    expect(analytics.currencies.every(
      (item) => item.provenance === 'synthetic-fixture-rate' && item.syntheticRatesToBase.length > 0,
    )).toBe(true)
    expect(analytics.evidenceSources.reduce((sum, item) => sum + item.purchaseCount, 0)).toBe(42)
  })

  it('uses the same filtered purchase set as Globe, Timeline, and Purchases', () => {
    const retailPurchases = filterPurchases({ ...defaultPurchaseQuery, category: 'retail' }, globePurchases, globePlaces, globeMerchants)
    const augustPurchases = filterPurchases({ ...defaultPurchaseQuery, timelineMonth: '2026-08' }, globePurchases, globePlaces, globeMerchants)
    const onlinePurchases = filterPurchases({ ...defaultPurchaseQuery, channel: 'online' }, globePurchases, globePlaces, globeMerchants)
    const tokyoPurchases = filterPurchases({ ...defaultPurchaseQuery, search: 'Tokyo' }, globePurchases, globePlaces, globeMerchants)

    expect(derivePurchaseAnalytics(retailPurchases, globeEvidenceRecords).purchaseCount).toBe(8)
    expect(derivePurchaseAnalytics(augustPurchases, globeEvidenceRecords).purchaseCount).toBe(10)
    expect(derivePurchaseAnalytics(onlinePurchases, globeEvidenceRecords).channels).toEqual([
      { key: 'physical', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
      { key: 'online', purchaseCount: 2, totalBaseAmountIls: 329.4, shareOfSpend: 1 },
      { key: 'unresolved', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
    ])
    expect(derivePurchaseAnalytics(onlinePurchases, globeEvidenceRecords).topPhysicalPlaces).toHaveLength(0)
    expect(derivePurchaseAnalytics(tokyoPurchases, globeEvidenceRecords).topPhysicalPlaces.map((item) => item.placeId)).toEqual([
      'place_kumo_shibuya',
    ])
  })

  it('returns stable zero-state analytics for an empty shared result set', () => {
    expect(derivePurchaseAnalytics([], globeEvidenceRecords)).toEqual({
      purchaseCount: 0,
      totalBaseAmountIls: 0,
      averageBaseAmountIls: 0,
      channels: [
        { key: 'physical', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
        { key: 'online', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
        { key: 'unresolved', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
      ],
      categories: [
        { key: 'groceries', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
        { key: 'food', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
        { key: 'retail', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
        { key: 'travel', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
      ],
      months: [],
      topPhysicalPlaces: [],
      currencies: [],
      evidenceSources: [
        { key: 'card-record', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
        { key: 'receipt', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
        { key: 'email-receipt', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
        { key: 'manual-entry', purchaseCount: 0, totalBaseAmountIls: 0, shareOfSpend: 0 },
      ],
    })
  })
})
