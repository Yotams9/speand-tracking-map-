import {
  globePlaces,
  type GlobePurchase,
  type Place,
  type SmartInboxCase,
} from '../../data/spendscape-globe'

export type SmartInboxDecision =
  | { caseId: string; status: 'resolved'; placeId: string }
  | { caseId: string; status: 'deferred' }

export function decisionForCase(
  caseId: string,
  decisions: readonly SmartInboxDecision[],
): SmartInboxDecision | undefined {
  return decisions.find((decision) => decision.caseId === caseId)
}

export function caseForPurchase(
  purchaseId: string,
  cases: readonly SmartInboxCase[],
): SmartInboxCase | undefined {
  return cases.find((candidate) => candidate.purchaseId === purchaseId && candidate.material)
}

export function pendingSmartInboxCases(
  cases: readonly SmartInboxCase[],
  purchases: readonly GlobePurchase[],
  decisions: readonly SmartInboxDecision[],
): SmartInboxCase[] {
  const purchaseById = new Map(purchases.map((purchase) => [purchase.id, purchase]))
  return cases.filter((inboxCase) => {
    const purchase = purchaseById.get(inboxCase.purchaseId)
    return Boolean(
      inboxCase.material
      && purchase?.resolution === 'unresolved'
      && purchase.placeId === null
      && !decisionForCase(inboxCase.id, decisions),
    )
  })
}

export function applySmartInboxDecisions(
  purchases: readonly GlobePurchase[],
  cases: readonly SmartInboxCase[],
  decisions: readonly SmartInboxDecision[],
  places: readonly Place[] = globePlaces,
): GlobePurchase[] {
  const caseById = new Map(cases.map((inboxCase) => [inboxCase.id, inboxCase]))
  const placeById = new Map(places.map((place) => [place.id, place]))
  const resolutionByPurchaseId = new Map<string, Place>()

  for (const decision of decisions) {
    if (decision.status !== 'resolved') continue
    const inboxCase = caseById.get(decision.caseId)
    const place = placeById.get(decision.placeId)
    if (!inboxCase || !place) continue
    if (!inboxCase.candidates.some((candidate) => candidate.placeId === place.id)) continue
    resolutionByPurchaseId.set(inboxCase.purchaseId, place)
  }

  return purchases.map((purchase) => {
    const place = resolutionByPurchaseId.get(purchase.id)
    if (!place || purchase.resolution !== 'unresolved' || purchase.placeId !== null) return purchase
    return {
      ...purchase,
      merchantId: place.merchantId,
      channel: 'physical',
      resolution: 'confirmed',
      placeId: place.id,
      category: place.category,
    }
  })
}

export function upsertSmartInboxDecision(
  decisions: readonly SmartInboxDecision[],
  next: SmartInboxDecision,
): SmartInboxDecision[] {
  return [...decisions.filter((decision) => decision.caseId !== next.caseId), next]
}

export function removeSmartInboxDecision(
  decisions: readonly SmartInboxDecision[],
  caseId: string,
): SmartInboxDecision[] {
  return decisions.filter((decision) => decision.caseId !== caseId)
}
