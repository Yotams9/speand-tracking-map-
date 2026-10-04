import {
  globeEvidenceRecords,
  globePlaces,
  globePurchases,
  smartInboxCases,
} from '../../data/spendscape-fixtures'
import { describe, expect, it } from 'vitest'
import { derivePurchaseAnalytics } from '../../data/spendscape-analytics'
import { buildPlaceFeatureCollection } from '../../data/spendscape-globe'
import {
  applySmartInboxDecisions,
  caseForPurchase,
  pendingSmartInboxCases,
  removeSmartInboxDecision,
  upsertSmartInboxDecision,
  type SmartInboxDecision,
} from './smart-inbox-domain'

const caseFixture = smartInboxCases[0]

describe('material-uncertainty Smart Inbox domain', () => {
  it('defines exactly one material case from the canonical fixture graph', () => {
    expect(smartInboxCases).toHaveLength(1)
    expect(caseFixture.purchaseId).toBe('purchase_unresolved_01')
    expect(caseFixture.material).toBe(true)
    expect(caseForPurchase(caseFixture.purchaseId, smartInboxCases)).toBe(caseFixture)

    const purchase = globePurchases.find((candidate) => candidate.id === caseFixture.purchaseId)
    expect(purchase).toMatchObject({ resolution: 'unresolved', channel: 'unknown', placeId: null })
    expect(new Set(caseFixture.candidates.map((candidate) => candidate.placeId)).size).toBe(2)
    for (const candidate of caseFixture.candidates) {
      expect(globePlaces.some((place) => place.id === candidate.placeId)).toBe(true)
    }
  })

  it('does not create cases for unrelated unresolved records', () => {
    const unrelated = { ...globePurchases.find((purchase) => purchase.id === caseFixture.purchaseId)!, id: 'session_unresolved' }
    expect(caseForPurchase(unrelated.id, smartInboxCases)).toBeUndefined()
    expect(pendingSmartInboxCases(smartInboxCases, [...globePurchases, unrelated], [])).toEqual([caseFixture])
  })

  it('requires an explicit valid candidate resolution and preserves recorded facts', () => {
    const baseline = globePurchases.find((purchase) => purchase.id === caseFixture.purchaseId)!
    const decisions: SmartInboxDecision[] = [{
      caseId: caseFixture.id,
      status: 'resolved',
      placeId: 'place_shuk_bograshov',
    }]
    const resolved = applySmartInboxDecisions(globePurchases, smartInboxCases, decisions, globePlaces)
      .find((purchase) => purchase.id === baseline.id)!

    expect(resolved).toMatchObject({
      merchantId: 'merchant_shuk',
      channel: 'physical',
      resolution: 'confirmed',
      placeId: 'place_shuk_bograshov',
      category: 'groceries',
    })
    expect({
      id: resolved.id,
      timestamp: resolved.timestamp,
      originalAmount: resolved.originalAmount,
      originalCurrency: resolved.originalCurrency,
      paymentMode: resolved.paymentMode,
      fx: resolved.fx,
      items: resolved.items,
      evidenceIds: resolved.evidenceIds,
    }).toEqual({
      id: baseline.id,
      timestamp: baseline.timestamp,
      originalAmount: baseline.originalAmount,
      originalCurrency: baseline.originalCurrency,
      paymentMode: baseline.paymentMode,
      fx: baseline.fx,
      items: baseline.items,
      evidenceIds: baseline.evidenceIds,
    })

    const invalid = applySmartInboxDecisions(globePurchases, smartInboxCases, [{
      caseId: caseFixture.id,
      status: 'resolved',
      placeId: 'place_rimon_park',
    }], globePlaces).find((purchase) => purchase.id === baseline.id)
    expect(invalid).toBe(baseline)
  })

  it('keeps one canonical pin while synchronizing counts and analytics', () => {
    const baselinePins = buildPlaceFeatureCollection(globePlaces, globePurchases)
    const baselineAnalytics = derivePurchaseAnalytics(globePurchases, globeEvidenceRecords)
    const resolvedPurchases = applySmartInboxDecisions(globePurchases, smartInboxCases, [{
      caseId: caseFixture.id,
      status: 'resolved',
      placeId: 'place_shuk_bograshov',
    }], globePlaces)
    const resolvedPins = buildPlaceFeatureCollection(globePlaces, resolvedPurchases)
    const resolvedAnalytics = derivePurchaseAnalytics(resolvedPurchases, globeEvidenceRecords)
    const shuk = resolvedPins.features.find((feature) => feature.properties.placeId === 'place_shuk_bograshov')

    expect(resolvedPins.features).toHaveLength(baselinePins.features.length)
    expect(shuk?.properties.visitCount).toBe(15)
    expect(resolvedAnalytics.purchaseCount).toBe(baselineAnalytics.purchaseCount)
    expect(resolvedAnalytics.totalBaseAmountIls).toBe(baselineAnalytics.totalBaseAmountIls)
    expect(resolvedAnalytics.averageBaseAmountIls).toBe(baselineAnalytics.averageBaseAmountIls)
    expect(resolvedAnalytics.channels.find((channel) => channel.key === 'physical')?.purchaseCount)
      .toBe((baselineAnalytics.channels.find((channel) => channel.key === 'physical')?.purchaseCount ?? 0) + 1)
    expect(resolvedAnalytics.channels.find((channel) => channel.key === 'unresolved')?.purchaseCount).toBe(0)
  })

  it('supports explicit defer and exact undo back to fixture baseline', () => {
    const deferred = upsertSmartInboxDecision([], { caseId: caseFixture.id, status: 'deferred' })
    expect(pendingSmartInboxCases(smartInboxCases, globePurchases, deferred)).toEqual([])
    expect(applySmartInboxDecisions(globePurchases, smartInboxCases, deferred, globePlaces)).toEqual(globePurchases)

    const undone = removeSmartInboxDecision(deferred, caseFixture.id)
    expect(pendingSmartInboxCases(smartInboxCases, globePurchases, undone)).toEqual([caseFixture])
    expect(applySmartInboxDecisions(globePurchases, smartInboxCases, undone, globePlaces)).toEqual(globePurchases)
  })
})
