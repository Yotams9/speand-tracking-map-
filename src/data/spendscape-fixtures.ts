/**
 * Canonical synthetic data for Spendscape Phase 1.
 *
 * Everything here is invented. Merchant names are fictional, coordinates use
 * broad public commercial districts, and normalized ILS values are fixed mock
 * values—not live exchange rates or market data.
 */

import {
  buildPlaceFeatureCollection,
  syntheticFx,
  type CurrencyCode,
  type EvidenceKind,
  type GlobePurchase,
  type LocalizedText,
  type Merchant,
  type Place,
  type PurchaseEvidence,
  type PurchaseItem,
  type SmartInboxCase,
} from './spendscape-globe'

const text = (en: string, he: string): LocalizedText => ({ en, he })

export const globeMerchants: Merchant[] = [
  { id: 'merchant_shuk', name: text('Shuk Express', 'שוק אקספרס'), category: 'groceries' },
  { id: 'merchant_nomi', name: text('Cafe Nomi', 'קפה נומי'), category: 'food' },
  { id: 'merchant_rimon', name: text('Rimon Market', 'רימון מרקט'), category: 'groceries' },
  { id: 'merchant_lumen', name: text('Lumen Books', 'לומן ספרים'), category: 'retail' },
  { id: 'merchant_morrow', name: text('Morrow Coffee', 'מורו קפה'), category: 'food' },
  { id: 'merchant_azulejo', name: text('Azulejo Pantry', 'אזולז׳ו מזווה'), category: 'groceries' },
  { id: 'merchant_kumo', name: text('Kumo Objects', 'קומו אובייקטים'), category: 'retail' },
  { id: 'merchant_harbour', name: text('Harbour Table', 'הרבור טייבל'), category: 'food' },
  { id: 'merchant_casa', name: text('Casa Nopal', 'קאסה נופאל'), category: 'food' },
  { id: 'merchant_atlas', name: text('Atlas Supply', 'אטלס סופליי'), category: 'retail' },
  { id: 'merchant_northline', name: text('Northline Market', 'נורת׳ליין מרקט'), category: 'groceries' },
  { id: 'merchant_orbit', name: text('Orbit Travel', 'אורביט טרוול'), category: 'travel' },
  { id: 'merchant_serein', name: text('Serein Online', 'סריין אונליין'), category: 'retail', onlineOnly: true },
  { id: 'merchant_cloudfare', name: text('Cloudfare Travel', 'קלאודפר נסיעות'), category: 'travel', onlineOnly: true },
  { id: 'merchant_unresolved', name: text('Unresolved merchant', 'בית עסק לא פתור'), category: 'retail' },
]

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
  rateToIls: number
}


function purchaseSeries(input: PurchaseSeriesInput): GlobePurchase[] {
  const first = new Date(`${input.firstDate}T12:00:00Z`)
  const place = globePlaces.find((candidate) => candidate.id === input.placeId)
  if (!place) throw new Error(`Synthetic series references missing place: ${input.placeId}`)
  return Array.from({ length: input.count }, (_, index) => {
    const date = new Date(first.getTime() - index * 7 * 86_400_000)
    const id = `${input.prefix}_${String(index + 1).padStart(2, '0')}`
    return {
      id,
      merchantId: place.merchantId,
      timestamp: date.toISOString(),
      channel: 'physical',
      resolution: 'confirmed',
      paymentMode: 'card',
      placeId: input.placeId,
      category: place.category,
      originalAmount: input.originalAmount + (index % 3) * 4.5,
      originalCurrency: input.originalCurrency,
      fx: syntheticFx(input.originalCurrency, date.toISOString(), input.rateToIls),
      items: [],
      evidenceIds: [`evidence_${id}`],
    }
  })
}

const purchaseSeed: GlobePurchase[] = [
  ...purchaseSeries({
    prefix: 'purchase_shuk', placeId: 'place_shuk_bograshov', count: 14,
    firstDate: '2026-08-20', originalAmount: 214.4, originalCurrency: 'ILS', rateToIls: 1,
  }),
  ...purchaseSeries({
    prefix: 'purchase_nomi', placeId: 'place_nomi_dizengoff', count: 6,
    firstDate: '2026-08-18', originalAmount: 26, originalCurrency: 'ILS', rateToIls: 1,
  }),
  ...purchaseSeries({
    prefix: 'purchase_rimon', placeId: 'place_rimon_park', count: 2,
    firstDate: '2026-07-05', originalAmount: 88, originalCurrency: 'ILS', rateToIls: 1,
  }),
  ...purchaseSeries({
    prefix: 'purchase_lumen', placeId: 'place_lumen_soho', count: 3,
    firstDate: '2026-08-08', originalAmount: 32, originalCurrency: 'GBP', rateToIls: 4.5,
  }),
  ...purchaseSeries({
    prefix: 'purchase_morrow', placeId: 'place_morrow_brooklyn', count: 2,
    firstDate: '2026-07-29', originalAmount: 18, originalCurrency: 'USD', rateToIls: 3.3,
  }),
  ...purchaseSeries({
    prefix: 'purchase_azulejo', placeId: 'place_azulejo_baixa', count: 2,
    firstDate: '2026-06-22', originalAmount: 41, originalCurrency: 'EUR', rateToIls: 4.05,
  }),
  ...purchaseSeries({
    prefix: 'purchase_kumo', placeId: 'place_kumo_shibuya', count: 2,
    firstDate: '2026-05-17', originalAmount: 6800, originalCurrency: 'JPY', rateToIls: 0.0225,
  }),
  ...purchaseSeries({
    prefix: 'purchase_harbour', placeId: 'place_harbour_surry', count: 2,
    firstDate: '2026-04-12', originalAmount: 54, originalCurrency: 'AUD', rateToIls: 2.2,
  }),
  ...purchaseSeries({
    prefix: 'purchase_casa', placeId: 'place_casa_roma', count: 1,
    firstDate: '2026-03-02', originalAmount: 720, originalCurrency: 'MXN', rateToIls: 0.185,
  }),
  ...purchaseSeries({
    prefix: 'purchase_atlas', placeId: 'place_atlas_woodstock', count: 1,
    firstDate: '2026-02-17', originalAmount: 890, originalCurrency: 'ZAR', rateToIls: 0.193,
  }),
  ...purchaseSeries({
    prefix: 'purchase_northline', placeId: 'place_northline_mitte', count: 2,
    firstDate: '2026-01-14', originalAmount: 67, originalCurrency: 'EUR', rateToIls: 4.05,
  }),
  ...purchaseSeries({
    prefix: 'purchase_orbit', placeId: 'place_orbit_changi', count: 2,
    firstDate: '2025-12-20', originalAmount: 84, originalCurrency: 'USD', rateToIls: 3.3,
  }),
  {
    id: 'purchase_online_01', merchantId: 'merchant_serein', timestamp: '2026-08-23T08:22:00Z',
    channel: 'online', resolution: 'confirmed', placeId: null,
    paymentMode: 'card', category: 'retail', originalAmount: 36, originalCurrency: 'USD',
    fx: syntheticFx('USD', '2026-08-23T08:22:00Z', 3.3), items: [],
    evidenceIds: ['evidence_purchase_online_01'],
  },
  {
    id: 'purchase_online_02', merchantId: 'merchant_cloudfare', timestamp: '2026-07-30T18:12:00Z',
    channel: 'online', resolution: 'confirmed', placeId: null,
    paymentMode: 'card', category: 'travel', originalAmount: 52, originalCurrency: 'EUR',
    fx: syntheticFx('EUR', '2026-07-30T18:12:00Z', 4.05), items: [],
    evidenceIds: ['evidence_purchase_online_02'],
  },
  {
    id: 'purchase_unresolved_01', merchantId: 'merchant_unresolved', timestamp: '2026-08-24T13:24:00Z',
    channel: 'unknown', resolution: 'unresolved', placeId: null,
    paymentMode: 'manual', category: 'retail', originalAmount: 58.9, originalCurrency: 'ILS',
    fx: syntheticFx('ILS', '2026-08-24T13:24:00Z', 1), items: [],
    evidenceIds: ['evidence_purchase_unresolved_01'],
  },
]

const nestedItemsByPurchaseId: Record<string, PurchaseItem[]> = {
  purchase_shuk_01: [
    { id: 'item_shuk_bread', label: text('Olive sourdough', 'לחם מחמצת זיתים'), quantity: 2, unit: 'item', unitPrice: 18.5, lineTotal: 37 },
    { id: 'item_shuk_tomatoes', label: text('Vine tomatoes', 'עגבניות אשכול'), quantity: 1.4, unit: 'kg', unitPrice: 15, lineTotal: 21 },
    { id: 'item_shuk_tahini', label: text('Whole sesame tahini', 'טחינה משומשום מלא'), quantity: 1, unit: 'item', unitPrice: 24.9, lineTotal: 24.9 },
    { id: 'item_shuk_feta', label: text('Sheep feta', 'פטה כבשים'), quantity: 2, unit: 'item', unitPrice: 29.5, lineTotal: 59 },
    { id: 'item_shuk_fruit', label: text('Seasonal fruit', 'פירות עונתיים'), quantity: 1, unit: 'item', unitPrice: 42.5, lineTotal: 42.5 },
    { id: 'item_shuk_pantry', label: text('Pantry staples', 'מצרכי מזווה'), quantity: 1, unit: 'item', unitPrice: 30, lineTotal: 30 },
  ],
  purchase_rimon_01: [
    { id: 'item_rimon_produce', label: text('Market produce', 'תוצרת שוק'), quantity: 1, unit: 'item', unitPrice: 55, lineTotal: 55 },
    { id: 'item_rimon_bakery', label: text('Bakery selection', 'מבחר מאפים'), quantity: 1, unit: 'item', unitPrice: 33, lineTotal: 33 },
  ],
  purchase_kumo_01: [
    { id: 'item_kumo_vase', label: text('Ceramic vase', 'אגרטל קרמיקה'), quantity: 1, unit: 'item', unitPrice: 4800, lineTotal: 4800 },
    { id: 'item_kumo_cloth', label: text('Linen cloth', 'מפת פשתן'), quantity: 2, unit: 'item', unitPrice: 1000, lineTotal: 2000 },
  ],
  purchase_online_01: [
    { id: 'item_serein_notebook', label: text('Recycled notebook', 'מחברת ממוחזרת'), quantity: 1, unit: 'item', unitPrice: 24, lineTotal: 24 },
    { id: 'item_serein_pens', label: text('Ink pen set', 'ערכת עטי דיו'), quantity: 1, unit: 'item', unitPrice: 12, lineTotal: 12 },
  ],
}

export const globePurchases: GlobePurchase[] = purchaseSeed.map((purchase) => ({
  ...purchase,
  paymentMode: purchase.id === 'purchase_rimon_01' ? 'cash' : purchase.paymentMode,
  items: nestedItemsByPurchaseId[purchase.id] ?? purchase.items,
}))

/**
 * The only Phase 1 Smart Inbox case. It references the existing unresolved
 * purchase and existing canonical places; it carries no provider score,
 * location claim, or newly invented purchase fact.
 */
export const smartInboxCases: SmartInboxCase[] = [
  {
    id: 'inbox_case_unresolved_01',
    purchaseId: 'purchase_unresolved_01',
    material: true,
    question: text('Which place should own this purchase?', 'לאיזה מקום שייכת הרכישה הזו?'),
    rationale: text(
      'The manual record has an amount and date, but no confirmed merchant or place. Your choice changes place history and its single canonical pin.',
      'ברשומה הידנית יש סכום ותאריך, אך אין בית עסק או מקום מאומת. הבחירה תשנה את היסטוריית המקום ואת הסיכה הקנונית היחידה שלו.',
    ),
    candidates: [
      {
        placeId: 'place_shuk_bograshov',
        context: text('Existing place in your synthetic history', 'מקום קיים בהיסטוריה הסינתטית שלך'),
      },
      {
        placeId: 'place_nomi_dizengoff',
        context: text('Existing place in your synthetic history', 'מקום קיים בהיסטוריה הסינתטית שלך'),
      },
    ],
  },
]

function evidenceKindForPurchase(purchase: GlobePurchase): EvidenceKind {
  if (purchase.paymentMode === 'cash' || purchase.paymentMode === 'manual') return 'manual-entry'
  if (purchase.channel === 'online') return 'email-receipt'
  if (purchase.items.length > 0) return 'receipt'
  return 'card-record'
}

export const globeEvidenceRecords: PurchaseEvidence[] = globePurchases.map((purchase) => ({
  id: purchase.evidenceIds[0],
  purchaseId: purchase.id,
  kind: evidenceKindForPurchase(purchase),
  observedAt: purchase.timestamp,
  label: text(
    evidenceKindForPurchase(purchase).replaceAll('-', ' '),
    evidenceKindForPurchase(purchase) === 'manual-entry' ? 'הזנה ידנית' :
      evidenceKindForPurchase(purchase) === 'email-receipt' ? 'קבלה בדוא״ל' :
        evidenceKindForPurchase(purchase) === 'receipt' ? 'קבלה סינתטית' : 'רשומת כרטיס סינתטית',
  ),
  synthetic: true,
}))

export const placeFeatureCollection = buildPlaceFeatureCollection(globePlaces, globePurchases)

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

export const canonicalSpendscapeData = {
  fixtureKind: 'synthetic' as const,
  fixtureVersion: 'phase-1d4-v1',
  profile: {
    id: 'profile_demo',
    name: text('Demo explorer', 'משתמש הדגמה'),
    baseCurrency: 'ILS' as const,
    timezone: 'Asia/Jerusalem',
  },
  merchants: globeMerchants,
  places: globePlaces,
  purchases: globePurchases,
  evidence: globeEvidenceRecords,
  smartInboxCases,
}
