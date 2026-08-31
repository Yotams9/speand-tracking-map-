'use client'

import {
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import {
  globePlaces,
  localized,
  merchantForId,
  placeForId,
  type CurrencyCode,
  type LocaleCode,
  type PaymentMode,
  type PurchaseCategory,
} from '@/data/spendscape-globe'
import {
  canConfirmDraft,
  captureReducer,
  createSessionCaptureRecord,
  demoDraftForSource,
  initialCaptureState,
  manualDraft,
  receiptArithmetic,
  validateManualCapture,
  type CaptureDraft,
  type CaptureSource,
  type CaptureStep,
  type ManualCaptureInput,
  type SessionCaptureRecord,
} from './capture-domain'
import styles from './CaptureExperience.module.css'

interface CaptureExperienceProps {
  locale: LocaleCode
  step: CaptureStep
  reducedMotion: boolean
  sessionRecords: readonly SessionCaptureRecord[]
  onNavigate: (step: CaptureStep, mode?: 'push' | 'replace') => void
  onBack: () => void
  onClose: () => void
  onConfirm: (record: SessionCaptureRecord) => void
  onResetSession: () => void
  onViewPurchase: (purchaseId: string) => void
  onShowOnGlobe: (placeId: string) => void
}

const sourceOrder: CaptureSource[] = [
  'receipt', 'product', 'barcode', 'document', 'pdf', 'csv', 'manual', 'gmail', 'failure',
]

const sourceCopy = {
  en: {
    receipt: ['Receipt', 'Itemized physical demo'],
    product: ['Product', 'Recognition needs purchase context'],
    barcode: ['Barcode', 'Product candidate, not proof'],
    document: ['Document', 'Built-in digital receipt'],
    pdf: ['PDF demo', 'No real file is opened'],
    csv: ['CSV demo', 'Preview three synthetic rows'],
    manual: ['Manual / cash', 'Quick Add with minimal fields'],
    gmail: ['Gmail', 'Future connection — not connected'],
    failure: ['Read failure', 'Try the recovery story'],
  },
  he: {
    receipt: ['קבלה', 'הדגמה פיזית עם פריטים'],
    product: ['מוצר', 'זיהוי דורש הקשר רכישה'],
    barcode: ['ברקוד', 'מועמד למוצר, לא הוכחה'],
    document: ['מסמך', 'קבלה דיגיטלית מובנית'],
    pdf: ['הדגמת PDF', 'לא נפתח קובץ אמיתי'],
    csv: ['הדגמת CSV', 'תצוגה של שלוש שורות סינתטיות'],
    manual: ['ידני / מזומן', 'הוספה מהירה בשדות מינימליים'],
    gmail: ['Gmail', 'חיבור עתידי — לא מחובר'],
    failure: ['כשל קריאה', 'בדיקת תהליך ההתאוששות'],
  },
} as const

const copy = {
  en: {
    close: 'Close Capture', back: 'Back', eyebrow: 'Universal Capture · simulated',
    scannerTitle: 'Point at a receipt, product, barcode, or document',
    scannerBody: 'A camera-first concept using only built-in synthetic examples. No camera is accessed.',
    simulated: 'Demo scanner', scan: 'Scan demo receipt', other: 'Choose another source',
    sourceTitle: 'How would you like to add it?', sourceBody: 'Every option below is a working simulation or clearly marked future connection.',
    processing: 'Reading the synthetic example…', processingBody: 'Nothing is uploaded, retained, or sent to a provider.',
    review: 'We found this — does it look right?', reviewBody: 'Confirm the essentials. Advanced matching stays out of the way.',
    placeSuggestion: 'Suggested place', placeTruth: 'Suggested from simulated evidence. Location is never proof of purchase.',
    onlineTruth: 'Online purchase · no map pin will be created.',
    unresolvedTruth: 'No confirmed place · no map pin will be created.',
    nested: 'Receipt items', total: 'Total', original: 'Original amount', date: 'Date', payment: 'Payment',
    add: 'Add purchase', cancel: 'Cancel', editContext: 'Purchase context required',
    productTruth: 'A product or barcode identifies a candidate only. It is not proof of a purchase or merchant. Product photos are not retained.',
    selectPlace: 'Confirm merchant and place', amount: 'Amount', confirmContext: 'Use this purchase context',
    manualTitle: 'Quick Add', manualBody: 'Cash and manual purchases stay first-class, with no invented location.',
    merchant: 'Merchant', currency: 'Currency', category: 'Category', channel: 'Channel',
    physical: 'Physical place', online: 'Online', unknown: 'Unresolved place',
    card: 'Card', cash: 'Cash', manual: 'Manual', saveReview: 'Review purchase',
    gmailTitle: 'Automatic email receipts are planned',
    gmailBody: 'A later approved phase can add connection and consent. No email is accessed, no account is connected, and no permission is requested now.',
    understood: 'Back to sources', failureTitle: 'We could not read that demo',
    failureBody: 'The synthetic example was intentionally unclear. Try again or choose another method.',
    retry: 'Retry demo', successTitle: 'Purchase added for this session',
    successBody: 'The canonical fixtures stayed unchanged. Reloading resets demo additions.',
    viewPurchase: 'View purchase', showGlobe: 'Show on globe', done: 'Done',
    reset: 'Reset demo additions', sessionCount: 'session additions',
    provenance: 'Built-in synthetic demo · fixed illustrative FX',
    csvPreview: '3 synthetic rows previewed · only this row is added after confirmation.',
    statusProcessing: 'Simulated scan in progress', statusReady: 'Synthetic purchase ready to review',
    statusSuccess: 'Synthetic purchase added', required: 'Required', noPhoto: 'No image or photo value is retained.',
  },
  he: {
    close: 'סגירת Capture', back: 'חזרה', eyebrow: 'קליטה אוניברסלית · הדמיה',
    scannerTitle: 'כוונו אל קבלה, מוצר, ברקוד או מסמך',
    scannerBody: 'קונספט ממוקד־מצלמה המשתמש רק בדוגמאות סינתטיות מובנות. אין גישה למצלמה.',
    simulated: 'סורק הדגמה', scan: 'סריקת קבלת הדגמה', other: 'בחירת מקור אחר',
    sourceTitle: 'איך תרצו להוסיף את הרכישה?', sourceBody: 'כל אפשרות היא הדמיה פעילה או חיבור עתידי המסומן בבירור.',
    processing: 'קוראים את הדוגמה הסינתטית…', processingBody: 'דבר לא עולה, נשמר או נשלח לספק.',
    review: 'זה מה שמצאנו — הכול נראה נכון?', reviewBody: 'מאשרים רק את הפרטים החשובים. התאמות מתקדמות נשארות ברקע.',
    placeSuggestion: 'מקום מוצע', placeTruth: 'הצעה המבוססת על ראיות מדומות. מיקום לעולם אינו הוכחת רכישה.',
    onlineTruth: 'רכישה מקוונת · לא תיווצר סיכה במפה.',
    unresolvedTruth: 'אין מקום מאומת · לא תיווצר סיכה במפה.',
    nested: 'פריטי קבלה', total: 'סך הכול', original: 'סכום מקורי', date: 'תאריך', payment: 'תשלום',
    add: 'הוספת רכישה', cancel: 'ביטול', editContext: 'נדרש הקשר רכישה',
    productTruth: 'מוצר או ברקוד מזהים רק מועמד. הם אינם הוכחה לרכישה או לבית עסק. תמונות מוצר אינן נשמרות.',
    selectPlace: 'אישור בית עסק ומקום', amount: 'סכום', confirmContext: 'שימוש בהקשר הרכישה הזה',
    manualTitle: 'הוספה מהירה', manualBody: 'רכישות במזומן וידניות נשארות מלאות, בלי להמציא מיקום.',
    merchant: 'בית עסק', currency: 'מטבע', category: 'קטגוריה', channel: 'ערוץ',
    physical: 'מקום פיזי', online: 'אונליין', unknown: 'מקום לא פתור',
    card: 'כרטיס', cash: 'מזומן', manual: 'ידני', saveReview: 'בדיקת הרכישה',
    gmailTitle: 'ייבוא אוטומטי של קבלות מהדוא״ל מתוכנן',
    gmailBody: 'בשלב עתידי ומאושר ניתן יהיה להוסיף חיבור והסכמה. כעת אין גישה לדוא״ל, אין חשבון מחובר ולא מתבקשת הרשאה.',
    understood: 'חזרה למקורות', failureTitle: 'לא הצלחנו לקרוא את ההדגמה',
    failureBody: 'הדוגמה הסינתטית הוגדרה בכוונה כלא ברורה. אפשר לנסות שוב או לבחור שיטה אחרת.',
    retry: 'ניסיון הדגמה נוסף', successTitle: 'הרכישה נוספה להפעלה הזו',
    successBody: 'נתוני הבסיס הקנוניים לא השתנו. טעינה מחדש מאפסת את תוספות ההדגמה.',
    viewPurchase: 'הצגת הרכישה', showGlobe: 'הצגה בגלובוס', done: 'סיום',
    reset: 'איפוס תוספות הדגמה', sessionCount: 'תוספות להפעלה',
    provenance: 'הדגמה סינתטית מובנית · שער המחשה קבוע',
    csvPreview: '3 שורות סינתטיות הוצגו · רק שורה זו תתווסף לאחר אישור.',
    statusProcessing: 'סריקת ההדגמה מתבצעת', statusReady: 'הרכישה הסינתטית מוכנה לבדיקה',
    statusSuccess: 'הרכישה הסינתטית נוספה', required: 'שדה חובה', noPhoto: 'לא נשמר ערך של תמונה או צילום.',
  },
} as const

const currencyOptions: CurrencyCode[] = ['ILS', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'MXN', 'ZAR']
const categoryOptions: PurchaseCategory[] = ['groceries', 'food', 'retail', 'travel']
const categoryNames = {
  en: { groceries: 'Groceries', food: 'Food', retail: 'Retail', travel: 'Travel' },
  he: { groceries: 'מכולת', food: 'אוכל', retail: 'קמעונאות', travel: 'נסיעות' },
} as const

function formatAmount(value: number, currency: CurrencyCode, locale: LocaleCode): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value)
}

function formatDate(value: string, locale: LocaleCode): string {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value))
}

export function CaptureExperience({
  locale,
  step,
  reducedMotion,
  sessionRecords,
  onNavigate,
  onBack,
  onClose,
  onConfirm,
  onResetSession,
  onViewPurchase,
  onShowOnGlobe,
}: CaptureExperienceProps) {
  const [state, dispatch] = useReducer(captureReducer, initialCaptureState)
  const [manualInput, setManualInput] = useState<ManualCaptureInput>({
    merchantId: 'merchant_shuk',
    placeId: 'place_shuk_bograshov',
    amount: '',
    currency: 'ILS',
    timestamp: '2026-08-29T17:45',
    category: 'groceries',
    paymentMode: 'cash',
    channel: 'physical',
  })
  const [manualErrors, setManualErrors] = useState<ReturnType<typeof validateManualCapture>>({})
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const t = copy[locale]

  useEffect(() => {
    dispatch({ type: 'navigate', step })
  }, [step])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus({ preventScroll: true })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.offsetParent !== null)
      if (controls.length === 0) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus({ preventScroll: true })
    }
  }, [onClose])

  useEffect(() => {
    if (step !== 'processing' || !state.source) return
    const timer = window.setTimeout(() => {
      const draft = demoDraftForSource(state.source!)
      if (!draft) return
      dispatch({ type: 'draft-ready', draft })
      onNavigate('review', 'replace')
    }, reducedMotion ? 90 : 720)
    return () => window.clearTimeout(timer)
  }, [onNavigate, reducedMotion, state.source, step])

  const announce = step === 'processing'
    ? t.statusProcessing
    : step === 'review'
      ? t.statusReady
      : step === 'success'
        ? t.statusSuccess
        : ''

  const chooseSource = (source: CaptureSource) => {
    dispatch({ type: 'choose-source', source })
    const nextStep: CaptureStep = source === 'manual'
      ? 'manual'
      : source === 'gmail'
        ? 'gmail'
        : source === 'failure'
          ? 'failure'
          : 'processing'
    onNavigate(nextStep, 'push')
  }

  const updateDraft = (patch: Partial<CaptureDraft>) => {
    if (!state.draft) return
    const merged = { ...state.draft, ...patch }
    if (merged.productCandidateOnly) {
      merged.contextConfirmed = Boolean(
        merged.placeId && merged.merchantId && merged.originalAmount && merged.originalAmount > 0,
      )
    }
    dispatch({ type: 'update-draft', patch: merged })
  }

  const confirmDraft = (draft: CaptureDraft) => {
    if (!canConfirmDraft(draft)) return
    const record = createSessionCaptureRecord(draft, sessionRecords.length + 1)
    onConfirm(record)
    dispatch({ type: 'confirm', purchaseId: record.purchase.id })
    onNavigate('success', 'push')
  }

  const submitManual = () => {
    const errors = validateManualCapture(manualInput, locale)
    setManualErrors(errors)
    if (Object.keys(errors).length > 0) return
    const draft = manualDraft(manualInput)
    dispatch({ type: 'draft-ready', draft })
    onNavigate('review', 'push')
  }

  const updateManual = <Key extends keyof ManualCaptureInput>(key: Key, value: ManualCaptureInput[Key]) => {
    setManualInput((current) => ({ ...current, [key]: value }))
    setManualErrors((current) => ({ ...current, [key]: undefined }))
  }

  const lastRecord = state.lastPurchaseId
    ? sessionRecords.find((record) => record.purchase.id === state.lastPurchaseId)
    : undefined
  const arithmetic = state.draft ? receiptArithmetic(state.draft) : null
  const reviewPlace = state.draft?.placeId ? placeForId(state.draft.placeId) : undefined
  const reviewMerchant = state.draft?.merchantId ? merchantForId(state.draft.merchantId) : undefined
  const showBack = step !== 'scanner' && step !== 'success'

  const dialogTitle = step === 'scanner'
    ? t.scannerTitle
    : step === 'sources'
      ? t.sourceTitle
      : step === 'processing'
        ? t.processing
        : step === 'review'
          ? t.review
          : step === 'manual'
            ? t.manualTitle
            : step === 'gmail'
              ? t.gmailTitle
              : step === 'failure'
                ? t.failureTitle
                : t.successTitle

  return (
    <div className={styles.layer} data-testid="capture-layer" data-step={step} data-reduced-motion={reducedMotion}>
      <button type="button" className={styles.scrim} onClick={onClose} aria-label={t.close} />
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-title"
        aria-describedby="capture-description"
        data-testid="capture-dialog"
      >
        <header className={styles.header}>
          <div className={styles.headerLead}>
            {showBack && <button type="button" className={styles.back} onClick={onBack} aria-label={t.back}>←</button>}
            <div><p>{t.eyebrow}</p><strong>Spendscape</strong></div>
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label={t.close}>×</button>
        </header>

        <div className={styles.live} role="status" aria-live="polite">{announce}</div>

        {step === 'scanner' && (
          <div className={styles.scannerStage} data-testid="capture-scanner">
            <div className={styles.viewfinder} aria-hidden="true">
              <span className={styles.scanLine} />
              <span className={styles.focusMark} data-corner="one" />
              <span className={styles.focusMark} data-corner="two" />
              <span className={styles.focusMark} data-corner="three" />
              <span className={styles.focusMark} data-corner="four" />
              <div className={styles.receiptGlyph}><i /><i /><i /><i /></div>
              <small>{t.simulated}</small>
            </div>
            <div className={styles.stageCopy}>
              <p className={styles.kicker}>{t.simulated}</p>
              <h2 id="capture-title">{dialogTitle}</h2>
              <p id="capture-description">{t.scannerBody}</p>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => chooseSource('receipt')} data-testid="capture-scan">{t.scan}</button>
              <button type="button" className={styles.secondary} onClick={() => onNavigate('sources', 'push')} data-testid="capture-sources-open">{t.other}</button>
            </div>
          </div>
        )}

        {step === 'sources' && (
          <div className={styles.scrollBody} data-testid="capture-sources">
            <div className={styles.stageCopy}>
              <p className={styles.kicker}>{t.simulated}</p>
              <h2 id="capture-title">{dialogTitle}</h2>
              <p id="capture-description">{t.sourceBody}</p>
            </div>
            <div className={styles.sourceGrid}>
              {sourceOrder.map((source, index) => (
                <button
                  type="button"
                  key={source}
                  className={styles.sourceCard}
                  onClick={() => chooseSource(source)}
                  data-testid={`capture-source-${source}`}
                >
                  <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <strong>{sourceCopy[locale][source][0]}</strong>
                  <small>{sourceCopy[locale][source][1]}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className={styles.processing} data-testid="capture-processing">
            <div className={styles.processingOrb} aria-hidden="true"><span /><span /><span /></div>
            <p className={styles.kicker}>{t.simulated}</p>
            <h2 id="capture-title">{dialogTitle}</h2>
            <p id="capture-description">{t.processingBody}</p>
            <div className={styles.skeleton} aria-hidden="true"><i /><i /><i /><i /></div>
          </div>
        )}

        {step === 'review' && state.draft && (
          <div className={styles.review} data-testid="capture-review">
            <div className={styles.stageCopy}>
              <p className={styles.kicker}>{t.simulated}</p>
              <h2 id="capture-title">{dialogTitle}</h2>
              <p id="capture-description">{t.reviewBody}</p>
            </div>

            {state.draft.productCandidateOnly && (
              <div className={styles.truthCallout} data-testid="product-proof-boundary">
                <strong>{t.editContext}</strong><p>{t.productTruth}</p><small>{t.noPhoto}</small>
              </div>
            )}

            <div className={styles.reviewCard}>
              <div className={styles.merchantLine}>
                <span className={styles.merchantMark} data-category={state.draft.category} aria-hidden="true" />
                <span>
                  <small>{reviewPlace ? t.placeSuggestion : state.draft.channel === 'online' ? t.online : t.merchant}</small>
                  <strong>{reviewPlace ? localized(reviewPlace.name, locale) : reviewMerchant ? localized(reviewMerchant.name, locale) : sourceCopy[locale][state.draft.source][0]}</strong>
                  {reviewPlace && <em>{localized(reviewPlace.branch, locale)} · {localized(reviewPlace.city, locale)}</em>}
                </span>
                {state.draft.originalAmount !== null && <b>{formatAmount(state.draft.originalAmount, state.draft.originalCurrency, locale)}</b>}
              </div>

              {state.draft.productCandidateOnly && (
                <div className={styles.contextFields}>
                  <label>{t.selectPlace}
                    <select
                      value={state.draft.placeId ?? ''}
                      onChange={(event) => {
                        const place = placeForId(event.target.value)
                        updateDraft({ placeId: place?.id ?? null, merchantId: place?.merchantId ?? null })
                      }}
                      data-testid="product-place"
                    >
                      <option value="">{t.required}</option>
                      {globePlaces.slice(0, 3).map((place) => <option key={place.id} value={place.id}>{localized(place.name, locale)} · {localized(place.city, locale)}</option>)}
                    </select>
                  </label>
                  <label>{t.amount}
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={state.draft.originalAmount ?? ''}
                      onChange={(event) => updateDraft({ originalAmount: event.target.value ? Number(event.target.value) : null })}
                      data-testid="product-amount"
                    />
                  </label>
                </div>
              )}

              <dl className={styles.essentials}>
                <div><dt>{t.date}</dt><dd>{formatDate(state.draft.timestamp, locale)}</dd></div>
                <div><dt>{t.payment}</dt><dd>{t[state.draft.paymentMode]}</dd></div>
                <div><dt>{t.channel}</dt><dd>{state.draft.channel === 'physical' ? t.physical : state.draft.channel === 'online' ? t.online : t.unknown}</dd></div>
              </dl>

              {state.draft.items.length > 0 && (
                <details className={styles.items} open={!state.draft.productCandidateOnly}>
                  <summary>{t.nested}<span>{state.draft.items.length}</span></summary>
                  <ul>
                    {state.draft.items.map((entry) => (
                      <li key={entry.id}>
                        <span>{localized(entry.label, locale)}<small>{entry.quantity} × {formatAmount(entry.unitPrice, state.draft!.originalCurrency, locale)}</small></span>
                        <strong>{formatAmount(entry.lineTotal, state.draft!.originalCurrency, locale)}</strong>
                      </li>
                    ))}
                  </ul>
                  {arithmetic && arithmetic.itemTotal > 0 && (
                    <p className={styles.reconciled} data-reconciles={arithmetic.reconciles}>
                      <span>{t.total}</span><strong>{formatAmount(arithmetic.itemTotal, state.draft.originalCurrency, locale)}</strong>
                    </p>
                  )}
                </details>
              )}

              <div className={styles.provenance}>
                <span>{t.provenance}</span>
                <p>{reviewPlace ? t.placeTruth : state.draft.channel === 'online' ? t.onlineTruth : t.unresolvedTruth}</p>
                {state.draft.csvPreviewCount && <p>{t.csvPreview}</p>}
              </div>
            </div>

            <div className={`${styles.actions} ${styles.stickyActions}`}>
              <button type="button" className={styles.primary} disabled={!canConfirmDraft(state.draft)} onClick={() => confirmDraft(state.draft!)} data-testid="capture-confirm">{t.add}</button>
              <button type="button" className={styles.secondary} onClick={() => onNavigate('sources', 'push')}>{t.other}</button>
            </div>
          </div>
        )}

        {step === 'manual' && (
          <div className={styles.manualFlow} data-testid="capture-manual">
            <div className={styles.stageCopy}>
              <p className={styles.kicker}>{t.simulated}</p>
              <h2 id="capture-title">{dialogTitle}</h2>
              <p id="capture-description">{t.manualBody}</p>
            </div>
            <div className={styles.formGrid}>
              <label>{t.channel}
                <select
                  value={manualInput.channel}
                  onChange={(event) => {
                    const channel = event.target.value as ManualCaptureInput['channel']
                    setManualInput((current) => ({
                      ...current,
                      channel,
                      placeId: channel === 'physical' ? current.placeId ?? 'place_shuk_bograshov' : null,
                      merchantId: channel === 'online' ? 'merchant_serein' : channel === 'unknown' ? 'merchant_unresolved' : 'merchant_shuk',
                    }))
                  }}
                  data-testid="manual-channel"
                >
                  <option value="physical">{t.physical}</option><option value="online">{t.online}</option><option value="unknown">{t.unknown}</option>
                </select>
              </label>
              {manualInput.channel === 'physical' && (
                <label className={styles.fullField}>{t.selectPlace}
                  <select
                    value={manualInput.placeId ?? ''}
                    onChange={(event) => {
                      const place = placeForId(event.target.value)
                      updateManual('placeId', place?.id ?? null)
                      if (place) updateManual('merchantId', place.merchantId)
                    }}
                    aria-invalid={Boolean(manualErrors.placeId)}
                    aria-describedby={manualErrors.placeId ? 'manual-place-error' : undefined}
                    data-testid="manual-place"
                  >
                    {globePlaces.map((place) => <option key={place.id} value={place.id}>{localized(place.name, locale)} · {localized(place.city, locale)}</option>)}
                  </select>
                  {manualErrors.placeId && <small id="manual-place-error" className={styles.fieldError}>{manualErrors.placeId}</small>}
                </label>
              )}
              <label>{t.amount}
                <input
                  type="number" inputMode="decimal" min="0.01" step="0.01"
                  value={manualInput.amount}
                  onChange={(event) => updateManual('amount', event.target.value)}
                  aria-invalid={Boolean(manualErrors.amount)}
                  aria-describedby={manualErrors.amount ? 'manual-amount-error' : undefined}
                  data-testid="manual-amount"
                />
                {manualErrors.amount && <small id="manual-amount-error" className={styles.fieldError}>{manualErrors.amount}</small>}
              </label>
              <label>{t.currency}
                <select value={manualInput.currency} onChange={(event) => updateManual('currency', event.target.value as CurrencyCode)}>
                  {currencyOptions.map((currency) => <option key={currency}>{currency}</option>)}
                </select>
              </label>
              <label>{t.date}
                <input type="datetime-local" value={manualInput.timestamp} onChange={(event) => updateManual('timestamp', event.target.value)} aria-invalid={Boolean(manualErrors.timestamp)} />
              </label>
              <label>{t.category}
                <select value={manualInput.category} onChange={(event) => updateManual('category', event.target.value as PurchaseCategory)}>
                  {categoryOptions.map((category) => <option key={category} value={category}>{categoryNames[locale][category]}</option>)}
                </select>
              </label>
              <label>{t.payment}
                <select value={manualInput.paymentMode} onChange={(event) => updateManual('paymentMode', event.target.value as PaymentMode)}>
                  <option value="cash">{t.cash}</option><option value="card">{t.card}</option><option value="manual">{t.manual}</option>
                </select>
              </label>
            </div>
            <div className={`${styles.actions} ${styles.stickyActions}`}>
              <button type="button" className={styles.primary} onClick={submitManual} data-testid="manual-review">{t.saveReview}</button>
              <button type="button" className={styles.secondary} onClick={onBack}>{t.cancel}</button>
            </div>
          </div>
        )}

        {step === 'gmail' && (
          <div className={styles.messageState} data-testid="capture-gmail">
            <span className={styles.messageIcon} aria-hidden="true">@</span>
            <p className={styles.kicker}>{sourceCopy[locale].gmail[1]}</p>
            <h2 id="capture-title">{dialogTitle}</h2>
            <p id="capture-description">{t.gmailBody}</p>
            <button type="button" className={styles.primary} onClick={onBack}>{t.understood}</button>
          </div>
        )}

        {step === 'failure' && (
          <div className={styles.messageState} role="alert" data-testid="capture-failure">
            <span className={`${styles.messageIcon} ${styles.errorIcon}`} aria-hidden="true">!</span>
            <p className={styles.kicker}>{t.simulated}</p>
            <h2 id="capture-title">{dialogTitle}</h2>
            <p id="capture-description">{t.failureBody}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => {
                dispatch({ type: 'retry' })
                onNavigate('processing', 'replace')
              }} data-testid="capture-retry">{t.retry}</button>
              <button type="button" className={styles.secondary} onClick={() => onNavigate('sources', 'replace')}>{t.other}</button>
            </div>
          </div>
        )}

        {step === 'success' && lastRecord && (
          <div className={styles.messageState} data-testid="capture-success">
            <span className={`${styles.messageIcon} ${styles.successIcon}`} aria-hidden="true">✓</span>
            <p className={styles.kicker}>{t.simulated}</p>
            <h2 id="capture-title">{dialogTitle}</h2>
            <p id="capture-description">{t.successBody}</p>
            <div className={styles.successSummary}>
              <strong>{formatAmount(lastRecord.purchase.originalAmount, lastRecord.purchase.originalCurrency, locale)}</strong>
              <span>{lastRecord.purchase.placeId ? t.physical : lastRecord.purchase.channel === 'online' ? t.onlineTruth : t.unresolvedTruth}</span>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => onViewPurchase(lastRecord.purchase.id)} data-testid="capture-view-purchase">{t.viewPurchase}</button>
              {lastRecord.purchase.placeId && <button type="button" className={styles.secondary} onClick={() => onShowOnGlobe(lastRecord.purchase.placeId!)}>{t.showGlobe}</button>}
              <button type="button" className={styles.secondary} onClick={onClose}>{t.done}</button>
            </div>
          </div>
        )}

        {sessionRecords.length > 0 && step !== 'success' && (
          <footer className={styles.sessionFooter}>
            <span>{sessionRecords.length} {t.sessionCount}</span>
            <button type="button" onClick={onResetSession}>{t.reset}</button>
          </footer>
        )}
      </section>
    </div>
  )
}
