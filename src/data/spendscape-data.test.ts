import { describe, expect, it } from 'vitest'
import {
  baseAmountIlsForPurchase,
  buildPlaceFeatureCollection,
  canonicalSpendscapeData,
  defaultPurchaseQuery,
  derivedPurchaseSummary,
  filterPurchases,
  globeEvidenceRecords,
  globeMerchants,
  globePlaces,
  globePurchases,
  nestedItemTotal,
  synchronizeSelection,
} from './spendscape-globe'

describe('Spendscape canonical synthetic data', () => {
  it('has complete merchant, place, purchase, and evidence relationships', () => {
    const merchantIds = new Set(globeMerchants.map((merchant) => merchant.id))
    const placeIds = new Set(globePlaces.map((place) => place.id))
    const evidenceIds = new Set(globeEvidenceRecords.map((record) => record.id))
    const purchaseIds = new Set(globePurchases.map((purchase) => purchase.id))

    expect(merchantIds.size).toBe(globeMerchants.length)
    expect(placeIds.size).toBe(globePlaces.length)
    expect(evidenceIds.size).toBe(globeEvidenceRecords.length)
    expect(purchaseIds.size).toBe(globePurchases.length)
    expect(globePlaces.every((place) => merchantIds.has(place.merchantId))).toBe(true)
    expect(globePurchases.every((purchase) => merchantIds.has(purchase.merchantId))).toBe(true)
    expect(globePurchases.every((purchase) => purchase.placeId === null || placeIds.has(purchase.placeId))).toBe(true)
    expect(globePurchases.every((purchase) => purchase.evidenceIds.every((id) => evidenceIds.has(id)))).toBe(true)
    expect(globeEvidenceRecords.every((record) => purchaseIds.has(record.purchaseId))).toBe(true)
    expect(canonicalSpendscapeData.fixtureKind).toBe('synthetic')
  })

  it('reconciles every nested receipt total to its purchase original amount', () => {
    const nestedPurchases = globePurchases.filter((purchase) => purchase.items.length > 0)
    expect(nestedPurchases.map((purchase) => purchase.id)).toEqual([
      'purchase_shuk_01',
      'purchase_rimon_01',
      'purchase_kumo_01',
      'purchase_online_01',
    ])
    for (const purchase of nestedPurchases) {
      expect(nestedItemTotal(purchase)).toBe(purchase.originalAmount)
      expect(purchase.items.every((item) => item.lineTotal === item.quantity * item.unitPrice)).toBe(true)
    }
  })

  it('derives normalized amounts only from explicit synthetic FX provenance', () => {
    for (const purchase of globePurchases) {
      expect(purchase.fx.source).toBe('synthetic-fixture-rate')
      expect(purchase.fx.effectiveAt).toBe(purchase.timestamp)
      expect(baseAmountIlsForPurchase(purchase)).toBe(
        Math.round(purchase.originalAmount * purchase.fx.rateToBase * 100) / 100,
      )
    }
    const yenPurchase = globePurchases.find((purchase) => purchase.id === 'purchase_kumo_01')
    expect(yenPurchase && baseAmountIlsForPurchase(yenPurchase)).toBe(153)
  })

  it('keeps online and unresolved records in history but outside the pin source', () => {
    const allPins = buildPlaceFeatureCollection()
    const online = filterPurchases({ ...defaultPurchaseQuery, channel: 'online' })
    const unresolved = filterPurchases({ ...defaultPurchaseQuery, channel: 'unresolved' })

    expect(online).toHaveLength(2)
    expect(unresolved).toHaveLength(1)
    expect(buildPlaceFeatureCollection(globePlaces, online).features).toHaveLength(0)
    expect(buildPlaceFeatureCollection(globePlaces, unresolved).features).toHaveLength(0)
    expect(allPins.features).toHaveLength(12)
  })

  it('derives search, category, currency, channel, date, and timeline results consistently', () => {
    const itemSearch = filterPurchases({ ...defaultPurchaseQuery, search: 'sourdough' })
    const yen = filterPurchases({ ...defaultPurchaseQuery, currency: 'JPY' })
    const manual = filterPurchases({ ...defaultPurchaseQuery, channel: 'cash-manual' })
    const retail = filterPurchases({ ...defaultPurchaseQuery, category: 'retail' })
    const august = filterPurchases({ ...defaultPurchaseQuery, timelineMonth: '2026-08' })
    const recent = filterPurchases({ ...defaultPurchaseQuery, dateRange: '30d' })

    expect(itemSearch.map((purchase) => purchase.id)).toEqual(['purchase_shuk_01'])
    expect(yen).toHaveLength(2)
    expect(buildPlaceFeatureCollection(globePlaces, yen).features).toHaveLength(1)
    expect(manual.map((purchase) => purchase.id)).toEqual(['purchase_unresolved_01', 'purchase_rimon_01'])
    expect(retail.every((purchase) => purchase.category === 'retail')).toBe(true)
    expect(august).toHaveLength(10)
    expect(recent.every((purchase) => purchase.timestamp >= '2026-07-31')).toBe(true)
    expect(derivedPurchaseSummary(onlineOnly()).pinCount).toBe(0)
  })

  it('synchronizes selection with the shared filtered purchase set', () => {
    expect(synchronizeSelection(globePurchases, {
      selectedPlaceId: null,
      selectedPurchaseId: 'purchase_shuk_01',
    })).toEqual({ selectedPlaceId: 'place_shuk_bograshov', selectedPurchaseId: 'purchase_shuk_01' })

    expect(synchronizeSelection(onlineOnly(), {
      selectedPlaceId: 'place_shuk_bograshov',
      selectedPurchaseId: 'purchase_online_01',
    })).toEqual({ selectedPlaceId: null, selectedPurchaseId: 'purchase_online_01' })

    const groceries = filterPurchases({ ...defaultPurchaseQuery, category: 'groceries' })
    expect(synchronizeSelection(groceries, {
      selectedPlaceId: 'place_kumo_shibuya',
      selectedPurchaseId: 'purchase_kumo_01',
    })).toEqual({ selectedPlaceId: null, selectedPurchaseId: null })
  })
})

function onlineOnly() {
  return filterPurchases({ ...defaultPurchaseQuery, channel: 'online' })
}
