import { describe, expect, it } from 'vitest'
import {
  buildPlaceFeatureCollection,
  globeEvidence,
  globePlaces,
  globePurchases,
  placeFeatureCollection,
} from './spendscape-globe'

describe('Spendscape canonical pin contract', () => {
  it('creates exactly one feature for a physical place with many purchases', () => {
    expect(globeEvidence.recurringPlacePurchaseCount).toBe(14)
    expect(globeEvidence.recurringPlacePinCount).toBe(1)

    const feature = buildPlaceFeatureCollection().features.find(
      (candidate) => candidate.properties.placeId === 'place_shuk_bograshov',
    )
    expect(feature?.properties.visitCount).toBe(14)
  })

  it('never turns online or unresolved purchases into pins', () => {
    const featureCollection = buildPlaceFeatureCollection()
    const pinnedPlaceIds = new Set(
      featureCollection.features.map((feature) => feature.properties.placeId),
    )

    for (const purchase of globePurchases) {
      if (purchase.channel === 'online' || purchase.resolution === 'unresolved') {
        expect(purchase.placeId).toBeNull()
      }
    }

    expect(globeEvidence.onlineCount).toBe(2)
    expect(globeEvidence.unresolvedCount).toBe(1)
    expect(pinnedPlaceIds.has('purchase_online_01')).toBe(false)
    expect(pinnedPlaceIds.has('purchase_unresolved_01')).toBe(false)
  })

  it('emits one pin per unique confirmed physical place and nothing else', () => {
    const confirmedPlaceIds = new Set(
      globePurchases
        .filter(
          (purchase) =>
            purchase.channel === 'physical' &&
            purchase.resolution === 'confirmed' &&
            purchase.placeId !== null,
        )
        .map((purchase) => purchase.placeId),
    )

    const featureCollection = buildPlaceFeatureCollection(globePlaces, globePurchases)
    expect(featureCollection.features).toHaveLength(confirmedPlaceIds.size)
    expect(featureCollection.features).toHaveLength(globeEvidence.pinCount)
    expect(featureCollection.features.every((feature) => feature.geometry.type === 'Point')).toBe(true)
    expect(placeFeatureCollection.features).toHaveLength(globePlaces.length)
    expect(new Set(
      placeFeatureCollection.features.map((feature) => feature.properties.placeId),
    ).size).toBe(globePlaces.length)
    expect(placeFeatureCollection.features.every(
      (feature) => !('point_count' in feature.properties),
    )).toBe(true)
  })

  it('keeps derived counts and normalized totals internally consistent', () => {
    const featureCollection = buildPlaceFeatureCollection()
    const visitSum = featureCollection.features.reduce(
      (sum, feature) => sum + feature.properties.visitCount,
      0,
    )
    const pinIds = featureCollection.features.map((feature) => feature.properties.placeId)

    expect(visitSum).toBe(globeEvidence.physicalConfirmedCount)
    expect(new Set(pinIds).size).toBe(pinIds.length)
    expect(
      featureCollection.features.every((feature) => feature.properties.totalBaseAmountIls > 0),
    ).toBe(true)
  })
})
