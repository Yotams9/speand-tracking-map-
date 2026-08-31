import {
  baseAmountIlsForPurchase,
  globeEvidenceRecords,
  globePurchases,
  type CurrencyCode,
  type EvidenceKind,
  type GlobePurchase,
  type PurchaseCategory,
} from './spendscape-globe'

export interface AnalyticsSegment<Key extends string> {
  key: Key
  purchaseCount: number
  totalBaseAmountIls: number
  shareOfSpend: number
}

export interface AnalyticsMonth {
  month: string
  purchaseCount: number
  totalBaseAmountIls: number
}

export interface AnalyticsPlace {
  placeId: string
  merchantId: string
  purchaseCount: number
  totalBaseAmountIls: number
}

export interface AnalyticsCurrency {
  currency: CurrencyCode
  purchaseCount: number
  originalAmountTotal: number
  totalBaseAmountIls: number
  syntheticRatesToBase: number[]
  provenance: 'synthetic-fixture-rate'
}

export interface PurchaseAnalytics {
  purchaseCount: number
  totalBaseAmountIls: number
  averageBaseAmountIls: number
  channels: Array<AnalyticsSegment<'physical' | 'online' | 'unresolved'>>
  categories: Array<AnalyticsSegment<PurchaseCategory>>
  months: AnalyticsMonth[]
  topPhysicalPlaces: AnalyticsPlace[]
  currencies: AnalyticsCurrency[]
  evidenceSources: Array<AnalyticsSegment<EvidenceKind>>
}

const categoryOrder: PurchaseCategory[] = ['groceries', 'food', 'retail', 'travel']
const channelOrder = ['physical', 'online', 'unresolved'] as const
const evidenceOrder: EvidenceKind[] = ['card-record', 'receipt', 'email-receipt', 'manual-entry']

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function shareOf(total: number, value: number): number {
  return total === 0 ? 0 : value / total
}

function summarize<Key extends string>(
  keys: readonly Key[],
  purchases: GlobePurchase[],
  matches: (purchase: GlobePurchase, key: Key) => boolean,
  totalBaseAmountIls: number,
): Array<AnalyticsSegment<Key>> {
  return keys.map((key) => {
    const matching = purchases.filter((purchase) => matches(purchase, key))
    const total = roundMoney(matching.reduce(
      (sum, purchase) => sum + baseAmountIlsForPurchase(purchase),
      0,
    ))
    return {
      key,
      purchaseCount: matching.length,
      totalBaseAmountIls: total,
      shareOfSpend: shareOf(totalBaseAmountIls, total),
    }
  })
}

export function derivePurchaseAnalytics(
  purchases: GlobePurchase[] = globePurchases,
  evidenceRecords = globeEvidenceRecords,
): PurchaseAnalytics {
  const totalBaseAmountIls = roundMoney(purchases.reduce(
    (sum, purchase) => sum + baseAmountIlsForPurchase(purchase),
    0,
  ))

  const channels = summarize(
    channelOrder,
    purchases,
    (purchase, key) => key === 'physical'
      ? purchase.channel === 'physical' && purchase.resolution === 'confirmed'
      : key === 'online'
        ? purchase.channel === 'online'
        : purchase.resolution === 'unresolved',
    totalBaseAmountIls,
  )

  const categories = summarize(
    categoryOrder,
    purchases,
    (purchase, key) => purchase.category === key,
    totalBaseAmountIls,
  )

  const monthGroups = new Map<string, GlobePurchase[]>()
  const placeGroups = new Map<string, GlobePurchase[]>()
  const currencyGroups = new Map<CurrencyCode, GlobePurchase[]>()

  for (const purchase of purchases) {
    const month = purchase.timestamp.slice(0, 7)
    monthGroups.set(month, [...(monthGroups.get(month) ?? []), purchase])
    currencyGroups.set(
      purchase.originalCurrency,
      [...(currencyGroups.get(purchase.originalCurrency) ?? []), purchase],
    )
    if (
      purchase.channel === 'physical' &&
      purchase.resolution === 'confirmed' &&
      purchase.placeId
    ) {
      placeGroups.set(purchase.placeId, [...(placeGroups.get(purchase.placeId) ?? []), purchase])
    }
  }

  const months = [...monthGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, matching]) => ({
      month,
      purchaseCount: matching.length,
      totalBaseAmountIls: roundMoney(matching.reduce(
        (sum, purchase) => sum + baseAmountIlsForPurchase(purchase),
        0,
      )),
    }))

  const topPhysicalPlaces = [...placeGroups.entries()]
    .map(([placeId, matching]) => ({
      placeId,
      merchantId: matching[0].merchantId,
      purchaseCount: matching.length,
      totalBaseAmountIls: roundMoney(matching.reduce(
        (sum, purchase) => sum + baseAmountIlsForPurchase(purchase),
        0,
      )),
    }))
    .sort((left, right) =>
      right.totalBaseAmountIls - left.totalBaseAmountIls || left.placeId.localeCompare(right.placeId),
    )

  const currencies = [...currencyGroups.entries()]
    .map(([currency, matching]) => ({
      currency,
      purchaseCount: matching.length,
      originalAmountTotal: roundMoney(matching.reduce(
        (sum, purchase) => sum + purchase.originalAmount,
        0,
      )),
      totalBaseAmountIls: roundMoney(matching.reduce(
        (sum, purchase) => sum + baseAmountIlsForPurchase(purchase),
        0,
      )),
      syntheticRatesToBase: [...new Set(matching.map((purchase) => purchase.fx.rateToBase))].sort(
        (left, right) => left - right,
      ),
      provenance: 'synthetic-fixture-rate' as const,
    }))
    .sort((left, right) =>
      right.totalBaseAmountIls - left.totalBaseAmountIls || left.currency.localeCompare(right.currency),
    )

  const visiblePurchaseIds = new Set(purchases.map((purchase) => purchase.id))
  const evidenceSources = evidenceOrder.map((key) => {
    const matchingPurchaseIds = new Set(
      evidenceRecords
        .filter((record) => record.kind === key && visiblePurchaseIds.has(record.purchaseId))
        .map((record) => record.purchaseId),
    )
    const matching = purchases.filter((purchase) => matchingPurchaseIds.has(purchase.id))
    const total = roundMoney(matching.reduce(
      (sum, purchase) => sum + baseAmountIlsForPurchase(purchase),
      0,
    ))
    return {
      key,
      purchaseCount: matching.length,
      totalBaseAmountIls: total,
      shareOfSpend: shareOf(totalBaseAmountIls, total),
    }
  })

  return {
    purchaseCount: purchases.length,
    totalBaseAmountIls,
    averageBaseAmountIls: purchases.length === 0 ? 0 : roundMoney(totalBaseAmountIls / purchases.length),
    channels,
    categories,
    months,
    topPhysicalPlaces,
    currencies,
    evidenceSources,
  }
}
