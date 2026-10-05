'use client'

import { useEffect, useRef, useState } from 'react'
import { localized, type LocaleCode } from '@/data/spendscape-globe'
import { lineMinorTotal, reviewCategories, reviewCurrencies, validateReview, type PurchaseReviewInput, type ReviewContext, type ReviewErrors, type SaveReviewResult } from './session-purchase-domain'
import { prepareReceiptReview, type ReceiptReviewDraft } from './receipt-review-adapter'
import { ReceiptReviewDetails, receiptCopy } from './ReceiptReviewDetails'
import { MerchantPlaceReview } from './MerchantPlaceReview'
import styles from './CaptureExperience.module.css'

type EditableReview = Omit<PurchaseReviewInput, 'lines'> & { lines: (PurchaseReviewInput['lines'][number] | ReceiptReviewDraft['review']['lines'][number])[] }
const calculatedLine = (line: EditableReview['lines'][number], currency: string) => line.unit ? lineMinorTotal(line as PurchaseReviewInput['lines'][number], currency) : null
const receiptFeedbackTarget = (control: HTMLElement) => control.closest<HTMLElement>('[data-review-feedback]') ?? control.closest('label') ?? control

const copy = {
  en: { capacity: 'Not saved: the local purchase limit has been reached. Existing purchases are intact and your draft is still here. You can cancel and continue viewing your history.', storage: 'Not saved. Local storage failed or changed in another tab. Your draft is still here; retry when storage is available.', title: 'Review your purchase', manualTitle: 'Quick Add', description: 'Check every detail before adding. Saved purchases stay in this browser on this device.', demo: 'Built-in synthetic demo · review only', user: 'Details supplied by you · not independently verified', product: 'A barcode identifies a candidate only. It is not proof of purchase. No purchase or merchant is inferred. Product photos are not retained.', channel: 'Channel', physical: 'Physical place', online: 'Online purchase · no map pin', unknown: 'Unresolved place · no map pin', merchantId: 'Merchant', placeId: 'Merchant and place', unresolved: 'Merchant not resolved', places: 'Choose an existing place explicitly, or create a confirmed place below.', date: 'Date and time (UTC)', currency: 'Currency', payment: 'Payment context', category: 'Category', amount: 'Purchase total', baseAmount: 'Paid amount in ILS, reported by you', conversion: 'Enter the ILS amount you can confirm. If unknown, leave this as a draft. No exchange rate is looked up.', name: 'Item name', quantity: 'Quantity', price: 'Unit price (before discount)', discount: 'Line discount (optional)', discountHint: 'Whole-line amount, not per unit. 0 means no discount; clear only to enter a new amount.', net: 'Net line total', unit: 'Unit', item: 'Item', kg: 'kg', addLine: 'Add receipt item', remove: 'Remove item', total: 'Item total', cash: 'Cash', card: 'Card', manual: 'Manual payment', groceries: 'Groceries', food: 'Food', retail: 'Retail', travel: 'Travel', required: 'Choose…', save: 'Save on this device', review: 'Review purchase', other: 'Choose another source', errors: 'Check the highlighted fields.', duplicate: 'A purchase with the same details already exists. Add another only if this is a separate purchase.', again: 'Add a separate purchase with these details', consumed: 'This confirmation has already been used. Start a new purchase to add another.', summary: 'Review summary', noItems: 'Total-only manual purchase. Quantity and unit price apply when you add items.', close: 'Cancel',
    error: { discount: 'Enter a discount of zero or more, no greater than the gross line amount, in this currency’s precision.', required: 'Complete this field.', amount: 'Enter a positive decimal amount in this currency’s precision (up to 9,999,999).', quantity: 'Enter a positive quantity: whole items or kg with up to 3 decimals.', date: 'Enter a valid UTC date and time between 1900 and 2100.', place: 'Choose a matching existing merchant and place, or an unpinned channel.', conversion: 'Enter the ILS amount you can confirm.', arithmetic: 'The purchase total must equal the net item totals after discounts.', items: 'Provide 1–50 valid items.', barcode: 'The barcode identity is invalid.' } },
  he: { capacity: 'לא נשמר: הגעת למגבלת הרכישות המקומיות. הרכישות הקיימות תקינות והטיוטה עדיין כאן. אפשר לבטל ולהמשיך לצפות בהיסטוריה.', storage: 'לא נשמר. האחסון נכשל או השתנה בלשונית אחרת. הטיוטה עדיין כאן; נסו שוב כשהאחסון זמין.', title: 'בדיקת פרטי הרכישה', manualTitle: 'הוספה מהירה', description: 'בדקו את כל הפרטים לפני ההוספה. הרכישות נשמרות בדפדפן הזה במכשיר הזה.', demo: 'הדגמה סינתטית מובנית · לבדיקה בלבד', user: 'פרטים שסופקו על ידך · ללא אימות עצמאי', product: 'ברקוד מזהה מועמד בלבד. אין הסקת רכישה או בית עסק. תמונות מוצר אינן נשמרות.', channel: 'ערוץ', physical: 'מקום פיזי', online: 'רכישה מקוונת · ללא סיכה במפה', unknown: 'מקום לא פתור · ללא סיכה במפה', merchantId: 'בית עסק', placeId: 'בית עסק ומקום', unresolved: 'בית עסק לא פתור', places: 'בחרו מקום קיים במפורש, או צרו מקום מאושר בהמשך.', date: 'תאריך ושעה (UTC)', currency: 'מטבע', payment: 'אמצעי תשלום', category: 'קטגוריה', amount: 'סכום הרכישה', baseAmount: 'סכום ששולם בש״ח, לפי הדיווח שלך', conversion: 'הזינו סכום בש״ח שאפשר לאשר. אם אינו ידוע, השאירו טיוטה. לא מתבצע חיפוש שער מטבע.', name: 'שם פריט', quantity: 'כמות', price: 'מחיר יחידה (לפני הנחה)', discount: 'הנחה לשורה (רשות)', discountHint: 'סכום לכל השורה, לא ליחידה. 0 משמעו ללא הנחה; יש להשלים סכום אם השדה נמחק.', net: 'סכום שורה לאחר הנחה', unit: 'יחידה', item: 'פריט', kg: 'ק״ג', addLine: 'הוספת פריט לקבלה', remove: 'הסרת פריט', total: 'סכום הפריטים', cash: 'מזומן', card: 'כרטיס', manual: 'תשלום ידני', groceries: 'מכולת', food: 'אוכל', retail: 'קמעונאות', travel: 'נסיעות', required: 'בחירה…', save: 'שמירה במכשיר הזה', review: 'בדיקת הרכישה', other: 'בחירת מקור אחר', errors: 'בדקו את השדות המסומנים.', duplicate: 'כבר קיימת רכישה עם אותם פרטים. הוסיפו שוב רק אם זו רכישה נפרדת.', again: 'הוספת רכישה נפרדת עם אותם פרטים', consumed: 'האישור הזה כבר נוצל. להוספה נוספת יש להתחיל רכישה חדשה.', summary: 'סיכום לבדיקה', noItems: 'רכישה ידנית בסכום כולל. כמות ומחיר יחידה נדרשים בהוספת פריטים.', close: 'ביטול',
    error: { discount: 'יש להזין הנחה מאפס ועד סכום השורה לפני הנחה, בדיוק המטבע.', required: 'יש להשלים את השדה.', amount: 'יש להזין סכום עשרוני חיובי בדיוק המטבע (עד 9,999,999).', quantity: 'יש להזין כמות חיובית: פריטים שלמים או ק״ג עד 3 ספרות עשרוניות.', date: 'יש להזין תאריך ושעה תקינים ב־UTC בין 1900 ל־2100.', place: 'יש לבחור בית עסק ומקום תואמים, או ערוץ ללא סיכה.', conversion: 'יש להזין סכום בש״ח שניתן לאשר.', arithmetic: 'סכום הרכישה חייב להתאים לסכומי השורות לאחר הנחות.', items: 'יש לספק 1–50 פריטים תקינים.', barcode: 'זיהוי הברקוד אינו תקין.' } },
} as const

export function PurchaseReview({ initial, receiptDraft, locale, context, manualStep, onReviewed, onSave, onOther }: {
  initial: EditableReview; receiptDraft?: ReceiptReviewDraft; locale: LocaleCode; context: ReviewContext; manualStep: boolean
  onReviewed: () => void; onSave: (input: PurchaseReviewInput, allowDuplicate: boolean) => Promise<SaveReviewResult>; onOther: () => void
}) {
  const [input, setInput] = useState<EditableReview>(initial), [errors, setErrors] = useState<ReviewErrors>({}), [message, setMessage] = useState<'duplicate' | 'consumed' | 'storage' | 'capacity' | null>(null)
  const form = useRef<HTMLFormElement>(null), heading = useRef<HTMLHeadingElement>(null), saving = useRef(false)
  const directoryActive = useRef(Boolean(input.directoryIntent))
  directoryActive.current = Boolean(input.directoryIntent)
  const status = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const layer = form.current?.closest<HTMLElement>('[data-testid="capture-layer"]')
    const viewport = window.visualViewport
    if (!layer || !viewport) return
    let frame = 0
    const fit = () => {
      layer.style.setProperty('--review-viewport-height', `${viewport.height}px`)
      layer.style.setProperty('--review-viewport-top', `${viewport.offsetTop}px`)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const focused = document.activeElement
        if (focused instanceof HTMLElement && form.current?.contains(focused)) {
          const target = receiptDraft || directoryActive.current ? receiptFeedbackTarget(focused) : focused
          target.scrollIntoView({ block: 'nearest' })
        }
      })
    }
    fit()
    viewport.addEventListener('resize', fit)
    viewport.addEventListener('scroll', fit)
    // The scroll area settles after viewport events (notably when the mobile
    // keyboard changes the available height). Reveal the whole field, including
    // its error, using the final layout rather than the earlier viewport event.
    const scrollArea = form.current?.firstElementChild
    const observer = scrollArea ? new ResizeObserver(fit) : null
    if (scrollArea) observer?.observe(scrollArea)
    return () => {
      viewport.removeEventListener('resize', fit); viewport.removeEventListener('scroll', fit)
      observer?.disconnect()
      cancelAnimationFrame(frame)
      layer.style.removeProperty('--review-viewport-height'); layer.style.removeProperty('--review-viewport-top')
    }
  }, [])
  useEffect(() => {
    if (message === 'capacity') status.current?.scrollIntoView({ block: 'nearest' })
  }, [message])
  const t = copy[locale]
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [manualStep])
  const patch = (value: Partial<EditableReview>) => { setInput(current => ({ ...current, ...value })); setErrors({}); setMessage(null) }
  const errorText = (field: string) => receiptDraft && field.startsWith('printedAmount-') && errors[field] === 'arithmetic' ? receiptCopy[locale].mismatch : errors[field] ? t.error[errors[field] as keyof typeof t.error] ?? t.error.required : null
  const attrs = (field: string) => ({ id: `review-${field}`, 'data-testid': `review-${field}`, 'aria-invalid': Boolean(errors[field]), 'aria-required': true, 'aria-describedby': errors[field] ? `review-error-${field}` : undefined })
  const error = (field: string) => errorText(field) && <small className={styles.fieldError} id={`review-error-${field}`}>{errorText(field)}</small>
  const submit = async (allowDuplicate = false) => {
    if (saving.current) return
    const prepared = receiptDraft ? prepareReceiptReview({ ...receiptDraft, review: input as ReceiptReviewDraft['review'] }, context) : null
    const projected = prepared?.ready ? prepared.input : input as PurchaseReviewInput
    const nextErrors = prepared && !prepared.ready ? prepared.errors : validateReview(projected, context)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => {
        const invalid = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        const control = receiptDraft && invalid?.dataset.testid === 'review-date'
          ? form.current?.querySelector<HTMLElement>('[data-receipt-time-target]') ?? invalid : invalid
        if ((receiptDraft || input.directoryIntent) && control) {
          control.focus({ preventScroll: true })
          receiptFeedbackTarget(control).scrollIntoView({ block: 'nearest' })
        } else invalid?.focus()
      })
      return
    }
    if (manualStep) { onReviewed(); return }
    saving.current = true
    const retryFocus = document.activeElement instanceof HTMLElement && form.current?.contains(document.activeElement) ? document.activeElement : null
    const result = await onSave(projected, allowDuplicate)
    saving.current = false
    if (result.code !== 'saved') {
      if (result.code === 'invalid') setErrors(result.errors)
      else {
        setMessage(result.code)
        // Every failed attempt must reveal feedback, including an unchanged
        // storage error after the user scrolls away and retries.
        if (result.code === 'storage') requestAnimationFrame(() => {
          // The transaction's inert lock can move focus to body. Restore only
          // that lost focus, never a newer target or a blocked/conflicted form.
          if (document.activeElement === document.body && retryFocus?.isConnected && form.current?.contains(retryFocus) && !form.current.closest('[inert]')) retryFocus.focus({ preventScroll: true })
          status.current?.scrollIntoView({ block: 'nearest' })
        })
      }
    }
  }
  const factor = input.currency === 'JPY' ? 1 : 100
  const validLineTotals = input.lines.every(line => calculatedLine(line, input.currency) !== null)
  const lineTotal = input.lines.reduce((sum, line) => sum + (calculatedLine(line, input.currency) ?? 0), 0) / factor
  const money = (amount: number) => input.currency ? new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', { style: 'currency', currency: input.currency }).format(amount) : '—'
  const merchant = context.merchants.find(m => m.id === input.merchantId)
  const place = context.places.find(p => p.id === input.placeId)
  return <form ref={form} noValidate autoComplete="off" className={`${styles.review} ${styles.purchaseReview}`} data-identification-method={input.identification?.method} data-testid={manualStep ? 'capture-manual' : 'capture-review'} onSubmit={event => { event.preventDefault(); submit() }}>
    <div className={styles.reviewScroll}>
    <div className={styles.stageCopy}><p className={styles.kicker}>{input.provenance === 'synthetic-demo' ? t.demo : t.user}</p><h2 id="capture-title" ref={heading} tabIndex={-1}>{manualStep ? t.manualTitle : t.title}</h2><p id="capture-description">{t.description}</p><small>{locale === 'he' ? 'שדות הפרטים הם חובה, למעט הנחה. הוספת פריטים לרכישה ידנית היא רשות.' : 'Detail fields are required except the optional discount. Items are optional for a total-only manual purchase.'}</small></div>
    {(input.identification || input.source === 'product' || input.source === 'barcode') && <div className={styles.truthCallout} data-testid="product-proof-boundary"><p>{t.product}</p><bdi dir="ltr">{input.identification?.identity.original}</bdi>{input.identification?.syntheticCatalog && <p>{t.demo}</p>}</div>}
    {receiptDraft && <ReceiptReviewDetails draft={receiptDraft} locale={locale} confirmed={Boolean(input.date)} onDate={date => patch({ date })} dateError={Boolean(errors.date)} />}
    <div className={styles.reviewColumns}><div className={styles.formGrid}>
      <label>{t.channel}<select {...attrs('channel')} value={input.channel} onChange={e => patch({ channel: e.target.value as PurchaseReviewInput['channel'], placeId: '', merchantId: '', directoryIntent: undefined })}><option value="">{t.required}</option>{(['physical', 'online', 'unknown'] as const).map(key => <option key={key} value={key}>{t[key]}</option>)}</select>{error('channel')}</label>
      {!input.directoryIntent && (input.channel === 'physical' ? <label>{t.placeId}<select {...attrs('placeId')} value={input.placeId} onChange={e => { const p = context.places.find(p => p.id === e.target.value); patch({ placeId: p?.id ?? '', merchantId: p?.merchantId ?? '', directoryIntent: undefined }) }}><option value="">{t.required}</option>{context.places.map(p => <option key={p.id} value={p.id}>{localized(p.name, locale)} · {localized(p.branch, locale)}</option>)}</select>{error('placeId')}<small>{t.places}</small></label> : <label>{t.merchantId}<select {...attrs('merchantId')} value={input.merchantId} onChange={e => patch({ merchantId: e.target.value, directoryIntent: undefined })}><option value="">{t.required}</option>{context.merchants.map(m => <option key={m.id} value={m.id}>{localized(m.name, locale)}</option>)}</select>{error('merchantId')}</label>)}
      <div className={styles.fullField}><MerchantPlaceReview intent={input.directoryIntent} merchantId={input.merchantId} channel={input.channel} context={context} locale={locale} errors={errors} onChooseMerchant={merchantId => patch({ merchantId, placeId: '', directoryIntent: undefined })} onChange={directoryIntent => patch({ directoryIntent, ...(directoryIntent ? { placeId: '', ...(directoryIntent.merchant ? { merchantId: '' } : {}) } : {}) })} /></div>
      {!receiptDraft && <label>{t.date}<input {...attrs('date')} type="datetime-local" step="60" dir="ltr" value={input.date} onChange={e => patch({ date: e.target.value })} />{error('date')}</label>}
      <label>{t.currency}<select {...attrs('currency')} value={input.currency} onChange={e => patch({ currency: e.target.value as PurchaseReviewInput['currency'], baseAmount: '' })}><option value="">{t.required}</option>{reviewCurrencies.map(c => <option key={c}>{c}</option>)}</select>{error('currency')}</label>
      <label>{t.payment}<select {...attrs('payment')} value={input.payment} onChange={e => patch({ payment: e.target.value as PurchaseReviewInput['payment'] })}><option value="">{t.required}</option>{(['card', 'cash', 'manual'] as const).map(p => <option key={p} value={p}>{t[p]}</option>)}</select>{error('payment')}</label>
      <label>{t.category}<select {...attrs('category')} value={input.category} onChange={e => patch({ category: e.target.value as PurchaseReviewInput['category'] })}><option value="">{t.required}</option>{reviewCategories.map(c => <option key={c} value={c}>{t[c]}</option>)}</select>{error('category')}</label>
      <label>{t.amount}<input {...attrs('amount')} dir="ltr" inputMode="decimal" value={input.amount} onChange={e => patch({ amount: e.target.value })} />{error('amount')}</label>
      {input.provenance === 'user-reviewed' && input.currency && input.currency !== 'ILS' && <label>{t.baseAmount}<input {...attrs('baseAmount')} dir="ltr" inputMode="decimal" value={input.baseAmount} onChange={e => patch({ baseAmount: e.target.value })} />{error('baseAmount')}<small>{t.conversion}</small></label>}
      <div className={styles.fullField}><p>{input.lines.length ? t.total : t.noItems}</p>{input.lines.map((line, i) => <fieldset key={i} className={styles.reviewLine}><legend>{i + 1}. {line.name || t.name}</legend>
        <label>{t.name}<input {...attrs(`name-${i}`)} dir="auto" maxLength={100} value={line.name} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, name: e.target.value } : l) })} />{error(`name-${i}`)}</label>
        <label>{t.quantity}<input {...attrs(`quantity-${i}`)} dir="ltr" inputMode="decimal" value={line.quantity} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l) })} />{error(`quantity-${i}`)}</label>
        <label>{t.price}<input {...attrs(`price-${i}`)} dir="ltr" inputMode="decimal" value={line.price} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, price: e.target.value } : l) })} />{error(`price-${i}`)}</label>
        <label>{t.unit}<select {...attrs(`unit-${i}`)} value={line.unit} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, unit: e.target.value as 'item' | 'kg' } : l) })}>{receiptDraft && <option value="">{t.required}</option>}<option value="item">{t.item}</option><option value="kg">{t.kg}</option></select>{error(`unit-${i}`)}</label>
        {receiptDraft && <label>{receiptCopy[locale].amount}<input {...attrs(`printedAmount-${i}`)} dir="ltr" inputMode="decimal" value={'printedAmount' in line ? line.printedAmount : ''} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, printedAmount: e.target.value } : l) })} />{error(`printedAmount-${i}`)}</label>}
        <label className={styles.lineDiscount}>{t.discount}<input {...attrs(`discount-${i}`)} aria-required={false} aria-describedby={errors[`discount-${i}`] ? `review-error-discount-${i}` : `review-discount-hint-${i}`} dir="ltr" inputMode="decimal" value={line.discount ?? '0'} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, discount: e.target.value } : l) })} /><small id={`review-discount-hint-${i}`}>{t.discountHint}</small>{error(`discount-${i}`)}</label>
        <output className={styles.lineNet} data-testid={`review-net-${i}`}>{t.net}: <bdi>{calculatedLine(line, input.currency) === null ? '—' : money(calculatedLine(line, input.currency)! / factor)}</bdi></output><button type="button" className={styles.secondary} onClick={() => patch({ lines: input.lines.filter((_, j) => j !== i) })}>{t.remove} {i + 1}</button>
      </fieldset>)}{error('lines')}<button type="button" className={styles.secondary} disabled={input.lines.length >= 50} onClick={() => patch({ lines: [...input.lines, receiptDraft ? { name: '', quantity: '', price: '', unit: '', printedAmount: '' } : { name: '', quantity: '', price: '', unit: 'item' }] })}>{t.addLine}</button></div>
    </div><aside className={styles.reviewSummary} aria-label={t.summary}><strong>{t.summary}</strong><p>{input.directoryIntent ? [input.directoryIntent.merchant?.name ?? (merchant ? localized(merchant.name, locale) : t.required), input.directoryIntent.place?.branch].filter(Boolean).join(' · ') : place ? `${localized(place.name, locale)} · ${localized(place.branch, locale)} · ${localized(place.city, locale)}` : merchant ? localized(merchant.name, locale) : t.required}</p><p>{input.channel ? t[input.channel] : t.required}</p><p><bdi>{input.date.replace('T', ' ')} {input.date && 'UTC'}</bdi></p><p>{input.payment ? t[input.payment] : t.required}</p>{input.lines.length > 0 && <p>{t.total}: <bdi>{validLineTotals ? money(lineTotal) : '—'}</bdi></p>}<p>{t.amount}: <bdi>{money(Number(input.amount) || 0)}</bdi></p>{input.baseAmount && <p>{t.baseAmount}: <bdi>{input.baseAmount} ILS</bdi></p>}</aside></div>
    <p ref={status} role="status" aria-live="polite">{Object.keys(errors).length ? t.errors : message ? t[message] : ''}</p>
    </div>
    <div className={`${styles.actions} ${styles.stickyActions}`}><button type="submit" className={styles.primary} data-identification-method={input.identification?.method} data-testid={manualStep ? 'manual-review' : 'capture-confirm'}>{manualStep ? t.review : t.save}</button>{message === 'duplicate' && <button type="button" className={styles.secondary} data-testid="review-save-separate" onClick={() => submit(true)}>{t.again}</button>}<button type="button" className={styles.secondary} onClick={onOther}>{t.other}</button></div>
  </form>
}
