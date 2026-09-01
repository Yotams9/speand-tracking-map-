import {
  nestedItemTotal,
  syntheticFx,
  type CurrencyCode,
  type GlobePurchase,
  type LocaleCode,
  type PaymentMode,
  type PurchaseCategory,
  type PurchaseEvidence,
  type PurchaseItem,
} from '../../data/spendscape-globe'

export type CaptureSource =
  | 'receipt'
  | 'product'
  | 'barcode'
  | 'document'
  | 'pdf'
  | 'csv'
  | 'gmail'
  | 'manual'
  | 'failure'

export type CaptureStep =
  | 'scanner'
  | 'sources'
  | 'processing'
  | 'review'
  | 'manual'
  | 'gmail'
  | 'failure'
  | 'success'

export interface CaptureDraft {
  source: Exclude<CaptureSource, 'gmail' | 'failure'>
  merchantId: string | null
  placeId: string | null
  timestamp: string
  channel: 'physical' | 'online' | 'unknown'
  resolution: 'confirmed' | 'unresolved'
  paymentMode: PaymentMode
  category: PurchaseCategory
  originalAmount: number | null
  originalCurrency: CurrencyCode
  items: PurchaseItem[]
  provenance: 'synthetic-demo'
  productCandidateOnly: boolean
  contextConfirmed: boolean
  csvPreviewCount?: number
}

export interface SessionCaptureRecord {
  purchase: GlobePurchase
  evidence: PurchaseEvidence
  source: CaptureDraft['source']
  synthetic: true
}

export interface CaptureState {
  step: CaptureStep
  source: CaptureSource | null
  draft: CaptureDraft | null
  lastPurchaseId: string | null
  attempt: number
}

export type CaptureAction =
  | { type: 'navigate'; step: CaptureStep }
  | { type: 'choose-source'; source: CaptureSource }
  | { type: 'draft-ready'; draft: CaptureDraft }
  | { type: 'update-draft'; patch: Partial<CaptureDraft> }
  | { type: 'confirm'; purchaseId: string }
  | { type: 'retry' }
  | { type: 'reset-flow' }

export const initialCaptureState: CaptureState = {
  step: 'scanner',
  source: null,
  draft: null,
  lastPurchaseId: null,
  attempt: 0,
}

export function captureReducer(state: CaptureState, action: CaptureAction): CaptureState {
  switch (action.type) {
    case 'navigate':
      return { ...state, step: action.step }
    case 'choose-source':
      return {
        ...state,
        source: action.source,
        draft: null,
        step: action.source === 'manual'
          ? 'manual'
          : action.source === 'gmail'
            ? 'gmail'
            : action.source === 'failure'
              ? 'failure'
              : 'processing',
      }
    case 'draft-ready':
      return { ...state, draft: action.draft, step: 'review' }
    case 'update-draft':
      return state.draft ? { ...state, draft: { ...state.draft, ...action.patch } } : state
    case 'confirm':
      return { ...state, lastPurchaseId: action.purchaseId, step: 'success' }
    case 'retry':
      return { ...state, attempt: state.attempt + 1, source: 'receipt', step: 'processing' }
    case 'reset-flow':
      return initialCaptureState
  }
}

const item = (
  id: string,
  en: string,
  he: string,
  quantity: number,
  unitPrice: number,
  unit: PurchaseItem['unit'] = 'item',
): PurchaseItem => ({
  id,
  label: { en, he },
  quantity,
  unit,
  unitPrice,
  lineTotal: Math.round(quantity * unitPrice * 100) / 100,
})

const DEMO_TIMESTAMP = '2026-08-29T17:45:00Z'

export function demoDraftForSource(source: CaptureSource): CaptureDraft | null {
  switch (source) {
    case 'receipt': {
      const items = [
        item('demo_sourdough', 'Olive sourdough', 'לחם מחמצת זיתים', 1, 18.5),
        item('demo_tomatoes', 'Vine tomatoes', 'עגבניות אשכול', 1.2, 15, 'kg'),
        item('demo_tahini', 'Whole sesame tahini', 'טחינה משומשום מלא', 1, 24.9),
        item('demo_fruit', 'Seasonal fruit', 'פירות עונתיים', 1, 25.5),
      ]
      return {
        source,
        merchantId: 'merchant_shuk',
        placeId: 'place_shuk_bograshov',
        timestamp: DEMO_TIMESTAMP,
        channel: 'physical',
        resolution: 'confirmed',
        paymentMode: 'card',
        category: 'groceries',
        originalAmount: Math.round(items.reduce((sum, entry) => sum + entry.lineTotal, 0) * 100) / 100,
        originalCurrency: 'ILS',
        items,
        provenance: 'synthetic-demo',
        productCandidateOnly: false,
        contextConfirmed: true,
      }
    }
    case 'product':
    case 'barcode':
      return {
        source,
        merchantId: null,
        placeId: null,
        timestamp: DEMO_TIMESTAMP,
        channel: 'physical',
        resolution: 'confirmed',
        paymentMode: 'card',
        category: 'groceries',
        originalAmount: null,
        originalCurrency: 'ILS',
        items: [item('demo_product_oats', 'Cinnamon oat bar', 'חטיף שיבולת שועל וקינמון', 1, 12.9)],
        provenance: 'synthetic-demo',
        productCandidateOnly: true,
        contextConfirmed: false,
      }
    case 'document': {
      const items = [
        item('demo_document_notebook', 'Recycled notebook', 'מחברת ממוחזרת', 1, 24),
        item('demo_document_pens', 'Ink pen set', 'ערכת עטי דיו', 1, 12),
      ]
      return {
        source,
        merchantId: 'merchant_serein',
        placeId: null,
        timestamp: '2026-08-28T09:20:00Z',
        channel: 'online',
        resolution: 'confirmed',
        paymentMode: 'card',
        category: 'retail',
        originalAmount: 36,
        originalCurrency: 'USD',
        items,
        provenance: 'synthetic-demo',
        productCandidateOnly: false,
        contextConfirmed: true,
      }
    }
    case 'pdf':
      return {
        source,
        merchantId: 'merchant_cloudfare',
        placeId: null,
        timestamp: '2026-08-27T12:15:00Z',
        channel: 'online',
        resolution: 'confirmed',
        paymentMode: 'card',
        category: 'travel',
        originalAmount: 75,
        originalCurrency: 'EUR',
        items: [item('demo_pdf_pass', 'Flexible rail pass', 'כרטיס רכבת גמיש', 1, 75)],
        provenance: 'synthetic-demo',
        productCandidateOnly: false,
        contextConfirmed: true,
      }
    case 'csv':
      return {
        source,
        merchantId: 'merchant_serein',
        placeId: null,
        timestamp: '2026-08-26T14:00:00Z',
        channel: 'online',
        resolution: 'confirmed',
        paymentMode: 'card',
        category: 'retail',
        originalAmount: 29,
        originalCurrency: 'USD',
        items: [item('demo_csv_pouch', 'Travel cable pouch', 'נרתיק כבלים לנסיעות', 1, 29)],
        provenance: 'synthetic-demo',
        productCandidateOnly: false,
        contextConfirmed: true,
        csvPreviewCount: 3,
      }
    case 'manual':
    case 'gmail':
    case 'failure':
      return null
  }
}

export interface ManualCaptureInput {
  merchantId: string
  placeId: string | null
  amount: string
  currency: CurrencyCode
  timestamp: string
  category: PurchaseCategory
  paymentMode: PaymentMode
  channel: 'physical' | 'online' | 'unknown'
}

export type ManualCaptureErrors = Partial<Record<keyof ManualCaptureInput, string>>

export function validateManualCapture(input: ManualCaptureInput, locale: LocaleCode): ManualCaptureErrors {
  const errors: ManualCaptureErrors = {}
  const amount = Number(input.amount)
  if (!input.merchantId) errors.merchantId = locale === 'he' ? 'יש לבחור בית עסק.' : 'Choose a merchant.'
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = locale === 'he' ? 'יש להזין סכום חיובי.' : 'Enter a positive amount.'
  }
  if (!input.timestamp) errors.timestamp = locale === 'he' ? 'יש לבחור תאריך ושעה.' : 'Choose a date and time.'
  if (input.channel === 'physical' && !input.placeId) {
    errors.placeId = locale === 'he' ? 'יש לבחור מקום פיזי או לסמן כלא פתור.' : 'Choose a physical place or mark it unresolved.'
  }
  return errors
}

export function manualDraft(input: ManualCaptureInput): CaptureDraft {
  const unresolved = input.channel === 'unknown'
  return {
    source: 'manual',
    merchantId: unresolved ? 'merchant_unresolved' : input.merchantId,
    placeId: input.channel === 'physical' ? input.placeId : null,
    timestamp: new Date(input.timestamp).toISOString(),
    channel: input.channel,
    resolution: unresolved ? 'unresolved' : 'confirmed',
    paymentMode: input.paymentMode,
    category: input.category,
    originalAmount: Number(input.amount),
    originalCurrency: input.currency,
    items: [],
    provenance: 'synthetic-demo',
    productCandidateOnly: false,
    contextConfirmed: true,
  }
}

export function canConfirmDraft(draft: CaptureDraft | null): boolean {
  if (!draft || draft.originalAmount === null || draft.originalAmount <= 0 || !draft.merchantId) return false
  if (draft.channel === 'physical' && !draft.placeId) return false
  if (draft.productCandidateOnly && !draft.contextConfirmed) return false
  return true
}

export function createSessionCaptureRecord(
  draft: CaptureDraft,
  sequence: number,
): SessionCaptureRecord {
  if (!canConfirmDraft(draft) || draft.originalAmount === null || !draft.merchantId) {
    throw new Error('Capture draft is not ready for confirmation')
  }
  const sourceToken = draft.source.replaceAll('-', '_')
  const suffix = String(sequence).padStart(2, '0')
  const purchaseId = `session_purchase_${sourceToken}_${suffix}`
  const evidenceId = `session_evidence_${sourceToken}_${suffix}`
  const purchase: GlobePurchase = {
    id: purchaseId,
    merchantId: draft.merchantId,
    timestamp: draft.timestamp,
    channel: draft.channel,
    resolution: draft.resolution,
    paymentMode: draft.paymentMode,
    placeId: draft.channel === 'physical' ? draft.placeId : null,
    category: draft.category,
    originalAmount: draft.originalAmount,
    originalCurrency: draft.originalCurrency,
    fx: syntheticFx(draft.originalCurrency, draft.timestamp),
    items: draft.items.map((entry, index) => ({
      ...entry,
      id: `${purchaseId}_item_${String(index + 1).padStart(2, '0')}`,
      label: { ...entry.label },
    })),
    evidenceIds: [evidenceId],
  }
  return {
    purchase,
    evidence: {
      id: evidenceId,
      purchaseId,
      kind: draft.source === 'manual'
        ? 'manual-entry'
        : draft.channel === 'online'
          ? 'email-receipt'
          : 'receipt',
      observedAt: draft.timestamp,
      label: {
        en: `Synthetic ${draft.source} demo`,
        he: `הדגמת ${draft.source} סינתטית`,
      },
      synthetic: true,
    },
    source: draft.source,
    synthetic: true,
  }
}

export function combineSessionPurchases(
  baseline: readonly GlobePurchase[],
  sessionRecords: readonly SessionCaptureRecord[],
): GlobePurchase[] {
  return [...baseline, ...sessionRecords.map((record) => record.purchase)]
}

export function receiptArithmetic(draft: CaptureDraft): {
  itemTotal: number
  purchaseTotal: number | null
  reconciles: boolean
} {
  const itemTotal = nestedItemTotal({ items: draft.items } as GlobePurchase)
  return {
    itemTotal,
    purchaseTotal: draft.originalAmount,
    reconciles: draft.originalAmount !== null && itemTotal === draft.originalAmount,
  }
}
