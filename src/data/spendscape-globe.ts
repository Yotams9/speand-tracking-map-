/** Canonical Spendscape types and deterministic operations over supplied data. */

import type { Feature, FeatureCollection, Point } from 'geojson'

export type LocaleCode = 'en' | 'he'
export type PurchaseCategory = 'groceries' | 'food' | 'retail' | 'travel'
export type CurrencyCode = 'ILS' | 'EUR' | 'GBP' | 'USD' | 'JPY' | 'AUD' | 'MXN' | 'ZAR'
export type PurchaseChannel = 'physical' | 'online' | 'unknown'
export type PaymentMode = 'card' | 'cash' | 'manual'
export type PurchaseResolution = 'confirmed' | 'unresolved'
export type EvidenceKind = 'card-record' | 'receipt' | 'email-receipt' | 'manual-entry'

export interface LocalizedText {
  en: string
  he: string
}

export interface Place {
  id: string
  merchantId: string
  name: LocalizedText
  branch: LocalizedText
  city: LocalizedText
  country: LocalizedText
  coordinates: [longitude: number, latitude: number]
  category: PurchaseCategory
}

export interface Merchant {
  id: string
  name: LocalizedText
  category: PurchaseCategory
  onlineOnly?: boolean
}

export interface PurchaseItem {
  id: string
  label: LocalizedText
  quantity: number
  unit: 'item' | 'kg'
  unitPrice: number
  lineTotal: number
}

export interface FxProvenance {
  baseCurrency: 'ILS'
  rateToBase: number
  effectiveAt: string
  source: 'synthetic-fixture-rate'
  label: LocalizedText
}

export interface GlobePurchase {
  id: string
  merchantId: string
  timestamp: string
  channel: PurchaseChannel
  resolution: PurchaseResolution
  paymentMode: PaymentMode
  placeId: string | null
  category: PurchaseCategory
  originalAmount: number
  originalCurrency: CurrencyCode
  fx: FxProvenance
  items: PurchaseItem[]
  evidenceIds: string[]
}

export interface PurchaseEvidence {
  id: string
  purchaseId: string
  kind: EvidenceKind
  observedAt: string
  label: LocalizedText
  synthetic: true
}

export interface SmartInboxCandidate {
  placeId: string
  context: LocalizedText
}

export interface SmartInboxCase {
  id: string
  purchaseId: string
  material: true
  question: LocalizedText
  rationale: LocalizedText
  candidates: SmartInboxCandidate[]
}

export interface PlaceFeatureProperties {
  placeId: string
  merchantId: string
  nameEn: string
  nameHe: string
  branchEn: string
  branchHe: string
  cityEn: string
  cityHe: string
  countryEn: string
  countryHe: string
  category: PurchaseCategory
  visitCount: number
  totalBaseAmountIls: number
  latestTimestamp: string
}

export function syntheticFx(
  currency: CurrencyCode,
  effectiveAt: string,
  rateToBase?: number,
): FxProvenance {
  const fixedRates: Record<CurrencyCode, number> = {
    ILS: 1,
    EUR: 4.05,
    GBP: 4.5,
    USD: 3.3,
    JPY: 0.0225,
    AUD: 2.2,
    MXN: 0.185,
    ZAR: 0.193,
  }
  return {
    baseCurrency: 'ILS',
    rateToBase: rateToBase ?? fixedRates[currency],
    effectiveAt,
    source: 'synthetic-fixture-rate',
    label: {
      en: currency === 'ILS' ? 'Synthetic identity rate' : 'Fixed synthetic demo rate',
      he: currency === 'ILS' ? 'שער זהות סינתטי' : 'שער הדגמה סינתטי קבוע',
    },
  }
}


export function nestedItemTotal(purchase: GlobePurchase): number {
  return Math.round(purchase.items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100
}

export function baseAmountIlsForPurchase(purchase: GlobePurchase): number {
  return Math.round(purchase.originalAmount * purchase.fx.rateToBase * 100) / 100
}

export type CategoryFilter = 'all' | PurchaseCategory
export type CurrencyFilter = 'all' | CurrencyCode
export type ChannelFilter = 'all' | 'physical' | 'online' | 'cash-manual' | 'unresolved'
export type DateRangeFilter = 'all' | '30d' | '90d' | 'year'

export interface PurchaseQuery {
  search: string
  category: CategoryFilter
  currency: CurrencyFilter
  channel: ChannelFilter
  dateRange: DateRangeFilter
  timelineMonth: string | null
}

export interface PlaceSearchResult {
  id: string
  kind: 'place'
  place: Place
  purchaseCount: number
}

export interface CitySearchResult {
  id: string
  kind: 'city'
  city: LocalizedText
  country: LocalizedText
  placeIds: string[]
  placeCount: number
  physicalPurchaseCount: number
}

export interface PurchaseSearchResult {
  id: string
  kind: 'purchase'
  purchase: GlobePurchase
  merchant: Merchant
  matchedItems: LocalizedText[]
}

export type CanonicalSearchResult = PlaceSearchResult | CitySearchResult | PurchaseSearchResult

export const defaultPurchaseQuery: PurchaseQuery = {
  search: '',
  category: 'all',
  currency: 'all',
  channel: 'all',
  dateRange: 'all',
  timelineMonth: null,
}

const fixtureNow = new Date('2026-08-30T00:00:00Z')

function searchTextForPurchase(
  purchase: GlobePurchase,
  places: readonly Place[],
  merchants: readonly Merchant[],
): string {
  const merchant = merchantForId(purchase.merchantId, merchants)
  const place = purchase.placeId ? placeForId(purchase.placeId, places) : undefined
  return normalizeCanonicalSearch([
    merchant?.name.en, merchant?.name.he, place?.name.en, place?.name.he,
    place?.branch.en, place?.branch.he, place?.city.en, place?.city.he,
    place?.country.en, place?.country.he, purchase.originalCurrency,
    purchase.channel, purchase.paymentMode, purchase.resolution,
    ...purchase.items.flatMap((item) => [item.label.en, item.label.he]),
  ].filter(Boolean).join(' '))
}

export function normalizeCanonicalSearch(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function localizedSearchText(...values: Array<LocalizedText | string | undefined>): string {
  return normalizeCanonicalSearch(values.flatMap((value) => {
    if (!value) return []
    return typeof value === 'string' ? [value] : [value.en, value.he]
  }).join(' '))
}

function searchRank(searchText: string, term: string): number {
  if (searchText === term) return 0
  if (searchText.split(' ').some((token) => token.startsWith(term))) return 1
  return 2
}

/**
 * Derives local-only search suggestions from the same synthetic purchase graph
 * used by the globe, Purchases, Analytics, filters, and timeline. No result
 * invents a coordinate, count, or provider-backed place.
 */
export function deriveCanonicalSearchResults(
  value: string,
  purchases: readonly GlobePurchase[],
  places: readonly Place[],
  merchants: readonly Merchant[],
): CanonicalSearchResult[] {
  const term = normalizeCanonicalSearch(value)
  if (!term) return []

  const placePurchases = new Map<string, GlobePurchase[]>()
  for (const purchase of purchases) {
    if (purchase.channel !== 'physical' || purchase.resolution !== 'confirmed' || !purchase.placeId) continue
    const current = placePurchases.get(purchase.placeId) ?? []
    current.push(purchase)
    placePurchases.set(purchase.placeId, current)
  }

  const placeResults = places
    .filter((place) => placePurchases.has(place.id))
    .map((place) => {
      const merchant = merchantForId(place.merchantId, merchants)
      const searchText = localizedSearchText(
        place.name,
        merchant?.name,
        place.branch,
        place.city,
        place.country,
      )
      return { place, searchText, rank: searchRank(searchText, term) }
    })
    .filter((candidate) => candidate.searchText.includes(term))
    .sort((left, right) => left.rank - right.rank || left.place.name.en.localeCompare(right.place.name.en))
    .slice(0, 4)
    .map(({ place }): PlaceSearchResult => ({
      id: `place:${place.id}`,
      kind: 'place',
      place,
      purchaseCount: placePurchases.get(place.id)?.length ?? 0,
    }))

  const cityGroups = new Map<string, {
    city: LocalizedText
    country: LocalizedText
    placeIds: string[]
    physicalPurchaseCount: number
  }>()
  for (const place of places) {
    const matchingPurchases = placePurchases.get(place.id)
    if (!matchingPurchases?.length) continue
    const key = `${normalizeCanonicalSearch(place.city.en)}:${normalizeCanonicalSearch(place.country.en)}`
    const group = cityGroups.get(key) ?? {
      city: place.city,
      country: place.country,
      placeIds: [],
      physicalPurchaseCount: 0,
    }
    group.placeIds.push(place.id)
    group.physicalPurchaseCount += matchingPurchases.length
    cityGroups.set(key, group)
  }

  const cityResults = [...cityGroups.entries()]
    .map(([key, group]) => {
      const searchText = localizedSearchText(group.city, group.country)
      return { key, group, searchText, rank: searchRank(searchText, term) }
    })
    .filter((candidate) => candidate.searchText.includes(term))
    .sort((left, right) => left.rank - right.rank || left.group.city.en.localeCompare(right.group.city.en))
    .slice(0, 3)
    .map(({ key, group }): CitySearchResult => ({
      id: `city:${key}`,
      kind: 'city',
      city: group.city,
      country: group.country,
      placeIds: group.placeIds,
      placeCount: group.placeIds.length,
      physicalPurchaseCount: group.physicalPurchaseCount,
    }))

  const purchaseResults = purchases
    .map((purchase) => {
      const merchant = merchantForId(purchase.merchantId, merchants)
      if (!merchant) return null
      const matchedItems = purchase.items
        .filter((item) => localizedSearchText(item.label).includes(term))
        .map((item) => item.label)
      const merchantMatches = localizedSearchText(merchant.name).includes(term)
      const usefulPurchaseMatch = matchedItems.length > 0 || (
        merchantMatches && (purchase.channel !== 'physical' || purchase.resolution !== 'confirmed' || !purchase.placeId)
      )
      if (!usefulPurchaseMatch) return null
      return {
        result: {
          id: `purchase:${purchase.id}`,
          kind: 'purchase' as const,
          purchase,
          merchant,
          matchedItems,
        },
        rank: matchedItems.length > 0 ? 0 : 1,
      }
    })
    .filter((candidate): candidate is { result: PurchaseSearchResult; rank: number } => candidate !== null)
    .sort((left, right) => left.rank - right.rank || right.result.purchase.timestamp.localeCompare(left.result.purchase.timestamp))
    .slice(0, 3)
    .map((candidate) => candidate.result)

  return [...placeResults, ...cityResults, ...purchaseResults].slice(0, 8)
}

export function filterPurchases(
  query: PurchaseQuery,
  purchases: readonly GlobePurchase[],
  places: readonly Place[],
  merchants: readonly Merchant[],
): GlobePurchase[] {
  const normalizedSearch = normalizeCanonicalSearch(query.search)
  const rangeDays = query.dateRange === '30d' ? 30 : query.dateRange === '90d' ? 90 : query.dateRange === 'year' ? 365 : null
  const earliest = rangeDays === null ? null : new Date(fixtureNow.getTime() - rangeDays * 86_400_000)

  return purchases
    .filter((purchase) => {
      if (normalizedSearch && !searchTextForPurchase(purchase, places, merchants).includes(normalizedSearch)) return false
      if (query.category !== 'all' && purchase.category !== query.category) return false
      if (query.currency !== 'all' && purchase.originalCurrency !== query.currency) return false
      if (query.channel === 'physical' && purchase.channel !== 'physical') return false
      if (query.channel === 'online' && purchase.channel !== 'online') return false
      if (query.channel === 'cash-manual' && purchase.paymentMode !== 'cash' && purchase.paymentMode !== 'manual') return false
      if (query.channel === 'unresolved' && purchase.resolution !== 'unresolved') return false
      if (earliest && new Date(purchase.timestamp) < earliest) return false
      if (query.timelineMonth && !purchase.timestamp.startsWith(query.timelineMonth)) return false
      return true
    })
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

export function availableTimelineMonths(purchases: readonly GlobePurchase[]): string[] {
  return [...new Set(purchases.map((purchase) => purchase.timestamp.slice(0, 7)))].sort().reverse()
}

export interface PurchaseSelection {
  selectedPlaceId: string | null
  selectedPurchaseId: string | null
}

export function synchronizeSelection(
  purchases: readonly GlobePurchase[],
  selection: PurchaseSelection,
  places: readonly Place[],
): PurchaseSelection {
  const selectedPurchase = selection.selectedPurchaseId
    ? purchases.find((purchase) => purchase.id === selection.selectedPurchaseId)
    : undefined
  const selectedPurchaseId = selectedPurchase?.id ?? null
  const candidatePlaceId = selectedPurchase
    ? selectedPurchase.placeId
    : selection.selectedPlaceId
  const visiblePlaceIds = new Set(
    buildPlaceFeatureCollection(places, purchases).features.map(
      (feature) => feature.properties.placeId,
    ),
  )
  return {
    selectedPurchaseId,
    selectedPlaceId: candidatePlaceId && visiblePlaceIds.has(candidatePlaceId)
      ? candidatePlaceId
      : null,
  }
}

export function buildPlaceFeatureCollection(
  places: readonly Place[],
  purchases: readonly GlobePurchase[],
): FeatureCollection<Point, PlaceFeatureProperties> {
  const placeById = new Map(places.map((place) => [place.id, place]))
  const purchasesByPlace = new Map<string, GlobePurchase[]>()

  for (const purchase of purchases) {
    if (
      purchase.channel !== 'physical' ||
      purchase.resolution !== 'confirmed' ||
      purchase.placeId === null
    ) {
      continue
    }

    if (!placeById.has(purchase.placeId)) continue
    const grouped = purchasesByPlace.get(purchase.placeId) ?? []
    grouped.push(purchase)
    purchasesByPlace.set(purchase.placeId, grouped)
  }

  const features: Array<Feature<Point, PlaceFeatureProperties>> = []
  for (const place of places) {
    const placePurchases = purchasesByPlace.get(place.id)
    if (!placePurchases?.length) continue

    const ordered = [...placePurchases].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: place.coordinates },
      properties: {
        placeId: place.id,
        merchantId: place.merchantId,
        nameEn: place.name.en,
        nameHe: place.name.he,
        branchEn: place.branch.en,
        branchHe: place.branch.he,
        cityEn: place.city.en,
        cityHe: place.city.he,
        countryEn: place.country.en,
        countryHe: place.country.he,
        category: place.category,
        visitCount: placePurchases.length,
        totalBaseAmountIls: Math.round(
          placePurchases.reduce((sum, purchase) => sum + baseAmountIlsForPurchase(purchase), 0) * 100,
        ) / 100,
        latestTimestamp: ordered[0].timestamp,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

export function derivedPurchaseSummary(
  purchases: readonly GlobePurchase[],
  places: readonly Place[],
) {
  const confirmed = purchases.filter((purchase) => purchase.resolution === 'confirmed')
  const currencies = [...new Set(purchases.map((purchase) => purchase.originalCurrency))].sort()
  return {
    purchaseCount: purchases.length,
    confirmedCount: confirmed.length,
    pinCount: buildPlaceFeatureCollection(places, purchases).features.length,
    totalBaseAmountIls: Math.round(
      purchases.reduce((sum, purchase) => sum + baseAmountIlsForPurchase(purchase), 0) * 100,
    ) / 100,
    averageBaseAmountIls: purchases.length === 0 ? 0 : Math.round(
      purchases.reduce((sum, purchase) => sum + baseAmountIlsForPurchase(purchase), 0) /
      purchases.length * 100,
    ) / 100,
    currencies,
  }
}

export function placeForId(placeId: string, places: readonly Place[]): Place | undefined {
  return places.find((place) => place.id === placeId)
}

export function merchantForId(
  merchantId: string,
  merchants: readonly Merchant[],
): Merchant | undefined {
  return merchants.find((merchant) => merchant.id === merchantId)
}

export function purchaseForId(
  purchaseId: string,
  purchases: readonly GlobePurchase[],
): GlobePurchase | undefined {
  return purchases.find((purchase) => purchase.id === purchaseId)
}

export function purchasesForPlace(
  placeId: string,
  purchases: readonly GlobePurchase[],
): GlobePurchase[] {
  return purchases
    .filter((purchase) => purchase.placeId === placeId)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

export function localized(value: LocalizedText, locale: LocaleCode): string {
  return value[locale]
}
