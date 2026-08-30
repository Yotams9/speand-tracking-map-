/**
 * Canonical synthetic data for the Phase 1 globe checkpoint.
 *
 * Everything here is invented. Merchant names are fictional, coordinates use
 * broad public commercial districts, and normalized ILS values are fixed mock
 * values—not live exchange rates or market data.
 */

import type { Feature, FeatureCollection, Point } from 'geojson'

export type LocaleCode = 'en' | 'he'
export type PurchaseCategory = 'groceries' | 'food' | 'retail' | 'travel'
export type CurrencyCode = 'ILS' | 'EUR' | 'GBP' | 'USD' | 'JPY' | 'AUD' | 'MXN' | 'ZAR'

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

export interface GlobePurchase {
  id: string
  timestamp: string
  channel: 'physical' | 'online' | 'unknown'
  resolution: 'confirmed' | 'unresolved'
  placeId: string | null
  originalAmount: number
  originalCurrency: CurrencyCode
  /** Fixed synthetic normalization for cross-currency display in this demo. */
  baseAmountIls: number
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

const text = (en: string, he: string): LocalizedText => ({ en, he })

export const globePlaces: Place[] = [
  {
    id: 'place_shuk_bograshov', merchantId: 'merchant_shuk',
    name: text('Shuk Express', 'שוק אקספרס'), branch: text('Bograshov', 'בוגרשוב'),
    city: text('Tel Aviv', 'תל אביב'), country: text('Israel', 'ישראל'),
    coordinates: [34.7735, 32.0748], category: 'groceries',
  },
  {
    id: 'place_nomi_dizengoff', merchantId: 'merchant_nomi',
    name: text('Cafe Nomi', 'קפה נומי'), branch: text('Dizengoff', 'דיזנגוף'),
    city: text('Tel Aviv', 'תל אביב'), country: text('Israel', 'ישראל'),
    coordinates: [34.7745, 32.081], category: 'food',
  },
  {
    id: 'place_rimon_park', merchantId: 'merchant_rimon',
    name: text('Rimon Market', 'רימון מרקט'), branch: text('City Park', 'פארק העיר'),
    city: text('Herzliya', 'הרצליה'), country: text('Israel', 'ישראל'),
    coordinates: [34.844, 32.163], category: 'groceries',
  },
  {
    id: 'place_lumen_soho', merchantId: 'merchant_lumen',
    name: text('Lumen Books', 'לומן ספרים'), branch: text('Soho', 'סוהו'),
    city: text('London', 'לונדון'), country: text('United Kingdom', 'בריטניה'),
    coordinates: [-0.1365, 51.5136], category: 'retail',
  },
  {
    id: 'place_morrow_brooklyn', merchantId: 'merchant_morrow',
    name: text('Morrow Coffee', 'מורו קפה'), branch: text('Brooklyn Heights', 'ברוקלין הייטס'),
    city: text('New York', 'ניו יורק'), country: text('United States', 'ארצות הברית'),
    coordinates: [-73.9936, 40.696], category: 'food',
  },
  {
    id: 'place_azulejo_baixa', merchantId: 'merchant_azulejo',
    name: text('Azulejo Pantry', 'אזולז׳ו מזווה'), branch: text('Baixa', 'באישה'),
    city: text('Lisbon', 'ליסבון'), country: text('Portugal', 'פורטוגל'),
    coordinates: [-9.1393, 38.7139], category: 'groceries',
  },
  {
    id: 'place_kumo_shibuya', merchantId: 'merchant_kumo',
    name: text('Kumo Objects', 'קומו אובייקטים'), branch: text('Shibuya', 'שיבויה'),
    city: text('Tokyo', 'טוקיו'), country: text('Japan', 'יפן'),
    coordinates: [139.7006, 35.6595], category: 'retail',
  },
  {
    id: 'place_harbour_surry', merchantId: 'merchant_harbour',
    name: text('Harbour Table', 'הרבור טייבל'), branch: text('Surry Hills', 'סארי הילס'),
    city: text('Sydney', 'סידני'), country: text('Australia', 'אוסטרליה'),
    coordinates: [151.2127, -33.8843], category: 'food',
  },
  {
    id: 'place_casa_roma', merchantId: 'merchant_casa',
    name: text('Casa Nopal', 'קאסה נופאל'), branch: text('Roma Norte', 'רומא נורטה'),
    city: text('Mexico City', 'מקסיקו סיטי'), country: text('Mexico', 'מקסיקו'),
    coordinates: [-99.1638, 19.4194], category: 'food',
  },
  {
    id: 'place_atlas_woodstock', merchantId: 'merchant_atlas',
    name: text('Atlas Supply', 'אטלס סופליי'), branch: text('Woodstock', 'וודסטוק'),
    city: text('Cape Town', 'קייפטאון'), country: text('South Africa', 'דרום אפריקה'),
    coordinates: [18.4472, -33.9285], category: 'retail',
  },
  {
    id: 'place_northline_mitte', merchantId: 'merchant_northline',
    name: text('Northline Market', 'נורת׳ליין מרקט'), branch: text('Mitte', 'מיטה'),
    city: text('Berlin', 'ברלין'), country: text('Germany', 'גרמניה'),
    coordinates: [13.405, 52.52], category: 'groceries',
  },
  {
    id: 'place_orbit_changi', merchantId: 'merchant_orbit',
    name: text('Orbit Travel', 'אורביט טרוול'), branch: text('Changi', 'צ׳אנגי'),
    city: text('Singapore', 'סינגפור'), country: text('Singapore', 'סינגפור'),
    coordinates: [103.9894, 1.3644], category: 'travel',
  },
]

interface PurchaseSeriesInput {
  prefix: string
  placeId: string
  count: number
  firstDate: string
  originalAmount: number
  originalCurrency: CurrencyCode
  baseAmountIls: number
}

function purchaseSeries(input: PurchaseSeriesInput): GlobePurchase[] {
  const first = new Date(`${input.firstDate}T12:00:00Z`)
  return Array.from({ length: input.count }, (_, index) => {
    const date = new Date(first.getTime() - index * 7 * 86_400_000)
    return {
      id: `${input.prefix}_${String(index + 1).padStart(2, '0')}`,
      timestamp: date.toISOString(),
      channel: 'physical',
      resolution: 'confirmed',
      placeId: input.placeId,
      originalAmount: input.originalAmount + (index % 3) * 4.5,
      originalCurrency: input.originalCurrency,
      baseAmountIls: input.baseAmountIls + (index % 3) * 4.5,
    }
  })
}

export const globePurchases: GlobePurchase[] = [
  ...purchaseSeries({
    prefix: 'purchase_shuk', placeId: 'place_shuk_bograshov', count: 14,
    firstDate: '2026-08-20', originalAmount: 214.4, originalCurrency: 'ILS', baseAmountIls: 214.4,
  }),
  ...purchaseSeries({
    prefix: 'purchase_nomi', placeId: 'place_nomi_dizengoff', count: 6,
    firstDate: '2026-08-18', originalAmount: 26, originalCurrency: 'ILS', baseAmountIls: 26,
  }),
  ...purchaseSeries({
    prefix: 'purchase_rimon', placeId: 'place_rimon_park', count: 2,
    firstDate: '2026-07-05', originalAmount: 88, originalCurrency: 'ILS', baseAmountIls: 88,
  }),
  ...purchaseSeries({
    prefix: 'purchase_lumen', placeId: 'place_lumen_soho', count: 3,
    firstDate: '2026-08-08', originalAmount: 32, originalCurrency: 'GBP', baseAmountIls: 145,
  }),
  ...purchaseSeries({
    prefix: 'purchase_morrow', placeId: 'place_morrow_brooklyn', count: 2,
    firstDate: '2026-07-29', originalAmount: 18, originalCurrency: 'USD', baseAmountIls: 59,
  }),
  ...purchaseSeries({
    prefix: 'purchase_azulejo', placeId: 'place_azulejo_baixa', count: 2,
    firstDate: '2026-06-22', originalAmount: 41, originalCurrency: 'EUR', baseAmountIls: 166,
  }),
  ...purchaseSeries({
    prefix: 'purchase_kumo', placeId: 'place_kumo_shibuya', count: 2,
    firstDate: '2026-05-17', originalAmount: 6800, originalCurrency: 'JPY', baseAmountIls: 153,
  }),
  ...purchaseSeries({
    prefix: 'purchase_harbour', placeId: 'place_harbour_surry', count: 2,
    firstDate: '2026-04-12', originalAmount: 54, originalCurrency: 'AUD', baseAmountIls: 119,
  }),
  ...purchaseSeries({
    prefix: 'purchase_casa', placeId: 'place_casa_roma', count: 1,
    firstDate: '2026-03-02', originalAmount: 720, originalCurrency: 'MXN', baseAmountIls: 133,
  }),
  ...purchaseSeries({
    prefix: 'purchase_atlas', placeId: 'place_atlas_woodstock', count: 1,
    firstDate: '2026-02-17', originalAmount: 890, originalCurrency: 'ZAR', baseAmountIls: 172,
  }),
  ...purchaseSeries({
    prefix: 'purchase_northline', placeId: 'place_northline_mitte', count: 2,
    firstDate: '2026-01-14', originalAmount: 67, originalCurrency: 'EUR', baseAmountIls: 271,
  }),
  ...purchaseSeries({
    prefix: 'purchase_orbit', placeId: 'place_orbit_changi', count: 2,
    firstDate: '2025-12-20', originalAmount: 84, originalCurrency: 'USD', baseAmountIls: 277,
  }),
  {
    id: 'purchase_online_01', timestamp: '2026-08-23T08:22:00Z',
    channel: 'online', resolution: 'confirmed', placeId: null,
    originalAmount: 36, originalCurrency: 'USD', baseAmountIls: 118,
  },
  {
    id: 'purchase_online_02', timestamp: '2026-07-30T18:12:00Z',
    channel: 'online', resolution: 'confirmed', placeId: null,
    originalAmount: 52, originalCurrency: 'EUR', baseAmountIls: 210,
  },
  {
    id: 'purchase_unresolved_01', timestamp: '2026-08-24T13:24:00Z',
    channel: 'unknown', resolution: 'unresolved', placeId: null,
    originalAmount: 58.9, originalCurrency: 'ILS', baseAmountIls: 58.9,
  },
]

export function buildPlaceFeatureCollection(
  places: Place[] = globePlaces,
  purchases: GlobePurchase[] = globePurchases,
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
          placePurchases.reduce((sum, purchase) => sum + purchase.baseAmountIls, 0) * 100,
        ) / 100,
        latestTimestamp: ordered[0].timestamp,
      },
    })
  }

  return { type: 'FeatureCollection', features }
}

export const placeFeatureCollection = buildPlaceFeatureCollection()

export const globeEvidence = {
  purchaseCount: globePurchases.length,
  physicalConfirmedCount: globePurchases.filter(
    (purchase) => purchase.channel === 'physical' && purchase.resolution === 'confirmed',
  ).length,
  onlineCount: globePurchases.filter((purchase) => purchase.channel === 'online').length,
  unresolvedCount: globePurchases.filter((purchase) => purchase.resolution === 'unresolved').length,
  pinCount: placeFeatureCollection.features.length,
  recurringPlacePurchaseCount: globePurchases.filter(
    (purchase) => purchase.placeId === 'place_shuk_bograshov',
  ).length,
  recurringPlacePinCount: placeFeatureCollection.features.filter(
    (feature) => feature.properties.placeId === 'place_shuk_bograshov',
  ).length,
} as const

export function placeForId(placeId: string): Place | undefined {
  return globePlaces.find((place) => place.id === placeId)
}

export function localized(value: LocalizedText, locale: LocaleCode): string {
  return value[locale]
}
