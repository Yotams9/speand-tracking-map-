'use client'
import { useEffect, useRef, useState } from 'react'
import type { ReceiptObservation, ReceiptReviewDraft } from './receipt-review-adapter'
import { receiptTimeCandidates } from './receipt-review-time'
import styles from './CaptureExperience.module.css'

export const receiptCopy = {
  en: { observed: 'Original receipt observations', merchant: 'Observed merchant', address: 'Observed address', date: 'Printed date', time: 'Printed time', missing: 'Unresolved', original: 'Original observations remain separate from your corrections. Address, tax, barcodes and timezone are kept only in this draft; they are not saved.', local: 'Receipt date and time', zone: 'Receipt timezone · choose explicitly', confirm: 'Confirm receipt date and time', confirmed: 'Date and time confirmed', confirmationRequired: 'Confirm the receipt date, time and selected timezone above.', choose: 'Choose…', invalid: 'Complete a valid date, time and timezone. This local time may not exist during a clock change.', overlap: 'This time occurs twice during a clock change. Choose the intended occurrence.', earlier: 'Earlier occurrence', later: 'Later occurrence', occurrence: 'Clock-change occurrence', amount: 'Printed line amount', mismatch: 'Printed amount must match quantity × gross unit price minus the whole-line discount. Correct the facts; no amount is repaired automatically.', optional: 'VAT and barcodes are optional. Confirm the required facts and purchase context before saving.' },
  he: { observed: 'התצפיות המקוריות מהקבלה', merchant: 'בית עסק שנצפה', address: 'כתובת שנצפתה', date: 'תאריך מודפס', time: 'שעה מודפסת', missing: 'לא פתור', original: 'התצפיות המקוריות נפרדות מהתיקונים שלך. כתובת, מסים, ברקודים ואזור זמן נשארים בטיוטה בלבד ואינם נשמרים.', local: 'תאריך ושעת הקבלה', zone: 'אזור זמן הקבלה · בחירה מפורשת', confirm: 'אישור תאריך ושעת הקבלה', confirmed: 'התאריך והשעה אושרו', confirmationRequired: 'יש לאשר את תאריך ושעת הקבלה ואת אזור הזמן שנבחר למעלה.', choose: 'בחירה…', invalid: 'יש להשלים תאריך, שעה ואזור זמן תקינים. שעה זו עשויה לא להתקיים במעבר שעון.', overlap: 'שעה זו מופיעה פעמיים במעבר שעון. יש לבחור את המופע המתאים.', earlier: 'המופע המוקדם', later: 'המופע המאוחר', occurrence: 'מופע במעבר שעון', amount: 'סכום שורה מודפס', mismatch: 'הסכום המודפס חייב להתאים לכמות × מחיר יחידה לפני הנחה פחות הנחת השורה. יש לתקן את הפרטים; אין תיקון סכום אוטומטי.', optional: 'מע״מ וברקודים הם רשות. יש לאשר את פרטי החובה והקשר הרכישה לפני שמירה.' },
} as const
export function ReceiptReviewDetails({ draft, locale, confirmed, onDate, dateError }: {
  draft: ReceiptReviewDraft; locale: 'en' | 'he'; confirmed: boolean; onDate: (utc: string) => void; dateError: boolean
}) {
  const t = receiptCopy[locale], o = draft.observations
  const value = (v: ReceiptObservation | undefined) => typeof v === 'string' ? v : v && typeof v === 'object' ? v.candidates.join(' / ') : t.missing
  const [wall, setWall] = useState(`${typeof o.date === 'string' ? o.date : ''}T${typeof o.time === 'string' ? o.time : ''}`)
  const [zone, setZone] = useState(''), [occurrence, setOccurrence] = useState(''), [attempted, setAttempted] = useState(false)
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const zones = [...new Set(['Asia/Jerusalem', 'UTC', deviceZone, ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [])])]
  const candidates = receiptTimeCandidates(wall, zone)
  const change = () => { onDate(''); setOccurrence(''); setAttempted(false) }
  const section = useRef<HTMLElement>(null), revealFrame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(revealFrame.current), [])
  // UTC is used only to validate the wall-clock calendar here, never as an
  // inferred receipt timezone or a saved instant.
  const feedbackField = !receiptTimeCandidates(wall, 'UTC').length ? 'date'
    : !zone ? 'zone' : !candidates.length ? 'date'
      : candidates.length > 1 && occurrence === '' ? 'occurrence' : 'confirm'
  const showError = dateError || (attempted && !confirmed)
  const feedback = (field: typeof feedbackField) => showError && field === feedbackField &&
    <span className={styles.fieldError} id="receipt-time-error">{field === 'occurrence' ? t.overlap : field === 'confirm' ? t.confirmationRequired : t.invalid}</span>
  const target = (field: typeof feedbackField) => showError && field === feedbackField ? { 'data-receipt-time-target': true } : {}
  const confirm = () => {
    setAttempted(true)
    const utc = candidates.length === 1 ? candidates[0] : occurrence !== '' ? candidates[Number(occurrence)] ?? '' : ''
    onDate(utc)
    if (!utc) {
      cancelAnimationFrame(revealFrame.current)
      revealFrame.current = requestAnimationFrame(() => {
        const control = section.current?.querySelector<HTMLElement>('[data-receipt-time-target]')
        control?.focus({ preventScroll: true })
        control?.closest('[data-review-feedback]')?.scrollIntoView({ block: 'nearest' })
      })
    }
  }
  return <section ref={section} className={styles.receiptObservations} data-testid="receipt-observations">
    <p><strong>{t.merchant}: </strong><bdi dir="auto">{value(o.merchantName)}</bdi></p>
    <p><strong>{t.address}: </strong><bdi dir="auto">{value(o.address)}</bdi></p>
    <p>{t.date}: <bdi>{value(o.date)}</bdi> · {t.time}: <bdi>{value(o.time)}</bdi></p>
    <details><summary>{t.observed}</summary><p>{t.original}</p>
      <dl>{(['currency', 'finalAmount', 'preVat', 'vatAmount', 'vatRate'] as const).filter(k => k in o).map(k => <div key={k}><dt>{({currency: locale === 'he' ? 'מטבע' : 'Currency', finalAmount: locale === 'he' ? 'סכום סופי' : 'Final amount', preVat: locale === 'he' ? 'לפני מע״מ' : 'Pre-VAT', vatAmount: locale === 'he' ? 'מע״מ' : 'VAT', vatRate: locale === 'he' ? 'שיעור מע״מ' : 'VAT rate'})[k]}</dt><dd><bdi>{value(o[k])}</bdi></dd></div>)}</dl>
      <ol>{o.lines.map((line, i) => <li key={i}><bdi dir="auto">{value(line.name)}</bdi><p><bdi>{value(line.quantity)} · {value(line.unit)} × {value(line.unitPrice)} → {value(line.lineAmount)}</bdi></p>{'discount' in line && <p>{locale === 'he' ? 'הנחה מודפסת' : 'Printed discount'}: <bdi>{value(line.discount)}</bdi></p>}{line.barcode && <p>{locale === 'he' ? 'ברקוד (רשות)' : 'Barcode (optional)'}: <bdi>{value(line.barcode.original)} · {value(line.barcode.format)}</bdi></p>}</li>)}</ol>
    </details>
    <div className={styles.formGrid}>
      <label data-review-feedback>{t.local}<input {...target('date')} id="review-date" data-testid="review-date" type="datetime-local" dir="ltr" step="60" value={wall} aria-required="true" aria-invalid={dateError || (attempted && !candidates.length)} aria-describedby={showError ? 'receipt-time-error' : undefined} onChange={e => { setWall(e.target.value); change() }} />{feedback('date')}</label>
      <label data-review-feedback>{t.zone}<select {...target('zone')} data-testid="receipt-timezone" dir="ltr" value={zone} aria-required="true" aria-invalid={showError && !zone} aria-describedby={showError ? 'receipt-time-error' : undefined} onChange={e => { setZone(e.target.value); change() }}><option value="">{t.choose}</option>{zones.map(z => <option key={z} value={z}>{z}</option>)}</select>{feedback('zone')}</label>
      {candidates.length > 1 && <label data-review-feedback>{t.occurrence}<select {...target('occurrence')} data-testid="receipt-occurrence" value={occurrence} aria-required="true" aria-invalid={showError && occurrence === ''} aria-describedby={showError ? 'receipt-time-error' : undefined} onChange={e => { setOccurrence(e.target.value); onDate('') }}><option value="">{t.choose}</option><option value="0">{t.earlier}</option><option value="1">{t.later}</option></select>{feedback('occurrence')}{!showError && <small>{t.overlap}</small>}</label>}
    </div>
    <div data-review-feedback>
    <button {...target('confirm')} type="button" className={styles.secondary} data-testid="receipt-confirm-time" aria-describedby={showError ? 'receipt-time-error' : undefined} onClick={confirm}>{t.confirm}</button>
    {feedback('confirm')}
    </div>
    <p role="status">{confirmed ? t.confirmed : ''}</p>
    <small>{t.optional}</small>
  </section>
}
