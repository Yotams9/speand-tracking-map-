/**
 * Canonical domain types for the Phase 1 concept demo.
 *
 * All data described by these types is SYNTHETIC. Nothing here is derived from
 * a real person, account, receipt, bank feed, or price source.
 */

export type CategoryId =
  | 'groceries'
  | 'food'
  | 'shopping'
  | 'fuel'
  | 'pharmacy'
  | 'other'

/** A localized string. English is the default UI language; Hebrew is optional. */
export interface Localized {
  en: string
  he: string
}

export interface Cluster {
  id: string
  name: Localized
  /** [longitude, latitude] */
  center: [number, number]
}

export interface Merchant {
  id: string
  name: Localized
  /** Branch qualifier, e.g. "Almog Mall". Empty when the merchant has one site. */
  branch: Localized | null
  category: CategoryId
  clusterId: string
  /** [longitude, latitude] of the storefront. Public commercial locations only. */
  coord: [number, number]
  /** Street line shown in detail views. */
  address: Localized
}

/**
 * Products carry an `equivalenceGroup`. Two products may be substituted for one
 * another in a basket comparison ONLY when their groups match.
 *
 * This is the mechanism that keeps regular cola and zero-sugar cola apart: they
 * are both cola, both 1.5L, and both from the same shelf, but they sit in
 * different groups and therefore never substitute.
 */
export interface Product {
  id: string
  name: Localized
  /** Display unit, e.g. "1 L", "12 pcs". */
  unit: Localized
  category: CategoryId
  equivalenceGroup: string
}

/** Price of one unit of a product at one merchant, in ILS. */
export type PriceTable = Record<string, Record<string, number>>

export interface BasketEntry {
  productId: string
  qty: number
}

export type CaptureSource =
  | 'receipt_photo'
  | 'product_photo'
  | 'barcode'
  | 'digital_receipt'
  | 'quick_add'
  | 'card_feed'

/**
 * How confidently this purchase is attached to a merchant.
 *
 * `confirmed`   — resolved automatically from strong evidence, or by the user.
 * `ambiguous`   — several merchants are plausible and the answer changes an
 *                 outcome, so it is worth one Smart Inbox question.
 * `unresolved`  — too little evidence; left alone rather than guessed.
 */
export type MatchState = 'confirmed' | 'ambiguous' | 'unresolved'

export interface Purchase {
  id: string
  /** Null while a purchase is still ambiguous. */
  merchantId: string | null
  /** ISO 8601 local timestamp. */
  timestamp: string
  captureSource: CaptureSource
  matchState: MatchState
  /** Itemized purchases derive their total from these entries. */
  items: BasketEntry[]
  /**
   * Card-feed purchases arrive as an amount with no line items. When set, this
   * IS the total and `items` must be empty.
   */
  flatTotal?: number
  /** Loyalty or promotional reduction applied at the register. */
  discount?: number
  /** Refundable container deposit added at the register. */
  deposit?: number
  /** Free-text merchant string as it appeared on the card feed, when relevant. */
  rawMerchantString?: string
}

export interface AmbiguityCase {
  id: string
  purchaseId: string
  /** Candidate merchants, most plausible first. Never fewer than two. */
  candidateMerchantIds: string[]
  /** Where the evidence places the purchase, in plain language. */
  areaLabel: Localized
  /**
   * Why the system is asking. Shown in one short line — never a score, never
   * pipeline vocabulary.
   */
  reason: Localized
}

/**
 * A route leg. Distance and duration are STORED MOCK ESTIMATES: Phase 1 has no
 * routing engine, and an LLM must never be the source of a distance or a
 * travel time. See `derive.ts` for which values are computed and which are not.
 */
export interface RouteLeg {
  distanceKm: number
  durationMin: number
  /** Ordered [lon, lat] points used only to draw a legible schematic line. */
  path: [number, number][]
}

export interface RouteComparison {
  id: string
  /** Where the user starts from. A public landmark, never a residence. */
  originLabel: Localized
  originCoord: [number, number]
  currentMerchantId: string
  alternativeMerchantId: string
  currentLeg: RouteLeg
  alternativeLeg: RouteLeg
  /** ILS per trip of additional transport, a stored estimate. */
  transportCostPerTrip: number
  /** Basket the comparison is priced against. */
  basket: BasketEntry[]
  /**
   * Substitutions the comparison relies on, plus the ones it refused. Both are
   * shown to the user: the refusals are what make the recommendation credible.
   */
  substitutions: Substitution[]
}

export interface Substitution {
  fromProductId: string
  toProductId: string
  accepted: boolean
  reason: Localized
}

export type RecommendationKind =
  | 'recurring_saving'
  | 'habit'
  | 'proactive'
  | 'category_trend'
  | 'likely_needed'

export interface Recommendation {
  id: string
  kind: RecommendationKind
  /** Comparison backing a savings recommendation, when there is one. */
  routeComparisonId?: string
  merchantId?: string
  /** Predicted basket for proactive recommendations. */
  predictedBasket?: BasketEntry[]
  /** Weekday index (0 = Sunday) a proactive prediction points at. */
  predictedWeekday?: number
  predictedTimeLabel?: Localized
}

export interface UserProfile {
  /** Fictional. */
  displayName: Localized
  homeAreaLabel: Localized
  currency: 'ILS'
  locale: 'en-IL' | 'he-IL'
}

/** Abstract basemap geometry, in [lon, lat]. Hand-authored, not surveyed. */
export interface BaseMapGeometry {
  sea: [number, number][]
  coast: [number, number][]
  river: [number, number][]
  parks: [number, number][][]
  arterials: [number, number][][]
}

export interface Fixtures {
  synthetic: true
  generatedFor: 'phase-1-concept-demo'
  /** Fixed "today" so relative labels never drift as real time passes. */
  demoToday: string
  user: UserProfile
  clusters: Cluster[]
  merchants: Merchant[]
  products: Product[]
  prices: PriceTable
  purchases: Purchase[]
  ambiguityCases: AmbiguityCase[]
  routeComparisons: RouteComparison[]
  recommendations: Recommendation[]
  basemap: BaseMapGeometry
}
