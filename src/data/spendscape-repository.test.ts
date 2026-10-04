import { canonicalSpendscapeData } from './spendscape-fixtures'
import { describe, expect, it } from 'vitest'
import { baseAmountIlsForPurchase, buildPlaceFeatureCollection, nestedItemTotal } from './spendscape-globe'
import { derivePurchaseAnalytics } from './spendscape-analytics'
import {
  createFixtureSpendscapeRepository,
  fixtureSpendscapeRepository,
  type SpendscapeDataRepository,
} from './spendscape-repository'

async function expectRepositoryContract(repository: SpendscapeDataRepository) {
  const snapshot = await repository.loadSnapshot()
  const merchantIds = new Set(snapshot.merchants.map((merchant) => merchant.id))
  const placeIds = new Set(snapshot.places.map((place) => place.id))
  const purchaseIds = new Set(snapshot.purchases.map((purchase) => purchase.id))
  const evidenceIds = new Set(snapshot.evidence.map((evidence) => evidence.id))

  expect(merchantIds.size).toBe(snapshot.merchants.length)
  expect(placeIds.size).toBe(snapshot.places.length)
  expect(purchaseIds.size).toBe(snapshot.purchases.length)
  expect(evidenceIds.size).toBe(snapshot.evidence.length)
  expect(snapshot.places.every((place) => merchantIds.has(place.merchantId))).toBe(true)
  expect(snapshot.purchases.every((purchase) => merchantIds.has(purchase.merchantId))).toBe(true)
  expect(snapshot.purchases.every(
    (purchase) => purchase.placeId === null || placeIds.has(purchase.placeId),
  )).toBe(true)
  expect(snapshot.purchases.every(
    (purchase) => purchase.evidenceIds.every((evidenceId) => evidenceIds.has(evidenceId)),
  )).toBe(true)
  expect(snapshot.evidence.every((evidence) => purchaseIds.has(evidence.purchaseId))).toBe(true)
  expect(snapshot.smartInboxCases.every((inboxCase) => (
    purchaseIds.has(inboxCase.purchaseId)
    && inboxCase.candidates.every((candidate) => placeIds.has(candidate.placeId))
  ))).toBe(true)

  const nested = snapshot.purchases.filter((purchase) => purchase.items.length > 0)
  expect(nested.every((purchase) => nestedItemTotal(purchase) === purchase.originalAmount)).toBe(true)
  expect(snapshot.purchases.every((purchase) => (
    purchase.fx.source === 'synthetic-fixture-rate'
    && purchase.fx.effectiveAt === purchase.timestamp
    && baseAmountIlsForPurchase(purchase) === Math.round(
      purchase.originalAmount * purchase.fx.rateToBase * 100,
    ) / 100
  ))).toBe(true)

  const canonicalPins = buildPlaceFeatureCollection(snapshot.places, snapshot.purchases)
  const confirmedPhysicalPlaceIds = new Set(snapshot.purchases
    .filter((purchase) => (
      purchase.channel === 'physical'
      && purchase.resolution === 'confirmed'
      && purchase.placeId !== null
    ))
    .map((purchase) => purchase.placeId))
  expect(canonicalPins.features).toHaveLength(confirmedPhysicalPlaceIds.size)
  expect(canonicalPins.features).toHaveLength(12)
  expect(new Set(canonicalPins.features.map((feature) => feature.properties.placeId)).size)
    .toBe(canonicalPins.features.length)
  expect(snapshot.purchases
    .filter((purchase) => purchase.channel === 'online' || purchase.resolution === 'unresolved')
    .every((purchase) => purchase.placeId === null)).toBe(true)
  for (const channel of ['online', 'unresolved']) {
    const unpinned = snapshot.purchases.filter((purchase) => (
      channel === 'online' ? purchase.channel === 'online' : purchase.resolution === 'unresolved'
    ))
    expect(unpinned).toHaveLength(channel === 'online' ? 2 : 1)
    expect(buildPlaceFeatureCollection(snapshot.places, unpinned).features).toHaveLength(0)
  }
  expect(derivePurchaseAnalytics(snapshot.purchases, snapshot.evidence)).toMatchObject({
    purchaseCount: 42,
    totalBaseAmountIls: 6777.38,
    averageBaseAmountIls: 161.37,
  })

  return snapshot
}

describe('Spendscape data repository contract', () => {
  it('loads the complete canonical graph through the fixture adapter', async () => {
    const snapshot = await expectRepositoryContract(fixtureSpendscapeRepository)

    expect(fixtureSpendscapeRepository.adapter).toBe('fixture')
    expect(snapshot.source).toEqual({
      adapter: 'fixture',
      classification: 'synthetic',
      version: canonicalSpendscapeData.fixtureVersion,
    })
    expect(snapshot.profile).toBe(canonicalSpendscapeData.profile)
    expect(snapshot.merchants).toBe(canonicalSpendscapeData.merchants)
    expect(snapshot.places).toBe(canonicalSpendscapeData.places)
    expect(snapshot.purchases).toBe(canonicalSpendscapeData.purchases)
    expect(snapshot.evidence).toBe(canonicalSpendscapeData.evidence)
    expect(snapshot.smartInboxCases).toBe(canonicalSpendscapeData.smartInboxCases)
    expect(snapshot.merchants).toHaveLength(15)
    expect(snapshot.places).toHaveLength(12)
    expect(snapshot.purchases).toHaveLength(42)
    expect(snapshot.evidence).toHaveLength(42)
  })

  it('returns a stable, plain serializable snapshot without duplicating fixture data', async () => {
    const repository = createFixtureSpendscapeRepository()
    const first = await repository.loadSnapshot()
    const second = await repository.loadSnapshot()
    const serialized = JSON.stringify(first)

    expect(first).toBe(second)
    expect(JSON.parse(serialized)).toEqual(first)
    expect(Object.keys(repository).sort()).toEqual(['adapter', 'loadSnapshot'])
    expect('save' in repository).toBe(false)
    expect('mutate' in repository).toBe(false)
  })
})
