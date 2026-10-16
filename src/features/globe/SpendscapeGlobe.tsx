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
import { composeUserGraph } from '@/data/spendscape-user'
import type { SpendscapeDataSnapshot } from '@/data/spendscape-repository'
import {
  availableTimelineMonths,
  baseAmountIlsForPurchase,
  buildPlaceFeatureCollection,
  defaultPurchaseQuery,
  deriveCanonicalSearchResults,
  derivedPurchaseSummary,
  filterPurchases,
  localized,
  merchantForId,
  placeForId,
  purchasesForPlace,
  purchaseItemTotalMinor,
  synchronizeSelection,
  type CategoryFilter,
  type CanonicalSearchResult,
  type ChannelFilter,
  type CurrencyCode,
  type CurrencyFilter,
  type DateRangeFilter,
  type GlobePurchase,
  type LocaleCode,
  type PlaceFeatureProperties,
  type PurchaseQuery,
  type SmartInboxCase,
} from '@/data/spendscape-globe'
import {
  combineSessionPurchases,
  type CaptureStep,
} from '@/features/capture/capture-domain'
import { ReceiptPayableSummary } from '@/features/capture/ReceiptPayableSummary'
import { NearbyDemoCard } from '@/features/nearby-demo/NearbyDemoCard'
import { demoComparison } from '@/features/nearby-demo/comparison'
import { useLocalPurchases } from '@/features/local-purchases/useLocalPurchases'
import { AddressAttribution } from '@/features/local-purchases/AddressSearch'
import type { LocalPlace } from '@/features/local-purchases/local-directory'
import { PurchaseLocationReview } from '@/features/local-purchases/PurchaseLocationReview'
import { PurchaseTimeCorrection } from '@/features/local-purchases/PurchaseTimeCorrection'
import { correctPurchaseTime, type PurchaseTimeIntent } from '@/features/local-purchases/purchase-time'
import type { ReceiptPlaceSeed } from '@/features/capture/receipt-place-seed'
import { resolvePurchaseLocation, undoPurchaseLocation, type PurchaseLocationIntent, type LocationUndo } from '@/features/local-purchases/purchase-location'
import { LocalDataPanel } from '@/features/local-purchases/LocalDataPanel'
import { dismissLegacyNotice, legacyNotice } from '@/features/local-purchases/legacy-device-migration'
import { restoredLedger } from '@/features/local-purchases/local-purchase-store'
import { composeDirectory } from '@/features/local-purchases/local-directory'
import { deleteLocalPurchase, emptySessionLedger, expireSessionPurchaseUndo, saveReviewedPurchase, undoSessionPurchase } from '@/features/capture/session-purchase-domain'
import { isLocated, loadCatalogStores } from '@/features/capture/catalog-stores'
import { catalogChainNames } from '@/features/local-purchases/place-provenance'
import { thisMonthSummary } from '@/features/insights/insights-domain'
import { SavingsPanel } from '@/features/savings/SavingsPanel'
import { savingsBasket } from '@/features/savings/purchase-basket'
import { offsetBesidePanel } from '@/features/savings/savings-camera'
import type { SavingsStore } from '@/features/savings/savings-engine'
import { DEFAULT_LOCALE, offeredDirectory, readDemoPreference, readLocalePreference, writeDemoPreference, writeLocalePreference } from '@/data/demo-visibility'
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
import { LifeReplayExperience, type ReplayController } from '../replay/LifeReplayExperience'
import { replayPlace } from '../replay/life-replay-domain'
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

const NearbyPricesReview = dynamic(() => import('@/features/nearby-prices/NearbyPricesReview').then(module => module.NearbyPricesReview), { ssr: false })

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
// Supermarkets with published prices: context markers, never purchase places or pins.
const CATALOG_SOURCE_ID = 'spendscape-catalog-stores'
const CATALOG_STORE_LAYER = 'spendscape-catalog-stores'
const CATALOG_LABEL_LAYER = 'spendscape-catalog-store-labels'
const catalogLabelExpression = (locale: LocaleCode) => ['concat', ['get', locale === 'he' ? 'chainHe' : 'chainEn'], ' · ', ['get', 'name']] as maplibregl.ExpressionSpecification
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
  replay?: { id: string } | null
}

interface ReplaySession {
  id: string
  entry: AskUndoSnapshot
  purchaseIds: string[]
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
  repositoryAdapter: SpendscapeDataSnapshot['source']['adapter']
  dataClassification: SpendscapeDataSnapshot['source']['classification']
  dataVersion: string
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
  replayAutomaticCameraCommands: number
  replayExplicitCameraCommands: number
  replayEventPresentations: number
  replaySourceUpdatesAtOpen: number | null
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

const userCopy = {
  en: {
    checkpoint: 'Your purchase world', synthetic: 'On this device', searchScope: 'Your purchase history',
    normalized: 'ILS total · reported conversions', total: 'ILS total · reported conversions',
    baseAmount: 'Reported ILS amount', mapFailedBody: 'Your saved purchases remain on this device. You can still use Purchases and Capture.',
    historyIntro: 'Purchases you reviewed and saved in this browser. No cloud synchronization.',
  },
  he: {
    checkpoint: 'עולם הרכישות שלכם', synthetic: 'במכשיר הזה', searchScope: 'היסטוריית הרכישות שלכם',
    normalized: 'סכום בש״ח · המרות בדיווח שלכם', total: 'סכום בש״ח · המרות בדיווח שלכם',
    baseAmount: 'סכום בש״ח בדיווח שלכם', mapFailedBody: 'הרכישות השמורות נשארות במכשיר הזה. רכישות ו־Capture עדיין זמינים.',
    historyIntro: 'רכישות שבדקתם ושמרתם בדפדפן הזה. אין סנכרון בענן.',
  },
}

const copy = {
  en: {
    product: 'Spendscape', checkpoint: 'Your purchases on a globe', navGlobe: 'Globe',
    navAnalytics: 'Analytics', navPurchases: 'Purchases',
    addPurchase: 'Add purchase', capture: 'Add',
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
    unknown: 'Unknown', cash: 'Cash', card: 'Card', manual: 'Manual', confirmedStatus: 'Confirmed', unresolvedStatus: 'Unresolved',
    openPurchase: 'Open purchase', backToHistory: 'Back to history', viewPlace: 'View place',
    selectedMonth: 'Selected month', clearTimeline: 'Clear timeline', showTimeline: 'Open timeline',
    noPurchases: 'No purchases match this view', noPurchasesBody: 'Adjust the shared search, filters, or timeline.',
    reloadNote: 'Shared view saved for this session', onlineNoPin: 'Online · no map pin',
    unresolvedNoPin: 'Unresolved · no map pin', manualEntry: 'Manual cash record',
    demoLoad: 'Load demo data', demoHide: 'Hide demo data', demoOn: 'Demo data on', demoLabel: 'Demo · fictional purchase',
    demoLoadedStatus: 'Demo purchases loaded. They are fictional and never saved.', demoHiddenStatus: 'Demo purchases hidden',
    emptyTitle: 'No purchases yet', emptyBody: 'Scan a barcode or type a purchase in. It stays on this device.',
    emptyAdd: 'Add your first purchase', emptyDemoHint: 'Just looking around? Load fictional demo purchases.',
    demoHistoryIntro: 'Fictional demo history next to the purchases you saved on this device. Demo purchases are never saved or backed up.',
  },
  he: {
    product: 'Spendscape', checkpoint: 'הרכישות שלך על הגלובוס', navGlobe: 'גלובוס',
    navAnalytics: 'ניתוחים', navPurchases: 'רכישות',
    addPurchase: 'הוספת רכישה', capture: 'הוספה',
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
    unknown: 'לא ידוע', cash: 'מזומן', card: 'כרטיס', manual: 'ידני', confirmedStatus: 'מאומת', unresolvedStatus: 'לא פתור',
    openPurchase: 'פתיחת רכישה', backToHistory: 'חזרה להיסטוריה', viewPlace: 'הצגת מקום',
    selectedMonth: 'חודש נבחר', clearTimeline: 'ניקוי ציר הזמן', showTimeline: 'פתיחת ציר הזמן',
    noPurchases: 'אין רכישות התואמות לתצוגה', noPurchasesBody: 'אפשר לשנות חיפוש, מסננים או ציר זמן משותפים.',
    reloadNote: 'התצוגה המשותפת נשמרה להפעלה זו', onlineNoPin: 'אונליין · ללא סיכה',
    unresolvedNoPin: 'לא פתור · ללא סיכה', manualEntry: 'רשומת מזומן ידנית',
    demoLoad: 'טען נתוני דמו', demoHide: 'הסתר נתוני דמו', demoOn: 'נתוני דמו פעילים', demoLabel: 'דמו · רכישה בדיונית',
    demoLoadedStatus: 'רכישות הדמו נטענו. הן בדיוניות ולעולם אינן נשמרות.', demoHiddenStatus: 'רכישות הדמו הוסתרו',
    emptyTitle: 'עוד אין רכישות', emptyBody: 'סרקו ברקוד או הקלידו רכישה. היא נשמרת במכשיר הזה.',
    emptyAdd: 'הוספת רכישה ראשונה', emptyDemoHint: 'רק מסתכלים? טענו רכישות דמו בדיוניות.',
    demoHistoryIntro: 'היסטוריית דמו בדיונית לצד הרכישות ששמרת במכשיר הזה. רכישות דמו לעולם אינן נשמרות או מגובות.',
  },
} as const

const categoryLabels: Record<CategoryFilter, keyof typeof copy.en> = {
  all: 'all', groceries: 'groceries', food: 'food', retail: 'retail', travel: 'travel', unknown: 'unknown',
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

// Old builds embedded an entire Replay session in history. Read only its
// navigation flags; never restore or reserialize its query or other payload.
function replayReturnNavigation(snapshot: NavigationSnapshot): NavigationSnapshot {
  const legacy = snapshot.replay as { entry?: { navigation?: unknown } } | null | undefined
  const source = isNavigationSnapshot(legacy?.entry?.navigation) ? legacy.entry.navigation : snapshot
  return {
    marker: 'spendscape-1d1', surface: source.surface,
    selectedPlaceId: source.selectedPlaceId, selectedPurchaseId: source.selectedPurchaseId,
    captureStep: source.captureStep, captureDepth: source.captureDepth,
    inboxCaseId: source.inboxCaseId, askOpen: source.askOpen, replay: null,
  }
}

function navigationHash(snapshot: NavigationSnapshot): string {
  if (snapshot.replay) return '#replay'
  if (snapshot.captureStep) return '#capture'
  if (snapshot.inboxCaseId) return `#inbox/${snapshot.inboxCaseId}`
  if (snapshot.askOpen) return '#ask'
  if (snapshot.selectedPurchaseId) return `#purchase/${snapshot.selectedPurchaseId}`
  if (snapshot.selectedPlaceId) return snapshot.selectedPlaceId.startsWith('local_place_') ? '#place' : `#place/${snapshot.selectedPlaceId}`
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

interface SpendscapeGlobeProps {
  initialData: SpendscapeDataSnapshot
  /** Fictional history behind the visible demo toggle. View-only: never saved, backed up or counted as yours. */
  demoHistory?: Pick<SpendscapeDataSnapshot, 'purchases' | 'evidence'>
}

const noDemo = Object.freeze({ purchases: Object.freeze([]), evidence: Object.freeze([]) }) as Pick<SpendscapeDataSnapshot, 'purchases' | 'evidence'>

export function SpendscapeGlobe({ initialData, demoHistory = noDemo }: SpendscapeGlobeProps) {
  const syntheticQa = initialData.source.classification === 'synthetic'
  // Ordinary users start in Hebrew; the loopback-only synthetic QA gate starts in English.
  // A language the person chose (spendscape.locale.v1) applies in both.
  const initialLocale: LocaleCode = syntheticQa ? 'en' : DEFAULT_LOCALE
  // Demo purchases stay hidden until the person loads them (remembered on this device).
  // The server QA gate keeps its own synthetic snapshot and ignores the toggle.
  const [demoData, setDemoData] = useState(false)
  const demoShown = !syntheticQa && demoData
  const {
    merchants: baselineMerchants,
    places: baselinePlaces,
    smartInboxCases,
  } = initialData
  const globePurchases = demoShown ? demoHistory.purchases : initialData.purchases
  const globeEvidenceRecords = demoShown ? demoHistory.evidence : initialData.evidence
  const placeFeatureCollection = useMemo(
    () => buildPlaceFeatureCollection(baselinePlaces, globePurchases),
    [baselinePlaces, globePurchases],
  )
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
  const desktopTimelineRef = useRef<HTMLButtonElement>(null)
  const timelineReturnFocusRef = useRef<HTMLElement | null>(null)
  const replayReturnFocusRef = useRef<HTMLElement | null>(null)
  const replayFocusFrameRef = useRef<number | null>(null)
  const replayRestoreFocusRef = useRef(false)
  const replayWasOpenRef = useRef(false)
  const replaySessionRef = useRef<ReplaySession | null>(null)
  const replayControllerRef = useRef<ReplayController | null>(null)
  const replayLastPlaceRef = useRef<string | null>(null)
  const replaySequenceRef = useRef(0)
  const replaySessionsRef = useRef(new Map<string, ReplaySession>())
  const replayMapAvailableRef = useRef(false)
  const replayAutomaticCameraCommandsRef = useRef(0)
  const replayExplicitCameraCommandsRef = useRef(0)
  const replayEventPresentationsRef = useRef(0)
  const replaySourceUpdatesAtOpenRef = useRef<number | null>(null)
  const exitReplayRef = useRef<(action: (entry: NavigationSnapshot | null) => void) => void>((action) => action(null))
  const pendingReplayNavigationRef = useRef<{ entry: NavigationSnapshot; action: (entry: NavigationSnapshot | null) => void } | null>(null)
  const rendererHealthRef = useRef<'ready' | 'lost' | 'restoring'>('ready')
  const rendererGenerationRef = useRef(0)
  const cameraGenerationRef = useRef(0)
  const selectedPlaceRef = useRef<string | null>(null)
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
  const sessionUndoDeadlineRef = useRef(0)
  const [undoSeconds, setUndoSeconds] = useState(0)
  const loadStartRef = useRef(0)
  const localeRef = useRef<LocaleCode>(initialLocale)
  const modeRef = useRef<MapMode>('pins')
  const mapInstanceCountRef = useRef(0)
  const mapConstructionCountRef = useRef(0)
  const pendingCaptureExitRef = useRef<null | (() => void)>(null)
  const captureDismissedRef = useRef(false)
  const captureResumeSpinRef = useRef(false)

  const [locale, setLocale] = useState<LocaleCode>(initialLocale)
  const [query, setQuery] = useState<PurchaseQuery>(defaultPurchaseQuery)
  const [mode, setMode] = useState<MapMode>('pins')
  const [surface, setSurface] = useState<ProductSurface>('globe')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null)
  const [nearbyPurchaseId, setNearbyPurchaseId] = useState<string | null>(null)
  useEffect(() => { setNearbyPurchaseId(null) }, [selectedPurchaseId, surface])
  const [captureStep, setCaptureStep] = useState<CaptureStep | null>(null)
  const [captureDepth, setCaptureDepth] = useState(0)
  const [sessionLedger, setSessionLedger] = useState(emptySessionLedger)
  const sessionLedgerRef = useRef(sessionLedger)
  const userGraph = useMemo(() => syntheticQa
    ? composeDirectory({ merchants: baselineMerchants, places: baselinePlaces }, sessionLedger.directory)
    : composeUserGraph(initialData, sessionLedger.directory, sessionLedger.records), [syntheticQa, initialData, baselineMerchants, baselinePlaces, sessionLedger.directory, sessionLedger.records])
  // The view adds only the fictional places the demo history uses; the purchase
  // form, validation and storage keep working from the person's own graph.
  const directoryGraph = useMemo(() => {
    if (!demoShown || demoHistory.purchases.length === 0) return userGraph
    const placeIds = new Set(demoHistory.purchases.flatMap(p => p.placeId ? [p.placeId] : [])), merchantIds = new Set(demoHistory.purchases.map(p => p.merchantId))
    const places = [...userGraph.places, ...baselinePlaces.filter(p => placeIds.has(p.id) && !userGraph.places.some(u => u.id === p.id))]
    const merchants = [...userGraph.merchants, ...baselineMerchants.filter(m => (merchantIds.has(m.id) || places.some(p => p.merchantId === m.id)) && !userGraph.merchants.some(u => u.id === m.id))]
    return { merchants, places }
  }, [demoShown, demoHistory.purchases, userGraph, baselineMerchants, baselinePlaces])
  const { merchants: globeMerchants, places: globePlaces } = directoryGraph
  // Stores the purchase form offers: your own, plus the "store not identified" choice.
  // Fictional demo stores are never offered, so demo data cannot enter your purchases.
  const captureContext = useMemo(() => syntheticQa ? userGraph : offeredDirectory(
    { merchants: [...userGraph.merchants, ...baselineMerchants.filter(m => !userGraph.merchants.some(u => u.id === m.id))], places: userGraph.places },
    new Set(baselineMerchants.map(m => m.id)), new Set(baselinePlaces.map(p => p.id)),
    { merchantIds: new Set(userGraph.merchants.map(m => m.id)), placeIds: new Set(userGraph.places.map(p => p.id)) },
    false,
  ), [syntheticQa, userGraph, baselineMerchants, baselinePlaces])
  const globePlacesRef = useRef(globePlaces)
  globePlacesRef.current = globePlaces
  const receiptLocationSeedRef = useRef<ReceiptPlaceSeed | undefined>(undefined)
  const [locationPurchaseId, setLocationPurchaseId] = useState<string | null>(null)
  const [locationPicking, setLocationPicking] = useState(false)
  const locationPickingRef = useRef(false)
  const locationUndoRef = useRef<(LocationUndo & { deadline: number }) | null>(null)
  const [locationUndoSeconds, setLocationUndoSeconds] = useState(0)
  const [localUpdateKind, setLocalUpdateKind] = useState<'place' | 'time'>('place')
  const purchaseTimeViewRef = useRef(selectedPurchaseId)
  purchaseTimeViewRef.current = selectedPurchaseId
  const locationWriteRef = useRef(false)
  const locationViewRef = useRef(locationPurchaseId)
  locationViewRef.current = locationPurchaseId
  const [deletePurchaseId, setDeletePurchaseId] = useState<string | null>(null)
  const sessionCaptureRecords = useMemo(() => syntheticQa ? sessionLedger.records : sessionLedger.records.filter(record => !record.synthetic), [syntheticQa, sessionLedger.records])
  const [comparisonReadyId, setComparisonReadyId] = useState<string | null>(null)
  const nearbyComparison = useMemo(() => syntheticQa ? demoComparison(sessionCaptureRecords, comparisonReadyId, sessionLedger.undoId, globePlaces) : null, [syntheticQa, sessionCaptureRecords, comparisonReadyId, sessionLedger.undoId, globePlaces])
  const [inboxCaseId, setInboxCaseId] = useState<string | null>(null)
  const [smartInboxDecisions, setSmartInboxDecisions] = useState<SmartInboxDecision[]>([])
  const inboxDecisionsRef = useRef(smartInboxDecisions)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const localData = useLocalPurchases(initialData, data => {
    const restored = restoredLedger(data)
    sessionLedgerRef.current = restored
    setSessionLedger(restored)
    inboxDecisionsRef.current = [...data.decisions]
    setSmartInboxDecisions([...data.decisions])
  })
  // One-time report of the earlier on-device ledger import (see legacy-device-migration.ts).
  const [migrationDismissed, setMigrationDismissed] = useState(false)
  const notice = migrationDismissed ? null : legacyNotice(localData.migration)
  const migrationNotice = !notice ? null
    : notice.kind === 'imported' ? (locale === 'he' ? `${notice.purchases} רכישות שנשמרו קודם במכשיר הזה הועברו לאחסון המקומי החדש.${notice.demoSkipped ? ` ${notice.demoSkipped} רכישות דמו לא הועברו.` : ''}` : `${notice.purchases} purchases saved earlier on this device were moved to the new local store.${notice.demoSkipped ? ` ${notice.demoSkipped} demo purchases were not moved.` : ''}`)
    : notice.kind === 'not-empty' ? (locale === 'he' ? `${notice.purchases} רכישות שנשמרו קודם במכשיר הזה לא הועברו, כי באחסון המקומי כבר יש נתונים. הן לא נמחקו ולא שונו.` : `${notice.purchases} purchases saved earlier on this device were not moved because local storage already holds data. They were not deleted or changed.`)
    : notice.capacity ? (locale === 'he' ? `${notice.purchases} רכישות שנשמרו קודם במכשיר הזה לא הועברו: הן חורגות ממגבלת 1,000 הרכישות המקומיות. הן לא נמחקו ולא שונו.` : `${notice.purchases} purchases saved earlier on this device were not moved: they exceed the 1,000 local purchase limit. They were not deleted or changed.`)
    : (locale === 'he' ? `${notice.purchases} רכישות שנשמרו קודם במכשיר הזה לא הועברו כי לא עברו בדיקה (למשל חנות דמו בדיונית או סניף שכבר אינו במחירון). הן לא נמחקו ולא שונו.` : `${notice.purchases} purchases saved earlier on this device were not moved because they did not pass validation (for example a fictional demo store or a branch no longer in the price catalog). They were not deleted or changed.`)
  const [askOpen, setAskOpen] = useState(false)
  const [replay, setReplay] = useState<ReplaySession | null>(null)
  const [askUndoSnapshot, setAskUndoSnapshot] = useState<AskUndoSnapshot | null>(null)
  const [askFeedback, setAskFeedback] = useState<AskExecutionFeedback | null>(null)
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [stateRestored, setStateRestored] = useState(false)
  const [mapAttempt, setMapAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [rendererHealth, setRendererHealth] = useState<'ready' | 'lost' | 'restoring'>('ready')
  const mapAvailable = !loading && !mapError && rendererHealth === 'ready'
  replayMapAvailableRef.current = mapAvailable
  const [autoSpin, setAutoSpin] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [status, setStatus] = useState<string>(copy[initialLocale].loading)
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

  const t = syntheticQa ? copy[locale] : { ...copy[locale], ...userCopy[locale] }
  const basePurchases = useMemo(
    () => combineSessionPurchases(globePurchases, sessionCaptureRecords),
    [globePurchases, sessionCaptureRecords],
  )
  const allPurchases = useMemo(
    () => syntheticQa ? applySmartInboxDecisions(basePurchases, smartInboxCases, smartInboxDecisions, globePlaces) : basePurchases,
    [syntheticQa, basePurchases, globePlaces, smartInboxCases, smartInboxDecisions],
  )
  const allEvidence = useMemo(
    () => [...globeEvidenceRecords, ...sessionCaptureRecords.map((record) => record.evidence)],
    [globeEvidenceRecords, sessionCaptureRecords],
  )
  const searchScopePurchases = useMemo(
    () => filterPurchases({ ...query, search: '' }, allPurchases, globePlaces, globeMerchants),
    [allPurchases, globeMerchants, globePlaces, query],
  )
  const searchResults = useMemo(
    () => deriveCanonicalSearchResults(
      query.search,
      searchScopePurchases,
      globePlaces,
      globeMerchants,
    ),
    [globeMerchants, globePlaces, query.search, searchScopePurchases],
  )
  const visiblePurchases = useMemo(
    () => filterPurchases(query, allPurchases, globePlaces, globeMerchants),
    [allPurchases, globeMerchants, globePlaces, query],
  )
  const replayPurchases = useMemo(() => replay
    ? allPurchases.filter((purchase) => replay.purchaseIds.includes(purchase.id)) : [], [allPurchases, replay])
  const visibleData = useMemo(
    () => buildPlaceFeatureCollection(globePlaces, visiblePurchases),
    [globePlaces, visiblePurchases],
  )
  const latestPlaceId = syntheticQa ? 'place_shuk_bograshov' : [...visibleData.features]
    .sort((a, b) => b.properties.latestTimestamp.localeCompare(a.properties.latestTimestamp) || a.properties.placeId.localeCompare(b.properties.placeId))[0]?.properties.placeId
  const visibleSummary = useMemo(
    () => derivedPurchaseSummary(visiblePurchases, globePlaces),
    [globePlaces, visiblePurchases],
  )
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
  }, [globePlaces, allPurchases])
  const timelineMonths = useMemo(() => availableTimelineMonths(allPurchases), [allPurchases])
  // "This month" is always the whole month of your own purchases, independent of filters.
  // Demo purchases never count towards it; the QA sample keeps its synthetic history.
  const monthSummary = useMemo(
    () => thisMonthSummary(syntheticQa ? allPurchases : sessionCaptureRecords.map((record) => record.purchase), { now: new Date() }),
    [syntheticQa, allPurchases, sessionCaptureRecords],
  )
  const askContext = useMemo<AskContext>(() => ({
    merchants: globeMerchants,
    places: globePlaces,
    purchases: allPurchases,
    timelineMonths,
  }), [allPurchases, globeMerchants, globePlaces, timelineMonths])
  const pendingInbox = useMemo(
    () => syntheticQa ? pendingSmartInboxCases(smartInboxCases, basePurchases, smartInboxDecisions) : [],
    [syntheticQa, basePurchases, smartInboxCases, smartInboxDecisions],
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
  const selectedPlace = selectedPlaceId ? placeForId(selectedPlaceId, globePlaces) : undefined
  const selectedPurchase = selectedPurchaseId
    ? allPurchases.find((purchase) => purchase.id === selectedPurchaseId)
    : undefined
  const selectedMerchant = selectedPurchase
    ? merchantForId(selectedPurchase.merchantId, globeMerchants)
    : undefined
  const selectedPurchaseInboxCase = selectedPurchase
    ? (syntheticQa ? caseForPurchase(selectedPurchase.id, smartInboxCases) : undefined)
    : undefined
  const selectedEvidence = useMemo(
    () => selectedPurchase
      ? allEvidence.filter((record) => selectedPurchase.evidenceIds.includes(record.id))
      : [],
    [allEvidence, selectedPurchase],
  )
  const selectedSavingsBasket = useMemo(
    () => selectedPurchase ? savingsBasket(selectedPurchase, sessionCaptureRecords.find(r => r.purchase.id === selectedPurchase.id), userGraph.places) : null,
    [selectedPurchase, sessionCaptureRecords, userGraph.places],
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
  selectedPlaceRef.current = selectedPlaceId

  const updateQuery = useCallback((patch: Partial<PurchaseQuery>) => {
    exitReplayRef.current(() => setQuery((current) => ({ ...current, ...patch })))
  }, [])

  useEffect(() => {
    let preferences: Storage | null = null
    try { preferences = window.localStorage } catch { preferences = null }
    setDemoData(readDemoPreference(preferences))
    const preferredLocale = readLocalePreference(preferences)
    if (preferredLocale) setLocale(preferredLocale)
    let restored: Partial<StoredExperienceState> = {}
    try {
      const raw = window.sessionStorage.getItem(EXPERIENCE_STORAGE_KEY)
      if (raw) restored = JSON.parse(raw) as Partial<StoredExperienceState>
    } catch {
      restored = {}
    }

    if (restored.locale === 'en' || restored.locale === 'he') setLocale(restored.locale)
    if (restored.query) setQuery({ ...defaultPurchaseQuery, ...restored.query, search: '' })
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
      ? replayReturnNavigation(window.history.state)
      : null
    const snapshot: NavigationSnapshot = historicalSnapshot
      ? {
          ...historicalSnapshot,
          captureStep: null,
          captureDepth: 0,
          inboxCaseId: null,
          askOpen: false,
          replay: null,
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
          replay: null,
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
    const undoId = sessionLedger.undoId
    if (!undoId) { setUndoSeconds(0); return }
    const update = () => {
      const remaining = Math.max(0, sessionUndoDeadlineRef.current - performance.now())
      setUndoSeconds(Math.ceil(remaining / 1000))
      if (remaining > 0) return
      const expired = expireSessionPurchaseUndo(sessionLedgerRef.current, undoId)
      if (expired === sessionLedgerRef.current) return
      if (locationUndoRef.current?.after === sessionLedgerRef.current) locationUndoRef.current.after = expired
      sessionLedgerRef.current = expired
      setSessionLedger(expired)
      setComparisonReadyId(undoId)
    }
    update()
    const interval = window.setInterval(update, 100)
    const timeout = window.setTimeout(update, Math.max(0, sessionUndoDeadlineRef.current - performance.now()))
    return () => { window.clearInterval(interval); window.clearTimeout(timeout) }
  }, [sessionLedger.undoId])

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
    const entry = replaySessionRef.current?.entry
    const stored: StoredExperienceState = {
      marker: 'spendscape-1d1', locale, query, mode, surface,
      selectedPlaceId: selectedPlaceId?.startsWith('local_place_') ? null : selectedPlaceId,
      selectedPurchaseId: selectedPurchaseId?.startsWith('session_purchase_') ? null : selectedPurchaseId,
      captureStep: null, captureDepth: 0, inboxCaseId: null,
      askOpen: false,
      ...(entry ? { ...entry.navigation, query: entry.query, mode: entry.mode, replay: null } : {}),
    }
    // Free text can contain a session purchase's private item/merchant details.
    // Preserve filters/preferences, but never persist search (including Replay's
    // entry query). Overwrite any legacy stored search without restoring it.
    if (stored.selectedPlaceId?.startsWith('local_place_')) stored.selectedPlaceId = null
    stored.query = { ...stored.query, search: '' }
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

  useEffect(() => {
    const dismissed = replayWasOpenRef.current && !replay
    replayWasOpenRef.current = Boolean(replay)
    if (!dismissed || !replayRestoreFocusRef.current) return
    let cancelled = false
    const stopWatchingInput = () => {
      document.removeEventListener('pointerdown', cancel, true)
      document.removeEventListener('keydown', cancel, true)
    }
    const cancel = () => { cancelled = true; stopWatchingInput() }
    document.addEventListener('pointerdown', cancel, true)
    document.addEventListener('keydown', cancel, true)
    const restore = () => {
      stopWatchingInput()
      if (cancelled || !replayRestoreFocusRef.current || replaySessionRef.current) return
      const target = [replayReturnFocusRef.current, timelineReturnFocusRef.current,
        document.querySelector<HTMLElement>('[data-testid="analytics-timeline"]'),
        document.querySelector<HTMLElement>('[data-testid="history-timeline"]'),
        mobileToolsButtonRef.current, desktopTimelineRef.current,
        purchasesCloseRef.current].find(isAvailableFocusTarget)
      target?.focus({ preventScroll: true })
    }
    const frame = window.requestAnimationFrame(() => {
      replayFocusFrameRef.current = null
      // Restored Purchases/Stats mount at opacity 0. Wait for their actual entry
      // animation, not a timeout, before requiring a visible focus target.
      const animations = ['[data-testid="purchases-panel"]', '[data-testid="analytics-panel"]']
        .flatMap((selector) => document.querySelector(selector)?.getAnimations() ?? [])
        .filter((animation) => animation.playState === 'running' || animation.pending)
      if (animations.length) void Promise.allSettled(animations.map((animation) => animation.finished)).then(restore)
      else restore()
    })
    replayFocusFrameRef.current = frame
    return () => { cancel(); window.cancelAnimationFrame(frame); replayFocusFrameRef.current = null }
  }, [replay, surface])

  const clearSpinTimer = useCallback(() => {
    if (spinTimerRef.current !== null) {
      window.clearTimeout(spinTimerRef.current)
      spinTimerRef.current = null
    }
  }, [])

  const stopSpin = useCallback((announce = true) => {
    cameraGenerationRef.current += 1
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
    if (reducedMotionRef.current || rendererHealthRef.current !== 'ready') return
    spinEnabledRef.current = true
    setAutoSpin(true)
    setStatus(copy[localeRef.current].orbiting)
    queueSpin()
  }, [queueSpin])

  const resumeAfterCapture = useCallback(() => {
    if (!captureResumeSpinRef.current) return
    captureResumeSpinRef.current = false
    if (reducedMotionRef.current || rendererHealthRef.current !== 'ready') return
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

  const releaseReplay = useCallback((restoreFocus = true) => {
    const session = replaySessionRef.current
    if (!session) return null
    replayControllerRef.current?.pause()
    stopSpin(false)
    const entry = session.entry
    setQuery(entry.query)
    setMode(entry.mode)
    modeRef.current = entry.mode
    setAnalyticsView(entry.analyticsView)
    setSurface(entry.navigation.surface)
    setSelectedPlaceId(entry.navigation.selectedPlaceId)
    selectedPlaceRef.current = entry.navigation.selectedPlaceId
    setSelectedPurchaseId(entry.navigation.selectedPurchaseId)
    updateSelectedFilter(entry.navigation.selectedPlaceId)
    if (entry.camera) {
      mapRef.current?.jumpTo(entry.camera)
      window.sessionStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(entry.camera))
    }
    replaySessionRef.current = null
    replayLastPlaceRef.current = null
    replayRestoreFocusRef.current = restoreFocus
    setReplay(null)
    return entry.navigation
  }, [stopSpin, updateSelectedFilter])

  const exitReplayForNavigation = useCallback((action: (entry: NavigationSnapshot | null) => void) => {
    // A newer destination supersedes a pending one without another traversal.
    if (pendingReplayNavigationRef.current) {
      pendingReplayNavigationRef.current.action = action
      return
    }
    const entry = releaseReplay(false)
    replayRestoreFocusRef.current = false
    if (replayFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(replayFocusFrameRef.current)
      replayFocusFrameRef.current = null
    }
    if (!entry) { action(null); return }
    // Traverse the actual opening entry. Replacing Replay with origin would
    // leave adjacent origins when Capture/Ask/etc subsequently push a destination.
    pendingReplayNavigationRef.current = { entry, action }
    window.history.back()
  }, [releaseReplay])
  exitReplayRef.current = exitReplayForNavigation

  const applyNavigation = useCallback((snapshot: NavigationSnapshot) => {
    if (!syntheticQa) snapshot = { ...snapshot, askOpen: false, inboxCaseId: null, captureStep: ['processing', 'failure', 'gmail'].includes(snapshot.captureStep ?? '') ? 'sources' : snapshot.captureStep }
    // A reload clears the ephemeral player. Old forward entries must not revive it.
    const session = snapshot.replay ? replaySessionsRef.current.get(snapshot.replay.id) : undefined
    if (snapshot.replay && !session) {
      snapshot = replayReturnNavigation(snapshot)
      window.history.replaceState({ ...window.history.state, ...snapshot }, '', navigationHash(snapshot))
    }
    if (replaySessionRef.current && snapshot.replay?.id !== replaySessionRef.current.id) releaseReplay()
    if (session && !replaySessionRef.current) {
      replaySessionRef.current = session
      replayLastPlaceRef.current = null
      replayRestoreFocusRef.current = false
      if (replayFocusFrameRef.current !== null) window.cancelAnimationFrame(replayFocusFrameRef.current)
      stopSpin(false)
      setReplay(session)
      setQuery(session.entry.query)
      setMode('pins')
    }
    setSurface(snapshot.replay ? 'globe' : snapshot.surface)
    const selectedPlace = snapshot.selectedPlaceId?.startsWith('local_place_') && !globePlacesRef.current.some(p => p.id === snapshot.selectedPlaceId) ? null : snapshot.selectedPlaceId
    setSelectedPlaceId(selectedPlace)
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
    updateSelectedFilter(snapshot.replay ? null : selectedPlace)
  }, [syntheticQa, releaseReplay, stopSpin, updateSelectedFilter])

  const pushNavigation = useCallback((patch: Partial<NavigationSnapshot>) => {
    const snapshot: NavigationSnapshot = {
      marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId,
      captureStep,
      captureDepth,
      inboxCaseId,
      askOpen,
      ...patch,
    }
    window.history.pushState({ ...window.history.state, ...snapshot, replay: null }, '', navigationHash(snapshot))
    applyNavigation(snapshot)
  }, [applyNavigation, askOpen, captureDepth, captureStep, inboxCaseId, selectedPlaceId, selectedPurchaseId, surface])

  const closeTopLayer = useCallback(() => {
    if (nearbyPurchaseId) {
      setNearbyPurchaseId(null)
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="purchase-nearby-prices"]')?.focus())
      return
    }
    if (locationPurchaseId) {
      if (locationWriteRef.current) return
      setLocationPurchaseId(null); receiptLocationSeedRef.current = undefined; setLocationPicking(false); locationPickingRef.current = false
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="purchase-resolve-location"]')?.focus())
      return
    }
    if (replaySessionRef.current) {
      replayControllerRef.current?.pause()
      window.history.back()
      return
    }
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
  }, [applyNavigation, askOpen, filtersOpen, inboxCaseId, locationPurchaseId, nearbyPurchaseId, mobileToolsOpen, searchOpen, selectedPlaceId, selectedPurchaseId, surface, timelineOpen])

  useEffect(() => {
    const restoreNavigation = (event: PopStateEvent) => {
      setLocationPurchaseId(null); receiptLocationSeedRef.current = undefined; setLocationPicking(false); locationPickingRef.current = false
      if (!isNavigationSnapshot(event.state)) return
      const pendingReplay = pendingReplayNavigationRef.current
      pendingReplayNavigationRef.current = null
      if (event.state.captureStep && captureDismissedRef.current) {
        window.history.go(-Math.max(1, event.state.captureDepth ?? 1))
        return
      }
      applyNavigation(event.state)
      if (pendingReplay) {
        pendingReplay.action(pendingReplay.entry)
        return
      }
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

  useEffect(() => () => { pendingReplayNavigationRef.current = null }, [])

  const selectPlace = useCallback((placeId: string, shouldFly = true, recordHistory = true) => {
    if (replaySessionRef.current) {
      replayControllerRef.current?.inspectPlace(placeId)
      return
    }
    const map = mapRef.current
    const place = placeForId(placeId, globePlacesRef.current)
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
    if (shouldFly && map && rendererHealthRef.current === 'ready') {
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
    if (map?.getLayer(CATALOG_LABEL_LAYER)) map.setLayoutProperty(CATALOG_LABEL_LAYER, 'text-field', catalogLabelExpression(locale))
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
    rendererHealthRef.current = 'ready'
    setRendererHealth('ready')
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
    let detachRendererListeners = () => {}
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
      detachRendererListeners()
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
        // Optional tile/sprite errors are not renderer failure. MapLibre destroys
        // and restores its style on real context loss, but keeps this Map instance.
        let recoverySource: GeoJSONSource | undefined
        let recoveryData: typeof filteredRef.current | null = null
        let recoverySyncing = false
        const recoveryIsCurrent = (generation: number) => !disposed && !attemptFailed
          && mapRef.current === map && rendererGenerationRef.current === generation
          && rendererHealthRef.current === 'restoring'
        const syncRecoveredStyle = () => {
          if (rendererHealthRef.current !== 'restoring' || recoverySyncing || !map.isStyleLoaded()) return
          const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
          if (!source || !map.getLayer(PIN_LAYER)) return
          const data = filteredRef.current
          if (recoverySource === source && recoveryData === data) return
          const generation = rendererGenerationRef.current
          recoverySyncing = true
          void source.setData(data).then(() => {
            if (!recoveryIsCurrent(generation)) return
            recoverySyncing = false
            recoverySource = source
            recoveryData = data
            // The renderer's saved style may predate a Replay exit or navigation.
            // Reconcile from current canonical/UI ownership, never the stale style.
            applyGlobeMode(map, modeRef.current)
            map.setLayoutProperty(LABEL_LAYER, 'text-field', placeLabelExpression(localeRef.current))
            updateSelectedFilter(replaySessionRef.current ? replayLastPlaceRef.current : selectedPlaceRef.current)
            setSourceUpdates((current) => current + 1)
            map.triggerRepaint()
          }).catch(() => {
            if (!recoveryIsCurrent(generation)) return
            recoverySyncing = false
            // Stay honestly unavailable. A later renderer event may retry; never
            // remount the map or resume playback as a side effect of recovery.
          })
        }
        const confirmRecoveredRender = () => {
          if (rendererHealthRef.current !== 'restoring') return
          syncRecoveredStyle()
          if (recoverySyncing || recoveryData !== filteredRef.current || !recoverySource
            || !map.loaded() || map.getCanvas().getContext('webgl2')?.isContextLost() !== false) return
          rendererHealthRef.current = 'ready'
          mapReadyRef.current = true
          setRendererHealth('ready')
          setStatus(copy[localeRef.current].ready)
          // No Play, resumeSpin, or camera callback here: recovery stays paused.
        }
        const contextLost = () => {
          rendererGenerationRef.current += 1
          rendererHealthRef.current = 'lost'
          replayMapAvailableRef.current = false
          mapReadyRef.current = false
          recoverySource = undefined
          recoveryData = null
          recoverySyncing = false
          replayControllerRef.current?.pause()
          stopSpin(false)
          map.stop()
          setRendererHealth('lost')
          setStatus(copy[localeRef.current].mapFailed)
        }
        const contextRestored = () => {
          rendererHealthRef.current = 'restoring'
          setRendererHealth('restoring')
          syncRecoveredStyle()
        }
        map.on('webglcontextlost', contextLost)
        map.on('webglcontextrestored', contextRestored)
        map.on('style.load', syncRecoveredStyle)
        map.on('render', confirmRecoveredRender)
        map.on('idle', confirmRecoveredRender)
        detachRendererListeners = () => {
          rendererGenerationRef.current += 1
          map.off('webglcontextlost', contextLost)
          map.off('webglcontextrestored', contextRestored)
          map.off('style.load', syncRecoveredStyle)
          map.off('render', confirmRecoveredRender)
          map.off('idle', confirmRecoveredRender)
        }
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
          if (!replaySessionRef.current) window.sessionStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(snapshot))
          if (window.__SPENDSCAPE_QA__) window.__SPENDSCAPE_QA__.camera = snapshot
          if (spinEnabledRef.current) queueSpin()
        })

        const interrupt = () => { replayLastPlaceRef.current = null; replayControllerRef.current?.pause(); stopSpin(true) }
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
            if (locationPickingRef.current) return
            const feature = event.features?.[0]
            const clusterId = Number(feature?.properties?.cluster_id)
            const source = map.getSource(SOURCE_ID) as GeoJSONSource
            if (!Number.isFinite(clusterId) || !source || rendererHealthRef.current !== 'ready') return
            stopSpin(false)
            const generation = cameraGenerationRef.current
            let zoom: number
            try { zoom = await source.getClusterExpansionZoom(clusterId) } catch { return }
            if (disposed || mapRef.current !== map || rendererHealthRef.current !== 'ready'
              || generation !== cameraGenerationRef.current) return
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
            if (locationPickingRef.current) return
            const placeId = String(event.features?.[0]?.properties?.placeId ?? '')
            if (placeId) selectPlace(placeId)
          })

          const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16 })
          void loadCatalogStores().then((stores) => {
            if (disposed || map.getSource(CATALOG_SOURCE_ID)) return
            const below = map.getLayer(HEAT_LAYER) ? HEAT_LAYER : undefined
            map.addSource(CATALOG_SOURCE_ID, {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: stores.filter(isLocated).map((store) => ({
                  type: 'Feature' as const,
                  geometry: { type: 'Point' as const, coordinates: [store.location.lon, store.location.lat] },
                  properties: { id: store.id, chain: store.chain, chainEn: catalogChainNames[store.chain].en, chainHe: catalogChainNames[store.chain].he, name: store.name, address: store.address },
                })),
              },
            })
            map.addLayer({
              id: CATALOG_STORE_LAYER,
              type: 'circle',
              source: CATALOG_SOURCE_ID,
              minzoom: 10,
              paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 13, 4.5, 16, 7],
                'circle-color': '#1a1e26',
                // A quiet per-chain tint so neighbouring chains are told apart; no logos.
                'circle-stroke-color': ['match', ['get', 'chain'], 'shufersal', '#e0707f', 'ramilevi', '#e3a95c', 'osherad', '#7f9fe0', '#aab1bd'],
                'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2],
                'circle-opacity': 0.92,
                'circle-pitch-alignment': 'viewport',
              },
            }, below)
            map.addLayer({
              id: CATALOG_LABEL_LAYER,
              type: 'symbol',
              source: CATALOG_SOURCE_ID,
              minzoom: 14,
              layout: {
                'text-field': catalogLabelExpression(localeRef.current),
                'text-font': ['Noto Sans Regular'],
                'text-size': 11,
                'text-offset': [0, 1.1],
                'text-anchor': 'top',
                'text-optional': true,
              },
              paint: { 'text-color': '#2b313b', 'text-halo-color': 'rgba(252,253,255,0.95)', 'text-halo-width': 1.6 },
            }, below)
            map.on('mouseenter', CATALOG_STORE_LAYER, (event) => {
              if (replaySessionRef.current || locationPickingRef.current) return
              const feature = event.features?.[0]
              if (!feature) return
              const properties = feature.properties as { chainEn: string; chainHe: string; name: string; address: string }
              const activeLocale = localeRef.current
              const tooltip = document.createElement('div')
              tooltip.className = styles.mapTooltip
              const title = document.createElement('strong')
              title.textContent = `${activeLocale === 'he' ? properties.chainHe : properties.chainEn} · ${properties.name}`
              const meta = document.createElement('span')
              meta.textContent = activeLocale === 'he' ? `${properties.address} · מחירים מפורסמים בסורק` : `${properties.address} · published prices in the scanner`
              tooltip.append(title, meta)
              popup.setLngLat((feature.geometry as Point).coordinates as [number, number]).setDOMContent(tooltip).addTo(map)
            })
            map.on('mouseleave', CATALOG_STORE_LAYER, () => popup.remove())
          }).catch(() => {})
          let hoveredFeatureId: string | number | null = null
          map.on('mouseenter', PIN_LAYER, (event) => {
            if (replaySessionRef.current || locationPickingRef.current) return
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
            if (replaySessionRef.current || locationPickingRef.current) return
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
              || rendererHealthRef.current !== 'ready'
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
          canvas.setAttribute('aria-label', syntheticQa ? 'Interactive globe of synthetic purchase places' : 'Interactive globe of your purchase places')
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
              const place = placeForId(placeId, globePlacesRef.current)
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
      detachRendererListeners()
      if (actionTimerRef.current !== null) window.clearTimeout(actionTimerRef.current)
      mapReadyRef.current = false
      programmaticCameraRef.current = false
      removeAttemptMap()
      delete window.__SPENDSCAPE_QA_ACTIONS__
    }
  }, [clearSpinTimer, mapAttempt, queueSpin, selectPlace, stopSpin, updateSelectedFilter])

  useEffect(() => {
    const map = mapRef.current
    const generation = rendererGenerationRef.current
    const canonicalSource = map?.getSource(SOURCE_ID) as GeoJSONSource | undefined
    if (canonicalSource && rendererHealthRef.current === 'ready') {
      void canonicalSource.setData(visibleData).then(() => {
        if (mapRef.current !== map || rendererGenerationRef.current !== generation) return
        setSourceUpdates((current) => current + 1)
      }).catch((error: unknown) => {
        if (mapRef.current !== map || rendererGenerationRef.current !== generation) return
        setMapError(error instanceof Error ? error.message : 'Canonical place source update failed')
      })
    }
    const synchronized = synchronizeSelection(
      visiblePurchases,
      { selectedPlaceId, selectedPurchaseId },
      globePlaces,
    )
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
    const evidenceMap = mapAvailable && mapReadyRef.current ? mapRef.current : null
    window.__SPENDSCAPE_QA__ = {
      ready: mapAvailable,
      repositoryAdapter: initialData.source.adapter,
      dataClassification: initialData.source.classification,
      dataVersion: initialData.source.version,
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
      replayAutomaticCameraCommands: replayAutomaticCameraCommandsRef.current,
      replayExplicitCameraCommands: replayExplicitCameraCommandsRef.current,
      replayEventPresentations: replayEventPresentationsRef.current,
      replaySourceUpdatesAtOpen: replaySourceUpdatesAtOpenRef.current,
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
  }, [activeInboxDecision, allPurchases.length, askFeedback, askOpen, askUndoSnapshot, autoSpin, captureStep, currentGlobeCounts, inboxCaseId, initializationEvidence, inputEvidence, loading, locale, mapAvailable, mapError, mode, pendingInbox.length, performanceEvidence, query, reducedMotion, renderedEvidence, selectedPlaceId, selectedPurchaseId, sessionCaptureRecords.length, sourceUpdates, surface, visibleAnalytics, visibleData.features.length, visiblePurchases.length, visibleSummary.totalBaseAmountIls])

  const runCameraAction = useCallback((name: string, action: (map: MapLibreMap) => void) => {
    const map = mapRef.current
    if (!map || rendererHealthRef.current !== 'ready') return
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
    const places = placeIds
      .map((placeId) => placeForId(placeId, globePlacesRef.current))
      .filter((place): place is NonNullable<typeof place> => Boolean(place))
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

  const clearFilters = () => exitReplayForNavigation(() => setQuery(defaultPurchaseQuery))

  const openInbox = (requestedCase: SmartInboxCase = pendingInbox[0] ?? smartInboxCases[0]) => exitReplayForNavigation(() => {
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
  })

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

  const openCapture = () => exitReplayForNavigation(() => {
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
  })

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

  const openSurface = (nextSurface: ProductSurface) => exitReplayForNavigation((entry) => {
    stopSpin(false)
    pushNavigation({
      ...entry,
      surface: nextSurface,
      selectedPurchaseId: null,
      selectedPlaceId: nextSurface === 'globe' ? (entry ? entry.selectedPlaceId : selectedPlaceId) : null,
    })
  })

  const openPurchase = (purchaseId: string) => exitReplayForNavigation((entry) => {
    const purchase = allPurchases.find((candidate) => candidate.id === purchaseId)
    if (!purchase) return
    stopSpin(false)
    if (purchase.placeId) selectPlace(purchase.placeId, true, false)
    pushNavigation({
      ...entry,
      surface: 'purchases',
      selectedPlaceId: purchase.placeId,
      selectedPurchaseId: purchase.id,
      captureStep: null,
      captureDepth: 0,
      inboxCaseId: null,
    })
  })

  const selectSearchResult = (result: CanonicalSearchResult) => {
    if (replaySessionRef.current || pendingReplayNavigationRef.current) {
      exitReplayForNavigation(() => selectSearchResult(result))
      return
    }
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

  const undoLastSessionPurchase = async () => {
    const removedId = sessionLedgerRef.current.undoId
    if (!removedId) return false
    if (performance.now() >= sessionUndoDeadlineRef.current) {
      sessionLedgerRef.current = expireSessionPurchaseUndo(sessionLedgerRef.current, removedId)
      setSessionLedger(sessionLedgerRef.current)
      setComparisonReadyId(removedId)
      return false
    }
    const undone = undoSessionPurchase(sessionLedgerRef.current)
    if (!await localData.commit(undone, inboxDecisionsRef.current)) return false
    setComparisonReadyId(null)
    sessionLedgerRef.current = undone
    setSessionLedger(sessionLedgerRef.current)
    if (selectedPurchaseId === removedId) setSelectedPurchaseId(null)
    if (selectedPlaceId?.startsWith('local_place_') && !undone.directory.places.some(p => p.id === selectedPlaceId)) updateSelectedFilter(null)
    setAskUndoSnapshot(null)
    if (replay?.purchaseIds.includes(removedId)) exitReplayForNavigation(() => {})
    setStatus(locale === 'he' ? 'ההוספה האחרונה בוטלה' : 'Last session addition undone')
    if (!captureStep) requestAnimationFrame(() => {
      const buttons = document.querySelectorAll<HTMLElement>('[data-testid="capture-open-desktop"], [data-testid="capture-open-mobile"]')
      Array.from(buttons).find(button => button.offsetParent !== null)?.focus({ preventScroll: true })
    })
    return true
  }

  const removeLocalPurchase = async (id: string) => {
    const next = deleteLocalPurchase(sessionLedgerRef.current, id)
    if (next === sessionLedgerRef.current) return
    if (!await localData.commit(next, inboxDecisionsRef.current)) return
    sessionLedgerRef.current = next; setSessionLedger(next)
    setDeletePurchaseId(null); setSelectedPurchaseId(null); setComparisonReadyId(null)
    if (selectedPlaceId?.startsWith('local_place_') && !next.directory.places.some(p => p.id === selectedPlaceId)) updateSelectedFilter(null)
    setAskUndoSnapshot(null); setAskFeedback(null); setAskOpen(false)
    if (replay?.purchaseIds.includes(id)) exitReplayForNavigation(() => {})
    setStatus(locale === 'he' ? 'הרכישה נמחקה מהמכשיר הזה' : 'Purchase deleted from this device')
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="history-search"]')?.focus({ preventScroll: true }))
  }

  useEffect(() => {
    if (!locationUndoSeconds) return
    const timer = window.setInterval(() => {
      const undo = locationUndoRef.current
      const seconds = undo && sessionLedgerRef.current === undo.after ? Math.max(0, Math.ceil((undo.deadline - performance.now()) / 1000)) : 0
      setLocationUndoSeconds(seconds)
      if (!seconds) locationUndoRef.current = null
    }, 200)
    return () => window.clearInterval(timer)
  }, [locationUndoSeconds])

  const confirmPurchaseLocation = async (purchaseId: string, intent: PurchaseLocationIntent): Promise<Record<string, string>> => {
    if (locationWriteRef.current || localData.phase !== 'ready') return { location: 'storage' }
    const before = sessionLedgerRef.current
    const result = resolvePurchaseLocation(before, purchaseId, intent, { merchants: baselineMerchants, places: baselinePlaces })
    if (result.code === 'invalid' || result.code === 'protected') return result.errors
    if (result.code === 'unchanged') { setLocationPurchaseId(null); receiptLocationSeedRef.current = undefined; return {} }
    locationWriteRef.current = true
    try {
      if (!await localData.commit(result.ledger, inboxDecisionsRef.current)) return { location: 'storage' }
      const after = { ...result.ledger, undoId: sessionLedgerRef.current.undoId }
      sessionLedgerRef.current = after; setSessionLedger(after)
      locationUndoRef.current = { before, after, deadline: performance.now() + 8_000 }; setLocationUndoSeconds(8)
      setLocalUpdateKind('place')
      if (locationViewRef.current !== purchaseId) return {} // Durable write survives Back; late completion must not replace newer navigation.
      setLocationPurchaseId(null); receiptLocationSeedRef.current = undefined; setLocationPicking(false); locationPickingRef.current = false
      // No camera command: Show place remains the explicit navigation action.
      updateSelectedFilter(null); setSelectedPlaceId(null); setComparisonReadyId(null)
      setAskUndoSnapshot(null)
      setStatus(locale === 'he' ? 'מקום הרכישה נשמר במכשיר הזה' : 'Purchase place saved on this device')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="purchase-show-place"]')?.focus())
      return {}
    } finally { locationWriteRef.current = false }
  }

  const confirmPurchaseTime = async (purchaseId: string, intent: PurchaseTimeIntent): Promise<Record<string, string>> => {
    if (locationWriteRef.current || localData.phase !== 'ready') return { time: 'storage' }
    const before = sessionLedgerRef.current
    const result = correctPurchaseTime(before, purchaseId, intent, initialData)
    if (result.code === 'invalid') return result.errors
    if (result.code === 'unchanged') return {}
    locationWriteRef.current = true
    try {
      if (!await localData.commit(result.ledger, inboxDecisionsRef.current)) return { time: 'storage' }
      const after = { ...result.ledger, undoId: sessionLedgerRef.current.undoId }
      sessionLedgerRef.current = after; setSessionLedger(after)
      locationUndoRef.current = { before, after, deadline: performance.now() + 8_000 }
      setLocalUpdateKind('time'); setLocationUndoSeconds(8)
      if (purchaseTimeViewRef.current === purchaseId) setStatus(locale === 'he' ? 'תאריך הרכישה תוקן במכשיר הזה' : 'Purchase date corrected on this device')
      return {}
    } finally { locationWriteRef.current = false }
  }

  const undoLocation = async () => {
    const undo = locationUndoRef.current
    if (!undo || performance.now() >= undo.deadline || locationWriteRef.current) return
    const next = undoPurchaseLocation(sessionLedgerRef.current, undo)
    if (!next) { setLocationUndoSeconds(0); return }
    locationWriteRef.current = true
    try {
      if (!await localData.commit(next, inboxDecisionsRef.current)) return
      sessionLedgerRef.current = next; setSessionLedger(next)
      locationUndoRef.current = null; setLocationUndoSeconds(0)
      updateSelectedFilter(null); setSelectedPlaceId(null); setComparisonReadyId(null); setAskUndoSnapshot(null)
      setStatus(localUpdateKind === 'time' ? (locale === 'he' ? 'תיקון התאריך בוטל' : 'Date correction undone') : (locale === 'he' ? 'עדכון המקום בוטל' : 'Place update undone'))
    } finally { locationWriteRef.current = false }
  }

  const resetSessionCaptures = async () => {
    closeCapture()
    setPrivacyOpen(true)
    return false
  }

  // Loading or hiding the demo story returns to a clean view. It changes only what
  // is shown: nothing is written to the purchase store and your purchases stay.
  const toggleDemoData = () => exitReplayForNavigation(() => {
    const next = !demoData
    writeDemoPreference((() => { try { return window.localStorage } catch { return null } })(), next)
    stopSpin(false)
    const snapshot: NavigationSnapshot = { marker: 'spendscape-1d1', surface, selectedPlaceId: null, selectedPurchaseId: null }
    window.history.replaceState({ ...window.history.state, ...snapshot }, '', navigationHash(snapshot))
    applyNavigation(snapshot)
    setDemoData(next)
    setStatus(next ? t.demoLoadedStatus : t.demoHiddenStatus)
  })

  const setTimelineMonth = (month: string | null) => {
    stopSpin(false)
    updateQuery({ timelineMonth: month, dateRange: 'all' })
  }

  const openAsk = (trigger: HTMLElement) => exitReplayForNavigation((replayEntry) => {
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
      ...replayEntry,
      askOpen: true,
      captureStep: null,
      captureDepth: 0,
      inboxCaseId: null,
    })
  })

  const closeAsk = useCallback(() => {
    if (askOpen && isNavigationSnapshot(window.history.state) && window.history.state.askOpen) {
      window.history.back()
      return
    }
    setAskOpen(false)
  }, [askOpen])

  const executeAskActions = useCallback((actions: unknown, actionSummary: string) => {
    if (replaySessionRef.current) return
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
    if (needsMap && (!mapRef.current || !mapAvailable)) {
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
          const place = placeForId(action.placeId, globePlaces)
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
              const place = placeForId(placeId, globePlacesRef.current)
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
            const place = placeForId(purchase.placeId, globePlaces)
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
  }, [allPurchases, analyticsView, applyNavigation, askContext, mapAvailable, mode, query, runCameraAction, selectedPlaceId, selectedPurchaseId, surface, updateSelectedFilter, visibleData.features])

  const undoAskAction = useCallback(() => exitReplayForNavigation(() => {
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
  }), [applyNavigation, askUndoSnapshot, exitReplayForNavigation, runCameraAction])

  const retryMap = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('mapFailure')
    window.history.replaceState(window.history.state, '', url)
    setMapAttempt((current) => current + 1)
  }

  const openTimeline = () => {
    timelineReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    exitReplayForNavigation(() => {
      stopSpin(false)
      setMobileToolsOpen(false)
      setTimelineOpen(true)
    })
  }

  const openFilters = () => exitReplayForNavigation(() => {
    stopSpin(false)
    setMobileToolsOpen(false)
    setFiltersOpen(true)
  })

  const openReplay = (trigger: HTMLElement) => {
    if (replaySessionRef.current || askOpen || captureStep || inboxCaseId) return
    replayReturnFocusRef.current = trigger
    const navigation: NavigationSnapshot = { marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId, replay: null }
    const session: ReplaySession = {
      // A page-lifetime key prevents pre-reload entries aliasing new sessions.
      // This is an opaque navigation reference, not a credential.
      id: `${performance.timeOrigin}:${++replaySequenceRef.current}`,
      entry: { navigation, query: { ...query }, mode, analyticsView, camera: mapRef.current ? snapshotCamera(mapRef.current) : getStoredCamera() },
      purchaseIds: visiblePurchases.map((purchase) => purchase.id),
    }
    // Own persistence before stopping a flight, which synchronously emits moveend.
    replaySessionRef.current = session
    replaySessionsRef.current.set(session.id, session)
    replayLastPlaceRef.current = null
    replayAutomaticCameraCommandsRef.current = 0
    replayExplicitCameraCommandsRef.current = 0
    replayEventPresentationsRef.current = 0
    replaySourceUpdatesAtOpenRef.current = sourceUpdates
    stopSpin(false)
    if (session.entry.camera) window.sessionStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(session.entry.camera))
    setReplay(session)
    setMode('pins')
    // Only an opaque key and ordinary navigation flags enter browser history.
    // Query text, purchase lists and restoration state stay in the runtime map.
    const snapshot: NavigationSnapshot = { ...navigation, replay: { id: session.id } }
    window.history.pushState({ ...window.history.state, ...snapshot }, '', navigationHash(snapshot))
    applyNavigation(snapshot)
  }

  const presentReplayPurchase = useCallback((purchase: GlobePurchase | undefined, intent: 'details' | 'show-place' = 'details') => {
    if (!replaySessionRef.current) return
    replayEventPresentationsRef.current += 1
    if (window.__SPENDSCAPE_QA__) {
      window.__SPENDSCAPE_QA__.replayEventPresentations = replayEventPresentationsRef.current
    }
    const place = replayPlace(purchase, globePlacesRef.current)
    updateSelectedFilter(place?.id ?? null)
    replayLastPlaceRef.current = place?.id ?? null
    // Playback owns only event details and a temporary pin highlight. It never
    // owns the camera. This branch intentionally returns before any map method.
    if (intent !== 'show-place') return
    const map = mapRef.current
    if (!place || !map || !replayMapAvailableRef.current) return
    const playerTop = document.querySelector('[data-testid="replay-player"]')?.getBoundingClientRect().top ?? window.innerHeight / 2
    // Frame the pin in the exposed map, including the short-phone player height.
    const offset: [number, number] = window.innerWidth <= 760
      ? [0, (60 + playerTop) / 2 - window.innerHeight / 2]
      : [0, -80]
    // This explicit, user-invoked action is Replay's sole camera command.
    replayExplicitCameraCommandsRef.current += 1
    if (window.__SPENDSCAPE_QA__) {
      window.__SPENDSCAPE_QA__.replayExplicitCameraCommands = replayExplicitCameraCommandsRef.current
    }
    programmaticCameraRef.current = true
    map.once('moveend', () => { programmaticCameraRef.current = false })
    const repositionWithoutMotion = reducedMotionRef.current
    map.flyTo({ center: place.coordinates, zoom: 15.2, speed: 1.6,
      offset, ...(repositionWithoutMotion ? { duration: 0 } : {}),
      // MapLibre otherwise converts a reduced-motion flyTo to jumpTo and drops
      // its offset. A zero-duration essential transition keeps the explicit pin
      // in the exposed map without introducing animated motion.
      essential: repositionWithoutMotion })
  }, [updateSelectedFilter])

  const showSavingsStore = (store: SavingsStore) => {
    const reveal = () => runCameraAction('savings-store', map => map.flyTo({
      center: [store.location.lon, store.location.lat], zoom: 15.6, speed: 1.6,
      offset: offsetBesidePanel(document.querySelector('[data-testid="purchase-detail"]')?.getBoundingClientRect() ?? null, { width: window.innerWidth, height: window.innerHeight }),
      ...(reducedMotionRef.current ? { duration: 0 } : {}), essential: reducedMotionRef.current,
    }))
    // The receipt comparison covers the map on a phone. Reveal the purchase
    // sheet first, then put the branch in the visible map area beside it.
    if (nearbyPurchaseId) { closeTopLayer(); requestAnimationFrame(reveal) } else reveal()
  }
  return (
    <>
    <main
      inert={localData.busy || localData.phase !== 'ready'}
      data-local-state={localData.phase}
      data-location-editing={!!locationPurchaseId}
      data-location-picking={locationPicking}
      className={styles.app}
      data-locale={locale}
      data-map-ready={mapAvailable}
      data-renderer-health={rendererHealth}
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
      data-replay-open={Boolean(replay)}
      data-repository-adapter={initialData.source.adapter}
      data-data-classification={initialData.source.classification}
      data-data-version={initialData.source.version}
    >
      {localData.writeError && captureStep !== 'review' && captureStep !== 'manual' && (localData.lastFailure.current !== 'capacity' || !captureStep) && <div role="alert" style={{ position: 'fixed', bottom: 90, left: 12, right: 12, zIndex: 300, background: '#311b1b', color: 'white', padding: 12 }}>{localData.lastFailure.current === 'capacity' ? (locale === 'he' ? 'מגבלת האחסון המקומי הושגה. הרכישות הקיימות לא השתנו.' : 'Local storage limit reached. Existing purchases are unchanged.') : (locale === 'he' ? 'השינוי לא נשמר. בדקו את האחסון ונסו שוב.' : 'Change not saved. Check storage and retry.')}</div>}
      {migrationNotice && <div role="status" className={styles.migrationNotice} data-testid="legacy-migration-notice" data-migration-status={localData.migration?.status}><p>{migrationNotice}</p><button type="button" onClick={() => { setMigrationDismissed(true); dismissLegacyNotice((() => { try { return window.localStorage } catch { return null } })()) }}>{locale === 'he' ? 'הבנתי' : 'Got it'}</button></div>}
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
          <button type="button" className={styles.languageButton} data-testid="local-privacy" aria-label={locale === 'he' ? 'נתונים במכשיר ופרטיות' : 'On-device data & privacy'} title={locale === 'he' ? 'נתונים במכשיר ופרטיות' : 'On-device data & privacy'} onClick={() => setPrivacyOpen(true)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6z"/><path d="m8 12 3 3 5-6"/></svg></button>
          {syntheticQa && <button
            type="button"
            className={styles.inboxButton}
            onClick={() => openInbox()}
            aria-label={`${t.openInbox}${pendingInbox.length ? ` · ${pendingInbox.length}` : ''}`}
            data-testid="smart-inbox-open"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5zM5 14h4l1.5 2h3L15 14h4"/></svg>
            <span>{t.inbox}</span>
            {pendingInbox.length > 0 && <em aria-label={`${pendingInbox.length} pending`}>{pendingInbox.length}</em>}
          </button>}
          <button
            type="button"
            className={styles.addPurchaseButton}
            onClick={openCapture}
            data-testid="capture-open-desktop"
          >
            <span aria-hidden="true">＋</span>{t.addPurchase}
          </button>
          {syntheticQa && <span className={styles.syntheticBadge}>{sessionCaptureRecords.some(r => !r.synthetic) ? (locale === 'he' ? 'דוגמה + רכישות מקומיות' : 'Sample + local purchases') : t.synthetic}</span>}
          {!syntheticQa && <button type="button" className={styles.demoToggle} aria-pressed={demoData} data-testid="demo-toggle" onClick={toggleDemoData}>{demoData ? t.demoHide : t.demoLoad}</button>}
          <button
            type="button"
          className={styles.languageButton}
            onClick={() => {
              stopSpin(false)
              const next: LocaleCode = locale === 'en' ? 'he' : 'en'
              // The language choice is remembered only when the person makes it.
              try { writeLocalePreference(window.localStorage, next) } catch { /* storage blocked: lasts this visit */ }
              setLocale(next)
            }}
            aria-label={t.language}
          >
            {locale === 'en' ? 'עב' : 'EN'}
          </button>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="globe-title">
        <h1 id="globe-title">{t.headline}</h1>
        <p className={styles.heroCopy}>{t.intro}</p>
        <p className={styles.heroMeta}>
          <span><strong>{currentGlobeCounts.pinCount}</strong> {t.placesSummary}</span>
          <i aria-hidden="true" />
          <span><strong>{currentGlobeCounts.physicalConfirmedCount}</strong> {t.purchasesSummary}</span>
        </p>
      </section>

      {!syntheticQa && surface === 'globe' && allPurchases.length === 0 && !captureStep && !replay && (
        <section className={styles.homeEmpty} aria-labelledby="home-empty-title" data-testid="home-empty">
          <h2 id="home-empty-title">{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
          <button type="button" className={styles.emptyPrimary} onClick={openCapture} data-testid="home-empty-add">
            <span aria-hidden="true">＋</span>{t.emptyAdd}
          </button>
          <button type="button" className={styles.emptyLink} onClick={toggleDemoData} data-testid="home-demo-load">{t.emptyDemoHint}</button>
        </section>
      )}

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
          <button type="button" onClick={openFilters} data-testid="filters-open">
            {t.filters}{activeFilterCount > 0 && <span>{activeFilterCount}</span>}
          </button>
          <button type="button" ref={desktopTimelineRef} onClick={openTimeline} data-testid="timeline-open">
            {query.timelineMonth ?? t.timeline}
          </button>
          {syntheticQa && <button
            type="button"
            className={styles.askButton}
            ref={desktopAskTriggerRef}
            onClick={(event) => openAsk(event.currentTarget)}
            data-testid="ask-open-desktop"
          >
            <span aria-hidden="true">✦</span>{locale === 'he' ? 'שאלו' : 'Ask'}
          </button>}
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
      <section ref={controlDockRef} className={styles.controlDock} id="globe-controls" aria-label="Globe controls" data-testid="globe-tools"
        onPointerDownCapture={() => replayControllerRef.current?.pause()} onKeyDownCapture={() => replayControllerRef.current?.pause()}>
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
          <button type="button" onClick={openFilters}>{t.filters}</button>
          <button type="button" onClick={openTimeline}>{t.timeline}</button>
        </div>

        {syntheticQa && <button
          type="button"
          className={styles.mobileAskRow}
          onClick={(event) => openAsk(event.currentTarget)}
          data-testid="ask-open-mobile"
        >
          <span aria-hidden="true">✦</span>
          <span><strong>{locale === 'he' ? 'שאלו את Spendscape' : 'Ask Spendscape'}</strong><small>{locale === 'he' ? 'הדגמה מקומית וסינתטית' : 'Local synthetic actions'}</small></span>
          <i aria-hidden="true">{locale === 'he' ? '←' : '→'}</i>
        </button>}

        <div className={styles.modeSwitch} role="group" aria-label="Visualization">
          <button type="button" disabled={Boolean(replay) || rendererHealth !== 'ready'} aria-pressed={mode === 'pins'} onClick={() => { stopSpin(false); setMode('pins') }}>{t.pins}</button>
          <button type="button" disabled={Boolean(replay) || rendererHealth !== 'ready'} aria-pressed={mode === 'heatmap'} onClick={() => { stopSpin(false); setMode('heatmap') }}>{t.heatmap}</button>
        </div>

        <label className={styles.placeSelect}>
          <span className={styles.srOnly}>{t.jump}</span>
          <select
            disabled={rendererHealth !== 'ready'}
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
          <button type="button" disabled={rendererHealth !== 'ready' || visibleData.features.length === 0} onClick={fitVisible} aria-label={t.fit} title={t.fit}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/></svg>
          </button>
          <button type="button" disabled={rendererHealth !== 'ready' || !latestPlaceId} onClick={() => { if (latestPlaceId) selectPlace(latestPlaceId) }} aria-label={t.latest} title={t.latest}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>
          </button>
          <button type="button" disabled={rendererHealth !== 'ready'} onClick={resetGlobe} aria-label={t.reset} title={t.reset}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11a8 8 0 1 0 2-5.3M4 4v7h7"/></svg>
          </button>
          <button
            type="button"
            onClick={() => autoSpin ? stopSpin(false) : resumeSpin()}
            aria-label={autoSpin ? t.pause : t.resume}
            title={autoSpin ? t.pause : t.resume}
            disabled={reducedMotion || Boolean(replay) || rendererHealth !== 'ready'}
          >
            {autoSpin ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7v10M15 7v10"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6Z"/></svg>
            )}
          </button>
          <span className={styles.zoomGroup}>
            <button type="button" disabled={rendererHealth !== 'ready'} onClick={() => { stopSpin(false); mapRef.current?.zoomOut({ duration: reducedMotion ? 0 : 350 }) }} aria-label={t.zoomOut}>−</button>
            <button type="button" disabled={rendererHealth !== 'ready'} onClick={() => { stopSpin(false); mapRef.current?.zoomIn({ duration: reducedMotion ? 0 : 350 }) }} aria-label={t.zoomIn}>+</button>
          </span>
        </div>
        <p className={styles.keyboardHint}>{t.keyboard}</p>
      </section>
      )}

      <div className={styles.mobilePrimary} aria-label="Primary globe actions">
        <button type="button" disabled={rendererHealth !== 'ready' || !latestPlaceId} className={styles.mobileLatest} onClick={() => { if (latestPlaceId) selectPlace(latestPlaceId) }}>
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

      {mapError && surface === 'globe' && !captureStep && !replay && (
        <div className={styles.failureState} role="alert" data-testid="map-failure">
          <span className={styles.failureIcon} aria-hidden="true">!</span>
          <p className={styles.eyebrow}>{t.checkpoint}</p>
          <h2>{t.mapFailed}</h2>
          <p>{t.mapFailedBody}</p>
          <button type="button" onClick={retryMap}>{t.retry}</button>
          <small>{mapError}</small>
        </div>
      )}

      {rendererHealth !== 'ready' && surface === 'globe' && !captureStep && !replay && !askOpen && (
        <div className={styles.failureState} role="status" data-testid="renderer-unavailable">
          <span className={styles.failureIcon} aria-hidden="true">!</span>
          <h2>{t.mapFailed}</h2>
          <p>{locale === 'he' ? 'המפה ממתינה לשחזור. היסטוריית הרכישות נשארת זמינה.' : 'Waiting for the map to recover. Purchase history remains available.'}</p>
        </div>
      )}

      {mapAvailable && surface === 'globe' && !captureStep && !replay && !askOpen && !selectedPurchase && visibleData.features.length === 0 && (syntheticQa || allPurchases.length > 0) && (
        <div className={styles.emptyState} role="status" data-testid="map-empty">
          <p className={styles.eyebrow}>{t.synthetic}</p>
          <h2>{allPurchases.length ? t.noPlaces : (locale === 'he' ? 'הגלובוס שלכם מחכה לרכישה הראשונה' : 'Your globe is ready for your first purchase')}</h2>
          <p>{allPurchases.length ? (locale === 'he' ? 'רק רכישות עם מקום פיזי שאישרתם יופיעו במפה. בדקו את פרטי הרכישה או המסננים.' : 'Only purchases with a physical place you confirmed appear on the map. Review purchase locations or filters.') : (locale === 'he' ? 'הוסיפו רכישה; מקומות מאומתים יופיעו כאן. רכישות ללא מיקום נשארות ברשימה.' : 'Add a purchase; confirmed places will appear here. Purchases without a location stay in your history.')}</p>
          <button type="button" onClick={allPurchases.length ? () => openSurface('purchases') : openCapture}>{allPurchases.length ? t.navPurchases : t.addPurchase}</button>
        </div>
      )}

      {!replay && selectedFeature && selectedPlace && !selectedPurchase && surface === 'globe' && (
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
            {(selectedPlace as LocalPlace).addressSearch && <><p>{locale === 'he' ? 'נקודה שאישרתם מתוך הצעת כתובת; לא אימות נוכחות היסטורית.' : 'Point you confirmed from an address suggestion; not historical occupancy verification.'}</p><AddressAttribution/></>}
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
            {(selectedPlace as LocalPlace).catalogStore && <p data-testid="place-catalog-provenance">{locale === 'he' ? `סניף מקטלוג המחירים של תל אביב · כתובת מפורסמת: ${(selectedPlace as LocalPlace).catalogStore!.publishedAddress || '—'}` : `Branch from the Tel Aviv price catalog · published address: ${(selectedPlace as LocalPlace).catalogStore!.publishedAddress || '—'}`}</p>}
            <p className={styles.panelTruth}>{syntheticQa ? t.synthetic : (locale === 'he' ? 'סיכה אחת לכל מקום רכישה מאומת.' : 'One pin per confirmed purchase place.')}</p>
          </div>
        </aside>
      )}

      {surface === 'purchases' && !selectedPurchase && (
        <section className={styles.purchasesPanel} aria-labelledby="purchases-title" data-testid="purchases-panel">
          <header className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>{demoShown ? t.demoOn : t.synthetic}</p>
              <h2 id="purchases-title">{t.history}</h2>
              <p>{syntheticQa ? (locale === 'he' ? 'היסטוריית בדיקה סינתטית.' : 'Synthetic QA history.') : demoShown ? t.demoHistoryIntro : t.historyIntro}</p>
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
            <button type="button" data-testid="history-timeline" onClick={openTimeline}>{query.timelineMonth ? formatMonth(query.timelineMonth, locale) : t.timeline}</button>
            {(query.search || query.category !== 'all' || activeFilterCount > 0) && (
              <button type="button" data-testid="history-reset" onClick={clearFilters}>{t.resetQuery}</button>
            )}
            {demoShown && <button type="button" data-testid="purchases-demo-hide" onClick={toggleDemoData}>{t.demoHide}</button>}
          </div>

          {!syntheticQa && allPurchases.length === 0 ? (
            <div className={styles.historyEmpty} role="status" data-testid="purchases-empty" data-empty-kind="no-purchases">
              <h3>{t.emptyTitle}</h3>
              <p>{t.emptyBody}</p>
              <button type="button" className={styles.emptyPrimary} onClick={openCapture}>{t.emptyAdd}</button>
              <p className={styles.emptyHint}>{t.emptyDemoHint}</p>
              <button type="button" onClick={toggleDemoData} data-testid="purchases-demo-load">{t.demoLoad}</button>
            </div>
          ) : visiblePurchases.length === 0 ? (
            <div className={styles.historyEmpty} role="status" data-testid="purchases-empty">
              <h3>{allPurchases.length ? t.noPurchases : (locale === 'he' ? 'הרכישה הראשונה שלכם מתחילה כאן' : 'Your first purchase starts here')}</h3>
              <p>{allPurchases.length ? t.noPurchasesBody : (locale === 'he' ? 'הוסיפו רכישה ידנית או קבלה ובדקו את הפרטים לפני השמירה.' : 'Add a manual purchase or receipt and review its details before saving.')}</p>
              <button type="button" onClick={allPurchases.length ? clearFilters : openCapture}>{allPurchases.length ? t.resetQuery : t.addPurchase}</button>
            </div>
          ) : (
            <div className={styles.purchaseList}>
              {visiblePurchases.map((purchase) => {
                const merchant = merchantForId(purchase.merchantId, globeMerchants)
                const place = purchase.placeId ? placeForId(purchase.placeId, globePlaces) : undefined
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
          syntheticQa={syntheticQa}
          analytics={visibleAnalytics}
          places={globePlaces}
          merchants={globeMerchants}
          monthSummary={monthSummary}
          locale={locale}
          query={query}
          activeFilterCount={activeFilterCount}
          onClose={closeTopLayer}
          onSearch={(search) => { stopSpin(false); updateQuery({ search }) }}
          onOpenFilters={openFilters}
          onOpenTimeline={openTimeline}
          onReset={clearFilters}
          onOpenPurchases={() => openSurface('purchases')}
          onSelectCategory={(category) => { stopSpin(false); updateQuery({ category }) }}
          onSelectChannel={(channel) => { stopSpin(false); updateQuery({ channel }) }}
          onSelectCurrency={(currency) => { stopSpin(false); updateQuery({ currency }) }}
          onSelectMonth={setTimelineMonth}
          onSelectPlace={selectPlace}
          initialView={analyticsView}
          demoData={demoShown}
          hasAnyPurchases={allPurchases.length > 0}
          onAddPurchase={openCapture}
          onLoadDemo={toggleDemoData}
        />
      )}

      {!replay && !locationPurchaseId && !nearbyPurchaseId && selectedPurchase && selectedMerchant && (
        <aside className={styles.purchaseDetailPanel} aria-labelledby="purchase-title" data-testid="purchase-detail">
          <button ref={purchaseDetailBackRef} type="button" className={styles.closePanel} onClick={closeTopLayer} aria-label={t.backToHistory}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
          <p className={styles.eyebrow}>{t.purchaseDetail} · {selectedPurchase.provenance === 'user-reviewed-session' ? (locale === 'he' ? 'דיווח שלך · במכשיר הזה' : 'Reported by you · on this device') : syntheticQa ? t.synthetic : t.demoLabel}</p>
          <h2 id="purchase-title">{localized(selectedMerchant.name, locale)}</h2>
          <p className={styles.panelLocation}>
            {selectedPurchase.placeId
              ? `${localized(placeForId(selectedPurchase.placeId, globePlaces)!.branch, locale)} · ${localized(placeForId(selectedPurchase.placeId, globePlaces)!.city, locale)}`
              : selectedPurchase.resolution === 'unresolved' ? t.unresolvedNoPin : t.onlineNoPin}
          </p>

          <p className={styles.detailHeroAmount} data-testid="purchase-detail-amount">
            <strong>{formatMoney(selectedPurchase.originalAmount, locale, selectedPurchase.originalCurrency)}</strong>
            <small>{formatDate(selectedPurchase.timestamp, locale)}</small>
          </p>

          <div className={styles.detailBadges}>
            <span>{t[selectedPurchase.category]}</span>
            <span>{t[selectedPurchase.paymentMode]}</span>
            <span>{selectedPurchase.resolution === 'confirmed' ? t.confirmedStatus : t.unresolvedStatus}</span>
          </div>

          {sessionCaptureRecords.some(r => r.purchase.id === selectedPurchase.id && r.source === 'receipt' && !r.synthetic) && <PurchaseTimeCorrection key={selectedPurchase.id} purchase={selectedPurchase} locale={locale} onConfirm={intent => confirmPurchaseTime(selectedPurchase.id, intent)} />}

          <div className={styles.amountLedger}>
            <span><small>{t.originalAmount}</small><strong>{formatMoney(selectedPurchase.originalAmount, locale, selectedPurchase.originalCurrency)}</strong></span>
            <span><small>{selectedPurchase.provenance === 'user-reviewed-session' ? (locale === 'he' ? 'סכום בש״ח לפי הדיווח שלך' : 'ILS amount reported by you') : t.baseAmount}</small><strong>{formatMoney(baseAmountIlsForPurchase(selectedPurchase), locale)}</strong></span>
          </div>

          <section className={styles.receiptSection} aria-labelledby="receipt-title">
            <h3 id="receipt-title">{t.receiptItems}</h3>
            {selectedPurchase.items.length === 0 ? <p>{t.noReceiptItems}</p> : (
              <ul>
                {selectedPurchase.items.map((item) => (
                  <li key={item.id}>
                    <span>{localized(item.label, locale)}<small>{item.quantity} × {formatMoney(item.unitPrice, locale, selectedPurchase.originalCurrency)}{item.discountMinor !== undefined && item.discountMinor > 0 && <> · {locale === 'he' ? 'הנחה' : 'Discount'} −{formatMoney(item.discountMinor / (selectedPurchase.originalCurrency === 'JPY' ? 1 : 100), locale, selectedPurchase.originalCurrency)}</>}</small></span>
                    <strong>{formatMoney(item.lineTotal, locale, selectedPurchase.originalCurrency)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selectedSavingsBasket && <SavingsPanel key={selectedPurchase.id} basket={selectedSavingsBasket} locale={locale} lineLabel={ref => { const item = selectedPurchase.items.find(i => i.id === ref); return item ? localized(item.label, locale) : '' }} onShowStore={showSavingsStore} />}

          {selectedPurchase.provenance === 'user-reviewed-session' && selectedPurchase.items.length > 0 && <ReceiptPayableSummary itemMinor={purchaseItemTotalMinor(selectedPurchase)} payableMinor={Math.round(selectedPurchase.originalAmount * (selectedPurchase.originalCurrency === 'JPY' ? 1 : 100))} currency={selectedPurchase.originalCurrency} locale={locale} />}

          <div className={styles.provenanceBlock}>
            <span><small>{t.fxProvenance}</small><strong>{localized(selectedPurchase.fx.label, locale)} · {selectedPurchase.fx.source === 'user-reported-conversion' ? selectedPurchase.fx.reportedBaseAmountIls : selectedPurchase.fx.rateToBase} {selectedPurchase.fx.baseCurrency}</strong></span>
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

          {sessionCaptureRecords.some(r => r.purchase.id === selectedPurchase.id) && <div className={styles.localDelete}>
            {deletePurchaseId === selectedPurchase.id ? <><p role="status">{locale === 'he' ? 'למחוק רכישה זו מהמכשיר? אי אפשר לבטל. מקומות שעדיין בשימוש יישארו.' : 'Delete this purchase from this device? This cannot be undone. Places still in use will remain.'}</p><button type="button" data-testid="local-purchase-delete-confirm" onClick={() => removeLocalPurchase(selectedPurchase.id)}>{locale === 'he' ? 'כן, למחוק רכישה' : 'Yes, delete purchase'}</button><button type="button" onClick={() => setDeletePurchaseId(null)}>{locale === 'he' ? 'ביטול' : 'Cancel'}</button></> : <button type="button" data-testid="local-purchase-delete" onClick={() => setDeletePurchaseId(selectedPurchase.id)}>{locale === 'he' ? 'מחיקת רכישה מהמכשיר' : 'Delete purchase from device'}</button>}
          </div>}
          {sessionCaptureRecords.some(r => r.purchase.id === selectedPurchase.id) && selectedPurchase.channel !== 'online' && !selectedMerchant.onlineOnly && <button type="button" className={styles.viewPlaceButton} data-testid="purchase-resolve-location" onClick={() => { stopSpin(false); setDeletePurchaseId(null); setLocationPurchaseId(selectedPurchase.id) }}>{locale === 'he' ? 'אישור או שינוי מקום הרכישה' : 'Confirm or change purchase place'}</button>}
          {sessionCaptureRecords.some(r => r.purchase.id === selectedPurchase.id && r.source === 'receipt') && <button type="button" className={styles.viewPlaceButton} data-testid="purchase-nearby-prices" onClick={() => { stopSpin(false); setDeletePurchaseId(null); setNearbyPurchaseId(selectedPurchase.id) }}>{locale === 'he' ? 'השוואת מחירים' : 'Price comparison'}</button>}
          {selectedPurchase.placeId && (
            <button type="button" className={styles.viewPlaceButton} data-testid="purchase-show-place" onClick={() => selectPlace(selectedPurchase.placeId!)}>{t.viewPlace}</button>
          )}
        </aside>
      )}

      {!replay && !captureStep && nearbyPurchaseId && selectedPurchase?.id === nearbyPurchaseId && <NearbyPricesReview key={nearbyPurchaseId} purchase={selectedPurchase} places={globePlaces} locale={locale} onClose={closeTopLayer} onShowStore={showSavingsStore} />}

      {locationPurchaseId && selectedPurchase?.id === locationPurchaseId && selectedMerchant && <div className={styles.locationHost}>
        <PurchaseLocationReview key={locationPurchaseId} locale={locale} merchant={selectedMerchant} places={userGraph.places} currentPlaceId={selectedPurchase.placeId} initialDetails={receiptLocationSeedRef.current} mapAvailable={mapAvailable}
          onPicking={value => { locationPickingRef.current = value; setLocationPicking(value); stopSpin(false) }}
          previewPoint={point => { const map = mapRef.current; if (!map || !mapAvailable) return; stopSpin(false); map.jumpTo({center:point,zoom:15}) }}
          getMapPoint={() => { if (!mapAvailable || !mapRef.current) return null; const center = mapRef.current.getCenter(); const longitude = ((center.lng + 180) % 360 + 360) % 360 - 180; return [Number(longitude.toFixed(6)), Number(center.lat.toFixed(6))] }}
          moveMap={action => { const map = mapRef.current; if (!map || !mapAvailable) return; stopSpin(false); if (action === 'in' || action === 'out') map.zoomTo(map.getZoom() + (action === 'in' ? 1 : -1), { duration: 0 }); else map.panBy(action === 'north' ? [0,-100] : action === 'south' ? [0,100] : action === 'east' ? [100,0] : [-100,0], { duration: 0 }) }}
          onCancel={closeTopLayer} onConfirm={intent => confirmPurchaseLocation(locationPurchaseId, intent)} />
      </div>}
      {!locationPurchaseId && locationUndoSeconds > 0 && locationUndoRef.current?.after === sessionLedger && <button type="button" className={styles.locationUndo} data-testid="location-undo" onClick={undoLocation}>{localUpdateKind === 'time' ? (locale === 'he' ? 'ביטול תיקון התאריך' : 'Undo date correction') : (locale === 'he' ? 'ביטול עדכון המקום' : 'Undo place update')} · {locationUndoSeconds}{locale === 'he' ? ' שנ׳' : 's'}</button>}

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
            <button className={styles.replayEntry} type="button" onClick={(event) => openReplay(event.currentTarget)} data-testid="replay-open">
              <span aria-hidden="true">▶</span><span>{locale === 'he' ? 'הרכישות לאורך הזמן' : 'Life Replay'}<small>{locale === 'he' ? 'ניגון תוצאות הרכישות הנוכחיות' : 'Play your current purchase results'}</small></span>
            </button>
          </aside>
        </>
      )}

      {!captureStep && !askOpen && !inboxCaseId && !replay && sessionLedger.undoId && (
        <button type="button" className={styles.sessionUndo} data-testid="session-undo" onClick={undoLastSessionPurchase} aria-label={locale === 'he' ? `ביטול ההוספה האחרונה, נותרו ${undoSeconds} שניות` : `Undo last addition, ${undoSeconds} seconds remaining`}>
          {locale === 'he' ? 'ביטול ההוספה האחרונה' : 'Undo last addition'} <span aria-hidden="true">{undoSeconds}{locale === 'he' ? ' שנ׳' : 's'}</span>
        </button>
      )}
      {!captureStep && !askOpen && !inboxCaseId && !replay && !selectedPurchaseId && !selectedPlaceId && surface === 'globe' && nearbyComparison && (
        <NearbyDemoCard comparison={nearbyComparison} locale={locale} floating onDismiss={() => {
          setComparisonReadyId(null)
          const buttons = document.querySelectorAll<HTMLElement>('[data-testid="capture-open-desktop"], [data-testid="capture-open-mobile"]')
          Array.from(buttons).find(button => button.offsetParent !== null)?.focus({ preventScroll: true })
        }} />
      )}
      {captureStep && (
        <CaptureExperience
          syntheticQa={syntheticQa}
          locale={locale}
          places={captureContext.places}
          merchants={captureContext.merchants}
          step={captureStep}
          reducedMotion={reducedMotion}
          sessionRecords={sessionCaptureRecords}
          comparison={nearbyComparison}
          onDismissComparison={() => setComparisonReadyId(null)}
          onNavigate={navigateCapture}
          onBack={() => window.history.back()}
          onClose={closeCapture}
          onConfirm={async (operationId, input, allowDuplicate) => {
            if (!syntheticQa && input.provenance !== 'user-reviewed') return { code: 'invalid', errors: { provenance: 'required' } }
            const saved = saveReviewedPurchase(sessionLedgerRef.current, operationId, input, captureContext, initialData.purchases, allowDuplicate)
            if (saved.result.code === 'saved') {
              if (!await localData.commit(saved.ledger, inboxDecisionsRef.current)) return { code: localData.lastFailure.current }
              setComparisonReadyId(null)
              sessionUndoDeadlineRef.current = performance.now() + 8_000
              setUndoSeconds(8)
              sessionLedgerRef.current = saved.ledger
              setSessionLedger(saved.ledger)
              setStatus(locale === 'he' ? 'הרכישה נשמרה במכשיר הזה' : 'Purchase saved on this device')
            }
            return saved.result
          }}
          onUndo={undoLastSessionPurchase}
          canUndo={sessionLedger.undoId !== null}
          undoSeconds={undoSeconds}
          onResetSession={resetSessionCaptures}
          onResolveLocation={(purchaseId, seed) => exitCaptureThen(() => { openPurchase(purchaseId); receiptLocationSeedRef.current = seed ? { ...seed } : undefined; setLocationPurchaseId(purchaseId) })}
          onViewPurchase={(purchaseId) => exitCaptureThen(() => openPurchase(purchaseId))}
          onShowOnGlobe={(placeId) => exitCaptureThen(() => selectPlace(placeId))}
        />
      )}

      {syntheticQa && inboxCaseId && activeInboxCase && activeInboxPurchase && (
        <SmartInboxExperience
          locale={locale}
          places={globePlaces}
          merchants={globeMerchants}
          inboxCase={activeInboxCase}
          purchase={activeInboxPurchase}
          purchases={basePurchases}
          decision={activeInboxDecision}
          onClose={closeInbox}
          onConfirm={async (decision) => {
            const next = upsertSmartInboxDecision(inboxDecisionsRef.current, decision)
            if (!await localData.commit(sessionLedgerRef.current, next)) return
            inboxDecisionsRef.current = next
            setSmartInboxDecisions(next)
            setStatus(locale === 'he' ? 'החלטת ההדגמה עודכנה' : 'Demo decision updated')
          }}
          onUndo={async () => {
            const next = removeSmartInboxDecision(inboxDecisionsRef.current, activeInboxCase.id)
            if (!await localData.commit(sessionLedgerRef.current, next)) return
            inboxDecisionsRef.current = next
            setSmartInboxDecisions(next)
            setStatus(locale === 'he' ? 'החלטת ההדגמה בוטלה' : 'Demo decision undone')
          }}
          onOpenPurchase={(purchaseId) => exitInboxThen(() => openPurchase(purchaseId))}
          onShowPlace={(placeId) => exitInboxThen(() => selectPlace(placeId))}
        />
      )}

      {syntheticQa && askOpen && !captureStep && !inboxCaseId && (
        <AskSpendscapeExperience
          locale={locale}
          context={askContext}
          onClose={closeAsk}
          onExecute={executeAskActions}
        />
      )}

      {replay && <LifeReplayExperience key={replay.id} purchases={replayPurchases}
        places={globePlaces} merchants={globeMerchants} locale={locale}
        reducedMotion={reducedMotion} mapAvailable={mapAvailable} rendererUnavailable={rendererHealth !== 'ready'} controllerRef={replayControllerRef}
        onRetryMap={mapError ? retryMap : undefined}
        onPresent={presentReplayPurchase} onClose={closeTopLayer} />}

      {askFeedback && !askOpen && !replay && (
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
    <LocalDataPanel locale={locale} open={privacyOpen} phase={localData.phase} busy={localData.busy} writeError={localData.writeError} onClose={() => setPrivacyOpen(false)} onErase={() => localData.commit(emptySessionLedger(), [], true)} emptyDestination={localData.emptyDestination} onExport={localData.exportBackup} onInspect={localData.inspectBackup} onRestore={localData.restoreBackup} />
    </>
  )
}
