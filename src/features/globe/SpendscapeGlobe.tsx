'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
  derivedPurchaseSummary,
  filterPurchases,
  globeEvidence,
  globeEvidenceRecords,
  globePlaces,
  localized,
  merchantForId,
  placeFeatureCollection,
  placeForId,
  purchaseForId,
  purchasesForPlace,
  synchronizeSelection,
  type CategoryFilter,
  type ChannelFilter,
  type CurrencyCode,
  type CurrencyFilter,
  type DateRangeFilter,
  type LocaleCode,
  type PlaceFeatureProperties,
  type PurchaseQuery,
} from '@/data/spendscape-globe'
import { SpendscapeAnalytics } from './SpendscapeAnalytics'
import styles from './SpendscapeGlobe.module.css'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark'
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
const PIN_CORE_LAYER = 'spendscape-pin-core'
const LABEL_LAYER = 'spendscape-place-labels'
const CAMERA_STORAGE_KEY = 'spendscape.phase1.globe-camera'

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

interface NavigationSnapshot {
  marker: 'spendscape-1d1'
  surface: ProductSurface
  selectedPlaceId: string | null
  selectedPurchaseId: string | null
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
  camera: CameraSnapshot | null
  performance: PerformanceEvidence
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
}

declare global {
  interface Window {
    __SPENDSCAPE_QA__?: QaEvidence
    __SPENDSCAPE_QA_ACTIONS__?: QaActions
  }
}

const copy = {
  en: {
    product: 'Spendscape', checkpoint: 'Globe checkpoint', navGlobe: 'Globe',
    navAnalytics: 'Analytics', navPurchases: 'Purchases',
    headline: 'Your world, in purchases.',
    intro: 'Every confirmed place becomes one point in a living history.',
    search: 'Search places or cities', all: 'All', groceries: 'Groceries', food: 'Food',
    retail: 'Retail', travel: 'Travel', pins: 'Pins', heatmap: 'Heatmap',
    fit: 'Fit purchases', latest: 'Fly to latest', reset: 'Reset globe',
    resume: 'Resume orbit', pause: 'Pause orbit', jump: 'Jump to a place',
    choosePlace: 'Choose a place', visits: 'visits', normalized: 'Illustrative base spend',
    latestVisit: 'Latest visit', close: 'Close place details', loading: 'Awakening your globe',
    loadingBody: 'Loading the map and placing synthetic purchases…',
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
    headline: 'עולם הרכישות שלך.',
    intro: 'כל מקום מאומת הופך לנקודה אחת בהיסטוריה חיה.',
    search: 'חיפוש מקומות או ערים', all: 'הכול', groceries: 'מכולת', food: 'אוכל',
    retail: 'קמעונאות', travel: 'נסיעות', pins: 'סיכות', heatmap: 'מפת חום',
    fit: 'התאם לרכישות', latest: 'טוס למקום האחרון', reset: 'אפס גלובוס',
    resume: 'המשך סיבוב', pause: 'עצור סיבוב', jump: 'עבור למקום',
    choosePlace: 'בחר מקום', visits: 'ביקורים', normalized: 'הוצאה בסיסית להמחשה',
    latestVisit: 'ביקור אחרון', close: 'סגירת פרטי מקום', loading: 'מעירים את הגלובוס',
    loadingBody: 'טוענים מפה וממקמים רכישות סינתטיות…',
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

async function fetchDevelopmentStyle(signal: AbortSignal): Promise<StyleSpecification> {
  const response = await fetch(STYLE_URL, { signal })
  if (!response.ok) throw new Error(`Development map style returned ${response.status}`)
  const providerStyle = await response.json() as StyleSpecification
  const tunedLayers = structuredClone(providerStyle.layers) as unknown as Array<Record<string, unknown>>

  for (const layer of tunedLayers) {
    const id = String(layer.id ?? '').toLocaleLowerCase()
    const sourceLayer = String(layer['source-layer'] ?? '').toLocaleLowerCase()
    const signature = `${id} ${sourceLayer}`
    const type = String(layer.type ?? '')
    const minZoom = Number(layer.minzoom ?? 0)
    const paint = (layer.paint ?? {}) as Record<string, unknown>

    if (type === 'background') {
      paint['background-color'] = '#05070b'
    }

    if (type === 'fill' && /water|ocean|lake|river/.test(signature)) {
      paint['fill-color'] = '#071620'
      paint['fill-opacity'] = 0.98
    }

    if (type === 'fill' && /building/.test(signature)) {
      layer.minzoom = Math.max(minZoom, 12)
      paint['fill-color'] = '#252b35'
    }

    if (type === 'line' && /boundary|admin/.test(signature)) {
      paint['line-color'] = '#68738a'
      paint['line-opacity'] = [
        'interpolate', ['linear'], ['zoom'],
        0, 0.16,
        3, 0.34,
        7, 0.62,
      ]
    } else if (type === 'line' && /road|street|highway|motorway|rail|transit/.test(signature)) {
      layer.minzoom = Math.max(minZoom, 5)
      paint['line-opacity'] = 0.42
    } else if (type === 'line' && /waterway|river|stream/.test(signature)) {
      layer.minzoom = Math.max(minZoom, 4)
      paint['line-color'] = '#173849'
    }

    if (type === 'symbol') {
      const isCountry = /country/.test(signature)
      const isSettlement = /place|city|town|village|state|province/.test(signature)
      const isHighNoise = /poi|housenumber|road|street|highway|motorway|transit|station|airport|ferry/.test(signature)
      layer.minzoom = Math.max(minZoom, isCountry ? 0.7 : isSettlement ? 2.6 : isHighNoise ? 5.4 : 3.8)
      paint['text-color'] = isCountry ? '#aeb8c9' : '#8893a7'
      paint['text-opacity'] = [
        'interpolate', ['linear'], ['zoom'],
        0, isCountry ? 0.28 : 0,
        2.5, isCountry ? 0.58 : 0.28,
        5.5, 0.88,
      ]
      paint['text-halo-color'] = 'rgba(4, 7, 11, 0.96)'
      paint['text-halo-width'] = 1.35
      paint['icon-opacity'] = isHighNoise ? 0.38 : 0.68
    }

    layer.paint = paint
  }

  return {
    ...providerStyle,
    layers: tunedLayers as unknown as StyleSpecification['layers'],
    name: 'Spendscape OpenFreeMap dark development globe',
    metadata: {
      'spendscape:provider': 'OpenFreeMap',
      'spendscape:sourceStyle': STYLE_URL,
    },
    projection: { type: 'globe' },
    light: {
      anchor: 'viewport',
      color: '#d6e5ff',
      intensity: 0.42,
      position: [1.15, 210, 32],
    },
    sky: {
      'sky-color': '#030509',
      'horizon-color': '#91aed7',
      'fog-color': '#132236',
      'atmosphere-blend': [
        'interpolate', ['linear'], ['zoom'],
        0, 1,
        3.5, 0.76,
        7, 0,
      ],
    },
  } as StyleSpecification
}

function percentile(values: number[], value: number): number {
  if (values.length === 0) return 0
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * value))]
}

function spatialEasing(value: number): number {
  return 1 - Math.pow(1 - value, 3)
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

export function SpendscapeGlobe() {
  const mapNodeRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const spinEnabledRef = useRef(true)
  const spinTimerRef = useRef<number | null>(null)
  const reducedMotionRef = useRef(false)
  const filteredRef = useRef(placeFeatureCollection)
  const mapReadyRef = useRef(false)
  const actionTimerRef = useRef<number | null>(null)
  const loadStartRef = useRef(0)
  const localeRef = useRef<LocaleCode>('en')

  const [locale, setLocale] = useState<LocaleCode>('en')
  const [query, setQuery] = useState<PurchaseQuery>(defaultPurchaseQuery)
  const [mode, setMode] = useState<MapMode>('pins')
  const [surface, setSurface] = useState<ProductSurface>('globe')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [stateRestored, setStateRestored] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [autoSpin, setAutoSpin] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [status, setStatus] = useState<string>(copy.en.loading)
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const [compactViewport, setCompactViewport] = useState(false)
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
  })
  const [performanceEvidence, setPerformanceEvidence] = useState<PerformanceEvidence>({
    samples: 0,
    medianFrameMs: 0,
    p95FrameMs: 0,
    loadMs: null,
    lastCameraAction: null,
    lastCameraMs: null,
  })

  const t = copy[locale]
  const visiblePurchases = useMemo(() => filterPurchases(query), [query])
  const visibleData = useMemo(
    () => buildPlaceFeatureCollection(globePlaces, visiblePurchases),
    [visiblePurchases],
  )
  const visibleSummary = useMemo(() => derivedPurchaseSummary(visiblePurchases), [visiblePurchases])
  const visibleAnalytics = useMemo(() => derivePurchaseAnalytics(visiblePurchases), [visiblePurchases])
  const timelineMonths = useMemo(() => availableTimelineMonths(), [])
  const selectedFeature = useMemo(
    () => visibleData.features.find(
      (feature) => feature.properties.placeId === selectedPlaceId,
    ) ?? null,
    [selectedPlaceId, visibleData.features],
  )
  const selectedPlace = selectedPlaceId ? placeForId(selectedPlaceId) : undefined
  const selectedPurchase = selectedPurchaseId ? purchaseForId(selectedPurchaseId) : undefined
  const selectedMerchant = selectedPurchase ? merchantForId(selectedPurchase.merchantId) : undefined
  const selectedEvidence = useMemo(
    () => selectedPurchase
      ? globeEvidenceRecords.filter((record) => selectedPurchase.evidenceIds.includes(record.id))
      : [],
    [selectedPurchase],
  )
  const selectedPlacePurchases = useMemo(
    () => selectedPlaceId ? purchasesForPlace(selectedPlaceId, visiblePurchases) : [],
    [selectedPlaceId, visiblePurchases],
  )
  const activeFilterCount = [
    query.currency !== 'all', query.channel !== 'all', query.dateRange !== 'all',
    query.timelineMonth !== null,
  ].filter(Boolean).length

  filteredRef.current = visibleData
  reducedMotionRef.current = reducedMotion
  localeRef.current = locale

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

    const snapshot: NavigationSnapshot = isNavigationSnapshot(window.history.state)
      ? window.history.state
      : {
          marker: 'spendscape-1d1',
          surface: restored.surface ?? 'globe',
          selectedPlaceId: restored.selectedPlaceId ?? null,
          selectedPurchaseId: restored.selectedPurchaseId ?? null,
        }
    window.history.replaceState(snapshot, '', navigationHash(snapshot))
    setStateRestored(true)
  }, [])

  useEffect(() => {
    if (!stateRestored) return
    const stored: StoredExperienceState = {
      marker: 'spendscape-1d1', locale, query, mode, surface,
      selectedPlaceId, selectedPurchaseId,
    }
    window.sessionStorage.setItem(EXPERIENCE_STORAGE_KEY, JSON.stringify(stored))
  }, [locale, mode, query, selectedPlaceId, selectedPurchaseId, stateRestored, surface])

  const clearSpinTimer = useCallback(() => {
    if (spinTimerRef.current !== null) {
      window.clearTimeout(spinTimerRef.current)
      spinTimerRef.current = null
    }
  }, [])

  const stopSpin = useCallback((announce = true) => {
    spinEnabledRef.current = false
    clearSpinTimer()
    mapRef.current?.stop()
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
    setFiltersOpen(false)
    setTimelineOpen(false)
    setMobileToolsOpen(false)
    updateSelectedFilter(snapshot.selectedPlaceId)
  }, [updateSelectedFilter])

  const pushNavigation = useCallback((patch: Partial<NavigationSnapshot>) => {
    const snapshot: NavigationSnapshot = {
      marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId,
      ...patch,
    }
    window.history.pushState(snapshot, '', navigationHash(snapshot))
    applyNavigation(snapshot)
  }, [applyNavigation, selectedPlaceId, selectedPurchaseId, surface])

  const closeTopLayer = useCallback(() => {
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

    const snapshot: NavigationSnapshot = selectedPurchaseId
      ? { marker: 'spendscape-1d1', surface, selectedPlaceId, selectedPurchaseId: null }
      : selectedPlaceId
        ? { marker: 'spendscape-1d1', surface, selectedPlaceId: null, selectedPurchaseId: null }
        : { marker: 'spendscape-1d1', surface: 'globe', selectedPlaceId: null, selectedPurchaseId: null }
    window.history.replaceState(snapshot, '', navigationHash(snapshot))
    applyNavigation(snapshot)
  }, [applyNavigation, filtersOpen, mobileToolsOpen, selectedPlaceId, selectedPurchaseId, surface, timelineOpen])

  useEffect(() => {
    const restoreNavigation = (event: PopStateEvent) => {
      if (isNavigationSnapshot(event.state)) applyNavigation(event.state)
    }
    window.addEventListener('popstate', restoreNavigation)
    return () => window.removeEventListener('popstate', restoreNavigation)
  }, [applyNavigation])

  const selectPlace = useCallback((placeId: string, shouldFly = true, recordHistory = true) => {
    const map = mapRef.current
    const place = placeForId(placeId)
    if (!map || !place) return
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
    if (shouldFly) {
      const started = performance.now()
      map.once('moveend', () => {
        setPerformanceEvidence((current) => ({
          ...current,
          lastCameraAction: 'fly-to-place',
          lastCameraMs: Math.round((performance.now() - started) * 10) / 10,
        }))
      })
      map.flyTo({
        center: place.coordinates,
        zoom: Math.max(map.getZoom(), 7.4),
        duration: reducedMotionRef.current ? 0 : 1250,
        curve: 1.18,
        easing: spatialEasing,
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
      map.setLayoutProperty(LABEL_LAYER, 'text-field', ['get', locale === 'he' ? 'nameHe' : 'nameEn'])
    }
  }, [locale])

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTopLayer()
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [closeTopLayer])

  useEffect(() => {
    const controller = new AbortController()
    const node = mapNodeRef.current
    if (!node) return () => controller.abort()

    const searchParams = new URLSearchParams(window.location.search)
    const forceFailure = searchParams.get('mapFailure') === '1'
    const holdLoadingState = searchParams.get('loading') === '1'
    if (forceFailure) {
      setLoading(false)
      setMapError('Simulated development style failure')
      setStatus(copy.en.mapFailed)
      return () => controller.abort()
    }

    let disposed = false
    loadStartRef.current = performance.now()

    const initialize = async () => {
      try {
        maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')
        if (holdLoadingState) {
          await new Promise((resolve) => window.setTimeout(resolve, 1800))
        }
        const developmentStyle = await fetchDevelopmentStyle(controller.signal)
        if (disposed || !mapNodeRef.current) return

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
          renderWorldCopies: false,
          localIdeographFontFamily: 'system-ui, sans-serif',
        })

        mapRef.current = map
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
        node.addEventListener('pointerdown', interrupt, { passive: true })
        node.addEventListener('wheel', interrupt, { passive: true })
        node.addEventListener('keydown', interrupt)

        map.on('load', async () => {
          if (disposed) return
          mapReadyRef.current = true
          const symbolLayer = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id

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
            maxzoom: 8,
            layout: { visibility: 'none' },
            paint: {
              'heatmap-weight': [
                'interpolate', ['linear'],
                ['to-number', ['coalesce', ['get', 'visitCount'], ['get', 'point_count']], 1],
                1, 0.15,
                14, 1,
              ],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.75, 7, 1.8],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 7, 44],
              'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.78, 8, 0.2],
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(81, 221, 255, 0)',
                0.18, 'rgba(81, 221, 255, 0.48)',
                0.42, 'rgba(100, 115, 255, 0.72)',
                0.7, 'rgba(183, 91, 255, 0.88)',
                1, 'rgba(255, 239, 201, 0.98)',
              ],
            },
          }, symbolLayer)

          const categoryColor: ExpressionSpecification = [
            'match', ['get', 'category'],
            'groceries', '#57e1c0',
            'food', '#ff9f68',
            'retail', '#b58cff',
            'travel', '#58c8ff',
            '#f8fbff',
          ]

          map.addLayer({
            id: CLUSTER_GLOW_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': [
                'step', ['get', 'point_count'],
                '#5f8cff', 3, '#8e66ff', 7, '#d365ff',
              ],
              'circle-radius': ['step', ['get', 'point_count'], 25, 4, 31, 8, 38],
              'circle-opacity': 0.46,
              'circle-blur': 0.72,
            },
          }, symbolLayer)

          map.addLayer({
            id: CLUSTER_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': [
                'step', ['get', 'point_count'],
                '#4d72ea', 3, '#7652e5', 7, '#aa4bd4',
              ],
              'circle-radius': ['step', ['get', 'point_count'], 16, 4, 21, 8, 27],
              'circle-stroke-color': 'rgba(239,244,255,0.9)',
              'circle-stroke-width': 1.25,
              'circle-opacity': 0.96,
              'circle-blur': 0.02,
            },
          }, symbolLayer)

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
          }, symbolLayer)

          map.addLayer({
            id: PIN_GLOW_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'visitCount'], 1, 13, 14, 22],
              'circle-color': categoryColor,
              'circle-opacity': 0.42,
              'circle-blur': 0.76,
            },
          }, symbolLayer)

          map.addLayer({
            id: PIN_SHADOW_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'visitCount'], 1, 8, 14, 13],
              'circle-color': '#020306',
              'circle-opacity': 0.7,
              'circle-translate': [0, 2.5],
              'circle-blur': 0.22,
            },
          }, symbolLayer)

          map.addLayer({
            id: PIN_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'visitCount'], 1, 6.5, 14, 11.5],
              'circle-color': categoryColor,
              'circle-stroke-color': 'rgba(244,248,255,0.92)',
              'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 5, 1.45],
              'circle-opacity': 0.99,
            },
          }, symbolLayer)

          map.addLayer({
            id: PIN_CORE_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['get', 'visitCount'], 1, 1.7, 14, 2.7],
              'circle-color': '#ffffff',
              'circle-opacity': 0.94,
            },
          }, symbolLayer)

          map.addLayer({
            id: SELECTION_GLOW_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['==', ['get', 'placeId'], ''],
            paint: {
              'circle-radius': 28,
              'circle-color': categoryColor,
              'circle-opacity': 0.6,
              'circle-blur': 0.68,
            },
          }, symbolLayer)

          map.addLayer({
            id: HALO_LAYER,
            type: 'circle',
            source: SOURCE_ID,
            filter: ['==', ['get', 'placeId'], ''],
            paint: {
              'circle-radius': 17,
              'circle-color': 'rgba(255,255,255,0)',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
              'circle-opacity': 1,
            },
          }, symbolLayer)

          map.addLayer({
            id: LABEL_LAYER,
            type: 'symbol',
            source: SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            minzoom: 3.6,
            layout: {
              'text-field': ['get', localeRef.current === 'he' ? 'nameHe' : 'nameEn'],
              'text-font': ['Noto Sans Regular'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 3.6, 11, 8, 12.5],
              'text-offset': [0, 1.65],
              'text-anchor': 'top',
              'text-optional': true,
            },
            paint: {
              'text-color': '#f7f7fb',
              'text-halo-color': 'rgba(4,7,11,0.98)',
              'text-halo-width': 1.8,
            },
          })

          const canonicalSource = map.getSource(SOURCE_ID) as GeoJSONSource
          try {
            await canonicalSource.setData(filteredRef.current)
            setSourceUpdates((current) => current + 1)
          } catch (error) {
            if (disposed) return
            setLoading(false)
            setMapError(error instanceof Error ? error.message : 'Canonical place source failed')
            setStatus(copy[localeRef.current].mapFailed)
            return
          }
          if (disposed) return
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
            map.once('moveend', () => setPerformanceEvidence((current) => ({
              ...current,
              lastCameraAction: 'cluster-expansion',
              lastCameraMs: Math.round((performance.now() - started) * 10) / 10,
            })))
            map.easeTo({
              center: coordinates,
              zoom,
              duration: reducedMotionRef.current ? 0 : 900,
              easing: spatialEasing,
              essential: false,
            })
          })

          map.on('click', PIN_LAYER, (event) => {
            const placeId = String(event.features?.[0]?.properties?.placeId ?? '')
            if (placeId) selectPlace(placeId)
          })

          const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16 })
          map.on('mouseenter', PIN_LAYER, (event) => {
            map.getCanvas().style.cursor = 'pointer'
            const feature = event.features?.[0]
            if (!feature) return
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
          }

          const loadMs = Math.round((performance.now() - loadStartRef.current) * 10) / 10
          setPerformanceEvidence((current) => ({ ...current, loadMs }))
          setLoading(false)
          setMapError(null)
          setStatus(copy.en.ready)
        })

      } catch (error) {
        if (controller.signal.aborted || disposed) return
        setLoading(false)
        setMapError(error instanceof Error ? error.message : 'Map initialization failed')
        setStatus(copy.en.mapFailed)
      }
    }

    void initialize()

    return () => {
      disposed = true
      controller.abort()
      clearSpinTimer()
      if (actionTimerRef.current !== null) window.clearTimeout(actionTimerRef.current)
      mapReadyRef.current = false
      mapRef.current?.remove()
      mapRef.current = null
      delete window.__SPENDSCAPE_QA_ACTIONS__
    }
  }, [clearSpinTimer, queueSpin, selectPlace, stopSpin, updateSelectedFilter])

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
    const pinsVisibility = mode === 'pins' ? 'visible' : 'none'
    map.setLayoutProperty(CLUSTER_GLOW_LAYER, 'visibility', pinsVisibility)
    map.setLayoutProperty(CLUSTER_LAYER, 'visibility', pinsVisibility)
    map.setLayoutProperty(CLUSTER_COUNT_LAYER, 'visibility', pinsVisibility)
    map.setLayoutProperty(PIN_GLOW_LAYER, 'visibility', pinsVisibility)
    map.setLayoutProperty(PIN_SHADOW_LAYER, 'visibility', pinsVisibility)
    map.setLayoutProperty(SELECTION_GLOW_LAYER, 'visibility', pinsVisibility)
    map.setLayoutProperty(HALO_LAYER, 'visibility', pinsVisibility)
    map.setLayoutProperty(PIN_LAYER, 'visibility', pinsVisibility)
    map.setLayoutProperty(PIN_CORE_LAYER, 'visibility', pinsVisibility)
    map.setLayoutProperty(LABEL_LAYER, 'visibility', pinsVisibility)
    map.setLayoutProperty(HEAT_LAYER, 'visibility', mode === 'heatmap' ? 'visible' : 'none')
    setStatus(mode === 'pins' ? copy[locale].modePins : copy[locale].modeHeat)
  }, [locale, mode])

  useEffect(() => {
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
      visiblePurchaseCount: visiblePurchases.length,
      visibleBaseTotalIls: visibleSummary.totalBaseAmountIls,
      visiblePinFeatures: visibleData.features.length,
      canonicalPins: globeEvidence.pinCount,
      physicalPurchases: globeEvidence.physicalConfirmedCount,
      onlineExcluded: globeEvidence.onlineCount,
      unresolvedExcluded: globeEvidence.unresolvedCount,
      recurringPlacePurchases: globeEvidence.recurringPlacePurchaseCount,
      recurringPlacePins: globeEvidence.recurringPlacePinCount,
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
      camera: mapRef.current ? snapshotCamera(mapRef.current) : null,
      performance: performanceEvidence,
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
  }, [autoSpin, loading, locale, mapError, mode, performanceEvidence, query, reducedMotion, renderedEvidence, selectedPlaceId, selectedPurchaseId, sourceUpdates, surface, visibleAnalytics, visibleData.features.length, visiblePurchases.length, visibleSummary.totalBaseAmountIls])

  const runCameraAction = useCallback((name: string, action: (map: MapLibreMap) => void) => {
    const map = mapRef.current
    if (!map) return
    stopSpin(false)
    const started = performance.now()
    let completed = false
    const finish = () => {
      if (completed) return
      completed = true
      if (actionTimerRef.current !== null) window.clearTimeout(actionTimerRef.current)
      setPerformanceEvidence((current) => ({
        ...current,
        lastCameraAction: name,
        lastCameraMs: Math.round((performance.now() - started) * 10) / 10,
      }))
    }
    map.once('moveend', finish)
    actionTimerRef.current = window.setTimeout(finish, 2500)
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
        duration: reducedMotionRef.current ? 0 : 1100,
        maxZoom: 7,
        easing: spatialEasing,
        essential: false,
      })
    })
  }, [runCameraAction, visibleData.features])

  const resetGlobe = useCallback(() => {
    setSelectedPlaceId(null)
    setSelectedPurchaseId(null)
    setSurface('globe')
    updateSelectedFilter(null)
    runCameraAction('reset-globe', (map) => map.flyTo({
      ...homeCamera(),
      duration: reducedMotionRef.current ? 0 : 1150,
      curve: 1.18,
      easing: spatialEasing,
      essential: false,
    }))
  }, [runCameraAction, updateSelectedFilter])

  const clearFilters = () => setQuery(defaultPurchaseQuery)

  const openSurface = (nextSurface: ProductSurface) => {
    stopSpin(false)
    pushNavigation({
      surface: nextSurface,
      selectedPurchaseId: null,
      selectedPlaceId: nextSurface === 'globe' ? selectedPlaceId : null,
    })
  }

  const openPurchase = (purchaseId: string) => {
    const purchase = purchaseForId(purchaseId)
    if (!purchase) return
    stopSpin(false)
    if (purchase.placeId) selectPlace(purchase.placeId, true, false)
    pushNavigation({
      surface: 'purchases',
      selectedPlaceId: purchase.placeId,
      selectedPurchaseId: purchase.id,
    })
  }

  const setTimelineMonth = (month: string | null) => {
    stopSpin(false)
    updateQuery({ timelineMonth: month, dateRange: 'all' })
  }

  const retryMap = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('mapFailure')
    window.history.replaceState({}, '', url)
    window.location.reload()
  }

  return (
    <main
      className={styles.app}
      data-locale={locale}
      data-map-ready={!loading && !mapError}
      data-auto-spin={autoSpin}
      data-mode={mode}
      data-pin-count={globeEvidence.pinCount}
      data-online-excluded={globeEvidence.onlineCount}
      data-unresolved-excluded={globeEvidence.unresolvedCount}
      data-frame-p95={performanceEvidence.p95FrameMs}
      data-mobile-tools={mobileToolsOpen}
      data-surface={surface}
      data-visible-purchases={visiblePurchases.length}
      data-visible-pins={visibleData.features.length}
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
          <span><strong>{globeEvidence.pinCount}</strong> {t.placesSummary}</span>
          <i aria-hidden="true" />
          <span><strong>{globeEvidence.physicalConfirmedCount}</strong> {t.purchasesSummary}</span>
        </p>
      </section>

      <section className={styles.queryDock} aria-label="Globe query controls">
        <label className={styles.searchField}>
          <span className={styles.srOnly}>{t.search}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          <input
            type="search"
            value={query.search}
            onChange={(event) => { stopSpin(false); updateQuery({ search: event.target.value }) }}
            placeholder={t.search}
            aria-label={t.search}
            data-testid="shared-search"
          />
        </label>
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
      <section className={styles.controlDock} id="globe-controls" aria-label="Globe controls" data-testid="globe-tools">
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

      {loading && (
        <div className={styles.loadingState} role="status" data-testid="map-loading">
          <div className={styles.loadingGlobe} aria-hidden="true"><span /></div>
          <p className={styles.eyebrow}>{t.synthetic}</p>
          <h2>{t.loading}</h2>
          <p>{t.loadingBody}</p>
          <div className={styles.loadingLine}><span /></div>
        </div>
      )}

      {mapError && (
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
        <aside className={styles.placePanel} aria-labelledby="place-title" data-testid="place-panel">
          <button
            type="button"
            className={styles.closePanel}
            onClick={closeTopLayer}
            aria-label={t.close}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
          </button>
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
            {selectedPlacePurchases.slice(0, 4).map((purchase) => (
              <button type="button" key={purchase.id} onClick={() => openPurchase(purchase.id)}>
                <span>{formatDate(purchase.timestamp, locale)}</span>
                <strong>{formatMoney(purchase.originalAmount, locale, purchase.originalCurrency)}</strong>
              </button>
            ))}
          </div>
          <p className={styles.panelTruth}>{t.synthetic} · {globeEvidence.recurringPlacePurchaseCount}:1 {locale === 'en' ? 'pin rule verified in fixtures' : 'כלל הסיכה אומת בנתונים'}</p>
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
            <button type="button" className={styles.closePanel} onClick={closeTopLayer} aria-label={t.closeHistory}>
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
        />
      )}

      {selectedPurchase && selectedMerchant && (
        <aside className={styles.purchaseDetailPanel} aria-labelledby="purchase-title" data-testid="purchase-detail">
          <button type="button" className={styles.closePanel} onClick={closeTopLayer} aria-label={t.backToHistory}>
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

      <nav className={styles.mobileNav} aria-label="Mobile primary">
        <button type="button" data-active={surface === 'globe'} onClick={() => openSurface('globe')}><i className={styles.globeIcon} />{t.navGlobe}</button>
        <button type="button" data-active={surface === 'purchases'} onClick={() => openSurface('purchases')}><i className={styles.purchaseIcon} />{t.navPurchases}</button>
        <button type="button" data-active={surface === 'stats'} onClick={() => openSurface('stats')}><i className={styles.statsIcon} />{t.mobileStats}</button>
      </nav>
    </main>
  )
}
