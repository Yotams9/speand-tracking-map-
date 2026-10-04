'use client'

import {
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import { type LocaleCode, type Merchant, type Place } from '@/data/spendscape-globe'
import { captureReducer, demoDraftForSource, initialCaptureState, type CaptureSource, type CaptureStep, type SessionCaptureRecord } from './capture-domain'
import { allocateReviewOperationId, blankReview, reviewFromDemo, type PurchaseReviewInput, type SaveReviewResult } from './session-purchase-domain'
import { PurchaseReview } from './PurchaseReview'
import { CaptureCamera } from './CaptureCamera'
import styles from './CaptureExperience.module.css'

interface CaptureExperienceProps {
  locale: LocaleCode
  places: readonly Place[]
  merchants: readonly Merchant[]
  step: CaptureStep
  reducedMotion: boolean
  sessionRecords: readonly SessionCaptureRecord[]
  onNavigate: (step: CaptureStep, mode?: 'push' | 'replace') => void
  onBack: () => void
  onClose: () => void
  onConfirm: (operationId: string, input: PurchaseReviewInput, allowDuplicate: boolean) => SaveReviewResult
  onUndo: () => void
  canUndo: boolean
  undoSeconds: number
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
    simulated: 'Demo scanner', other: 'Choose another source',
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
    successBody: 'Stored only in this tab. Reloading removes session additions.',
    viewPurchase: 'View purchase', showGlobe: 'Show on globe', done: 'Done',
    reset: 'Reset demo additions', sessionCount: 'session additions',
    provenance: 'Built-in synthetic demo · fixed illustrative FX',
    csvPreview: '3 synthetic rows previewed · only this row is added after confirmation.',
    statusProcessing: 'Simulated scan in progress', statusReady: 'Purchase ready to review',
    statusSuccess: 'Purchase added for this session', required: 'Required', noPhoto: 'No image or photo value is retained.',
  },
  he: {
    close: 'סגירת Capture', back: 'חזרה', eyebrow: 'קליטה אוניברסלית · הדמיה',
    simulated: 'סורק הדגמה', other: 'בחירת מקור אחר',
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
    successBody: 'נשמר בלשונית הזו בלבד. טעינה מחדש מסירה את התוספות להפעלה.',
    viewPurchase: 'הצגת הרכישה', showGlobe: 'הצגה בגלובוס', done: 'סיום',
    reset: 'איפוס תוספות הדגמה', sessionCount: 'תוספות להפעלה',
    provenance: 'הדגמה סינתטית מובנית · שער המחשה קבוע',
    csvPreview: '3 שורות סינתטיות הוצגו · רק שורה זו תתווסף לאחר אישור.',
    statusProcessing: 'סריקת ההדגמה מתבצעת', statusReady: 'הרכישה מוכנה לבדיקה',
    statusSuccess: 'הרכישה נוספה להפעלה', required: 'שדה חובה', noPhoto: 'לא נשמר ערך של תמונה או צילום.',
  },
} as const

function formatAmount(value: number, currency: string, locale: LocaleCode): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value)
}

export function CaptureExperience({
  locale,
  places,
  merchants,
  step,
  reducedMotion,
  sessionRecords,
  onNavigate,
  onBack,
  onClose,
  onConfirm,
  onUndo,
  canUndo,
  undoSeconds,
  onResetSession,
  onViewPurchase,
  onShowOnGlobe,
}: CaptureExperienceProps) {
  const [state, dispatch] = useReducer(captureReducer, initialCaptureState)
  const [scannerGeneration, setScannerGeneration] = useState(0)
  const [reviewInput, setReviewInput] = useState<PurchaseReviewInput | null>(null)
  const [operationId, setOperationId] = useState('')
  const prepareReview = (input: PurchaseReviewInput) => { setOperationId(allocateReviewOperationId()); setReviewInput(input) }
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
      prepareReview(reviewFromDemo(draft, locale))
      dispatch({ type: 'draft-ready', draft })
      onNavigate('review', 'replace')
    }, reducedMotion ? 90 : 720)
    return () => window.clearTimeout(timer)
  }, [onNavigate, reducedMotion, state.source, step, locale])

  const announce = step === 'processing'
    ? t.statusProcessing
    : step === 'review'
      ? t.statusReady
      : step === 'success'
        ? t.statusSuccess
        : ''

  const chooseSource = (source: CaptureSource) => {
    if (source === 'manual') prepareReview(blankReview())
    else setReviewInput(null)
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

  const saveReview = (input: PurchaseReviewInput, allowDuplicate: boolean): SaveReviewResult => {
    const result = onConfirm(operationId, input, allowDuplicate)
    if (result.code === 'saved') {
      dispatch({ type: 'confirm', purchaseId: result.purchaseId })
      onNavigate('success', 'replace')
    }
    return result
  }

  const lastRecord = state.lastPurchaseId
    ? sessionRecords.find((record) => record.purchase.id === state.lastPurchaseId)
    : undefined
  const showBack = step !== 'scanner' && step !== 'success'

  const dialogTitle = step === 'sources'
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
            <div><p>{step === 'scanner' ? (locale === 'he' ? 'Capture · מצלמה והדגמות' : 'Capture · camera & demos') : reviewInput?.provenance === 'user-reviewed' ? (locale === 'he' ? 'Capture · להפעלה בלבד' : 'Capture · session only') : t.eyebrow}</p><strong>Spendscape</strong></div>
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label={t.close}>×</button>
        </header>

        <div className={styles.live} role="status" aria-live="polite">{announce}</div>

        {step === 'scanner' && (
          <CaptureCamera
            key={scannerGeneration}
            locale={locale}
            onDemo={() => chooseSource('receipt')}
            onSources={() => onNavigate('sources', 'push')}
            onManual={() => chooseSource('manual')}
            onCandidate={(candidate) => {
              prepareReview({ ...blankReview(), source: 'barcode', identification: candidate.identification,
                provenance: 'user-reviewed',
                lines: [{ name: candidate.name, quantity: '', price: '', unit: 'item' }] })
              onNavigate('review', 'push')
            }}
          />
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

        {(step === 'review' || step === 'manual') && reviewInput && (
          <PurchaseReview key={operationId} initial={reviewInput} locale={locale} context={{ places, merchants }}
            manualStep={step === 'manual'} onReviewed={() => onNavigate('review', 'push')}
            onSave={saveReview} onOther={() => { setReviewInput(null); onNavigate('sources', 'push') }} />
        )}
        {(step === 'review' || step === 'manual' || step === 'success') && !reviewInput && !lastRecord && (
          <div className={styles.messageState}><h2 id="capture-title">{t.sourceTitle}</h2><p id="capture-description">{locale === 'he' ? 'הטיוטה אינה זמינה. התחילו רכישה חדשה.' : 'This draft is no longer available. Start a new purchase.'}</p><button type="button" className={styles.primary} onClick={() => onNavigate('sources', 'replace')}>{t.other}</button></div>
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
          <div className={`${styles.messageState} ${styles.successState}`} data-testid="capture-success">
            <span className={`${styles.messageIcon} ${styles.successIcon}`} aria-hidden="true">✓</span>
            <p className={styles.kicker}>{lastRecord.synthetic ? t.simulated : (locale === 'he' ? 'פרטים שנבדקו על ידך' : 'Details reviewed by you')}</p>
            <h2 id="capture-title">{dialogTitle}</h2>
            <p id="capture-description">{t.successBody}</p>
            <p>{locale === 'he' ? 'מסננים קיימים עשויים להסתיר את הרכישה. אפשר לפתוח אותה במפורש.' : 'Existing filters may hide this purchase. You can open it explicitly.'}</p>
            <div className={styles.successSummary}>
              <strong>{formatAmount(lastRecord.purchase.originalAmount, lastRecord.purchase.originalCurrency, locale)}</strong>
              <span>{lastRecord.purchase.placeId ? t.physical : lastRecord.purchase.channel === 'online' ? t.onlineTruth : t.unresolvedTruth}</span>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => onViewPurchase(lastRecord.purchase.id)} data-testid="capture-view-purchase">{t.viewPurchase}</button>
              {lastRecord.purchase.placeId && <button type="button" className={styles.secondary} onClick={() => onShowOnGlobe(lastRecord.purchase.placeId!)}>{t.showGlobe}</button>}
              <button type="button" className={styles.secondary} data-testid="capture-done" onClick={onClose}>{t.done}</button>
            </div>
          </div>
        )}

        {sessionRecords.length > 0 && (
          <footer className={styles.sessionFooter}>
            <span>{sessionRecords.length} {t.sessionCount}</span>
            {canUndo && <button type="button" data-testid="capture-undo" aria-label={locale === 'he' ? `ביטול ההוספה האחרונה, נותרו ${undoSeconds} שניות` : `Undo last addition, ${undoSeconds} seconds remaining`} onClick={() => { onUndo(); setReviewInput(null); onNavigate('sources', 'replace') }}>{locale === 'he' ? 'ביטול ההוספה האחרונה' : 'Undo last addition'} <span aria-hidden="true">{undoSeconds}{locale === 'he' ? ' שנ׳' : 's'}</span></button>}
            <button type="button" onClick={() => { setScannerGeneration((n) => n + 1); setReviewInput(null); onResetSession(); onNavigate('scanner', 'replace'); closeRef.current?.focus() }}>{t.reset}</button>
          </footer>
        )}
      </section>
    </div>
  )
}
