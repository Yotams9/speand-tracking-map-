'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import dynamic from 'next/dynamic'
import * as maplibregl from 'maplibre-gl'
import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
  StyleSpecification,
} from 'maplibre-gl'
import type { Point } from 'geojson'
import { derivePurchaseAnalytics } from '@/data/spendscape-analytics'
import {
  availableTimelineMonths,
  baseAmountIlsForPurchase,
  buildPlaceFeatureCollection,
  defaultPurchaseQuery,
  deriveCanonicalSearchResults,
  derivedPurchaseSummary,
  filterPurchases,
  globeEvidenceRecords,
  globePlaces,
  globePurchases,
  localized,
  merchantForId,
  placeFeatureCollection,
  placeForId,
  purchasesForPlace,
  smartInboxCases,
  synchronizeSelection,
  type CategoryFilter,
  type CanonicalSearchResult,
  type ChannelFilter,
  type CurrencyCode,
  type CurrencyFilter,
  type DateRangeFilter,
  type LocaleCode,
  type PlaceFeatureProperties,
  type PurchaseQuery,
  type SmartInboxCase,
} from '@/data/spendscape-globe'
import {
  combineSessionPurchases,
  type CaptureStep,
  type SessionCaptureRecord,
} from '@/features/capture/capture-domain'
import {
  applySmartInboxDecisions,
  caseForPurchase,
  decisionForCase,
  pendingSmartInboxCases,
  removeSmartInboxDecision,
  upsertSmartInboxDecision,
  type SmartInboxDecision,
} from '@/features/inbox/smart-inbox-domain'
import {
  isAllowedAskActionPlan,
  type AnalyticsView,
  type AskContext,
} from '@/features/ask/ask-spendscape-domain'
import { SpendscapeAnalytics } from './SpendscapeAnalytics'
import {
  buildDevelopmentGlobeStyle,
  HEATMAP_COLOR_EXPRESSION,
  HEATMAP_INTENSITY_EXPRESSION,
  HEATMAP_OPACITY,
  HEATMAP_RADIUS_EXPRESSION,
  HEATMAP_WEIGHT_EXPRESSION,
  OPENFREEMAP_LIBERTY_STYLE_URL,
  PIN_GLOW_RADIUS_EXPRESSION,
  PIN_HOVER_RADIUS_EXPRESSION,
  PIN_SELECTION_GLOW_RADIUS_EXPRESSION,
  PIN_SELECTION_HALO_RADIUS_EXPRESSION,
  PIN_SHADOW_RADIUS_EXPRESSION,
  PIN_STROKE_WIDTH_EXPRESSION,
  RTL_TEXT_PLUGIN_URL,
  SPENDSCAPE_BLUE,
  SPENDSCAPE_BLUE_BRIGHT,
  SPENDSCAPE_BLUE_DEEP,
} from './globe-map-config'
import styles from './SpendscapeGlobe.module.css'

const CaptureExperience = dynamic(
  () => import('@/features/capture/CaptureExperience').then((module) => module.CaptureExperience),
  {
    ssr: false,
    loading: () => (
      <div className={styles.featureLoading} role="status" data-testid="capture-chunk-loading">
        <span className={styles.featureLoadingMark} aria-hidden="true" />
        <p><span lang="en">Opening Capture…</span><span lang="he">פותח את Capture…</span></p>
      </div>
    ),
  },
)

const SmartInboxExperience = dynamic(
  () => import('@/features/inbox/SmartInboxExperience').then((module) => module.SmartInboxExperience),
  {
    ssr: false,
    loading: () => (
      <div className={styles.featureLoading} role="status" data-testid="inbox-chunk-loading">
        <span className={styles.featureLoadingMark} aria-hidden="true" />
        <p><span lang="en">Opening Smart Inbox…</span><span lang="he">פותח את תיבת העזרה…</span></p>
      </div>
    ),
  },
)

const AskSpendscapeExperience = dynamic(
  () => import('@/features/ask/AskSpendscapeExperience').then((module) => module.AskSpendscapeExperience),
  {
    ssr: false,
    loading: () => (
      <div className={styles.featureLoading} role="status" data-testid="ask-chunk-loading">
        <span className={styles.featureLoadingMark} aria-hidden="true" />
        <p><span lang="en">Opening Ask Spendscape…</span><span lang="he">פותח את שאלו את Spendscape…</span></p>
      </div>
    ),
  },
)

const SOURCE_ID = 'spendscape-places'
const HEAT_LAYER = 'spendscape-heat'
const CLUSTER_GLOW_LAYER = 'spendscape-cluster-glow'
const CLUSTER_LAYER = 'spendscape-clusters'
const CLUSTER_COUNT_LAYER = 'spendscape-cluster-count'
const PIN_GLOW_LAYER = 'spendscape-pin-glow'
const PIN_SHADOW_LAYER = 'spendscape-pin-shadow'
const HALO_LAYER = 'spendscape-selected-halo'
const SELECTION_GLOW_LAYER = 'spendscape-selected-glow'
const PIN_LAYER = 'spendscape-place-pins'
const LABEL_LAYER = 'spendscape-place-labels'
const CAMERA_STORAGE_KEY = 'spendscape.phase1.globe-camera'
const LIBERTY_STYLE_TIMEOUT_MS = 12_000
const RTL_PLUGIN_TIMEOUT_MS = 8_000
const MAP_READY_TIMEOUT_MS = 18_000
const QA_TIMEOUT_MS = 700

const SPENDSCAPE_TOP_LAYER_ORDER = [
  HEAT_LAYER,
  CLUSTER_GLOW_LAYER,
  PIN_GLOW_LAYER,
  SELECTION_GLOW_LAYER,
  PIN_SHADOW_LAYER,
  CLUSTER_LAYER,
  PIN_LAYER,
  HALO_LAYER,
  CLUSTER_COUNT_LAYER,
  LABEL_LAYER,
] as const

const PIN_MODE_LAYERS = [
  CLUSTER_GLOW_LAYER,
  CLUSTER_LAYER,
  CLUSTER_COUNT_LAYER,
  PIN_GLOW_LAYER,
  PIN_SHADOW_LAYER,
  SELECTION_GLOW_LAYER,
  HALO_LAYER,
  PIN_LAYER,
  LABEL_LAYER,
] as const

type MapMode = 'pins' | 'heatmap'
type ProductSurface = 'globe' | 'purchases' | 'stats'

interface CameraSnapshot {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

interface PerformanceEvidence {
  samples: number
  medianFrameMs: number
  p95FrameMs: number
  loadMs: number | null
  lastCameraAction: string | null
  lastCameraMs: number | null
}

type InitializationStage = 'idle' | 'resources' | 'constructing' | 'map-ready' | 'failed'

interface InitializationEvidence {
  attempt: number
  stage: InitializationStage
  styleFetchMs: number | null
  rtlPluginMs: number | null
  mapConstructedMs: number | null
  mapReadyMs: number | null
  failureStage: 'style' | 'rtl' | 'map-ready' | 'map' | null
  styleTimeoutMs: number
  rtlTimeoutMs: number
  mapReadyTimeoutMs: number
}

interface InputEvidence {
  scrollZoomEnabled: boolean
  cooperativeGesturesEnabled: boolean
  rtlPluginStatus: string
  wheelEvents: number
  smallDeltaWheelEvents: number
  lastWheelDeltaY: number | null
  lastWheelClientPoint: [number, number] | null
}

interface RenderedBasemapLabel {
  name: string | null
  nameLatin: string | null
  nameNonLatin: string | null
  nameEnglish: string | null
  sourceLayer: string | null
}

interface LayerOrderEvidence {
  firstLibertySymbol: { id: string; index: number } | null
  building: number | null
  building3d: number | null
  heatmap: number | null
  clusterGlow: number | null
  cluster: number | null
  clusterCount: number | null
  pinGlow: number | null
  pinShadow: number | null
  pin: number | null
  selectionGlow: number | null
  selectionHalo: number | null
  label: number | null
}

interface NavigationSnapshot {
  marker: 'spendscape-1d1'
  surface: ProductSurface
  selectedPlaceId: string | null
  selectedPurchaseId: string | null
  captureStep?: CaptureStep | null
  captureDepth?: number
  inboxCaseId?: string | null
  askOpen?: boolean
}

interface AskUndoSnapshot {
  navigation: NavigationSnapshot
  query: PurchaseQuery
  mode: MapMode
  analyticsView: AnalyticsView | null
  camera: CameraSnapshot | null
}

interface AskExecutionFeedback {
  summary: string
  undone: boolean
}

interface DesktopPanelBounds {
  top: number
  maxHeight: number
}

interface StoredExperienceState extends NavigationSnapshot {
  locale: LocaleCode
  query: PurchaseQuery
  mode: MapMode
}

interface QaEvidence {
  ready: boolean
  locale: LocaleCode
  reducedMotion: boolean
  autoSpin: boolean
  mode: MapMode
  surface: ProductSurface
  query: PurchaseQuery
  selectedPlaceId: string | null
  selectedPurchaseId: string | null
  captureOpen: boolean
  captureStep: CaptureStep | null
  inboxOpen: boolean
  inboxCaseId: string | null
  pendingInboxCount: number
  inboxDecisionStatus: SmartInboxDecision['status'] | null
  inboxResolvedPlaceId: string | null
  askOpen: boolean
  askUndoAvailable: boolean
  askLastSummary: string | null
  sessionPurchaseCount: number
  combinedPurchaseCount: number
  mapInstanceCount: number
  mapConstructionCount: number
  initialization: InitializationEvidence
  visiblePurchaseCount: number
  visibleBaseTotalIls: number
  visiblePinFeatures: number
  canonicalPins: number
  physicalPurchases: number
  onlineExcluded: number
  unresolvedExcluded: number
  recurringPlacePurchases: number
  recurringPlacePins: number
  sourcePresent: boolean
  sourceLoaded: boolean
  canonicalGeoJsonFeatures: number
  sourceDatasetFeatures: number
  sourceUpdates: number
  rendererQueryFeatures: number
  rendererQueryClusters: number
  rendererQueryPlaces: number
  rendererQueryUniquePlaces: number
  rendererRepresentedPlaces: number
  renderedClusters: number
  renderedPins: number
  renderedSelectionHalos: number
  renderedHeatFeatures: number
  renderedPlaceLabels: number
  camera: CameraSnapshot | null
  performance: PerformanceEvidence
  input: InputEvidence
  mapStyle: {
    name: string | null
    sourceUrl: string
    projection: string | null
    pinColor: string | null
    clusterColor: unknown
    heatmapColor: unknown
    layerOrder: LayerOrderEvidence | null
    pinOpacity: unknown
    pinStrokeColor: unknown
    pinRadius: unknown
    pinStrokeWidth: unknown
    pinPitchAlignment: unknown
    pinPitchScale: unknown
    selectionGlowOpacity: unknown
    selectionHaloColor: unknown
    selectionHaloStroke: unknown
    heatmapWeight: unknown
    heatmapIntensity: unknown
    heatmapRadius: unknown
    heatmapOpacity: unknown
    pinVisibility: unknown
    heatmapVisibility: unknown
    layerVisibility: Record<string, unknown>
  }
  analytics: {
    purchaseCount: number
    totalBaseAmountIls: number
    averageBaseAmountIls: number
    physicalCount: number
    onlineCount: number
    unresolvedCount: number
    monthCount: number
    topPhysicalPlaceId: string | null
  }
}

interface QaActions {
  firstRenderedPoint: (layerId: 'cluster' | 'pin') => [number, number] | null
  jumpTo: (center: [number, number], zoom: number, pitch?: number) => void
  unproject: (point: [number, number]) => [number, number]
  renderedPlaceIdsAt: (placeId: string) => string[]
  renderedBasemapLabels: () => RenderedBasemapLabel[]
}

declare global {
  interface Window {
    __SPENDSCAPE_QA__?: QaEvidence
    __SPENDSCAPE_QA_ACTIONS__?: QaActions
  }
}

let rtlTextPluginPromise: Promise<void> | null = null

class InitializationError extends Error {
  constructor(
    readonly stage: 'style' | 'rtl' | 'map-ready' | 'map',
    message: string,
  ) {
    super(message)
    this.name = 'InitializationError'
  }
}

function abortableTimeout<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
  stage: InitializationError['stage'],
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      callback()
    }
    const abort = () => finish(() => reject(new DOMException('Initialization aborted', 'AbortError')))
    const timeout = window.setTimeout(() => {
      finish(() => reject(new InitializationError(stage, `${label} timed out after ${timeoutMs}ms`)))
    }, timeoutMs)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      abort()
      return
    }
    promise.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    )
  })
}

function abortableDelay(durationMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, durationMs)
    const abort = () => {
      window.clearTimeout(timeout)
      reject(new DOMException('Initialization aborted', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

async function ensureRtlTextPlugin(): Promise<void> {
  const status = maplibregl.getRTLTextPluginStatus()
  if (status === 'loaded') return
  if (rtlTextPluginPromise) return rtlTextPluginPromise

  if (status === 'unavailable') {
    rtlTextPluginPromise = maplibregl.setRTLTextPlugin(RTL_TEXT_PLUGIN_URL, false)
      .catch((error: unknown) => {
        rtlTextPluginPromise = null
        throw error
      })
    return rtlTextPluginPromise
  }

  rtlTextPluginPromise = new Promise<void>((resolve, reject) => {
    const started = performance.now()
    const waitForExistingLoad = () => {
      const current = maplibregl.getRTLTextPluginStatus()
      if (current === 'loaded') {
        resolve()
        return
      }
      if (current === 'error' || performance.now() - started > 5_000) {
        reject(new Error(`RTL text plugin did not load (status: ${current})`))
        return
      }
      window.setTimeout(waitForExistingLoad, 25)
    }
    waitForExistingLoad()
  }).catch((error: unknown) => {
    rtlTextPluginPromise = null
    throw error
  })
  return rtlTextPluginPromise
}

const copy = {
  en: {
    product: 'Spendscape', checkpoint: 'Globe checkpoint', navGlobe: 'Globe',
    navAnalytics: 'Analytics', navPurchases: 'Purchases',
    addPurchase: 'Add purchase', capture: 'Capture',
    inbox: 'Inbox', openInbox: 'Open Smart Inbox', reviewMatch: 'Review match',
    headline: 'Your world, in purchases.',
    intro: 'Every confirmed place becomes one point in a living history.',
    search: 'Search places or cities', searchPlaceholder: 'Search your places or cities',
    searchScope: 'Your synthetic purchase history', searchPlace: 'Place', searchCity: 'City',
    searchPurchase: 'Purchase', noSearchResults: 'No places or cities found in your purchases.',
    physicalPurchaseMatches: 'physical purchases', all: 'All', groceries: 'Groceries', food: 'Food',
    retail: 'Retail', travel: 'Travel', pins: 'Pins', heatmap: 'Heatmap',
    fit: 'Fit purchases', latest: 'Fly to latest', reset: 'Reset globe',
    resume: 'Resume orbit', pause: 'Pause orbit', jump: 'Jump to a place',
    choosePlace: 'Choose a place', visits: 'visits', normalized: 'Illustrative base spend',
    latestVisit: 'Latest visit', close: 'Close place details', loading: 'Awakening your globe',
    loadingBody: 'The globe is loading. Purchases, Capture, and Stats are ready.',
    noPlaces: 'No places match this view', noPlacesBody: 'Clear the search or choose another category.',
    clear: 'Clear filters', mapFailed: 'The globe could not load',
    mapFailedBody: 'Your synthetic purchase history is safe. Retry the development map style.',
    retry: 'Retry map', synthetic: 'Synthetic data', confirmed: 'confirmed physical purchases',
    canonical: 'canonical place pins', online: 'online kept off-map',
    unresolved: 'unresolved kept off-map', keyboard: 'Keyboard: focus the globe, then use arrows and + / −.',
    orbiting: 'Globe rotating until first interaction', interrupted: 'Interaction owns the camera',
    ready: 'Globe ready', modePins: 'Canonical pins visible', modeHeat: 'Purchase density visible',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', language: 'Switch to Hebrew',
    mobileStats: 'Stats', tools: 'Globe tools',
    closeTools: 'Close globe tools', placesSummary: 'places', purchasesSummary: 'confirmed purchases',
    history: 'Purchase history', historyIntro: 'One synthetic record across every channel and currency.',
    filters: 'Filters', timeline: 'Timeline', allHistory: 'All history', results: 'results',
    total: 'Illustrative base total', average: 'Average', currencies: 'currencies',
    category: 'Category', currency: 'Currency', channel: 'Channel', dateRange: 'Date range',
    physical: 'Physical', onlineOnly: 'Online', cashManual: 'Cash / manual', unresolvedOnly: 'Unresolved',
    last30: 'Last 30 days', last90: 'Last 90 days', thisYear: 'Past year',
    resetQuery: 'Reset query', closeHistory: 'Close purchase history', closeFilters: 'Close filters', closeTimeline: 'Close timeline',
    purchaseDetail: 'Purchase detail', placeDetail: 'Place detail', receiptItems: 'Receipt items',
    noReceiptItems: 'No nested receipt lines for this record.', sourceEvidence: 'Evidence',
    originalAmount: 'Original amount', baseAmount: 'Illustrative ILS conversion', fxProvenance: 'Conversion provenance',
    cash: 'Cash', card: 'Card', manual: 'Manual', confirmedStatus: 'Confirmed', unresolvedStatus: 'Unresolved',
    openPurchase: 'Open purchase', backToHistory: 'Back to history', viewPlace: 'View place',
    selectedMonth: 'Selected month', clearTimeline: 'Clear timeline', showTimeline: 'Open timeline',
    noPurchases: 'No purchases match this view', noPurchasesBody: 'Adjust the shared search, filters, or timeline.',
    reloadNote: 'Shared view saved for this session', onlineNoPin: 'Online · no map pin',
    unresolvedNoPin: 'Unresolved · no map pin', manualEntry: 'Manual cash record',
  },
  he: {
    product: 'Spendscape', checkpoint: 'נקודת ביקורת גלובוס', navGlobe: 'גלובוס',
    navAnalytics: 'ניתוחים', navPurchases: 'רכישות',
    addPurchase: 'הוספת רכישה', capture: 'קליטה',
    inbox: 'תיבת עזרה', openInbox: 'פתיחת תיבת העזרה', reviewMatch: 'בדיקת התאמה',
    headline: 'עולם הרכישות שלך.',
    intro: 'כל מקום מאומת הופך לנקודה אחת בהיסטוריה חיה.',
    search: 'חיפוש מקומות או ערים', searchPlaceholder: 'חיפוש במקומות או בערים שלך',
    searchScope: 'היסטוריית הרכישות הסינתטית שלך', searchPlace: 'מקום', searchCity: 'עיר',
    searchPurchase: 'רכישה', noSearchResults: 'לא נמצאו מקומות או ערים ברכישות שלך.',
    physicalPurchaseMatches: 'רכישות פיזיות', all: 'הכול', groceries: 'מכולת', food: 'אוכל',
    retail: 'קמעונאות', travel: 'נסיעות', pins: 'סיכות', heatmap: 'מפת חום',
    fit: 'התאם לרכישות', latest: 'טוס למקום האחרון', reset: 'אפס גלובוס',
    resume: 'המשך סיבוב', pause: 'עצור סיבוב', jump: 'עבור למקום',
    choosePlace: 'בחר מקום', visits: 'ביקורים', normalized: 'הוצאה בסיסית להמחשה',
    latestVisit: 'ביקור אחרון', close: 'סגירת פרטי מקום', loading: 'מעירים את הגלובוס',
    loadingBody: 'הגלובוס נטען. רכישות, Capture ונתונים כבר זמינים.',
    noPlaces: 'אין מקומות התואמים לתצוגה', noPlacesBody: 'נקה את החיפוש או בחר קטגוריה אחרת.',
    clear: 'נקה מסננים', mapFailed: 'לא ניתן לטעון את הגלובוס',
    mapFailedBody: 'היסטוריית ההדגמה בטוחה. אפשר לנסות שוב את סגנון מפת הפיתוח.',
    retry: 'נסה שוב', synthetic: 'נתונים סינתטיים', confirmed: 'רכישות פיזיות מאומתות',
    canonical: 'סיכות מקום קנוניות', online: 'אונליין נשאר מחוץ למפה',
    unresolved: 'לא פתור נשאר מחוץ למפה', keyboard: 'מקלדת: התמקד בגלובוס והשתמש בחצים וב־+ / −.',
    orbiting: 'הגלובוס מסתובב עד לאינטראקציה הראשונה', interrupted: 'האינטראקציה שולטת במצלמה',
    ready: 'הגלובוס מוכן', modePins: 'סיכות קנוניות מוצגות', modeHeat: 'צפיפות רכישות מוצגת',
    zoomIn: 'התקרב', zoomOut: 'התרחק', language: 'מעבר לאנגלית',
    mobileStats: 'נתונים', tools: 'כלי גלובוס',
    closeTools: 'סגירת כלי גלובוס', placesSummary: 'מקומות', purchasesSummary: 'רכישות מאומתות',
    history: 'היסטוריית רכישות', historyIntro: 'רשומה סינתטית אחת לכל ערוץ ומטבע.',
    filters: 'מסננים', timeline: 'ציר זמן', allHistory: 'כל ההיסטוריה', results: 'תוצאות',
    total: 'סכום בסיס להמחשה', average: 'ממוצע', currencies: 'מטבעות',
    category: 'קטגוריה', currency: 'מטבע', channel: 'ערוץ', dateRange: 'טווח תאריכים',
    physical: 'פיזי', onlineOnly: 'אונליין', cashManual: 'מזומן / ידני', unresolvedOnly: 'לא פתור',
    last30: '30 ימים אחרונים', last90: '90 ימים אחרונים', thisYear: 'שנה אחרונה',
    resetQuery: 'איפוס שאילתה', closeHistory: 'סגירת היסטוריית רכישות', closeFilters: 'סגירת מסננים', closeTimeline: 'סגירת ציר הזמן',
    purchaseDetail: 'פרטי רכישה', placeDetail: 'פרטי מקום', receiptItems: 'פריטי קבלה',
    noReceiptItems: 'לרשומה זו אין שורות קבלה מקוננות.', sourceEvidence: 'ראיות',
    originalAmount: 'סכום מקורי', baseAmount: 'המרת ש״ח להמחשה', fxProvenance: 'מקור ההמרה',
    cash: 'מזומן', card: 'כרטיס', manual: 'ידני', confirmedStatus: 'מאומת', unresolvedStatus: 'לא פתור',
    openPurchase: 'פתיחת רכישה', backToHistory: 'חזרה להיסטוריה', viewPlace: 'הצגת מקום',
    selectedMonth: 'חודש נבחר', clearTimeline: 'ניקוי ציר הזמן', showTimeline: 'פתיחת ציר הזמן',
    noPurchases: 'אין רכישות התואמות לתצוגה', noPurchasesBody: 'אפשר לשנות חיפוש, מסננים או ציר זמן משותפים.',
    reloadNote: 'התצוגה המשותפת נשמרה להפעלה זו', onlineNoPin: 'אונליין · ללא סיכה',
    unresolvedNoPin: 'לא פתור · ללא סיכה', manualEntry: 'רשומת מזומן ידנית',
  },
} as const

const categoryLabels: Record<CategoryFilter, keyof typeof copy.en> = {
  all: 'all', groceries: 'groceries', food: 'food', retail: 'retail', travel: 'travel',
}

const channelLabels: Record<ChannelFilter, keyof typeof copy.en> = {
  all: 'all', physical: 'physical', online: 'onlineOnly',
  'cash-manual': 'cashManual', unresolved: 'unresolvedOnly',
}

const dateRangeLabels: Record<DateRangeFilter, keyof typeof copy.en> = {
  all: 'allHistory', '30d': 'last30', '90d': 'last90', year: 'thisYear',
}

const currencyOptions: CurrencyFilter[] = [
  'all', 'ILS', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'MXN', 'ZAR',
]

const EXPERIENCE_STORAGE_KEY = 'spendscape.phase1d1.experience-state'

function homeCamera(): CameraSnapshot {
  const compact = window.innerWidth <= 760
  return {
    center: compact ? [12, 18] : [18, 13],
    zoom: compact ? 1.25 : 2.04,
    bearing: 0,
    pitch: 0,
  }
}

function getStoredCamera(): CameraSnapshot {
  const fallback = homeCamera()
  try {
    const stored = window.sessionStorage.getItem(CAMERA_STORAGE_KEY)
    if (!stored) return fallback
    const parsed = JSON.parse(stored) as Partial<CameraSnapshot>
    if (!Array.isArray(parsed.center) || parsed.center.length !== 2) return fallback
    return {
      center: [Number(parsed.center[0]), Number(parsed.center[1])],
      zoom: Number(parsed.zoom ?? fallback.zoom),
      bearing: Number(parsed.bearing ?? 0),
      pitch: Number(parsed.pitch ?? 0),
    }
  } catch {
    return fallback
  }
}

function snapshotCamera(map: MapLibreMap): CameraSnapshot {
  const center = map.getCenter()
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
  }
}

function captureLayerOrder(map: MapLibreMap): LayerOrderEvidence {
  const layers = map.getStyle().layers ?? []
  const indexOf = (id: string) => {
    const index = layers.findIndex((layer) => layer.id === id)
    return index >= 0 ? index : null
  }
  const firstLibertySymbolIndex = layers.findIndex((layer) => (
    layer.type === 'symbol' && 'source' in layer && layer.source !== SOURCE_ID
  ))

  return {
    firstLibertySymbol: firstLibertySymbolIndex >= 0
      ? { id: layers[firstLibertySymbolIndex].id, index: firstLibertySymbolIndex }
      : null,
    building: indexOf('building'),
    building3d: indexOf('building-3d'),
    heatmap: indexOf(HEAT_LAYER),
    clusterGlow: indexOf(CLUSTER_GLOW_LAYER),
    cluster: indexOf(CLUSTER_LAYER),
    clusterCount: indexOf(CLUSTER_COUNT_LAYER),
    pinGlow: indexOf(PIN_GLOW_LAYER),
    pinShadow: indexOf(PIN_SHADOW_LAYER),
    pin: indexOf(PIN_LAYER),
    selectionGlow: indexOf(SELECTION_GLOW_LAYER),
    selectionHalo: indexOf(HALO_LAYER),
    label: indexOf(LABEL_LAYER),
  }
}

function ensureSpendscapeTopLayerOrder(map: MapLibreMap): void {
  for (const layerId of SPENDSCAPE_TOP_LAYER_ORDER) {
    if (map.getLayer(layerId)) map.moveLayer(layerId)
  }
}

function applyGlobeMode(map: MapLibreMap, mode: MapMode): void {
  ensureSpendscapeTopLayerOrder(map)
  const pinVisibility = mode === 'pins' ? 'visible' : 'none'
  for (const layerId of PIN_MODE_LAYERS) {
    if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', pinVisibility)
  }
  if (map.getLayer(HEAT_LAYER)) {
    map.setLayoutProperty(HEAT_LAYER, 'visibility', mode === 'heatmap' ? 'visible' : 'none')
  }
}

function placeLabelExpression(locale: LocaleCode): ExpressionSpecification {
  return [
    'format',
    ['get', locale === 'he' ? 'nameHe' : 'nameEn'], { 'font-scale': 1 },
    '\n', {},
    [
      'concat',
      ['number-format', ['to-number', ['get', 'totalBaseAmountIls'], 0], {
        currency: 'ILS',
        'max-fraction-digits': 0,
        'min-fraction-digits': 0,
      }],
      ' · ',
      ['to-string', ['to-number', ['get', 'visitCount'], 0]],
      locale === 'he' ? ' ביקורים' : ' visits',
    ], { 'font-scale': 0.82 },
  ]
}

async function fetchDevelopmentStyle(
  parentSignal: AbortSignal,
  timeoutMs: number,
  simulateStall = false,
): Promise<StyleSpecification> {
  const controller = new AbortController()
  let timedOut = false
  const abortFromParent = () => controller.abort()
  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  parentSignal.addEventListener('abort', abortFromParent, { once: true })
  if (parentSignal.aborted) controller.abort()

  try {
    if (simulateStall) {
      await new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new DOMException('Style fetch aborted', 'AbortError')), { once: true })
      })
    }
    const response = await fetch(OPENFREEMAP_LIBERTY_STYLE_URL, { signal: controller.signal })
    if (!response.ok) throw new InitializationError('style', `Development map style returned ${response.status}`)
    const providerStyle = await response.json() as StyleSpecification
    return buildDevelopmentGlobeStyle(providerStyle)
  } catch (error) {
    if (timedOut) {
      throw new InitializationError('style', `Liberty style timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    parentSignal.removeEventListener('abort', abortFromParent)
  }
}

function percentile(values: number[], value: number): number {
  if (values.length === 0) return 0
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * value))]
}

function formatMoney(amount: number, locale: LocaleCode, currency: CurrencyCode = 'ILS'): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)
}

function formatDate(timestamp: string, locale: LocaleCode): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(timestamp))
}

function formatMonth(month: string, locale: LocaleCode): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`))
}

function navigationHash(snapshot: NavigationSnapshot): string {
  if (snapshot.captureStep) return '#capture'
  if (snapshot.inboxCaseId) return `#inbox/${snapshot.inboxCaseId}`
  if (snapshot.askOpen) return '#ask'
  if (snapshot.selectedPurchaseId) return `#purchase/${snapshot.selectedPurchaseId}`
  if (snapshot.selectedPlaceId) return `#place/${snapshot.selectedPlaceId}`
  if (snapshot.surface === 'purchases') return '#purchases'
  if (snapshot.surface === 'stats') return '#stats'
  return '#globe'
}

function isNavigationSnapshot(value: unknown): value is NavigationSnapshot {
  if (!value || typeof value !== 'object') return false
  return (value as Partial<NavigationSnapshot>).marker === 'spendscape-1d1'
}

function isAvailableFocusTarget(target: HTMLElement | null): target is HTMLElement {
  if (!target?.isConnected || target.matches(':disabled') ||
      target.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]')) return false
  for (let element: HTMLElement | null = target; element; element = element.parentElement) {
    const style = window.getComputedStyle(element)
    if (style.visibility !== 'visible' || style.display === 'none' || Number(style.opacity) === 0) return false
  }
  const rect = target.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
    rect.top < window.innerHeight && rect.left < window.innerWidth
}

export function SpendscapeGlobe() {
  const mapNodeRef = useRef<HTMLDivElement>(null)
  const queryDockRef = useRef<HTMLElement>(null)
  const controlDockRef = useRef<HTMLElement>(null)
  const searchRootRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suppressSearchFocusOpenRef = useRef(false)
  const placeReturnFocusRef = useRef<HTMLElement | null>(null)
  const askReturnFocusRef = useRef<HTMLElement | null>(null)
  const askWasOpenRef = useRef(false)
  const askFocusFrameRef = useRef<number | null>(null)
  const askFocusIntentRef = useRef<'dismiss' | 'purchase' | 'purchases' | 'feedback' | { analytics: AnalyticsView }>('dismiss')
  const desktopAskTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileToolsButtonRef = useRef<HTMLButtonElement>(null)
  const purchaseDetailBackRef = useRef<HTMLButtonElement>(null)
  const purchasesCloseRef = useRef<HTMLButtonElement>(null)
  const askUndoButtonRef = useRef<HTMLButtonElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const spinEnabledRef = useRef(true)
  const spinTimerRef = useRef<number | null>(null)
  const programmaticCameraRef = useRef(false)
  const reducedMotionRef = useRef(false)
  const filteredRef = useRef(placeFeatureCollection)
  const mapReadyRef = useRef(false)
  const actionTimerRef = useRef<number | null>(null)
  const loadStartRef = useRef(0)
  const localeRef = useRef<LocaleCode>('en')
  const modeRef = useRef<MapMode>('pins')
  const mapInstanceCountRef = useRef(0)
  const mapConstructionCountRef = useRef(0)
  const pendingCaptureExitRef = useRef<null | (() => void)>(null)
  const captureDismissedRef = useRef(false)
  const captureResumeSpinRef = useRef(false)

  const [locale, setLocale] = useState<LocaleCode>('en')
  const [query, setQuery] = useState<PurchaseQuery>(defaultPurchaseQuery)
  const [mode, setMode] = useState<MapMode>('pins')
  const [surface, setSurface] = useState<ProductSurface>('globe')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null)
  const [captureStep, setCaptureStep] = useState<CaptureStep | null>(null)
  const [captureDepth, setCaptureDepth] = useState(0)
  const [sessionCaptureRecords, setSessionCaptureRecords] = useState<SessionCaptureRecord[]>([])
  const [inboxCaseId, setInboxCaseId] = useState<string | null>(null)
  const [smartInboxDecisions, setSmartInboxDecisions] = useState<SmartInboxDecision[]>([])
  const [askOpen, setAskOpen] = useState(false)
  const [askUndoSnapshot, setAskUndoSnapshot] = useState<AskUndoSnapshot | null>(null)
  const [askFeedback, setAskFeedback] = useState<AskExecutionFeedback | null>(null)
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [stateRestored, setStateRestored] = useState(false)
  const [mapAttempt, setMapAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [autoSpin, setAutoSpin] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [status, setStatus] = useState<string>(copy.en.loading)
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [compactViewport, setCompactViewport] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const [desktopPanelBounds, setDesktopPanelBounds] = useState<DesktopPanelBounds | null>(null)
  const [sourceUpdates, setSourceUpdates] = useState(0)
  const [renderedEvidence, setRenderedEvidence] = useState({
    sourcePresent: false,
    sourceLoaded: false,
    rendererQueryFeatures: 0,
    rendererQueryClusters: 0,
    rendererQueryPlaces: 0,
    rendererQueryUniquePlaces: 0,
    rendererRepresentedPlaces: 0,
    clusters: 0,
    pins: 0,
    selectionHalos: 0,
    heatFeatures: 0,
    placeLabels: 0,
  })
  const [performanceEvidence, setPerformanceEvidence] = useState<PerformanceEvidence>({
    samples: 0,
    medianFrameMs: 0,
    p95FrameMs: 0,
    loadMs: null,
    lastCameraAction: null,
    lastCameraMs: null,
  })
  const [inputEvidence, setInputEvidence] = useState<InputEvidence>({
    scrollZoomEnabled: false,
    cooperativeGesturesEnabled: false,
    rtlPluginStatus: 'unavailable',
    wheelEvents: 0,
    smallDeltaWheelEvents: 0,
    lastWheelDeltaY: null,
    lastWheelClientPoint: null,
  })
  const [initializationEvidence, setInitializationEvidence] = useState<InitializationEvidence>({
    attempt: 0,
    stage: 'idle',
    styleFetchMs: null,
    rtlPluginMs: null,
    mapConstructedMs: null,
    mapReadyMs: null,
    failureStage: null,
    styleTimeoutMs: LIBERTY_STYLE_TIMEOUT_MS,
    rtlTimeoutMs: RTL_PLUGIN_TIMEOUT_MS,
    mapReadyTimeoutMs: MAP_READY_TIMEOUT_MS,
  })

  const t = copy[locale]
  const basePurchases = useMemo(
    () => combineSessionPurchases(globePurchases, sessionCaptureRecords),
    [sessionCaptureRecords],
  )
  const allPurchases = useMemo(
    () => applySmartInboxDecisions(basePurchases, smartInboxCases, smartInboxDecisions),
    [basePurchases, smartInboxDecisions],
  )
  const allEvidence = useMemo(
    () => [...globeEvidenceRecords, ...sessionCaptureRecords.map((record) => record.evidence)],
    [sessionCaptureRecords],
  )
  const searchScopePurchases = useMemo(
    () => filterPurchases({ ...query, search: '' }, allPurchases),
    [allPurchases, query],
  )
  const searchResults = useMemo(
    () => deriveCanonicalSearchResults(query.search, searchScopePurchases),
    [query.search, searchScopePurchases],
  )
  const visiblePurchases = useMemo(() => filterPurchases(query, allPurchases), [allPurchases, query])
  const visibleData = useMemo(
    () => buildPlaceFeatureCollection(globePlaces, visiblePurchases),
    [visiblePurchases],
  )
  const visibleSummary = useMemo(() => derivedPurchaseSummary(visiblePurchases), [visiblePurchases])
  const visibleAnalytics = useMemo(
    () => derivePurchaseAnalytics(visiblePurchases, allEvidence),
    [allEvidence, visiblePurchases],
  )
  const currentGlobeCounts = useMemo(() => {
    const features = buildPlaceFeatureCollection(globePlaces, allPurchases).features
    const recurringPlacePurchases = allPurchases.filter(
      (purchase) => purchase.placeId === 'place_shuk_bograshov',
    ).length
    return {
      pinCount: features.length,
      physicalConfirmedCount: allPurchases.filter(
        (purchase) => purchase.channel === 'physical' && purchase.resolution === 'confirmed',
      ).length,
      onlineCount: allPurchases.filter((purchase) => purchase.channel === 'online').length,
      unresolvedCount: allPurchases.filter((purchase) => purchase.resolution === 'unresolved').length,
      recurringPlacePurchases,
      recurringPlacePins: features.filter(
        (feature) => feature.properties.placeId === 'place_shuk_bograshov',
      ).length,
    }
  }, [allPurchases])
  const timelineMonths = useMemo(() => availableTimelineMonths(allPurchases), [allPurchases])
  const askContext = useMemo<AskContext>(() => ({
    places: globePlaces,
    purchases: allPurchases,
    timelineMonths,
  }), [allPurchases, timelineMonths])
  const pendingInbox = useMemo(
    () => pendingSmartInboxCases(smartInboxCases, basePurchases, smartInboxDecisions),
    [basePurchases, smartInboxDecisions],
  )
  const activeInboxCase = inboxCaseId
    ? smartInboxCases.find((inboxCase) => inboxCase.id === inboxCaseId)
    : undefined
  const activeInboxPurchase = activeInboxCase
    ? basePurchases.find((purchase) => purchase.id === activeInboxCase.purchaseId)
    : undefined
  const activeInboxDecision = activeInboxCase
    ? decisionForCase(activeInboxCase.id, smartInboxDecisions)
    : undefined
  const selectedFeature = useMemo(
    () => visibleData.features.find(
      (feature) => feature.properties.placeId === selectedPlaceId,
    ) ?? null,
    [selectedPlaceId, visibleData.features],
  )
  const selectedPlace = selectedPlaceId ? placeForId(selectedPlaceId) : undefined
  const selectedPurchase = selectedPurchaseId
    ? allPurchases.find((purchase) => purchase.id === selectedPurchaseId)
    : undefined
  const selectedMerchant = selectedPurchase ? merchantForId(selectedPurchase.merchantId) : undefined
  const selectedPurchaseInboxCase = selectedPurchase
    ? caseForPurchase(selectedPurchase.id, smartInboxCases)
    : undefined
  const selectedEvidence = useMemo(
    () => selectedPurchase
      ? allEvidence.filter((record) => selectedPurchase.evidenceIds.includes(record.id))
      : [],
    [allEvidence, selectedPurchase],
  )
  const selectedPlacePurchases = useMemo(
    () => selectedPlaceId ? purchasesForPlace(selectedPlaceId, visiblePurchases) : [],
    [selectedPlaceId, visiblePurchases],
  )
  const activeFilterCount = [
    query.currency !== 'all', query.channel !== 'all', query.dateRange !== 'all',
    query.timelineMonth !== null,
  ].filter(Boolean).length
  const searchHasValue = query.search.trim().length > 0
  const showSearchResults = searchOpen && searchHasValue && surface === 'globe'
  const placePanelStyle = desktopPanelBounds ? ({
    '--place-panel-top': `${desktopPanelBounds.top}px`,
    '--place-panel-max-height': `${desktopPanelBounds.maxHeight}px`,
  } as CSSProperties) : undefined

  filteredRef.current = visibleData
  reducedMotionRef.current = reducedMotion
  localeRef.current = locale
  modeRef.current = mode

  const updateQuery = useCallback((patch: Partial<PurchaseQuery>) => {
    setQuery((current) => ({ ...current, ...patch }))
  }, [])

  useEffect(() => {
    let restored: Partial<StoredExperienceState> = {}
    try {
      const raw = window.sessionStorage.getItem(EXPERIENCE_STORAGE_KEY)
      if (raw) restored = JSON.parse(raw) as Partial<StoredExperienceState>
    } catch {
      restored = {}
    }

    if (restored.locale === 'en' || restored.locale === 'he') setLocale(restored.locale)
    if (restored.query) setQuery({ ...defaultPurchaseQuery, ...restored.query })
    if (restored.mode === 'pins' || restored.mode === 'heatmap') setMode(restored.mode)
    if (restored.surface === 'globe' || restored.surface === 'purchases' || restored.surface === 'stats') {
      setSurface(restored.surface)
    }
    if (typeof restored.selectedPlaceId === 'string' || restored.selectedPlaceId === null) {
      setSelectedPlaceId(restored.selectedPlaceId)
    }
    if (typeof restored.selectedPurchaseId === 'string' || restored.selectedPurchaseId === null) {
      setSelectedPurchaseId(restored.selectedPurchaseId)
    }

    const historicalSnapshot: NavigationSnapshot | null = isNavigationSnapshot(window.history.state)
      ? window.history.state
      : null
    const snapshot: NavigationSnapshot = historicalSnapshot
      ? {
          ...historicalSnapshot,
          captureStep: null,
          captureDepth: 0,
          inboxCaseId: null,
          askOpen: false,
          selectedPurchaseId: historicalSnapshot.selectedPurchaseId?.startsWith('session_purchase_')
            ? null
            : historicalSnapshot.selectedPurchaseId,
        }
      : {
          marker: 'spendscape-1d1',
          surface: restored.surface ?? 'globe',
          selectedPlaceId: restored.selectedPlaceId ?? null,
          selectedPurchaseId: restored.selectedPurchaseId?.startsWith('session_purchase_')
            ? null
            : restored.selectedPurchaseId ?? null,
          captureStep: null,
          captureDepth: 0,
          inboxCaseId: null,
          askOpen: false,
        }
    setSelectedPurchaseId(snapshot.selectedPurchaseId)
    // Preserve the router-owned state installed before this mount effect. Dropping
    // it makes Next reload the document on the first Back, destroying focus/refs.
    window.history.replaceState({ ...window.history.state, ...snapshot }, '', navigationHash(snapshot))
    setStateRestored(true)
  }, [])

  useEffect(() => {
    setActiveSearchIndex(-1)
  }, [query.search, searchResults.length])

  useEffect(() => {
    const dismissSearch = (event: PointerEvent) => {
      if (!searchRootRef.current?.contains(event.target as Node)) {
        setSearchOpen(false)
        setActiveSearchIndex(-1)
      }
    }
    document.addEventListener('pointerdown', dismissSearch)
    return () => document.removeEventListener('pointerdown', dismissSearch)
  }, [])

  useEffect(() => {
    if (!stateRestored) return
    const stored: StoredExperienceState = {
      marker: 'spendscape-1d1', locale, query, mode, surface,
      selectedPlaceId,
      selectedPurchaseId: selectedPurchaseId?.startsWith('session_purchase_') ? null : selectedPurchaseId,
      captureStep: null, captureDepth: 0, inboxCaseId: null,
      askOpen: false,
    }
    window.sessionStorage.setItem(EXPERIENCE_STORAGE_KEY, JSON.stringify(stored))
  }, [locale, mode, query, selectedPlaceId, selectedPurchaseId, stateRestored, surface])

  useEffect(() => {
    const dismissed = askWasOpenRef.current && !askOpen
    askWasOpenRef.current = askOpen
    if (!dismissed) return
    const intent = askFocusIntentRef.current
    // Run after React has removed the Ask focus trap and committed the destination.
    const frame = window.requestAnimationFrame(() => {
      askFocusFrameRef.current = null
      if (typeof intent === 'object') {
        const section = document.querySelector<HTMLElement>(`[data-analytics-view="${intent.analytics}"]`)
        // Analytics normally focuses itself. Do not override that focus; the fallback
        // also covers re-opening the same view when its mount/view effect does not run.
        if (section?.contains(document.activeElement)) return
        section?.scrollIntoView({ block: 'start', behavior: 'auto' })
        if (isAvailableFocusTarget(section)) section.focus({ preventScroll: true })
        return
      }
      const candidates = intent === 'dismiss'
        ? [askReturnFocusRef.current, mobileToolsButtonRef.current, desktopAskTriggerRef.current]
        : [intent === 'purchase' ? purchaseDetailBackRef.current
          : intent === 'purchases' ? purchasesCloseRef.current : askUndoButtonRef.current]
      const target = candidates.find(isAvailableFocusTarget)
      target?.focus({ preventScroll: true })
    })
    askFocusFrameRef.current = frame
    return () => {
      window.cancelAnimationFrame(frame)
      if (askFocusFrameRef.current === frame) askFocusFrameRef.current = null
    }
  }, [askOpen])

  const clearSpinTimer = useCallback(() => {
    if (spinTimerRef.current !== null) {
      window.clearTimeout(spinTimerRef.current)
      spinTimerRef.current = null
    }
  }, [])

  const stopSpin = useCallback((announce = true) => {
    const shouldStopCamera = spinEnabledRef.current || programmaticCameraRef.current
    spinEnabledRef.current = false
    programmaticCameraRef.current = false
    clearSpinTimer()
    if (shouldStopCamera) mapRef.current?.stop()
    setAutoSpin(false)
    if (announce) setStatus(copy[localeRef.current].interrupted)
  }, [clearSpinTimer])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const updateViewport = () => {
      setCompactViewport(media.matches)
      if (!media.matches) setMobileToolsOpen(false)
    }
    updateViewport()
    media.addEventListener('change', updateViewport)
    return () => media.removeEventListener('change', updateViewport)
  }, [])

  useEffect(() => {
    if (compactViewport) {
      setDesktopPanelBounds(null)
      return
    }

    let frame = 0
    const measure = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const queryDock = queryDockRef.current?.getBoundingClientRect()
        const controlDock = controlDockRef.current?.getBoundingClientRect()
        if (!queryDock || !controlDock) return
        const top = Math.ceil(queryDock.bottom + 16)
        const maxHeight = Math.max(180, Math.floor(controlDock.top - 16 - top))
        setDesktopPanelBounds((current) => (
          current?.top === top && current.maxHeight === maxHeight
            ? current
            : { top, maxHeight }
        ))
      })
    }

    const observer = new ResizeObserver(measure)
    if (queryDockRef.current) observer.observe(queryDockRef.current)
    if (controlDockRef.current) observer.observe(controlDockRef.current)
    window.addEventListener('resize', measure)
    measure()
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [compactViewport, locale, surface])

  const queueSpin = useCallback(() => {
    const map = mapRef.current
    clearSpinTimer()
    if (!map || !spinEnabledRef.current || reducedMotionRef.current || !mapReadyRef.current) return
    if (map.getZoom() > 4.25) return

    spinTimerRef.current = window.setTimeout(() => {
      if (!spinEnabledRef.current || reducedMotionRef.current) return
      const center = map.getCenter()
      map.easeTo({
        center: [center.lng + 7, center.lat],
        duration: 3600,
        easing: (value) => value,
        essential: false,
      })
    }, 80)
  }, [clearSpinTimer])

  const resumeSpin = useCallback(() => {
    if (reducedMotionRef.current) return
    spinEnabledRef.current = true
    setAutoSpin(true)
    setStatus(copy[localeRef.current].orbiting)
    queueSpin()
  }, [queueSpin])

  const resumeAfterCapture = useCallback(() => {
    if (!captureResumeSpinRef.current) return
    captureResumeSpinRef.current = false
    if (reducedMotionRef.current) return
    spinEnabledRef.current = true
    queueSpin()
  }, [queueSpin])

  const updateSelectedFilter = useCallback((placeId: string | null) => {
    const map = mapRef.current
    if (!map) return
    for (const layerId of [SELECTION_GLOW_LAYER, HALO_LAYER]) {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, ['==', ['get', 'placeId'], placeId ?? ''])
      }
    }
  }, [])

  const applyNavigation = useCallback((snapshot: NavigationSnapshot) => {
    setSurface(snapshot.surface)
    setSelectedPlaceId(snapshot.selectedPlaceId)
    setSelectedPurchaseId(snapshot.selectedPurchaseId)
    setCaptureStep(snapshot.captureStep ?? null)
    setCaptureDepth(snapshot.captureDepth ?? 0)
    setInboxCaseId(snapshot.inboxCaseId ?? null)
    setAskOpen(snapshot.askOpen ?? false)
    setFiltersOpen(false)
    setTimelineOpen(false)
    setMobileToolsOpen(false)
    setSearchOpen(false)
    setActiveSearchIndex(-1)
    updateSelectedFilter(snapshot.selectedPlaceId)
  }, [updateSelectedFilter])

  const pushNavigation = useCallback((patch: Partial<NavigationSnapshot>) => {
    const snapshot: NavigationSnapshot = {
      marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId,
      captureStep,
      captureDepth,
      inboxCaseId,
      askOpen,
      ...patch,
    }
    window.history.pushState(snapshot, '', navigationHash(snapshot))
    applyNavigation(snapshot)
  }, [applyNavigation, askOpen, captureDepth, captureStep, inboxCaseId, selectedPlaceId, selectedPurchaseId, surface])

  const closeTopLayer = useCallback(() => {
    if (askOpen) {
      window.history.back()
      return
    }
    if (inboxCaseId) {
      window.history.back()
      return
    }
    if (searchOpen) {
      setSearchOpen(false)
      setActiveSearchIndex(-1)
      return
    }
    if (filtersOpen) {
      setFiltersOpen(false)
      return
    }
    if (timelineOpen) {
      setTimelineOpen(false)
      return
    }
    if (mobileToolsOpen) {
      setMobileToolsOpen(false)
      return
    }

    const focusTarget = selectedPlaceId && !selectedPurchaseId ? placeReturnFocusRef.current : null
    const snapshot: NavigationSnapshot = selectedPurchaseId
      ? { marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId: null }
      : selectedPlaceId
        ? { marker: 'spendscape-1d1', surface, selectedPlaceId: null, selectedPurchaseId: null }
        : { marker: 'spendscape-1d1', surface: 'globe', selectedPlaceId: null, selectedPurchaseId: null }
    window.history.replaceState(snapshot, '', navigationHash(snapshot))
    applyNavigation(snapshot)
    if (focusTarget?.isConnected) {
      if (focusTarget === searchInputRef.current) suppressSearchFocusOpenRef.current = true
      window.requestAnimationFrame(() => {
        focusTarget.focus()
        suppressSearchFocusOpenRef.current = false
      })
    }
  }, [applyNavigation, askOpen, filtersOpen, inboxCaseId, mobileToolsOpen, searchOpen, selectedPlaceId, selectedPurchaseId, surface, timelineOpen])

  useEffect(() => {
    const restoreNavigation = (event: PopStateEvent) => {
      if (!isNavigationSnapshot(event.state)) return
      if (event.state.captureStep && captureDismissedRef.current) {
        window.history.go(-Math.max(1, event.state.captureDepth ?? 1))
        return
      }
      applyNavigation(event.state)
      if (!event.state.captureStep) resumeAfterCapture()
      if (!event.state.captureStep && pendingCaptureExitRef.current) {
        const pending = pendingCaptureExitRef.current
        pendingCaptureExitRef.current = null
        window.setTimeout(pending, 0)
      }
    }
    window.addEventListener('popstate', restoreNavigation)
    return () => window.removeEventListener('popstate', restoreNavigation)
  }, [applyNavigation, resumeAfterCapture])

  const selectPlace = useCallback((placeId: string, shouldFly = true, recordHistory = true) => {
    const map = mapRef.current
    const place = placeForId(placeId)
    if (!place) return
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      placeReturnFocusRef.current = activeElement
    }
    stopSpin(false)
    setMobileToolsOpen(false)
    setSurface('globe')
    setSelectedPlaceId(placeId)
    setSelectedPurchaseId(null)
    updateSelectedFilter(placeId)
    if (recordHistory) {
      const snapshot: NavigationSnapshot = {
        marker: 'spendscape-1d1', surface: 'globe',
        selectedPlaceId: placeId, selectedPurchaseId: null,
      }
      window.history.pushState(snapshot, '', navigationHash(snapshot))
    }
    const activeLocale = localeRef.current
    setStatus(`${localized(place.name, activeLocale)} · ${copy[activeLocale].ready}`)
    if (shouldFly && map) {
      const started = performance.now()
      programmaticCameraRef.current = true
      map.once('moveend', () => {
        programmaticCameraRef.current = false
        setPerformanceEvidence((current) => ({
          ...current,
          lastCameraAction: 'fly-to-place',
          lastCameraMs: Math.round((performance.now() - started) * 10) / 10,
        }))
      })
      map.flyTo({
        center: place.coordinates,
        zoom: 15.2,
        speed: 1.6,
        // Keep the selected spot above the mobile detail sheet; desktop follows
        // the unmodified reference center because its side panel does not cover it.
        offset: window.innerWidth <= 760
          ? [0, -Math.round(Math.min(180, window.innerHeight * 0.2))]
          : [0, 0],
        ...(reducedMotionRef.current ? { duration: 0 } : {}),
        essential: false,
      })
    }
  }, [stopSpin, updateSelectedFilter])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const applyMotionPreference = () => {
      const matches = media.matches
      reducedMotionRef.current = matches
      setReducedMotion(matches)
      if (matches) stopSpin(false)
    }
    applyMotionPreference()
    media.addEventListener('change', applyMotionPreference)
    return () => media.removeEventListener('change', applyMotionPreference)
  }, [stopSpin])

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr'
    const map = mapRef.current
    if (map?.getLayer(LABEL_LAYER)) {
      map.setLayoutProperty(LABEL_LAYER, 'text-field', placeLabelExpression(locale))
    }
  }, [locale])

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        stopSpin(false)
        closeTopLayer()
      }
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [closeTopLayer, stopSpin])

  useEffect(() => {
    const controller = new AbortController()
    const node = mapNodeRef.current
    if (!node) return () => controller.abort()

    const searchParams = new URLSearchParams(window.location.search)
    const forceFailure = searchParams.get('mapFailure') === '1'
    const holdLoadingState = searchParams.get('loading') === '1'
    const simulatedTimeout = mapAttempt === 0 ? searchParams.get('mapTimeout') : null
    const styleTimeoutMs = simulatedTimeout === 'style' ? QA_TIMEOUT_MS : LIBERTY_STYLE_TIMEOUT_MS
    const mapReadyTimeoutMs = simulatedTimeout === 'ready' ? QA_TIMEOUT_MS : MAP_READY_TIMEOUT_MS
    // Configure the worker before any status/evidence read can create
    // MapLibre's global dispatcher, including deterministic failure states.
    maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')
    setLoading(true)
    setMapError(null)
    setStatus(copy[localeRef.current].loading)
    setInitializationEvidence({
      attempt: mapAttempt + 1,
      stage: 'resources',
      styleFetchMs: null,
      rtlPluginMs: null,
      mapConstructedMs: null,
      mapReadyMs: null,
      failureStage: null,
      styleTimeoutMs,
      rtlTimeoutMs: RTL_PLUGIN_TIMEOUT_MS,
      mapReadyTimeoutMs,
    })
    if (forceFailure) {
      setLoading(false)
      setMapError('Simulated development style failure')
      setStatus(copy.en.mapFailed)
      setInitializationEvidence((current) => ({ ...current, stage: 'failed', failureStage: 'style' }))
      return () => controller.abort()
    }

    let disposed = false
    let attemptFailed = false
    let attemptMap: MapLibreMap | null = null
    let mapReadyTimer: number | null = null
    let detachInteractionListeners = () => {}
    loadStartRef.current = performance.now()

    const removeAttemptMap = () => {
      if (!attemptMap) return
      if (mapRef.current === attemptMap) mapRef.current = null
      attemptMap.remove()
      attemptMap = null
      mapInstanceCountRef.current = 0
    }

    const failInitialization = (error: unknown, fallbackStage: InitializationError['stage']) => {
      if (disposed || attemptFailed) return
      attemptFailed = true
      if (mapReadyTimer !== null) window.clearTimeout(mapReadyTimer)
      controller.abort()
      detachInteractionListeners()
      removeAttemptMap()
      const failure = error instanceof InitializationError
        ? error
        : new InitializationError(
            fallbackStage,
            error instanceof Error ? error.message : 'Map initialization failed',
          )
      setLoading(false)
      setMapError(failure.message)
      setStatus(copy[localeRef.current].mapFailed)
      setInitializationEvidence((current) => ({
        ...current,
        stage: 'failed',
        failureStage: failure.stage,
      }))
    }

    const initialize = async () => {
      try {
        // Let React's development-only Strict Mode probe dispose before any
        // network or worker work begins. The stable effect starts both
        // independent resources together on the next task.
        await abortableDelay(0, controller.signal)
        if (disposed) return
        const rtlStartedAt = performance.now()
        const rtlPromise = abortableTimeout(
          ensureRtlTextPlugin(),
          controller.signal,
          RTL_PLUGIN_TIMEOUT_MS,
          'rtl',
          'RTL text support',
        ).then(() => {
          setInitializationEvidence((current) => ({
            ...current,
            rtlPluginMs: Math.round((performance.now() - rtlStartedAt) * 10) / 10,
          }))
        }).catch((error: unknown) => {
          if (error instanceof InitializationError) {
            // A timed-out wrapper must not pin the next user-triggered Retry to
            // the same unresolved application promise. MapLibre keeps its own
            // plugin status, so the next attempt can observe a late success.
            rtlTextPluginPromise = null
            throw error
          }
          if (controller.signal.aborted) throw error
          throw new InitializationError('rtl', error instanceof Error ? error.message : 'RTL text support failed')
        })

        const styleStartedAt = performance.now()
        const stylePromise = fetchDevelopmentStyle(
          controller.signal,
          styleTimeoutMs,
          simulatedTimeout === 'style',
        ).then((style) => {
          setInitializationEvidence((current) => ({
            ...current,
            styleFetchMs: Math.round((performance.now() - styleStartedAt) * 10) / 10,
          }))
          return style
        }).catch((error: unknown) => {
          if (error instanceof InitializationError || controller.signal.aborted) throw error
          throw new InitializationError('style', error instanceof Error ? error.message : 'Liberty style failed')
        })

        const resourcesPromise = Promise.all([rtlPromise, stylePromise])
        const [, developmentStyle] = holdLoadingState
          ? (await Promise.all([
              resourcesPromise,
              abortableDelay(1_800, controller.signal),
            ]))[0]
          : await resourcesPromise
        if (disposed || !mapNodeRef.current) return

        setInitializationEvidence((current) => ({ ...current, stage: 'constructing' }))
        const camera = getStoredCamera()
        const map = new maplibregl.Map({
          container: mapNodeRef.current,
          style: developmentStyle,
          center: camera.center,
          zoom: camera.zoom,
          bearing: camera.bearing,
          pitch: camera.pitch,
          minZoom: 0.65,
          maxZoom: 16,
          attributionControl: { compact: true },
          keyboard: true,
          scrollZoom: true,
          cooperativeGestures: false,
          touchZoomRotate: true,
          renderWorldCopies: false,
          localIdeographFontFamily: 'system-ui, sans-serif',
        })

        attemptMap = map
        mapRef.current = map
        mapInstanceCountRef.current = 1
        mapConstructionCountRef.current += 1
        setInitializationEvidence((current) => ({
          ...current,
          mapConstructedMs: Math.round((performance.now() - loadStartRef.current) * 10) / 10,
        }))
        mapReadyTimer = window.setTimeout(() => {
          failInitialization(
            new InitializationError('map-ready', `Map resources timed out after ${mapReadyTimeoutMs}ms`),
            'map-ready',
          )
        }, mapReadyTimeoutMs)
        map.scrollZoom.enable()
        map.cooperativeGestures.disable()
        map.touchZoomRotate.enable()
        setInputEvidence((current) => ({
          ...current,
          scrollZoomEnabled: map.scrollZoom.isEnabled(),
          cooperativeGesturesEnabled: map.cooperativeGestures.isEnabled(),
          rtlPluginStatus: maplibregl.getRTLTextPluginStatus(),
        }))
        map.on('error', (event) => {
          console.error('[Spendscape MapLibre]', event.error?.message ?? 'Unknown map error')
        })
        map.setMissingStyleImageResolver((id) => {
          if (id !== 'circle-11' || map.hasImage(id)) return
          const size = 11
          const data = new Uint8Array(size * size * 4)
          for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
              const offset = (y * size + x) * 4
              const inside = Math.hypot(x - 5, y - 5) <= 3.2
              data[offset] = 205
              data[offset + 1] = 209
              data[offset + 2] = 225
              data[offset + 3] = inside ? 185 : 0
            }
          }
          map.addImage(id, { width: size, height: size, data })
        })

        const frameTimes: number[] = []
        let lastFrame: number | null = null
        const onRender = () => {
          const now = performance.now()
          if (lastFrame !== null) {
            const elapsed = now - lastFrame
            if (elapsed > 0 && elapsed < 100) frameTimes.push(elapsed)
          }
          lastFrame = now
          if (frameTimes.length >= 120 && frameTimes.length % 30 === 0) {
            setPerformanceEvidence((current) => ({
              ...current,
              samples: frameTimes.length,
              medianFrameMs: Math.round(percentile(frameTimes, 0.5) * 10) / 10,
              p95FrameMs: Math.round(percentile(frameTimes, 0.95) * 10) / 10,
            }))
          }
        }

        map.on('render', onRender)
        map.on('moveend', () => {
          if (!mapRef.current) return
          const snapshot = snapshotCamera(map)
          window.sessionStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(snapshot))
          if (window.__SPENDSCAPE_QA__) window.__SPENDSCAPE_QA__.camera = snapshot
          if (spinEnabledRef.current) queueSpin()
        })

        const interrupt = () => stopSpin(true)
        const captureWheel = (event: WheelEvent) => {
          interrupt()
          setInputEvidence((current) => ({
            ...current,
            wheelEvents: current.wheelEvents + 1,
            smallDeltaWheelEvents: current.smallDeltaWheelEvents + (Math.abs(event.deltaY) < 4 ? 1 : 0),
            lastWheelDeltaY: event.deltaY,
            lastWheelClientPoint: [event.clientX, event.clientY],
          }))
        }
        node.addEventListener('pointerdown', interrupt, { passive: true, capture: true })
        node.addEventListener('wheel', captureWheel, { passive: true, capture: true })
        node.addEventListener('keydown', interrupt, { capture: true })
        detachInteractionListeners = () => {
          node.removeEventListener('pointerdown', interrupt, { capture: true })
          node.removeEventListener('wheel', captureWheel, { capture: true })
          node.removeEventListener('keydown', interrupt, { capture: true })
        }

        map.on('load', async () => {
          if (disposed || attemptFailed || simulatedTimeout === 'ready') return
          if (mapReadyTimer !== null) {
            window.clearTimeout(mapReadyTimer)
            mapReadyTimer = null
          }
          mapReadyRef.current = true
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: filteredRef.current,
            generateId: true,
            cluster: true,
            clusterRadius: 54,
            clusterMaxZoom: 6,
          })

          map.addLayer({
            id: HEAT_LAYER,
            type: 'heatmap',
            source: SOURCE_ID,
            layout: { visibility: 'none' },
            paint: {
              'heatmap-weight': HEATMAP_WEIGHT_EXPRESSION,
              'heatmap-intensity': HEATMAP_INTENSITY_EXPRESSION,
              'heatmap-radius': HEATMAP_RADIUS_EXPRESSION,
              'heatmap-opacity': HEATMAP_OPACITY,
              'heatmap-color': HEATMAP_COLOR_EXPRESSION,
            },
          })

          map.addLayer({
            id: CLUSTER_GLOW_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': [
                'step', ['get', 'point_count'],
                SPENDSCAPE_BLUE_BRIGHT, 3, SPENDSCAPE_BLUE, 7, SPENDSCAPE_BLUE_DEEP,
              ],
              'circle-radius': ['step', ['get', 'point_count'], 25, 4, 31, 8, 38],
              'circle-opacity': 0.46,
              'circle-blur': 0.72,
              'circle-pitch-alignment': 'viewport',
              'circle-pitch-scale': 'viewport',
            },
          })

          map.addLayer({
            id: CLUSTER_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': [
                'step', ['get', 'point_count'],
                SPENDSCAPE_BLUE_BRIGHT, 3, SPENDSCAPE_BLUE, 7, SPENDSCAPE_BLUE_DEEP,
              ],
              'circle-radius': ['step', ['get', 'point_count'], 16, 4, 21, 8, 27],
              'circle-stroke-color': 'rgba(239,244,255,0.9)',
              'circle-stroke-width': 1.25,
              'circle-opacity': 0.96,
              'circle-blur': 0.02,
              'circle-pitch-alignment': 'viewport',
              'circle-pitch-scale': 'viewport',
            },
          })

          map.addLayer({
            id: CLUSTER_COUNT_LAYER,
            type: 'symbol',
            source: SOURCE_ID,
            filter: ['has', 'point_count'],
            layout: {
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['Noto Sans Regular'],
              'text-size': ['step', ['get', 'point_count'], 11, 4, 12, 8, 13],
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-color': 'rgba(5,7,12,0.5)',
              'text-halo-width': 1.1,
            },
          })

          map.addLayer({
            id: PIN_GLOW_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': PIN_GLOW_RADIUS_EXPRESSION,
              'circle-color': SPENDSCAPE_BLUE_BRIGHT,
              'circle-opacity': 0.34,
              'circle-blur': 0.76,
              'circle-pitch-alignment': 'viewport',
              'circle-pitch-scale': 'viewport',
            },
          })

          map.addLayer({
            id: PIN_SHADOW_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': PIN_SHADOW_RADIUS_EXPRESSION,
              'circle-color': '#020306',
              'circle-opacity': 0.7,
              'circle-translate': [0, 2.5],
              'circle-blur': 0.22,
              'circle-pitch-alignment': 'viewport',
              'circle-pitch-scale': 'viewport',
            },
          })

          map.addLayer({
            id: PIN_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            paint: {
              // Visit count is the only base-dot size metric; category never changes its color.
              'circle-radius': PIN_HOVER_RADIUS_EXPRESSION,
              'circle-color': SPENDSCAPE_BLUE,
              'circle-stroke-color': '#f7fbff',
              'circle-stroke-width': PIN_STROKE_WIDTH_EXPRESSION,
              'circle-opacity': 1,
              'circle-pitch-alignment': 'viewport',
              'circle-pitch-scale': 'viewport',
            },
          })

          map.addLayer({
            id: SELECTION_GLOW_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['==', ['get', 'placeId'], ''],
            paint: {
              'circle-radius': PIN_SELECTION_GLOW_RADIUS_EXPRESSION,
              'circle-color': SPENDSCAPE_BLUE_BRIGHT,
              'circle-opacity': 0.54,
              'circle-blur': 0.72,
              'circle-pitch-alignment': 'viewport',
              'circle-pitch-scale': 'viewport',
            },
          })

          map.addLayer({
            id: HALO_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['==', ['get', 'placeId'], ''],
            paint: {
              'circle-radius': PIN_SELECTION_HALO_RADIUS_EXPRESSION,
              'circle-color': 'rgba(255,255,255,0)',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2.4,
              'circle-opacity': 1,
              'circle-pitch-alignment': 'viewport',
              'circle-pitch-scale': 'viewport',
            },
          })

          map.addLayer({
            id: LABEL_LAYER,
            type: 'symbol',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            minzoom: 12.5,
            layout: {
              'text-field': placeLabelExpression(localeRef.current),
              'text-font': ['Noto Sans Bold'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 12.5, 12, 16, 13.5],
              'text-offset': [0, 1.8],
              'text-anchor': 'top',
              'text-optional': true,
            },
            paint: {
              'text-color': SPENDSCAPE_BLUE_DEEP,
              'text-halo-color': 'rgba(252,253,255,0.98)',
              'text-halo-width': 2.2,
            },
          })

          applyGlobeMode(map, modeRef.current)

          const canonicalSource = map.getSource(SOURCE_ID) as GeoJSONSource
          try {
            await canonicalSource.setData(filteredRef.current)
            setSourceUpdates((current) => current + 1)
          } catch (error) {
            if (disposed || attemptFailed) return
            failInitialization(error, 'map')
            return
          }
          if (disposed || attemptFailed) return
          map.triggerRepaint()

          map.on('click', CLUSTER_LAYER, async (event) => {
            const feature = event.features?.[0]
            const clusterId = Number(feature?.properties?.cluster_id)
            const source = map.getSource(SOURCE_ID) as GeoJSONSource
            if (!Number.isFinite(clusterId)) return
            stopSpin(false)
            const zoom = await source.getClusterExpansionZoom(clusterId)
            const coordinates = (feature?.geometry as Point).coordinates as [number, number]
            const started = performance.now()
            programmaticCameraRef.current = true
            map.once('moveend', () => {
              programmaticCameraRef.current = false
              setPerformanceEvidence((current) => ({
                ...current,
                lastCameraAction: 'cluster-expansion',
                lastCameraMs: Math.round((performance.now() - started) * 10) / 10,
              }))
            })
            map.flyTo({
              center: coordinates,
              zoom,
              speed: 1.6,
              ...(reducedMotionRef.current ? { duration: 0 } : {}),
              essential: false,
            })
          })

          map.on('click', PIN_LAYER, (event) => {
            const placeId = String(event.features?.[0]?.properties?.placeId ?? '')
            if (placeId) selectPlace(placeId)
          })

          const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16 })
          let hoveredFeatureId: string | number | null = null
          map.on('mouseenter', PIN_LAYER, (event) => {
            map.getCanvas().style.cursor = 'pointer'
            const feature = event.features?.[0]
            if (!feature) return
            if (hoveredFeatureId !== null) {
              map.setFeatureState({ source: SOURCE_ID, id: hoveredFeatureId }, { hover: false })
            }
            hoveredFeatureId = feature.id ?? null
            if (hoveredFeatureId !== null) {
              map.setFeatureState({ source: SOURCE_ID, id: hoveredFeatureId }, { hover: true })
            }
            const properties = feature.properties as PlaceFeatureProperties
            const tooltip = document.createElement('div')
            tooltip.className = styles.mapTooltip
            const title = document.createElement('strong')
            const activeLocale = localeRef.current
            title.textContent = activeLocale === 'he' ? properties.nameHe : properties.nameEn
            const meta = document.createElement('span')
            meta.textContent = `${properties.visitCount} ${copy[activeLocale].visits}`
            tooltip.append(title, meta)
            popup.setLngLat((feature.geometry as Point).coordinates as [number, number])
              .setDOMContent(tooltip)
              .addTo(map)
          })
          map.on('mouseleave', PIN_LAYER, () => {
            map.getCanvas().style.cursor = ''
            if (hoveredFeatureId !== null) {
              map.setFeatureState({ source: SOURCE_ID, id: hoveredFeatureId }, { hover: false })
              hoveredFeatureId = null
            }
            popup.remove()
          })
          map.on('mouseenter', CLUSTER_LAYER, () => { map.getCanvas().style.cursor = 'pointer' })
          map.on('mouseleave', CLUSTER_LAYER, () => { map.getCanvas().style.cursor = '' })
          map.on('click', (event: MapMouseEvent) => {
            const hit = map.queryRenderedFeatures(event.point, { layers: [CLUSTER_LAYER, PIN_LAYER] })
            if (hit.length === 0) {
              setSelectedPlaceId(null)
              setSelectedPurchaseId(null)
              updateSelectedFilter(null)
              const current: NavigationSnapshot = isNavigationSnapshot(window.history.state)
                ? window.history.state
                : { marker: 'spendscape-1d1', surface: 'globe', selectedPlaceId: null, selectedPurchaseId: null }
              const snapshot: NavigationSnapshot = {
                ...current, selectedPlaceId: null, selectedPurchaseId: null,
              }
              window.history.replaceState(snapshot, '', navigationHash(snapshot))
            }
          })

          let orbitStarted = false
          const startOrbitWhenSourceIsReady = () => {
            if (
              orbitStarted
              || reducedMotionRef.current
              || !spinEnabledRef.current
              || !map.isSourceLoaded(SOURCE_ID)
            ) return
            orbitStarted = true
            setStatus(copy[localeRef.current].orbiting)
            queueSpin()
          }
          const refreshRenderedEvidence = () => {
            if (disposed || !map.getLayer(CLUSTER_LAYER)) return
            const queriedFeatures = map.querySourceFeatures(SOURCE_ID)
            const queriedClusters = queriedFeatures.filter(
              (feature) => Number.isFinite(Number(feature.properties?.point_count)),
            )
            const queriedPlaces = queriedFeatures.filter(
              (feature) => typeof feature.properties?.placeId === 'string',
            )
            const representedPlaces = queriedClusters.reduce(
              (sum, feature) => sum + Number(feature.properties?.point_count ?? 0),
              queriedPlaces.length,
            )
            const next = {
              sourcePresent: Boolean(map.getSource(SOURCE_ID)),
              sourceLoaded: map.isSourceLoaded(SOURCE_ID),
              rendererQueryFeatures: queriedFeatures.length,
              rendererQueryClusters: queriedClusters.length,
              rendererQueryPlaces: queriedPlaces.length,
              rendererQueryUniquePlaces: new Set(
                queriedPlaces.map((feature) => String(feature.properties?.placeId)),
              ).size,
              rendererRepresentedPlaces: representedPlaces,
              clusters: map.queryRenderedFeatures({ layers: [CLUSTER_LAYER] }).length,
              pins: map.queryRenderedFeatures({ layers: [PIN_LAYER] }).length,
              selectionHalos: map.queryRenderedFeatures({ layers: [HALO_LAYER] }).length,
              heatFeatures: map.queryRenderedFeatures({ layers: [HEAT_LAYER] }).length,
              placeLabels: map.queryRenderedFeatures({ layers: [LABEL_LAYER] }).length,
            }
            setRenderedEvidence((current) => (
              current.sourcePresent === next.sourcePresent
              && current.sourceLoaded === next.sourceLoaded
              && current.rendererQueryFeatures === next.rendererQueryFeatures
              && current.rendererQueryClusters === next.rendererQueryClusters
              && current.rendererQueryPlaces === next.rendererQueryPlaces
              && current.rendererQueryUniquePlaces === next.rendererQueryUniquePlaces
              && current.rendererRepresentedPlaces === next.rendererRepresentedPlaces
              && current.clusters === next.clusters
              && current.pins === next.pins
              && current.selectionHalos === next.selectionHalos
              && current.heatFeatures === next.heatFeatures
              && current.placeLabels === next.placeLabels
                ? current
                : next
            ))
          }
          map.on('idle', refreshRenderedEvidence)
          map.on('sourcedata', (event) => {
            if (event.sourceId === SOURCE_ID) {
              window.requestAnimationFrame(refreshRenderedEvidence)
              startOrbitWhenSourceIsReady()
            }
          })
          map.on('moveend', () => window.requestAnimationFrame(refreshRenderedEvidence))
          window.setTimeout(() => {
            refreshRenderedEvidence()
            startOrbitWhenSourceIsReady()
          }, 300)
          window.setTimeout(() => {
            refreshRenderedEvidence()
            startOrbitWhenSourceIsReady()
          }, 1_200)

          const canvas = map.getCanvas()
          canvas.setAttribute('aria-label', 'Interactive globe of synthetic purchase places')
          canvas.setAttribute('role', 'application')
          canvas.setAttribute('tabindex', '0')

          window.__SPENDSCAPE_QA_ACTIONS__ = {
            firstRenderedPoint: (layerId) => {
              const rendererLayer = layerId === 'cluster' ? CLUSTER_LAYER : PIN_LAYER
              const feature = map.queryRenderedFeatures({ layers: [rendererLayer] })[0]
              if (!feature || feature.geometry.type !== 'Point') return null
              const point = map.project(feature.geometry.coordinates as [number, number])
              return [point.x, point.y]
            },
            jumpTo: (center, zoom, pitch = 0) => map.jumpTo({ center, zoom, bearing: 0, pitch }),
            unproject: (point) => {
              const coordinate = map.unproject(point)
              return [coordinate.lng, coordinate.lat]
            },
            renderedPlaceIdsAt: (placeId) => {
              const place = placeForId(placeId)
              if (!place || !map.getLayer(PIN_LAYER)) return []
              const point = map.project(place.coordinates)
              return map.queryRenderedFeatures(point, { layers: [PIN_LAYER] })
                .map((feature) => String(feature.properties?.placeId ?? ''))
                .filter(Boolean)
            },
            renderedBasemapLabels: () => {
              const labels = map.queryRenderedFeatures()
                .filter((feature) => feature.layer.type === 'symbol' && feature.source !== SOURCE_ID)
                .map((feature): RenderedBasemapLabel => ({
                  name: typeof feature.properties?.name === 'string' ? feature.properties.name : null,
                  nameLatin: typeof feature.properties?.['name:latin'] === 'string'
                    ? feature.properties['name:latin']
                    : null,
                  nameNonLatin: typeof feature.properties?.['name:nonlatin'] === 'string'
                    ? feature.properties['name:nonlatin']
                    : null,
                  nameEnglish: typeof feature.properties?.name_en === 'string'
                    ? feature.properties.name_en
                    : null,
                  sourceLayer: feature.sourceLayer ?? null,
                }))
              return labels.filter((label, index) => labels.findIndex((candidate) => (
                candidate.name === label.name
                && candidate.nameLatin === label.nameLatin
                && candidate.nameNonLatin === label.nameNonLatin
                && candidate.sourceLayer === label.sourceLayer
              )) === index)
            },
          }

          const loadMs = Math.round((performance.now() - loadStartRef.current) * 10) / 10
          setPerformanceEvidence((current) => ({ ...current, loadMs }))
          setInitializationEvidence((current) => ({
            ...current,
            stage: 'map-ready',
            mapReadyMs: loadMs,
            failureStage: null,
          }))
          setLoading(false)
          setMapError(null)
          setStatus(copy[localeRef.current].ready)
        })

      } catch (error) {
        if (controller.signal.aborted || disposed) return
        failInitialization(error, 'map')
      }
    }

    void initialize()

    return () => {
      disposed = true
      controller.abort()
      if (mapReadyTimer !== null) window.clearTimeout(mapReadyTimer)
      clearSpinTimer()
      detachInteractionListeners()
      if (actionTimerRef.current !== null) window.clearTimeout(actionTimerRef.current)
      mapReadyRef.current = false
      programmaticCameraRef.current = false
      removeAttemptMap()
      delete window.__SPENDSCAPE_QA_ACTIONS__
    }
  }, [clearSpinTimer, mapAttempt, queueSpin, selectPlace, stopSpin, updateSelectedFilter])

  useEffect(() => {
    const canonicalSource = mapRef.current?.getSource(SOURCE_ID) as GeoJSONSource | undefined
    if (canonicalSource) {
      void canonicalSource.setData(visibleData).then(() => {
        setSourceUpdates((current) => current + 1)
      }).catch((error: unknown) => {
        setMapError(error instanceof Error ? error.message : 'Canonical place source update failed')
      })
    }
    const synchronized = synchronizeSelection(visiblePurchases, { selectedPlaceId, selectedPurchaseId })
    if (synchronized.selectedPlaceId !== selectedPlaceId) {
      setSelectedPlaceId(synchronized.selectedPlaceId)
      updateSelectedFilter(synchronized.selectedPlaceId)
    }
    if (synchronized.selectedPurchaseId !== selectedPurchaseId) {
      setSelectedPurchaseId(synchronized.selectedPurchaseId)
    }
  }, [selectedPlaceId, selectedPurchaseId, updateSelectedFilter, visibleData, visiblePurchases])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer(PIN_LAYER)) return
    applyGlobeMode(map, mode)
    setStatus(mode === 'pins' ? copy[locale].modePins : copy[locale].modeHeat)
  }, [locale, mode])

  useEffect(() => {
    const evidenceMap = !loading && !mapError && mapReadyRef.current ? mapRef.current : null
    window.__SPENDSCAPE_QA__ = {
      ready: !loading && !mapError,
      locale,
      reducedMotion,
      autoSpin,
      mode,
      surface,
      query,
      selectedPlaceId,
      selectedPurchaseId,
      captureOpen: captureStep !== null,
      captureStep,
      inboxOpen: inboxCaseId !== null,
      inboxCaseId,
      pendingInboxCount: pendingInbox.length,
      inboxDecisionStatus: activeInboxDecision?.status ?? null,
      inboxResolvedPlaceId: activeInboxDecision?.status === 'resolved' ? activeInboxDecision.placeId : null,
      askOpen,
      askUndoAvailable: askUndoSnapshot !== null,
      askLastSummary: askFeedback?.summary ?? null,
      sessionPurchaseCount: sessionCaptureRecords.length,
      combinedPurchaseCount: allPurchases.length,
      mapInstanceCount: mapInstanceCountRef.current,
      mapConstructionCount: mapConstructionCountRef.current,
      initialization: initializationEvidence,
      visiblePurchaseCount: visiblePurchases.length,
      visibleBaseTotalIls: visibleSummary.totalBaseAmountIls,
      visiblePinFeatures: visibleData.features.length,
      canonicalPins: currentGlobeCounts.pinCount,
      physicalPurchases: currentGlobeCounts.physicalConfirmedCount,
      onlineExcluded: currentGlobeCounts.onlineCount,
      unresolvedExcluded: currentGlobeCounts.unresolvedCount,
      recurringPlacePurchases: currentGlobeCounts.recurringPlacePurchases,
      recurringPlacePins: currentGlobeCounts.recurringPlacePins,
      sourcePresent: renderedEvidence.sourcePresent,
      sourceLoaded: renderedEvidence.sourceLoaded,
      canonicalGeoJsonFeatures: placeFeatureCollection.features.length,
      sourceDatasetFeatures: visibleData.features.length,
      sourceUpdates,
      rendererQueryFeatures: renderedEvidence.rendererQueryFeatures,
      rendererQueryClusters: renderedEvidence.rendererQueryClusters,
      rendererQueryPlaces: renderedEvidence.rendererQueryPlaces,
      rendererQueryUniquePlaces: renderedEvidence.rendererQueryUniquePlaces,
      rendererRepresentedPlaces: renderedEvidence.rendererRepresentedPlaces,
      renderedClusters: renderedEvidence.clusters,
      renderedPins: renderedEvidence.pins,
      renderedSelectionHalos: renderedEvidence.selectionHalos,
      renderedHeatFeatures: renderedEvidence.heatFeatures,
      renderedPlaceLabels: renderedEvidence.placeLabels,
      camera: evidenceMap ? snapshotCamera(evidenceMap) : null,
      performance: performanceEvidence,
      input: {
        ...inputEvidence,
        rtlPluginStatus: maplibregl.getRTLTextPluginStatus(),
      },
      mapStyle: {
        name: evidenceMap?.getStyle().name ?? null,
        sourceUrl: OPENFREEMAP_LIBERTY_STYLE_URL,
        projection: evidenceMap ? String(evidenceMap.getProjection().type) : null,
        pinColor: (evidenceMap?.getPaintProperty(PIN_LAYER, 'circle-color') as string | null) ?? null,
        clusterColor: evidenceMap?.getPaintProperty(CLUSTER_LAYER, 'circle-color') ?? null,
        heatmapColor: evidenceMap?.getPaintProperty(HEAT_LAYER, 'heatmap-color') ?? null,
        layerOrder: evidenceMap ? captureLayerOrder(evidenceMap) : null,
        pinOpacity: evidenceMap?.getPaintProperty(PIN_LAYER, 'circle-opacity') ?? null,
        pinStrokeColor: evidenceMap?.getPaintProperty(PIN_LAYER, 'circle-stroke-color') ?? null,
        pinRadius: evidenceMap?.getPaintProperty(PIN_LAYER, 'circle-radius') ?? null,
        pinStrokeWidth: evidenceMap?.getPaintProperty(PIN_LAYER, 'circle-stroke-width') ?? null,
        pinPitchAlignment: evidenceMap?.getPaintProperty(PIN_LAYER, 'circle-pitch-alignment') ?? null,
        pinPitchScale: evidenceMap?.getPaintProperty(PIN_LAYER, 'circle-pitch-scale') ?? null,
        selectionGlowOpacity: evidenceMap?.getPaintProperty(SELECTION_GLOW_LAYER, 'circle-opacity') ?? null,
        selectionHaloColor: evidenceMap?.getPaintProperty(HALO_LAYER, 'circle-color') ?? null,
        selectionHaloStroke: evidenceMap?.getPaintProperty(HALO_LAYER, 'circle-stroke-color') ?? null,
        heatmapWeight: evidenceMap?.getPaintProperty(HEAT_LAYER, 'heatmap-weight') ?? null,
        heatmapIntensity: evidenceMap?.getPaintProperty(HEAT_LAYER, 'heatmap-intensity') ?? null,
        heatmapRadius: evidenceMap?.getPaintProperty(HEAT_LAYER, 'heatmap-radius') ?? null,
        heatmapOpacity: evidenceMap?.getPaintProperty(HEAT_LAYER, 'heatmap-opacity') ?? null,
        pinVisibility: evidenceMap?.getLayoutProperty(PIN_LAYER, 'visibility') ?? null,
        heatmapVisibility: evidenceMap?.getLayoutProperty(HEAT_LAYER, 'visibility') ?? null,
        layerVisibility: evidenceMap
          ? Object.fromEntries(SPENDSCAPE_TOP_LAYER_ORDER.map((layerId) => [
              layerId,
              evidenceMap.getLayoutProperty(layerId, 'visibility') ?? 'visible',
            ]))
          : {},
      },
      analytics: {
        purchaseCount: visibleAnalytics.purchaseCount,
        totalBaseAmountIls: visibleAnalytics.totalBaseAmountIls,
        averageBaseAmountIls: visibleAnalytics.averageBaseAmountIls,
        physicalCount: visibleAnalytics.channels.find((channel) => channel.key === 'physical')?.purchaseCount ?? 0,
        onlineCount: visibleAnalytics.channels.find((channel) => channel.key === 'online')?.purchaseCount ?? 0,
        unresolvedCount: visibleAnalytics.channels.find((channel) => channel.key === 'unresolved')?.purchaseCount ?? 0,
        monthCount: visibleAnalytics.months.length,
        topPhysicalPlaceId: visibleAnalytics.topPhysicalPlaces[0]?.placeId ?? null,
      },
    }
  }, [activeInboxDecision, allPurchases.length, askFeedback, askOpen, askUndoSnapshot, autoSpin, captureStep, currentGlobeCounts, inboxCaseId, initializationEvidence, inputEvidence, loading, locale, mapError, mode, pendingInbox.length, performanceEvidence, query, reducedMotion, renderedEvidence, selectedPlaceId, selectedPurchaseId, sessionCaptureRecords.length, sourceUpdates, surface, visibleAnalytics, visibleData.features.length, visiblePurchases.length, visibleSummary.totalBaseAmountIls])

  const runCameraAction = useCallback((name: string, action: (map: MapLibreMap) => void) => {
    const map = mapRef.current
    if (!map) return
    stopSpin(false)
    const started = performance.now()
    let completed = false
    const finish = () => {
      if (completed) return
      completed = true
      programmaticCameraRef.current = false
      if (actionTimerRef.current !== null) window.clearTimeout(actionTimerRef.current)
      setPerformanceEvidence((current) => ({
        ...current,
        lastCameraAction: name,
        lastCameraMs: Math.round((performance.now() - started) * 10) / 10,
      }))
    }
    map.once('moveend', finish)
    programmaticCameraRef.current = true
    actionTimerRef.current = window.setTimeout(finish, 10_000)
    action(map)
  }, [stopSpin])

  const fitVisible = useCallback(() => {
    if (visibleData.features.length === 0) return
    runCameraAction('fit-bounds', (map) => {
      const bounds = new maplibregl.LngLatBounds()
      for (const feature of visibleData.features) {
        bounds.extend(feature.geometry.coordinates as [number, number])
      }
      map.fitBounds(bounds, {
        padding: window.innerWidth < 700 ? 66 : 150,
        speed: 1.5,
        ...(reducedMotionRef.current ? { duration: 0 } : {}),
        maxZoom: 7,
        essential: false,
      })
    })
  }, [runCameraAction, visibleData.features])

  const fitPlaceIds = useCallback((placeIds: string[]) => {
    const places = placeIds.map(placeForId).filter((place): place is NonNullable<typeof place> => Boolean(place))
    if (places.length === 0) return
    runCameraAction('search-city-fit', (map) => {
      const bounds = new maplibregl.LngLatBounds()
      for (const place of places) bounds.extend(place.coordinates)
      map.fitBounds(bounds, {
        padding: window.innerWidth <= 760 ? 58 : 150,
        speed: 1.5,
        maxZoom: 11,
        ...(reducedMotionRef.current ? { duration: 0 } : {}),
        essential: false,
      })
    })
  }, [runCameraAction])

  const resetGlobe = useCallback(() => {
    setSelectedPlaceId(null)
    setSelectedPurchaseId(null)
    setSurface('globe')
    updateSelectedFilter(null)
    runCameraAction('reset-globe', (map) => map.flyTo({
      ...homeCamera(),
      speed: 1.4,
      ...(reducedMotionRef.current ? { duration: 0 } : {}),
      essential: false,
    }))
  }, [runCameraAction, updateSelectedFilter])

  const clearFilters = () => setQuery(defaultPurchaseQuery)

  const openInbox = (requestedCase: SmartInboxCase = pendingInbox[0] ?? smartInboxCases[0]) => {
    if (!requestedCase) return
    stopSpin(false)
    const current: NavigationSnapshot = isNavigationSnapshot(window.history.state)
      ? window.history.state
      : { marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId }
    const snapshot: NavigationSnapshot = {
      ...current,
      captureStep: null,
      captureDepth: 0,
      inboxCaseId: requestedCase.id,
    }
    window.history.pushState(snapshot, '', navigationHash(snapshot))
    applyNavigation(snapshot)
  }

  const closeInbox = () => {
    if (inboxCaseId) window.history.back()
  }

  const exitInboxThen = (action: () => void) => {
    const snapshot: NavigationSnapshot = {
      marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId,
      captureStep: null, captureDepth: 0, inboxCaseId: null,
    }
    window.history.replaceState(snapshot, '', navigationHash(snapshot))
    applyNavigation(snapshot)
    window.setTimeout(action, 0)
  }

  const openCapture = () => {
    captureDismissedRef.current = false
    captureResumeSpinRef.current = spinEnabledRef.current
    spinEnabledRef.current = false
    clearSpinTimer()
    mapRef.current?.stop()
    const current: NavigationSnapshot = isNavigationSnapshot(window.history.state)
      ? window.history.state
      : {
          marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId,
        }
    const snapshot: NavigationSnapshot = {
      ...current,
      captureStep: 'scanner',
      captureDepth: 1,
    }
    window.history.pushState(snapshot, '', navigationHash(snapshot))
    applyNavigation(snapshot)
  }

  const navigateCapture = useCallback((nextStep: CaptureStep, mode: 'push' | 'replace' = 'push') => {
    const snapshot: NavigationSnapshot = {
      marker: 'spendscape-1d1',
      surface,
      selectedPlaceId,
      selectedPurchaseId,
      captureStep: nextStep,
      captureDepth: mode === 'push' ? Math.max(1, captureDepth + 1) : Math.max(1, captureDepth),
    }
    if (mode === 'push') window.history.pushState(snapshot, '', navigationHash(snapshot))
    else window.history.replaceState(snapshot, '', navigationHash(snapshot))
    applyNavigation(snapshot)
  }, [applyNavigation, captureDepth, selectedPlaceId, selectedPurchaseId, surface])

  const closeCapture = useCallback(() => {
    if (!captureStep) return
    pendingCaptureExitRef.current = null
    captureDismissedRef.current = true
    const snapshot: NavigationSnapshot = {
      marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId,
      captureStep: null, captureDepth: 0,
    }
    window.history.replaceState(snapshot, '', navigationHash(snapshot))
    applyNavigation(snapshot)
    resumeAfterCapture()
  }, [applyNavigation, captureStep, resumeAfterCapture, selectedPlaceId, selectedPurchaseId, surface])

  const exitCaptureThen = useCallback((action: () => void) => {
    captureDismissedRef.current = true
    const snapshot: NavigationSnapshot = {
      marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId,
      captureStep: null, captureDepth: 0,
    }
    window.history.replaceState(snapshot, '', navigationHash(snapshot))
    applyNavigation(snapshot)
    resumeAfterCapture()
    window.setTimeout(action, 0)
  }, [applyNavigation, resumeAfterCapture, selectedPlaceId, selectedPurchaseId, surface])

  const openSurface = (nextSurface: ProductSurface) => {
    stopSpin(false)
    pushNavigation({
      surface: nextSurface,
      selectedPurchaseId: null,
      selectedPlaceId: nextSurface === 'globe' ? selectedPlaceId : null,
    })
  }

  const openPurchase = (purchaseId: string) => {
    const purchase = allPurchases.find((candidate) => candidate.id === purchaseId)
    if (!purchase) return
    stopSpin(false)
    if (purchase.placeId) selectPlace(purchase.placeId, true, false)
    pushNavigation({
      surface: 'purchases',
      selectedPlaceId: purchase.placeId,
      selectedPurchaseId: purchase.id,
      captureStep: null,
      captureDepth: 0,
      inboxCaseId: null,
    })
  }

  const selectSearchResult = (result: CanonicalSearchResult) => {
    setSearchOpen(false)
    setActiveSearchIndex(-1)
    searchInputRef.current?.blur()

    if (result.kind === 'place') {
      placeReturnFocusRef.current = searchInputRef.current
      updateQuery({ search: localized(result.place.name, locale) })
      selectPlace(result.place.id)
      return
    }

    if (result.kind === 'city') {
      stopSpin(false)
      updateQuery({ search: localized(result.city, locale) })
      pushNavigation({ surface: 'globe', selectedPlaceId: null, selectedPurchaseId: null })
      updateSelectedFilter(null)
      fitPlaceIds(result.placeIds)
      setStatus(`${localized(result.city, locale)} · ${result.placeCount} ${t.placesSummary}`)
      return
    }

    openPurchase(result.purchase.id)
  }

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (!showSearchResults) return
      event.preventDefault()
      event.stopPropagation()
      setSearchOpen(false)
      setActiveSearchIndex(-1)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return
    if (!showSearchResults && event.key !== 'Enter') setSearchOpen(true)
    if (searchResults.length === 0) return
    if (event.key === 'Enter') {
      if (activeSearchIndex < 0) return
      event.preventDefault()
      selectSearchResult(searchResults[activeSearchIndex])
      return
    }
    event.preventDefault()
    setActiveSearchIndex((current) => {
      if (event.key === 'ArrowDown') return current >= searchResults.length - 1 ? 0 : current + 1
      return current <= 0 ? searchResults.length - 1 : current - 1
    })
  }

  const resetSessionCaptures = () => {
    setSessionCaptureRecords([])
    if (selectedPurchaseId?.startsWith('session_purchase_')) {
      setSelectedPurchaseId(null)
      setSelectedPlaceId(null)
    }
    setStatus(locale === 'he' ? 'תוספות ההדגמה אופסו' : 'Demo additions reset')
  }

  const setTimelineMonth = (month: string | null) => {
    stopSpin(false)
    updateQuery({ timelineMonth: month, dateRange: 'all' })
  }

  const openAsk = (trigger: HTMLElement) => {
    if (askFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(askFocusFrameRef.current)
      askFocusFrameRef.current = null
    }
    askFocusIntentRef.current = 'dismiss'
    askReturnFocusRef.current = trigger
    stopSpin(false)
    setMobileToolsOpen(false)
    setFiltersOpen(false)
    setTimelineOpen(false)
    setSearchOpen(false)
    setAskFeedback(null)
    pushNavigation({
      askOpen: true,
      captureStep: null,
      captureDepth: 0,
      inboxCaseId: null,
    })
  }

  const closeAsk = useCallback(() => {
    if (askOpen && isNavigationSnapshot(window.history.state) && window.history.state.askOpen) {
      window.history.back()
      return
    }
    setAskOpen(false)
  }, [askOpen])

  const executeAskActions = useCallback((actions: unknown, actionSummary: string) => {
    // All single, confirmed-plan, and candidate paths fail closed before state or camera changes.
    if (!isAllowedAskActionPlan(actions, askContext)) return
    const currentNavigation: NavigationSnapshot = {
      marker: 'spendscape-1d1',
      surface,
      selectedPlaceId,
      selectedPurchaseId,
      captureStep: null,
      captureDepth: 0,
      inboxCaseId: null,
      askOpen: false,
    }
    const needsMap = actions.some((action) => action.type.startsWith('map.') || action.type === 'selection.openPurchase')
    if (needsMap && (!mapRef.current || mapError || loading)) {
      setAskFeedback({
        summary: localeRef.current === 'he'
          ? 'המפה אינה זמינה כרגע. יש לנסות שוב לאחר השחזור.'
          : 'The map is unavailable. Retry after recovery.',
        undone: false,
      })
      window.history.replaceState(currentNavigation, '', navigationHash(currentNavigation))
      applyNavigation(currentNavigation)
      return
    }

    const undoSnapshot: AskUndoSnapshot = {
      navigation: currentNavigation,
      query,
      mode,
      analyticsView,
      camera: mapRef.current ? snapshotCamera(mapRef.current) : null,
    }
    let nextNavigation = { ...currentNavigation }
    let nextQuery = { ...query }
    let nextAnalyticsView = analyticsView
    const cameraActions: Array<(map: MapLibreMap) => void> = []

    for (const action of actions) {
      switch (action.type) {
        case 'map.flyToPlace': {
          const place = placeForId(action.placeId)
          if (!place) continue
          nextNavigation = { ...nextNavigation, surface: 'globe', selectedPlaceId: place.id, selectedPurchaseId: null }
          cameraActions.push((map) => map.flyTo({
            center: place.coordinates,
            zoom: 15.2,
            speed: 1.6,
            offset: window.innerWidth <= 760 ? [0, -Math.round(Math.min(180, window.innerHeight * 0.2))] : [0, 0],
            ...(reducedMotionRef.current ? { duration: 0 } : {}),
            essential: false,
          }))
          break
        }
        case 'map.flyToRegion': {
          const placeIds = globePlaces.filter((place) => (
            place[action.region.kind].en === action.region.value
          )).map((place) => place.id)
          if (placeIds.length === 0) continue
          nextNavigation = { ...nextNavigation, surface: 'globe', selectedPlaceId: null, selectedPurchaseId: null }
          cameraActions.push((map) => {
            const bounds = new maplibregl.LngLatBounds()
            for (const placeId of placeIds) {
              const place = placeForId(placeId)
              if (place) bounds.extend(place.coordinates)
            }
            map.fitBounds(bounds, {
              padding: window.innerWidth <= 760 ? 58 : 150,
              speed: 1.5,
              maxZoom: 11,
              ...(reducedMotionRef.current ? { duration: 0 } : {}),
              essential: false,
            })
          })
          break
        }
        case 'map.fitVisiblePurchases':
          if (visibleData.features.length === 0) break
          cameraActions.push((map) => {
            const bounds = new maplibregl.LngLatBounds()
            for (const feature of visibleData.features) bounds.extend(feature.geometry.coordinates as [number, number])
            map.fitBounds(bounds, {
              padding: window.innerWidth < 700 ? 66 : 150,
              speed: 1.5,
              maxZoom: 7,
              ...(reducedMotionRef.current ? { duration: 0 } : {}),
              essential: false,
            })
          })
          break
        case 'map.resetGlobe':
          nextNavigation = { ...nextNavigation, surface: 'globe', selectedPlaceId: null, selectedPurchaseId: null }
          cameraActions.push((map) => map.flyTo({
            ...homeCamera(),
            speed: 1.4,
            ...(reducedMotionRef.current ? { duration: 0 } : {}),
            essential: false,
          }))
          break
        case 'filters.set':
          nextQuery = { ...nextQuery, ...action.patch }
          break
        case 'filters.clear':
          nextQuery = { ...defaultPurchaseQuery }
          break
        case 'timeline.setMonth':
          nextQuery = { ...nextQuery, timelineMonth: action.month, dateRange: 'all' }
          break
        case 'purchases.open':
          nextNavigation = { ...nextNavigation, surface: 'purchases', selectedPlaceId: null, selectedPurchaseId: null }
          break
        case 'selection.openPurchase': {
          const purchase = allPurchases.find((candidate) => candidate.id === action.purchaseId)
          if (!purchase) continue
          nextNavigation = {
            ...nextNavigation,
            surface: 'purchases',
            selectedPlaceId: purchase.placeId,
            selectedPurchaseId: purchase.id,
          }
          if (purchase.placeId) {
            const place = placeForId(purchase.placeId)
            if (place) cameraActions.push((map) => map.flyTo({
              center: place.coordinates,
              zoom: 15.2,
              speed: 1.6,
              ...(reducedMotionRef.current ? { duration: 0 } : {}),
              essential: false,
            }))
          }
          break
        }
        case 'analytics.open':
          nextNavigation = { ...nextNavigation, surface: 'stats', selectedPlaceId: null, selectedPurchaseId: null }
          nextAnalyticsView = action.view
          break
      }
    }

    // Execution owns destination focus, not the trigger-restoration dismissal path.
    askFocusIntentRef.current = nextNavigation.surface === 'stats' && actions.some((action) => action.type === 'analytics.open') && nextAnalyticsView
      ? { analytics: nextAnalyticsView }
      : nextNavigation.selectedPurchaseId && actions.some((action) => action.type === 'selection.openPurchase')
        ? 'purchase'
        : nextNavigation.surface === 'purchases' && actions.some((action) => action.type === 'purchases.open')
          ? 'purchases' : 'feedback'
    setQuery(nextQuery)
    setAnalyticsView(nextAnalyticsView)
    window.history.replaceState(nextNavigation, '', navigationHash(nextNavigation))
    applyNavigation(nextNavigation)
    updateSelectedFilter(nextNavigation.selectedPlaceId)
    if (cameraActions.length > 0) {
      runCameraAction(`ask-${actions.map((action) => action.type).join('+')}`, (map) => {
        for (const cameraAction of cameraActions) cameraAction(map)
      })
    }
    setAskUndoSnapshot(undoSnapshot)
    setAskFeedback({ summary: actionSummary, undone: false })
    setStatus(actionSummary)
  }, [allPurchases, analyticsView, applyNavigation, askContext, loading, mapError, mode, query, runCameraAction, selectedPlaceId, selectedPurchaseId, surface, updateSelectedFilter, visibleData.features])

  const undoAskAction = useCallback(() => {
    if (!askUndoSnapshot) return
    setQuery(askUndoSnapshot.query)
    setMode(askUndoSnapshot.mode)
    setAnalyticsView(askUndoSnapshot.analyticsView)
    window.history.replaceState(askUndoSnapshot.navigation, '', navigationHash(askUndoSnapshot.navigation))
    applyNavigation(askUndoSnapshot.navigation)
    if (askUndoSnapshot.camera && mapRef.current) {
      const camera = askUndoSnapshot.camera
      runCameraAction('ask-undo', (map) => map.easeTo({
        ...camera,
        duration: reducedMotionRef.current ? 0 : 320,
        essential: false,
      }))
    }
    setAskUndoSnapshot(null)
    setAskFeedback((current) => current ? { ...current, undone: true } : null)
    setStatus(localeRef.current === 'he' ? 'פעולת ההדגמה בוטלה' : 'Demo action undone')
  }, [applyNavigation, askUndoSnapshot, runCameraAction])

  const retryMap = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('mapFailure')
    window.history.replaceState(window.history.state, '', url)
    setMapAttempt((current) => current + 1)
  }

  return (
    <main
      className={styles.app}
      data-locale={locale}
      data-map-ready={!loading && !mapError}
      data-auto-spin={autoSpin}
      data-mode={mode}
      data-pin-count={currentGlobeCounts.pinCount}
      data-online-excluded={currentGlobeCounts.onlineCount}
      data-unresolved-excluded={currentGlobeCounts.unresolvedCount}
      data-frame-p95={performanceEvidence.p95FrameMs}
      data-mobile-tools={mobileToolsOpen}
      data-surface={surface}
      data-visible-purchases={visiblePurchases.length}
      data-visible-pins={visibleData.features.length}
      data-capture-open={captureStep !== null}
      data-inbox-open={inboxCaseId !== null}
      data-inbox-pending={pendingInbox.length}
      data-session-purchases={sessionCaptureRecords.length}
      data-ask-open={askOpen}
    >
      <div ref={mapNodeRef} className={styles.map} data-testid="map-canvas" />
      <div className={styles.vignette} aria-hidden="true" />

      <header className={styles.header}>
        <a href="#globe-controls" className={styles.skipLink}>Skip to globe controls</a>
        <button type="button" className={styles.brand} onClick={() => openSurface('globe')} aria-label={t.product}>
          <span className={styles.brandMark} aria-hidden="true">
            <span />
          </span>
          <span className={styles.brandWords}>
            <strong>{t.product}</strong>
            <small>{t.checkpoint}</small>
          </span>
        </button>

        <nav className={styles.desktopNav} aria-label="Primary">
          <button type="button" data-active={surface === 'globe'} onClick={() => openSurface('globe')}>{t.navGlobe}</button>
          <button type="button" data-active={surface === 'stats'} onClick={() => openSurface('stats')}>{t.navAnalytics}</button>
          <button type="button" data-active={surface === 'purchases'} onClick={() => openSurface('purchases')}>{t.navPurchases}</button>
        </nav>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.inboxButton}
            onClick={() => openInbox()}
            aria-label={`${t.openInbox}${pendingInbox.length ? ` · ${pendingInbox.length}` : ''}`}
            data-testid="smart-inbox-open"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5zM5 14h4l1.5 2h3L15 14h4"/></svg>
            <span>{t.inbox}</span>
            {pendingInbox.length > 0 && <em aria-label={`${pendingInbox.length} pending`}>{pendingInbox.length}</em>}
          </button>
          <button
            type="button"
            className={styles.addPurchaseButton}
            onClick={openCapture}
            data-testid="capture-open-desktop"
          >
            <span aria-hidden="true">＋</span>{t.addPurchase}
          </button>
          <span className={styles.syntheticBadge}>{t.synthetic}</span>
          <button
            type="button"
          className={styles.languageButton}
            onClick={() => { stopSpin(false); setLocale((current) => current === 'en' ? 'he' : 'en') }}
            aria-label={t.language}
          >
            {locale === 'en' ? 'עב' : 'EN'}
          </button>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="globe-title">
        <p className={styles.eyebrow}>{t.checkpoint}</p>
        <h1 id="globe-title">{t.headline}</h1>
        <p className={styles.heroCopy}>{t.intro}</p>
        <p className={styles.heroMeta}>
          <span><strong>{currentGlobeCounts.pinCount}</strong> {t.placesSummary}</span>
          <i aria-hidden="true" />
          <span><strong>{currentGlobeCounts.physicalConfirmedCount}</strong> {t.purchasesSummary}</span>
        </p>
      </section>

      <section ref={queryDockRef} className={styles.queryDock} aria-label="Globe query controls" data-testid="query-dock">
        <div ref={searchRootRef} className={styles.searchShell}>
          <label className={styles.searchField}>
            <span className={styles.srOnly}>{t.search}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input
              ref={searchInputRef}
              type="search"
              role="combobox"
              value={query.search}
              onChange={(event) => {
                stopSpin(false)
                const nextSearch = event.target.value
                updateQuery({ search: nextSearch })
                setSearchOpen(nextSearch.trim().length > 0)
              }}
              onFocus={() => {
                if (searchHasValue && !suppressSearchFocusOpenRef.current) setSearchOpen(true)
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={t.searchPlaceholder}
              aria-label={t.search}
              aria-autocomplete="list"
              aria-expanded={showSearchResults}
              aria-controls="canonical-search-results"
              aria-activedescendant={activeSearchIndex >= 0 ? `canonical-search-option-${activeSearchIndex}` : undefined}
              data-testid="shared-search"
            />
          </label>
          {showSearchResults && (
            <div
              id="canonical-search-results"
              className={styles.searchResults}
              role="listbox"
              aria-label={t.searchScope}
              data-testid="search-results"
            >
              <header>
                <strong>{t.searchScope}</strong>
                <span>{searchResults.length} {t.results}</span>
              </header>
              {searchResults.length === 0 ? (
                <p className={styles.searchEmpty} role="status">{t.noSearchResults}</p>
              ) : searchResults.map((result, index) => {
                const primary = result.kind === 'place'
                  ? localized(result.place.name, locale)
                  : result.kind === 'city'
                    ? localized(result.city, locale)
                    : localized(result.merchant.name, locale)
                const secondary = result.kind === 'place'
                  ? `${localized(result.place.branch, locale)} · ${localized(result.place.city, locale)} · ${result.purchaseCount} ${t.visits}`
                  : result.kind === 'city'
                    ? `${result.placeCount} ${t.placesSummary} · ${result.physicalPurchaseCount} ${t.physicalPurchaseMatches}`
                    : result.matchedItems.length > 0
                      ? `${localized(result.matchedItems[0], locale)} · ${formatDate(result.purchase.timestamp, locale)}`
                      : `${result.purchase.channel === 'online' ? t.onlineNoPin : t.unresolvedNoPin} · ${formatDate(result.purchase.timestamp, locale)}`
                return (
                  <button
                    key={result.id}
                    id={`canonical-search-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeSearchIndex === index}
                    className={styles.searchResult}
                    data-result-kind={result.kind}
                    data-result-id={result.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => selectSearchResult(result)}
                  >
                    <span className={styles.searchResultIcon} data-kind={result.kind} aria-hidden="true" />
                    <span className={styles.searchResultCopy}>
                      <strong>{primary}</strong>
                      <small>{secondary}</small>
                    </span>
                    <em>{result.kind === 'place' ? t.searchPlace : result.kind === 'city' ? t.searchCity : t.searchPurchase}</em>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className={`${styles.categories} ${styles.desktopCategories}`} role="group" aria-label="Categories">
          {(Object.keys(categoryLabels) as CategoryFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              data-category={item}
              aria-pressed={query.category === item}
              onClick={() => { stopSpin(false); updateQuery({ category: item }) }}
            >
              {t[categoryLabels[item]]}
            </button>
          ))}
        </div>
        <div className={styles.queryActions}>
          <button type="button" onClick={() => { stopSpin(false); setFiltersOpen(true) }} data-testid="filters-open">
            {t.filters}{activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
          <button type="button" onClick={() => { stopSpin(false); setTimelineOpen(true) }} data-testid="timeline-open">
            {query.timelineMonth ?? t.timeline}
          </button>
          <button
            type="button"
            className={styles.askButton}
            ref={desktopAskTriggerRef}
            onClick={(event) => openAsk(event.currentTarget)}
            data-testid="ask-open-desktop"
          >
            <span aria-hidden="true">✦</span>{locale === 'he' ? 'שאלו' : 'Ask'}
          </button>
          <output aria-live="polite">{visiblePurchases.length} {t.results} · {visibleData.features.length} {t.placesSummary}</output>
        </div>
      </section>

      {mobileToolsOpen && compactViewport && (
        <button
          type="button"
          className={styles.mobileScrim}
          onClick={() => setMobileToolsOpen(false)}
          aria-label={t.closeTools}
        />
      )}

      {(!compactViewport || mobileToolsOpen) && (
      <section ref={controlDockRef} className={styles.controlDock} id="globe-controls" aria-label="Globe controls" data-testid="globe-tools">
        <div className={styles.mobileControlsHeader}>
          <span>{t.tools}</span>
          <button type="button" onClick={() => setMobileToolsOpen(false)} aria-label={t.closeTools}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className={styles.mobileCategories} role="group" aria-label="Categories">
          {(Object.keys(categoryLabels) as CategoryFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              data-category={item}
              aria-pressed={query.category === item}
              onClick={() => { stopSpin(false); updateQuery({ category: item }) }}
            >
              {t[categoryLabels[item]]}
            </button>
          ))}
        </div>

        <div className={styles.mobileQueryActions}>
          <button type="button" onClick={() => { setMobileToolsOpen(false); setFiltersOpen(true) }}>{t.filters}</button>
          <button type="button" onClick={() => { setMobileToolsOpen(false); setTimelineOpen(true) }}>{t.timeline}</button>
        </div>

        <button
          type="button"
          className={styles.mobileAskRow}
          onClick={(event) => openAsk(event.currentTarget)}
          data-testid="ask-open-mobile"
        >
          <span aria-hidden="true">✦</span>
          <span><strong>{locale === 'he' ? 'שאלו את Spendscape' : 'Ask Spendscape'}</strong><small>{locale === 'he' ? 'הדגמה מקומית וסינתטית' : 'Local synthetic actions'}</small></span>
          <i aria-hidden="true">{locale === 'he' ? '←' : '→'}</i>
        </button>

        <div className={styles.modeSwitch} role="group" aria-label="Visualization">
          <button type="button" aria-pressed={mode === 'pins'} onClick={() => { stopSpin(false); setMode('pins') }}>{t.pins}</button>
          <button type="button" aria-pressed={mode === 'heatmap'} onClick={() => { stopSpin(false); setMode('heatmap') }}>{t.heatmap}</button>
        </div>

        <label className={styles.placeSelect}>
          <span className={styles.srOnly}>{t.jump}</span>
          <select
            value={selectedPlaceId ?? ''}
            onChange={(event) => { if (event.target.value) selectPlace(event.target.value) }}
            aria-label={t.jump}
          >
            <option value="">{t.choosePlace}</option>
            {visibleData.features.map((feature) => (
              <option key={feature.properties.placeId} value={feature.properties.placeId}>
                {locale === 'he' ? feature.properties.nameHe : feature.properties.nameEn}
                {' · '}
                {locale === 'he' ? feature.properties.cityHe : feature.properties.cityEn}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.cameraButtons}>
          <button type="button" onClick={fitVisible} aria-label={t.fit} title={t.fit}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/></svg>
          </button>
          <button type="button" onClick={() => selectPlace('place_shuk_bograshov')} aria-label={t.latest} title={t.latest}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>
          </button>
          <button type="button" onClick={resetGlobe} aria-label={t.reset} title={t.reset}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11a8 8 0 1 0 2-5.3M4 4v7h7"/></svg>
          </button>
          <button
            type="button"
            onClick={() => autoSpin ? stopSpin(false) : resumeSpin()}
            aria-label={autoSpin ? t.pause : t.resume}
            title={autoSpin ? t.pause : t.resume}
            disabled={reducedMotion}
          >
            {autoSpin ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7v10M15 7v10"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6Z"/></svg>
            )}
          </button>
          <span className={styles.zoomGroup}>
            <button type="button" onClick={() => { stopSpin(false); mapRef.current?.zoomOut({ duration: reducedMotion ? 0 : 350 }) }} aria-label={t.zoomOut}>−</button>
            <button type="button" onClick={() => { stopSpin(false); mapRef.current?.zoomIn({ duration: reducedMotion ? 0 : 350 }) }} aria-label={t.zoomIn}>+</button>
          </span>
        </div>
        <p className={styles.keyboardHint}>{t.keyboard}</p>
      </section>
      )}

      <div className={styles.mobilePrimary} aria-label="Primary globe actions">
        <button type="button" className={styles.mobileLatest} onClick={() => selectPlace('place_shuk_bograshov')}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>
          <span>{t.latest}</span>
        </button>
        <button
          type="button"
          className={styles.mobileToolsButton}
          ref={mobileToolsButtonRef}
          onClick={() => { stopSpin(false); setMobileToolsOpen((current) => !current) }}
          aria-expanded={mobileToolsOpen}
          aria-controls="globe-controls"
          aria-label={t.tools}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/></svg>
        </button>
      </div>

      <div className={styles.liveStatus} role="status" aria-live="polite">
        <span data-active={autoSpin} /><span className={styles.statusText}>{status}</span>
      </div>

      {loading && surface === 'globe' && !captureStep && (
        <div className={styles.loadingState} role="status" data-testid="map-loading">
          <div className={styles.loadingGlobe} aria-hidden="true"><span /></div>
          <p className={styles.eyebrow}>{t.synthetic}</p>
          <h2>{t.loading}</h2>
          <p>{t.loadingBody}</p>
          <div className={styles.loadingLine}><span /></div>
        </div>
      )}

      {mapError && surface === 'globe' && !captureStep && (
        <div className={styles.failureState} role="alert" data-testid="map-failure">
          <span className={styles.failureIcon} aria-hidden="true">!</span>
          <p className={styles.eyebrow}>{t.checkpoint}</p>
          <h2>{t.mapFailed}</h2>
          <p>{t.mapFailedBody}</p>
          <button type="button" onClick={retryMap}>{t.retry}</button>
          <small>{mapError}</small>
        </div>
      )}

      {!loading && !mapError && visibleData.features.length === 0 && (
        <div className={styles.emptyState} role="status" data-testid="map-empty">
          <p className={styles.eyebrow}>{t.synthetic}</p>
          <h2>{t.noPlaces}</h2>
          <p>{t.noPlacesBody}</p>
          <button type="button" onClick={clearFilters}>{t.clear}</button>
        </div>
      )}

      {selectedFeature && selectedPlace && !selectedPurchase && surface === 'globe' && (
        <aside
          className={styles.placePanel}
          style={placePanelStyle}
          aria-labelledby="place-title"
          data-testid="place-panel"
        >
          <button
            type="button"
            className={styles.closePanel}
            onClick={closeTopLayer}
            aria-label={t.close}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
          <div className={styles.placePanelScroll} data-testid="place-panel-scroll">
            <span className={styles.panelCategory}>{t[selectedFeature.properties.category]}</span>
            <h2 id="place-title">{localized(selectedPlace.name, locale)}</h2>
            <p className={styles.panelLocation}>
              {localized(selectedPlace.branch, locale)} · {localized(selectedPlace.city, locale)}
            </p>
            <div className={styles.panelStats}>
              <span><strong>{selectedFeature.properties.visitCount}</strong>{t.visits}</span>
              <span><strong>{formatMoney(selectedFeature.properties.totalBaseAmountIls, locale)}</strong>{t.normalized}</span>
            </div>
            <div className={styles.panelLatest}>
              <span>{t.latestVisit}</span>
              <strong>{formatDate(selectedFeature.properties.latestTimestamp, locale)}</strong>
            </div>
            <div className={styles.placePurchaseList}>
              {selectedPlacePurchases.map((purchase) => (
                <button type="button" key={purchase.id} onClick={() => openPurchase(purchase.id)}>
                  <span>{formatDate(purchase.timestamp, locale)}</span>
                  <strong>{formatMoney(purchase.originalAmount, locale, purchase.originalCurrency)}</strong>
                </button>
              ))}
            </div>
            <p className={styles.panelTruth}>{t.synthetic} · {currentGlobeCounts.recurringPlacePurchases}:1 {locale === 'en' ? 'pin rule verified in fixtures' : 'כלל הסיכה אומת בנתונים'}</p>
          </div>
        </aside>
      )}

      {surface === 'purchases' && !selectedPurchase && (
        <section className={styles.purchasesPanel} aria-labelledby="purchases-title" data-testid="purchases-panel">
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>{t.synthetic}</p>
              <h2 id="purchases-title">{t.history}</h2>
              <p>{t.historyIntro}</p>
            </div>
            <button ref={purchasesCloseRef} type="button" className={styles.closePanel} onClick={closeTopLayer} aria-label={t.closeHistory}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
            </button>
          </header>

          <div className={styles.historySummary} data-testid="derived-summary">
            <span><strong>{visibleSummary.purchaseCount}</strong>{t.results}</span>
            <span><strong>{formatMoney(visibleSummary.totalBaseAmountIls, locale)}</strong>{t.total}</span>
            <span><strong>{visibleSummary.currencies.length}</strong>{t.currencies}</span>
          </div>

          <label className={styles.panelSearch}>
            <span className={styles.srOnly}>{t.search}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input type="search" value={query.search} onChange={(event) => updateQuery({ search: event.target.value })} placeholder={t.search} aria-label={t.search} data-testid="history-search" />
          </label>

          <div className={styles.historyActions}>
            <button type="button" data-testid="history-filters" onClick={() => setFiltersOpen(true)}>{t.filters}{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>
            <button type="button" data-testid="history-timeline" onClick={() => setTimelineOpen(true)}>{query.timelineMonth ? formatMonth(query.timelineMonth, locale) : t.timeline}</button>
            {(query.search || query.category !== 'all' || activeFilterCount > 0) && (
              <button type="button" data-testid="history-reset" onClick={clearFilters}>{t.resetQuery}</button>
            )}
          </div>

          {visiblePurchases.length === 0 ? (
            <div className={styles.historyEmpty} role="status" data-testid="purchases-empty">
              <h3>{t.noPurchases}</h3>
              <p>{t.noPurchasesBody}</p>
              <button type="button" onClick={clearFilters}>{t.resetQuery}</button>
            </div>
          ) : (
            <div className={styles.purchaseList}>
              {visiblePurchases.map((purchase) => {
                const merchant = merchantForId(purchase.merchantId)
                const place = purchase.placeId ? placeForId(purchase.placeId) : undefined
                const typeLabel = purchase.resolution === 'unresolved'
                  ? t.unresolvedNoPin
                  : purchase.channel === 'online'
                    ? t.onlineNoPin
                    : purchase.paymentMode === 'cash'
                      ? t.manualEntry
                      : place ? localized(place.city, locale) : t.physical
                return (
                  <button
                    type="button"
                    key={purchase.id}
                    className={styles.purchaseRow}
                    onClick={() => openPurchase(purchase.id)}
                    data-testid={`purchase-${purchase.id}`}
                    data-purchase-kind={purchase.resolution === 'unresolved' ? 'unresolved' : purchase.channel === 'online' ? 'online' : purchase.paymentMode === 'cash' ? 'cash-manual' : 'physical'}
                  >
                    <span className={styles.purchaseGlyph} data-category={purchase.category} aria-hidden="true" />
                    <span className={styles.purchaseIdentity}>
                      <strong>{merchant ? localized(merchant.name, locale) : purchase.merchantId}</strong>
                      <small>{typeLabel} · {formatDate(purchase.timestamp, locale)}</small>
                      {purchase.items.length > 0 && <em>{purchase.items.length} {t.receiptItems.toLocaleLowerCase()}</em>}
                    </span>
                    <span className={styles.purchaseAmount}>
                      <strong>{formatMoney(purchase.originalAmount, locale, purchase.originalCurrency)}</strong>
                      {purchase.originalCurrency !== 'ILS' && <small>{formatMoney(baseAmountIlsForPurchase(purchase), locale)}</small>}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {surface === 'stats' && (
        <SpendscapeAnalytics
          analytics={visibleAnalytics}
          locale={locale}
          query={query}
          activeFilterCount={activeFilterCount}
          onClose={closeTopLayer}
          onSearch={(search) => { stopSpin(false); updateQuery({ search }) }}
          onOpenFilters={() => { stopSpin(false); setFiltersOpen(true) }}
          onOpenTimeline={() => { stopSpin(false); setTimelineOpen(true) }}
          onReset={clearFilters}
          onOpenPurchases={() => openSurface('purchases')}
          onSelectCategory={(category) => { stopSpin(false); updateQuery({ category }) }}
          onSelectChannel={(channel) => { stopSpin(false); updateQuery({ channel }) }}
          onSelectCurrency={(currency) => { stopSpin(false); updateQuery({ currency }) }}
          onSelectMonth={setTimelineMonth}
          onSelectPlace={selectPlace}
          initialView={analyticsView}
        />
      )}

      {selectedPurchase && selectedMerchant && (
        <aside className={styles.purchaseDetailPanel} aria-labelledby="purchase-title" data-testid="purchase-detail">
          <button ref={purchaseDetailBackRef} type="button" className={styles.closePanel} onClick={closeTopLayer} aria-label={t.backToHistory}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
          <p className={styles.eyebrow}>{t.purchaseDetail} · {t.synthetic}</p>
          <h2 id="purchase-title">{localized(selectedMerchant.name, locale)}</h2>
          <p className={styles.panelLocation}>
            {selectedPurchase.placeId
              ? `${localized(placeForId(selectedPurchase.placeId)!.branch, locale)} · ${localized(placeForId(selectedPurchase.placeId)!.city, locale)}`
              : selectedPurchase.resolution === 'unresolved' ? t.unresolvedNoPin : t.onlineNoPin}
          </p>

          <div className={styles.detailBadges}>
            <span>{t[selectedPurchase.category]}</span>
            <span>{t[selectedPurchase.paymentMode]}</span>
            <span>{selectedPurchase.resolution === 'confirmed' ? t.confirmedStatus : t.unresolvedStatus}</span>
          </div>

          <div className={styles.amountLedger}>
            <span><small>{t.originalAmount}</small><strong>{formatMoney(selectedPurchase.originalAmount, locale, selectedPurchase.originalCurrency)}</strong></span>
            <span><small>{t.baseAmount}</small><strong>{formatMoney(baseAmountIlsForPurchase(selectedPurchase), locale)}</strong></span>
          </div>

          <section className={styles.receiptSection} aria-labelledby="receipt-title">
            <h3 id="receipt-title">{t.receiptItems}</h3>
            {selectedPurchase.items.length === 0 ? <p>{t.noReceiptItems}</p> : (
              <ul>
                {selectedPurchase.items.map((item) => (
                  <li key={item.id}>
                    <span>{localized(item.label, locale)}<small>{item.quantity} × {formatMoney(item.unitPrice, locale, selectedPurchase.originalCurrency)}</small></span>
                    <strong>{formatMoney(item.lineTotal, locale, selectedPurchase.originalCurrency)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className={styles.provenanceBlock}>
            <span><small>{t.fxProvenance}</small><strong>{localized(selectedPurchase.fx.label, locale)} · {selectedPurchase.fx.rateToBase} {selectedPurchase.fx.baseCurrency}</strong></span>
            <span><small>{t.sourceEvidence}</small><strong>{selectedEvidence.map((record) => localized(record.label, locale)).join(' · ')}</strong></span>
          </div>

          {selectedPurchaseInboxCase && (
            <button
              type="button"
              className={styles.reviewMatchButton}
              onClick={() => openInbox(selectedPurchaseInboxCase)}
              data-testid="review-match"
            >
              <span aria-hidden="true">?</span>{t.reviewMatch}
            </button>
          )}

          {selectedPurchase.placeId && (
            <button type="button" className={styles.viewPlaceButton} onClick={() => selectPlace(selectedPurchase.placeId!)}>{t.viewPlace}</button>
          )}
        </aside>
      )}

      {filtersOpen && (
        <>
          <button type="button" className={styles.experienceScrim} onClick={() => setFiltersOpen(false)} aria-label={t.closeFilters} />
          <aside className={`${styles.experienceSheet} ${styles.filterSheet}`} role="dialog" aria-modal="true" aria-labelledby="filters-title" data-testid="filters-sheet">
            <header><h2 id="filters-title">{t.filters}</h2><button type="button" onClick={() => setFiltersOpen(false)} aria-label={t.closeFilters}>×</button></header>
            <div className={styles.filterGrid}>
              <label>{t.category}<select value={query.category} onChange={(event) => updateQuery({ category: event.target.value as CategoryFilter })}>{(Object.keys(categoryLabels) as CategoryFilter[]).map((item) => <option key={item} value={item}>{t[categoryLabels[item]]}</option>)}</select></label>
              <label>{t.currency}<select data-testid="currency-filter" value={query.currency} onChange={(event) => updateQuery({ currency: event.target.value as CurrencyFilter })}>{currencyOptions.map((item) => <option key={item} value={item}>{item === 'all' ? t.all : item}</option>)}</select></label>
              <label>{t.channel}<select data-testid="channel-filter" value={query.channel} onChange={(event) => updateQuery({ channel: event.target.value as ChannelFilter })}>{(Object.keys(channelLabels) as ChannelFilter[]).map((item) => <option key={item} value={item}>{t[channelLabels[item]]}</option>)}</select></label>
              <label>{t.dateRange}<select data-testid="date-filter" value={query.dateRange} onChange={(event) => updateQuery({ dateRange: event.target.value as DateRangeFilter, timelineMonth: null })}>{(Object.keys(dateRangeLabels) as DateRangeFilter[]).map((item) => <option key={item} value={item}>{t[dateRangeLabels[item]]}</option>)}</select></label>
            </div>
            <footer><button type="button" onClick={clearFilters}>{t.resetQuery}</button><output>{visiblePurchases.length} {t.results} · {visibleData.features.length} {t.placesSummary}</output></footer>
          </aside>
        </>
      )}

      {timelineOpen && (
        <>
          <button type="button" className={styles.experienceScrim} onClick={() => setTimelineOpen(false)} aria-label={t.closeTimeline} />
          <aside className={`${styles.experienceSheet} ${styles.timelineSheet}`} role="dialog" aria-modal="true" aria-labelledby="timeline-title" data-testid="timeline-sheet">
            <header><div><p className={styles.eyebrow}>{t.selectedMonth}</p><h2 id="timeline-title">{query.timelineMonth ? formatMonth(query.timelineMonth, locale) : t.allHistory}</h2></div><button type="button" onClick={() => setTimelineOpen(false)} aria-label={t.closeTimeline}>×</button></header>
            <input
              type="range"
              min="0"
              max={timelineMonths.length}
              value={query.timelineMonth ? timelineMonths.indexOf(query.timelineMonth) + 1 : 0}
              onChange={(event) => setTimelineMonth(Number(event.target.value) === 0 ? null : timelineMonths[Number(event.target.value) - 1])}
              aria-label={t.timeline}
              data-testid="timeline-range"
            />
            <div className={styles.timelineLabels}><span>{t.allHistory}</span><span>{formatMonth(timelineMonths[timelineMonths.length - 1], locale)}</span><span>{formatMonth(timelineMonths[0], locale)}</span></div>
            <footer><button type="button" onClick={() => setTimelineMonth(null)}>{t.clearTimeline}</button><output>{visiblePurchases.length} {t.results} · {visibleData.features.length} {t.placesSummary}</output></footer>
          </aside>
        </>
      )}

      {captureStep && (
        <CaptureExperience
          locale={locale}
          step={captureStep}
          reducedMotion={reducedMotion}
          sessionRecords={sessionCaptureRecords}
          onNavigate={navigateCapture}
          onBack={() => window.history.back()}
          onClose={closeCapture}
          onConfirm={(record) => {
            setSessionCaptureRecords((current) => [...current, record])
            setStatus(locale === 'he' ? 'הרכישת ההדגמה נוספה' : 'Demo purchase added')
          }}
          onResetSession={resetSessionCaptures}
          onViewPurchase={(purchaseId) => exitCaptureThen(() => openPurchase(purchaseId))}
          onShowOnGlobe={(placeId) => exitCaptureThen(() => selectPlace(placeId))}
        />
      )}

      {inboxCaseId && activeInboxCase && activeInboxPurchase && (
        <SmartInboxExperience
          locale={locale}
          inboxCase={activeInboxCase}
          purchase={activeInboxPurchase}
          purchases={basePurchases}
          decision={activeInboxDecision}
          onClose={closeInbox}
          onConfirm={(decision) => {
            setSmartInboxDecisions((current) => upsertSmartInboxDecision(current, decision))
            setStatus(locale === 'he' ? 'החלטת ההדגמה עודכנה' : 'Demo decision updated')
          }}
          onUndo={() => {
            setSmartInboxDecisions((current) => removeSmartInboxDecision(current, activeInboxCase.id))
            setStatus(locale === 'he' ? 'החלטת ההדגמה בוטלה' : 'Demo decision undone')
          }}
          onOpenPurchase={(purchaseId) => exitInboxThen(() => openPurchase(purchaseId))}
          onShowPlace={(placeId) => exitInboxThen(() => selectPlace(placeId))}
        />
      )}

      {askOpen && !captureStep && !inboxCaseId && (
        <AskSpendscapeExperience
          locale={locale}
          context={askContext}
          onClose={closeAsk}
          onExecute={executeAskActions}
        />
      )}

      {askFeedback && !askOpen && (
        <div className={styles.askFeedback} role="status" data-undone={askFeedback.undone} data-testid="ask-feedback">
          <span aria-hidden="true">{askFeedback.undone ? '↶' : '✓'}</span>
          <p><strong>{askFeedback.undone ? (locale === 'he' ? 'בוטל' : 'Undone') : (locale === 'he' ? 'בוצע מקומית' : 'Applied locally')}</strong><small>{askFeedback.summary}</small></p>
          {!askFeedback.undone && askUndoSnapshot && <button ref={askUndoButtonRef} type="button" onClick={undoAskAction} data-testid="ask-undo">{locale === 'he' ? 'ביטול פעולה' : 'Undo'}</button>}
          <button
            type="button"
            className={styles.askFeedbackClose}
            onClick={() => { setAskFeedback(null); setAskUndoSnapshot(null) }}
            aria-label={locale === 'he' ? 'סגירת סטטוס' : 'Dismiss status'}
          >×</button>
        </div>
      )}

      <nav className={styles.mobileNav} aria-label="Mobile primary">
        <button type="button" data-active={surface === 'globe'} aria-current={surface === 'globe' ? 'page' : undefined} onClick={() => openSurface('globe')}>
          <i className={styles.mobileNavIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 4 5.5 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.5-4-9s1.4-6.5 4-9Z"/></svg></i>
          <span>{t.navGlobe}</span>
        </button>
        <button type="button" className={styles.mobileCaptureButton} data-active={Boolean(captureStep)} aria-pressed={Boolean(captureStep)} onClick={openCapture} data-testid="capture-open-mobile">
          <i className={styles.mobileNavIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg></i>
          <span>{t.capture}</span>
        </button>
        <button type="button" data-active={surface === 'purchases'} aria-current={surface === 'purchases' ? 'page' : undefined} onClick={() => openSurface('purchases')}>
          <i className={styles.mobileNavIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4.5"/></svg></i>
          <span>{t.navPurchases}</span>
        </button>
        <button type="button" data-active={surface === 'stats'} aria-current={surface === 'stats' ? 'page' : undefined} onClick={() => openSurface('stats')}>
          <i className={styles.mobileNavIcon} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 19v-6M12 19V5M19 19v-9M3 19h18"/></svg></i>
          <span>{t.mobileStats}</span>
        </button>
      </nav>
    </main>
  )
}
