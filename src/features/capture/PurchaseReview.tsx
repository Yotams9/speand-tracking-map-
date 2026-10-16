'use client'

import {reviewFailure} from '../receipt-image/receipt-failure'
import { useEffect, useRef, useState } from 'react'
import { localized, type LocaleCode } from '@/data/spendscape-globe'
import { lineMinorTotal, minorAmount, usesFinalPayableTotal, reviewCategories, reviewCurrencies, validateReview, type PurchaseReviewInput, type ReviewContext, type ReviewErrors, type SaveReviewResult } from './session-purchase-domain'
import { prepareReceiptReview, type ReceiptReviewDraft } from './receipt-review-adapter'
import { ReceiptReviewDetails, receiptCopy } from './ReceiptReviewDetails'
import { MerchantPlaceReview } from './MerchantPlaceReview'
import { ReceiptPayableSummary } from './ReceiptPayableSummary'
import { receiptEditorWall } from './receipt-editor-values'
import { receiptReviewPrefill, receiptReviewZone } from './receipt-review-prefill'
import { receiptPlaceSeed, type ReceiptPlaceSeed } from './receipt-place-seed'
import { receiptBlockerFields, receiptBlockerLabel } from './receipt-review-readiness'
import { catalogChoice, catalogIdForPlace, isLocated, loadCatalogStores, localInputToUtc, nearestCatalogStore, NEAREST_STORE_METERS, utcToLocalInput, withNowIfEmpty, followLineEdit, followPublishedPrice, restoredStore, setAsideStore, type LocatedCatalogStore, type PublishedFill, type SetAsideStore } from './catalog-stores'
import { locationRequests } from './location-request'
import { catalogChainNames } from '../local-purchases/place-provenance'
import type { CatalogStoreSummary } from '@/data/price-catalog'
import styles from './CaptureExperience.module.css'

const NEW_STORE = '__new_store__'
const CATALOG = 'catalog:'

// publishedFill is form state only: what was last filled in from a store's
// published price, so a later store change can tell it from typed values.
type EditableReview = Omit<PurchaseReviewInput, 'lines'> & { lines: (PurchaseReviewInput['lines'][number] | ReceiptReviewDraft['review']['lines'][number])[]; publishedFill?: PublishedFill; setAside?: SetAsideStore }
const reviewInput = ({ publishedFill: _fill, setAside: _aside, ...form }: EditableReview) => form as PurchaseReviewInput
// Form-only state travels with the form: the new fill, and any store set aside.
const withFill = (input: PurchaseReviewInput, fill: PublishedFill | null, setAside: SetAsideStore | undefined): EditableReview => ({ ...(input as EditableReview), ...(fill ? { publishedFill: fill } : {}), ...(setAside ? { setAside } : {}) })
const followStore = (current: EditableReview, storeId: string | null): EditableReview => { const next = followPublishedPrice(reviewInput(current), storeId, current.publishedFill ?? null); return withFill(next.input, next.fill, current.setAside) }
const followEdit = (current: EditableReview): EditableReview => { const next = followLineEdit(reviewInput(current), current.publishedFill ?? null); return withFill(next.input, next.fill, current.setAside) }
const calculatedLine = (line: EditableReview['lines'][number], currency: string) => line.unit ? lineMinorTotal(line as PurchaseReviewInput['lines'][number], currency) : null
const receiptFeedbackTarget = (control: HTMLElement) => control.closest<HTMLElement>('[data-review-feedback]') ?? control.closest('label') ?? control

const copy = {
  en: { capacity: 'Not saved: the local purchase limit has been reached. Existing purchases are intact and your draft is still here. You can cancel and continue viewing your history.', storage: 'Not saved. Local storage failed or changed in another tab. Your draft is still here; retry when storage is available.', title: 'Review your purchase', manualTitle: 'Quick Add', description: 'Check every detail before adding. Saved purchases stay in this browser on this device.', demo: 'Built-in synthetic demo · review only', user: 'Details supplied by you · not independently verified', product: 'A barcode identifies a candidate only. It is not proof of purchase. No purchase or store is inferred. Product photos are not retained.', channel: 'Channel', physical: 'Physical place', online: 'Online purchase · no map pin', unknown: 'Unresolved place · no map pin', merchantId: 'Store', placeId: 'Store', unresolved: 'Store not identified', places: 'Choose a saved place or a Tel Aviv chain branch, or add a new store. No location is inferred.', nearest: 'Find the store I’m in', nearestPending: 'Finding your location…', nearestFound: 'Nearest known store: {store}, about {m} m away. Confirm that you bought here, or choose another store below.', confirmSuggested: 'I confirm this purchase was at this branch', nearestNone: 'No known store within {radius} m. Choose from the list or add a new store.', nearestFailed: 'Location is unavailable here. Choose the store from the list.', nearestNote: 'Your location is read once when you press the button and is not saved. It only suggests a store; it is not proof of a purchase.', catalogGroup: 'Tel Aviv supermarkets', priceFilled: 'Published shelf price at this store: {price}. Filled in for you; change it if you paid a different price.', newStore: '＋ New store…', date: 'Date and time', currency: 'Currency', payment: 'Payment context', category: 'Category', amount: 'Purchase total', baseAmount: 'Paid amount in ILS, reported by you', conversion: 'Enter the ILS amount you can confirm. If unknown, leave this as a draft. No exchange rate is looked up.', name: 'Item name', quantity: 'Quantity', price: 'Unit price (before discount)', discount: 'Line discount (optional)', discountHint: 'Whole-line amount, not per unit. 0 means no discount; clear only to enter a new amount.', net: 'Net line total', unit: 'Unit', item: 'Item', kg: 'kg', addLine: 'Add receipt item', remove: 'Remove item', total: 'Item total', unknownContext: 'Unknown', cash: 'Cash', card: 'Card', manual: 'Manual payment', groceries: 'Groceries', food: 'Food', retail: 'Retail', travel: 'Travel', required: 'Choose…', save: 'Save on this device', review: 'Review purchase', other: 'Choose another source', errors: 'Check the highlighted fields.', duplicate: 'A purchase with the same details already exists. Add another only if this is a separate purchase.', again: 'Add a separate purchase with these details', consumed: 'This confirmation has already been used. Start a new purchase to add another.', summary: 'Review summary', noItems: 'Total-only manual purchase. Quantity and unit price apply when you add items.', close: 'Cancel',
    error: { location: 'Confirm the suggested branch, or choose the store from the list.', discount: 'Enter a discount of zero or more, no greater than the gross line amount, in this currency’s precision.', required: 'Complete this field.', amount: 'Enter a positive decimal amount in this currency’s precision (up to 9,999,999).', quantity: 'Enter a positive quantity: whole items or kg with up to 3 decimals.', date: 'Enter a valid date and time between 1900 and 2100.', place: 'Choose a store from the list, or a channel without a map pin.', conversion: 'Enter the ILS amount you can confirm.', arithmetic: 'The purchase total must equal the net item totals after discounts.', items: 'Provide 1–50 valid items.', barcode: 'The barcode identity is invalid.' } },
  he: { capacity: 'לא נשמר: הגעת למגבלת הרכישות המקומיות. הרכישות הקיימות תקינות והטיוטה עדיין כאן. אפשר לבטל ולהמשיך לצפות בהיסטוריה.', storage: 'לא נשמר. האחסון נכשל או השתנה בלשונית אחרת. הטיוטה עדיין כאן; נסו שוב כשהאחסון זמין.', title: 'בדיקת פרטי הרכישה', manualTitle: 'הוספה מהירה', description: 'בדקו את כל הפרטים לפני ההוספה. הרכישות נשמרות בדפדפן הזה במכשיר הזה.', demo: 'הדגמה סינתטית מובנית · לבדיקה בלבד', user: 'פרטים שסופקו על ידך · ללא אימות עצמאי', product: 'ברקוד מזהה מועמד בלבד. אין הסקת רכישה או חנות. תמונות מוצר אינן נשמרות.', channel: 'ערוץ', physical: 'מקום פיזי', online: 'רכישה מקוונת · ללא סיכה במפה', unknown: 'מקום לא פתור · ללא סיכה במפה', merchantId: 'חנות', placeId: 'חנות', unresolved: 'חנות לא מזוהה', places: 'בחרו מקום שמור או סניף רשת בתל אביב, או הוסיפו חנות חדשה. אין הסקת מיקום.', nearest: 'מצאו את החנות שבה אני נמצא', nearestPending: 'מאתרים את המיקום…', nearestFound: 'החנות המוכרת הקרובה: {store}, כ־{m} מ׳ ממך. אשרו שקניתם כאן, או בחרו חנות אחרת למטה.', confirmSuggested: 'אני מאשר/ת שהרכישה הייתה בסניף הזה', nearestNone: 'אין חנות מוכרת ברדיוס {radius} מ׳. בחרו מהרשימה או הוסיפו חנות חדשה.', nearestFailed: 'המיקום אינו זמין כאן. בחרו את החנות מהרשימה.', nearestNote: 'המיקום נקרא פעם אחת בלחיצה ואינו נשמר. הוא רק מציע חנות ואינו הוכחה לרכישה.', catalogGroup: 'סופרמרקטים בתל אביב', priceFilled: 'מחיר המדף המפורסם בחנות הזו: {price}. מילאנו אותו בשבילכם; שנו אם שילמתם מחיר אחר.', newStore: '＋ חנות חדשה…', date: 'תאריך ושעה', currency: 'מטבע', payment: 'אמצעי תשלום', category: 'קטגוריה', amount: 'סכום הרכישה', baseAmount: 'סכום ששולם בש״ח, לפי הדיווח שלך', conversion: 'הזינו סכום בש״ח שאפשר לאשר. אם אינו ידוע, השאירו טיוטה. לא מתבצע חיפוש שער מטבע.', name: 'שם פריט', quantity: 'כמות', price: 'מחיר יחידה (לפני הנחה)', discount: 'הנחה לשורה (רשות)', discountHint: 'סכום לכל השורה, לא ליחידה. 0 משמעו ללא הנחה; יש להשלים סכום אם השדה נמחק.', net: 'סכום שורה לאחר הנחה', unit: 'יחידה', item: 'פריט', kg: 'ק״ג', addLine: 'הוספת פריט לקבלה', remove: 'הסרת פריט', total: 'סכום הפריטים', unknownContext: 'לא ידוע', cash: 'מזומן', card: 'כרטיס', manual: 'תשלום ידני', groceries: 'מכולת', food: 'אוכל', retail: 'קמעונאות', travel: 'נסיעות', required: 'בחירה…', save: 'שמירה במכשיר הזה', review: 'בדיקת הרכישה', other: 'בחירת מקור אחר', errors: 'בדקו את השדות המסומנים.', duplicate: 'כבר קיימת רכישה עם אותם פרטים. הוסיפו שוב רק אם זו רכישה נפרדת.', again: 'הוספת רכישה נפרדת עם אותם פרטים', consumed: 'האישור הזה כבר נוצל. להוספה נוספת יש להתחיל רכישה חדשה.', summary: 'סיכום לבדיקה', noItems: 'רכישה ידנית בסכום כולל. כמות ומחיר יחידה נדרשים בהוספת פריטים.', close: 'ביטול',
    error: { location: 'יש לאשר את הסניף המוצע, או לבחור את החנות מהרשימה.', discount: 'יש להזין הנחה מאפס ועד סכום השורה לפני הנחה, בדיוק המטבע.', required: 'יש להשלים את השדה.', amount: 'יש להזין סכום עשרוני חיובי בדיוק המטבע (עד 9,999,999).', quantity: 'יש להזין כמות חיובית: פריטים שלמים או ק״ג עד 3 ספרות עשרוניות.', date: 'יש להזין תאריך ושעה תקינים בין 1900 ל־2100.', place: 'יש לבחור חנות מהרשימה, או ערוץ ללא סיכה במפה.', conversion: 'יש להזין סכום בש״ח שניתן לאשר.', arithmetic: 'סכום הרכישה חייב להתאים לסכומי השורות לאחר הנחות.', items: 'יש לספק 1–50 פריטים תקינים.', barcode: 'זיהוי הברקוד אינו תקין.' } },
} as const

export function PurchaseReview({ initial, receiptDraft, locale, context, manualStep, onReviewed, onSave, onOther }: {
  initial: EditableReview; receiptDraft?: ReceiptReviewDraft; locale: LocaleCode; context: ReviewContext; manualStep: boolean
  onReviewed: () => void; onSave: (input: PurchaseReviewInput, allowDuplicate: boolean, locationSeed?: ReceiptPlaceSeed) => Promise<SaveReviewResult>; onOther: () => void
}) {
  const [input, setInput] = useState<EditableReview>(() => receiptDraft ? receiptReviewPrefill(initial, receiptDraft.observations) : initial), [errors, setErrors] = useState<ReviewErrors>({}), [message, setMessage] = useState<'duplicate' | 'consumed' | 'storage' | 'capacity' | null>(null)
  const observedMerchant = typeof receiptDraft?.observations.merchantName === 'string' ? receiptDraft.observations.merchantName : ''
  const [receiptAddress, setReceiptAddress] = useState(() => typeof receiptDraft?.observations.address === 'string' ? receiptDraft.observations.address : '')
  const [receiptWall, setReceiptWall] = useState(() => receiptEditorWall(receiptDraft?.observations.date, receiptDraft?.observations.time))
  const preparation = receiptDraft ? prepareReceiptReview({ ...receiptDraft, review: reviewInput(input) as ReceiptReviewDraft['review'] }, context) : null
  const blockers = preparation && !preparation.ready ? receiptBlockerFields(preparation.errors) : []
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
  const [catalogStores, setCatalogStores] = useState<CatalogStoreSummary[]>([])
  const [nearby, setNearby] = useState<{ state: 'idle' | 'pending' | 'found' | 'none' | 'failed'; label?: string; meters?: number }>({ state: 'idle' })
  useEffect(() => { if (receiptDraft) return; let live = true; loadCatalogStores().then(stores => { if (live) setCatalogStores(stores) }).catch(() => {}); return () => { live = false } }, [receiptDraft])
  // Chain branches already saved as places are offered once, as those places.
  const shownCatalogStores = catalogStores.filter(isLocated).filter(store => !context.places.some(p => catalogIdForPlace(p) === store.id))
  // A chain branch becomes (or reuses) a confirmed place through the directory on save.
  // A branch suggested by the device location, saved place or not, stays a suggestion until confirmed.
  const withCatalogStore = (current: EditableReview, store: LocatedCatalogStore, suggested = false): EditableReview => {
    const existing = context.places.find(p => catalogIdForPlace(p) === store.id)
    const setAside = setAsideStore(current)
    const chosen: EditableReview = existing && !suggested ? { ...current, setAside, directoryIntent: undefined, placeId: existing.id, merchantId: existing.merchantId } : { ...current, setAside, placeId: '', merchantId: '', directoryIntent: { catalogStore: catalogChoice(store), ...(suggested ? { locationSuggested: { confirmed: false } } : {}) } }
    return followStore(chosen, store.id)
  }
  // The device location is read only on this press, to suggest the closest known store.
  // Choosing a store, changing the channel or closing the form makes a pending read stale.
  const nearestRead = useRef(locationRequests())
  useEffect(() => () => nearestRead.current.cancel(), [])
  const findNearest = () => {
    if (!('geolocation' in navigator)) { setNearby({ state: 'failed' }); return }
    setNearby({ state: 'pending' })
    const request = nearestRead.current.start()
    navigator.geolocation.getCurrentPosition(position => {
      if (!nearestRead.current.isCurrent(request)) return
      const found = nearestCatalogStore(catalogStores, [position.coords.longitude, position.coords.latitude])
      if (!found) { setNearby({ state: 'none' }); return }
      setNearby({ state: 'found', label: `${catalogChainNames[found.store.chain][locale]} · ${found.store.name}`, meters: Math.round(found.meters) })
      setErrors({}); setMessage(null)
      // Being in the store now makes "now" and groceries the sensible defaults; both stay editable.
      setInput(current => withCatalogStore(withNowIfEmpty({ ...current, channel: 'physical', category: current.category || 'groceries' }), found.store, true))
    }, () => { if (nearestRead.current.isCurrent(request)) setNearby({ state: 'failed' }) }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
  }
  const choosePlace = (value: string) => {
    nearestRead.current.cancel(); setNearby({ state: 'idle' })
    // "New store" or no store brings back a new store the person was typing before a store replaced it.
    if (value === NEW_STORE) { setErrors({}); setMessage(null); setInput(current => followStore({ ...current, setAside: undefined, placeId: '', ...(restoredStore(setAsideStore(current)) ?? { merchantId: '', directoryIntent: { merchant: { name: '', category: '', separate: false }, place: { branch: '', city: '', country: '', address: '', longitude: '', latitude: '', confirmed: false, separate: false } } }) }, null)); return }
    if (!value) { setErrors({}); setMessage(null); setInput(current => followStore({ ...current, setAside: undefined, placeId: '', ...(restoredStore(setAsideStore(current)) ?? { merchantId: '', directoryIntent: undefined }) }, null)); return }
    const store = value.startsWith(CATALOG) ? shownCatalogStores.find(s => s.id === value.slice(CATALOG.length)) : undefined
    setErrors({}); setMessage(null)
    // Picking a chain branch means shopping there: an empty date becomes now (still editable).
    if (store) { setInput(current => withCatalogStore(withNowIfEmpty({ ...current, category: current.category || 'groceries' }), store)); return }
    const p = context.places.find(p => p.id === value)
    const chainStoreId = p ? catalogIdForPlace(p) : null
    setInput(current => { const chosen = { ...current, setAside: setAsideStore(current), placeId: p?.id ?? '', merchantId: p?.merchantId ?? '', directoryIntent: undefined }; return followStore(chainStoreId ? withNowIfEmpty(chosen) : chosen, chainStoreId) })
  }
  const catalogIntent = input.directoryIntent?.catalogStore
  const suggestion = input.directoryIntent?.locationSuggested
  // A suggested branch already saved as a place is shown as that place.
  const catalogPlace = catalogIntent ? context.places.find(p => catalogIdForPlace(p) === catalogIntent.id) : undefined
  const shownErrors =receiptDraft ? Object.fromEntries(Object.entries(errors).filter(([field]) => receiptBlockerFields(errors).includes(field))) : errors
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [manualStep])
  const patch = (value: Partial<EditableReview>) => { setInput(current => ({ ...current, ...value })); setErrors({}); setMessage(null) }
  // Leaving a store (channel, another store or a new one) clears only automatic published values.
  const patchStore = (change: (current: EditableReview) => EditableReview) => { nearestRead.current.cancel(); setNearby(n => n.state === 'pending' ? { state: 'idle' } : n); setInput(current => followStore(change(current), null)); setErrors({}); setMessage(null) }
  const patchLine = (index: number, value: Partial<PurchaseReviewInput['lines'][number]>) => { setInput(current => followEdit({ ...current, lines: current.lines.map((l, j) => j === index ? { ...l, ...value } : l) })); setErrors({}); setMessage(null) }
  const errorText = (field: string) => receiptDraft && field.startsWith('printedAmount-') && shownErrors[field] === 'arithmetic' ? receiptCopy[locale].mismatch : shownErrors[field] ? t.error[shownErrors[field] as keyof typeof t.error] ?? t.error.required : null
  const attrs = (field: string) => ({ id: `review-${field}`, 'data-testid': `review-${field}`, 'aria-invalid': Boolean(shownErrors[field]), 'aria-required': true, 'aria-describedby': shownErrors[field] ? `review-error-${field}` : undefined })
  const error = (field: string) => errorText(field) && <small className={styles.fieldError} id={`review-error-${field}`}>{errorText(field)}</small>
  const submit = async (allowDuplicate = false) => {
    if (saving.current) return
    const prepared = preparation
    const projected = prepared?.ready ? prepared.input : reviewInput(input)
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
    const result = await onSave(projected, allowDuplicate, receiptDraft ? receiptPlaceSeed(input.directoryIntent?.merchant?.name || context.merchants.find(m => m.id === input.merchantId)?.name[locale] || observedMerchant, receiptAddress) : undefined)
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
  const finalPayable = usesFinalPayableTotal(input)
  const printedTotals = input.lines.map(line => receiptDraft
    ? minorAmount('printedAmount' in line ? line.printedAmount : '', input.currency, true)
    : calculatedLine(line, input.currency))
  const itemMinor = printedTotals.length && printedTotals.every(value => value !== null)
    ? printedTotals.reduce<number>((sum, value) => sum + value!, 0) : null
  const money = (amount: number) => input.currency ? new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', { style: 'currency', currency: input.currency }).format(amount) : '—'
  const merchant = context.merchants.find(m => m.id === input.merchantId)
  const place = context.places.find(p => p.id === input.placeId)
  return <form data-receipt-failure={receiptDraft?JSON.stringify(reviewFailure(errors)):undefined} ref={form} noValidate autoComplete="off" className={`${styles.review} ${styles.purchaseReview}`} data-identification-method={input.identification?.method} data-testid={manualStep ? 'capture-manual' : 'capture-review'} onSubmit={event => { event.preventDefault(); submit() }}>
    <div className={styles.reviewScroll}>
    <div className={styles.stageCopy}><p className={styles.kicker}>{input.provenance === 'synthetic-demo' ? t.demo : t.user}</p><h2 id="capture-title" ref={heading} tabIndex={-1}>{manualStep ? t.manualTitle : t.title}</h2><p id="capture-description">{t.description}</p><small>{locale === 'he' ? 'שדות הפרטים הם חובה, למעט הנחה. הוספת פריטים לרכישה ידנית היא רשות.' : 'Detail fields are required except the optional discount. Items are optional for a total-only manual purchase.'}</small></div>
    {(input.identification || input.source === 'product' || input.source === 'barcode') && <div className={styles.truthCallout} data-testid="product-proof-boundary"><p>{t.product}</p><bdi dir="ltr">{input.identification?.identity.original}</bdi>{input.identification?.syntheticCatalog && <p>{t.demo}</p>}</div>}
    {receiptDraft && <ReceiptReviewDetails draft={receiptDraft} locale={locale} confirmed={Boolean(input.date)} onDate={date => patch({ date })} dateError={Boolean(shownErrors.date)} wall={receiptWall} onWall={setReceiptWall} initialZone={receiptReviewZone} />}
    {receiptDraft && <p data-testid="receipt-review-defaults">{locale === 'he' ? 'ברירת המחדל שלך לבדיקה: אזור זמן ישראל; ש״ח כשלא נצפה מטבע. בדקו לפני שמירה ושנו אם צריך. השעה המודפסת והתצפיות המקוריות נשמרות ללא שינוי. מקום לא מאושר אינו יוצר סיכה.' : 'Your review defaults: Israel timezone; ILS when no currency was observed. Check before saving and change if needed. Printed time and original observations remain unchanged. An unconfirmed location creates no pin.'}</p>}
    {receiptDraft && <section className={styles.receiptBlockers} data-testid="receipt-save-blockers" aria-labelledby="receipt-blocker-title" aria-live="polite"><h3 id="receipt-blocker-title">{blockers.length ? (locale === 'he' ? 'מה נותר לפני שמירה' : 'Remaining before saving') : (locale === 'he' ? 'פרטי החובה הושלמו · יש לבדוק ולשמור במפורש' : 'Required fields complete · review and explicitly save')}</h3>{blockers.length > 0 && <ul>{blockers.map(field => <li key={field} data-blocker-field={field}>{receiptBlockerLabel(field, locale === 'he')}</li>)}</ul>}<small>{locale === 'he' ? 'אפשר לשמור מיקום לא פתור ללא קואורדינטות וללא סיכה. אפשר לסמן אמצעי תשלום וקטגוריות במפורש כלא ידועים. תאריך, שעה, אזור זמן ויחידות חייבים להיות תקינים ולתאר את הרכישה.' : 'Unresolved location can save without coordinates or a pin. Payment and categories can explicitly be marked unknown. Date, time, timezone and units must be valid and describe the purchase.'}</small></section>}
    {receiptDraft && <section className={styles.receiptBlockers} data-testid="receipt-location-choice"><h3>{locale === 'he' ? 'מיקום הוא רשות' : 'Location is optional'}</h3><p>{locale === 'he' ? 'אפשר לשמור את הקבלה בלי סיכה ובלי קואורדינטות. להוספת סיכה, שמרו תחילה ואז בחרו חיפוש כתובת או אישור נקודה במפה. הכתובת שבדקתם תועבר זמנית לטופס המיקום.' : 'Save the receipt without a pin or coordinates. To add a pin, save first, then choose address search or map confirmation. Your reviewed address is carried temporarily into that form.'}</p><button type="button" className={styles.secondary} data-testid="review-save-unresolved" aria-pressed={input.channel === 'unknown' && !input.placeId} onClick={() => patch({ channel: 'unknown', placeId: '', directoryIntent: input.directoryIntent?.merchant ? { merchant: input.directoryIntent.merchant } : undefined })}>{locale === 'he' ? 'מיקום לא פתור · ללא סיכה' : 'Keep location unresolved · no pin'}</button></section>}
    <div className={styles.reviewColumns}><div className={styles.formGrid}>
      {!receiptDraft && catalogStores.some(isLocated) && <div className={`${styles.fullField} ${styles.storeLocation}`} data-testid="review-nearest-field">
        <button type="button" className={styles.secondary} data-testid="review-nearest" disabled={nearby.state === 'pending'} onClick={findNearest}>{nearby.state === 'pending' ? t.nearestPending : t.nearest}</button>
        <small role="status" data-testid="review-nearest-status">{nearby.state === 'found' ? t.nearestFound.replace('{store}', nearby.label!).replace('{m}', String(nearby.meters)) : nearby.state === 'none' ? t.nearestNone.replace('{radius}', String(NEAREST_STORE_METERS)) : nearby.state === 'failed' ? t.nearestFailed : ''}</small>
        {catalogIntent && suggestion && <label className={styles.suggestionCheck}><input type="checkbox" {...attrs('catalog-confirmed')} checked={suggestion.confirmed} onChange={e => patch({ directoryIntent: { ...input.directoryIntent!, locationSuggested: { confirmed: e.target.checked } } })} />{t.confirmSuggested}{error('catalog-confirmed')}</label>}
        <small>{t.nearestNote}</small>
      </div>}
      <label>{t.channel}<select {...attrs('channel')} value={input.channel} onChange={e => { const channel = e.target.value as PurchaseReviewInput['channel']; patchStore(current => ({ ...current, channel, placeId: '', ...(receiptDraft ? { directoryIntent: current.directoryIntent?.merchant ? { merchant: current.directoryIntent.merchant } : undefined } : { merchantId: '', directoryIntent: undefined }) })) }}><option value="">{t.required}</option>{(['physical', 'online', 'unknown'] as const).filter(key => !receiptDraft || key !== 'physical' || Boolean(input.placeId)).map(key => <option key={key} value={key}>{t[key]}</option>)}</select>{error('channel')}</label>
      {receiptDraft && <label>{t.merchantId}<select data-testid="receipt-store-choice" value={input.directoryIntent?.merchant ? NEW_STORE : input.placeId ? 'place:' + input.placeId : input.merchantId ? 'merchant:' + input.merchantId : ''} onChange={e => {
        const value = e.target.value
        if (value === NEW_STORE) { patch({ merchantId: '', placeId: '', channel: input.channel === 'online' ? 'online' : 'unknown', directoryIntent: { merchant: { name: observedMerchant, category: input.category, separate: false } } }); return }
        const chosenPlace = value.startsWith('place:') ? context.places.find(p => p.id === value.slice(6)) : undefined
        const chosenMerchant = context.merchants.find(m => m.id === (chosenPlace?.merchantId ?? (value.startsWith('merchant:') ? value.slice(9) : '')))
        patch({ merchantId: chosenMerchant?.id ?? '', placeId: chosenPlace?.id ?? '', channel: chosenPlace ? 'physical' : input.channel === 'online' ? 'online' : 'unknown', directoryIntent: undefined, category: input.category || chosenMerchant?.category || '' })
      }}><option value="">{t.required}</option>{(observedMerchant || input.directoryIntent?.merchant) && <option value={NEW_STORE}>{input.directoryIntent?.merchant?.name || observedMerchant} · {locale === 'he' ? 'מהקבלה' : 'from receipt'}</option>}{context.places.map(p => <option key={'place:' + p.id} value={'place:' + p.id}>{localized(p.name, locale)} · {localized(p.branch, locale)}</option>)}{context.merchants.map(m => <option key={'merchant:' + m.id} value={'merchant:' + m.id}>{localized(m.name, locale)}</option>)}</select>{error('merchantId')}</label>}
      {!receiptDraft && (!input.directoryIntent || catalogIntent) && (input.channel === 'physical' ? <label>{t.placeId}<select {...attrs('placeId')} value={catalogPlace ? catalogPlace.id : catalogIntent ? CATALOG + catalogIntent.id : input.placeId} onChange={e => choosePlace(e.target.value)}><option value="">{t.required}</option>{!receiptDraft && <option value={NEW_STORE}>{t.newStore}</option>}{context.places.map(p => <option key={p.id} value={p.id}>{localized(p.name, locale)} · {localized(p.branch, locale)}</option>)}{!receiptDraft && shownCatalogStores.length > 0 && <optgroup label={t.catalogGroup}>{shownCatalogStores.map(s => <option key={s.id} value={CATALOG + s.id}>{catalogChainNames[s.chain][locale]} · {s.name}</option>)}</optgroup>}</select>{error('placeId')}<small>{t.places}</small></label> : <label>{t.merchantId}<select {...attrs('merchantId')} value={input.merchantId} onChange={e => { const value = e.target.value; patchStore(current => value === NEW_STORE ? { ...current, setAside: undefined, placeId: '', ...(restoredStore(setAsideStore(current), false) ?? { merchantId: '', directoryIntent: { merchant: { name: '', category: '', separate: false } } }) } : { ...current, setAside: setAsideStore(current), merchantId: value, directoryIntent: undefined }) }}><option value="">{t.required}</option>{!receiptDraft && <option value={NEW_STORE}>{t.newStore}</option>}{context.merchants.map(m => <option key={m.id} value={m.id}>{localized(m.name, locale)}</option>)}</select>{error('merchantId')}</label>)}
      <div className={styles.fullField}><MerchantPlaceReview intent={catalogIntent ? undefined : input.directoryIntent} merchantId={input.merchantId} channel={input.channel} context={context} locale={locale} errors={shownErrors} observedName={observedMerchant} reviewedAddress={receiptAddress} receiptMode={Boolean(receiptDraft)} receiptCategory={input.category} onReceiptCategory={category => patch({ category, ...(input.directoryIntent?.merchant ? { directoryIntent: { ...input.directoryIntent, merchant: { ...input.directoryIntent.merchant, category } } } : {}) })} onReviewedAddress={setReceiptAddress} onChooseMerchant={merchantId => patchStore(current => ({ ...current, merchantId, placeId: '', directoryIntent: undefined }))} onChange={directoryIntent => patchStore(current => ({ ...current, directoryIntent, ...(receiptDraft && directoryIntent?.merchant ? { category: directoryIntent.merchant.category } : {}), ...(directoryIntent ? { placeId: '', ...(directoryIntent.merchant ? { merchantId: '' } : {}) } : { setAside: setAsideStore(current) }) }))} /></div>
      {!receiptDraft && <label>{t.date}<input {...attrs('date')} type="datetime-local" step="60" dir="ltr" value={utcToLocalInput(input.date)} onChange={e => patch({ date: localInputToUtc(e.target.value) })} />{error('date')}</label>}
      <label>{t.currency}<select {...attrs('currency')} value={input.currency} onChange={e => patch({ currency: e.target.value as PurchaseReviewInput['currency'], baseAmount: '' })}><option value="">{t.required}</option>{reviewCurrencies.map(c => <option key={c}>{c}</option>)}</select>{error('currency')}</label>
      <label>{t.payment}<select {...attrs('payment')} value={input.payment} onChange={e => patch({ payment: e.target.value as PurchaseReviewInput['payment'] })}><option value="">{t.required}</option>{(['card', 'cash', 'manual', 'unknown'] as const).map(p => <option key={p} value={p}>{p === 'unknown' ? t.unknownContext : t[p]}</option>)}</select>{error('payment')}</label>
      {!receiptDraft && <label>{t.category}<select {...attrs('category')} value={input.category} onChange={e => patch({ category: e.target.value as PurchaseReviewInput['category'] })}><option value="">{t.required}</option>{reviewCategories.map(c => <option key={c} value={c}>{c === 'unknown' ? t.unknownContext : t[c]}</option>)}</select>{error('category')}</label>}
      <label>{finalPayable ? (locale === 'he' ? 'סכום סופי לתשלום' : 'Final payable total') : t.amount}<input {...attrs('amount')} dir="ltr" inputMode="decimal" value={input.amount} onChange={e => patch({ amount: e.target.value })} />{error('amount')}</label>
      {input.provenance === 'user-reviewed' && input.currency && input.currency !== 'ILS' && <label>{t.baseAmount}<input {...attrs('baseAmount')} dir="ltr" inputMode="decimal" value={input.baseAmount} onChange={e => patch({ baseAmount: e.target.value })} />{error('baseAmount')}<small>{t.conversion}</small></label>}
      <div className={styles.fullField}><p>{input.lines.length ? t.total : t.noItems}</p>{input.lines.map((line, i) => <fieldset key={i} className={styles.reviewLine}><legend>{i + 1}. {line.name || t.name}</legend>
        <label>{t.name}<input {...attrs(`name-${i}`)} dir="auto" maxLength={100} value={line.name} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, name: e.target.value } : l) })} />{error(`name-${i}`)}</label>
        <label>{t.quantity}<input {...attrs(`quantity-${i}`)} dir="ltr" inputMode="decimal" value={line.quantity} onChange={e => patchLine(i, { quantity: e.target.value })} />{error(`quantity-${i}`)}</label>
        <label>{t.price}<input {...attrs(`price-${i}`)} dir="ltr" inputMode="decimal" value={line.price} onChange={e => patchLine(i, { price: e.target.value })} />{error(`price-${i}`)}</label>
        <label>{t.unit}<select {...attrs(`unit-${i}`)} value={line.unit} onChange={e => patchLine(i, { unit: e.target.value as 'item' | 'kg' })}>{receiptDraft && <option value="">{t.required}</option>}<option value="item">{t.item}</option><option value="kg">{t.kg}</option></select>{error(`unit-${i}`)}</label>
        {receiptDraft && <label>{receiptCopy[locale].amount}<input {...attrs(`printedAmount-${i}`)} dir="ltr" inputMode="decimal" value={'printedAmount' in line ? line.printedAmount : ''} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, printedAmount: e.target.value } : l) })} />{error(`printedAmount-${i}`)}</label>}
        <label className={styles.lineDiscount}>{t.discount}<input {...attrs(`discount-${i}`)} aria-required={false} aria-describedby={shownErrors[`discount-${i}`] ? `review-error-discount-${i}` : `review-discount-hint-${i}`} dir="ltr" inputMode="decimal" value={line.discount ?? '0'} onChange={e => patchLine(i, { discount: e.target.value })} /><small id={`review-discount-hint-${i}`}>{t.discountHint}</small>{error(`discount-${i}`)}</label>
        <output className={styles.lineNet} data-testid={`review-net-${i}`}>{t.net}: <bdi>{calculatedLine(line, input.currency) === null ? '—' : money(calculatedLine(line, input.currency)! / factor)}</bdi></output><button type="button" className={styles.secondary} onClick={() => patch({ lines: input.lines.filter((_, j) => j !== i) })}>{t.remove} {i + 1}</button>
      </fieldset>)}{error('lines')}{(() => {
        // The note follows the current store and only while the price is still the filled-in one.
        const storeId = catalogIntent?.id ?? catalogIdForPlace(place), fill = input.publishedFill
        return Boolean(fill?.price) && fill!.storeId === storeId && input.lines.length === 1 && input.lines[0].price === fill!.price && <small data-testid="review-price-filled">{t.priceFilled.replace('{price}', new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', { style: 'currency', currency: 'ILS' }).format(Number(fill!.price)))}</small>
      })()}<button type="button" className={styles.secondary} disabled={input.lines.length >= 50} onClick={() => patch({ lines: [...input.lines, receiptDraft ? { name: '', quantity: '', price: '', unit: '', printedAmount: '' } : { name: '', quantity: '', price: '', unit: 'item' }] })}>{t.addLine}</button></div>
    </div><aside className={styles.reviewSummary} aria-label={t.summary}><strong>{t.summary}</strong>{receiptDraft ? <div data-testid="receipt-context-summary">
      <p>{locale === 'he' ? 'חנות: ' : 'Store: '}<bdi dir="auto">{input.directoryIntent?.merchant ? input.directoryIntent.merchant.name || (locale === 'he' ? 'שם חסר' : 'Name missing') : merchant ? localized(merchant.name, locale) : observedMerchant || (locale === 'he' ? 'שם לא פתור' : 'Name unresolved')}</bdi>{!merchant && !input.directoryIntent && <small> · {locale === 'he' ? 'נצפה · נדרש אישור' : 'observed · confirmation required'}</small>}</p>
      <p>{locale === 'he' ? 'כתובת לבדיקה בלבד: ' : 'Address · draft only: '}<bdi dir="auto">{receiptAddress || (locale === 'he' ? 'לא פתורה' : 'Unresolved')}</bdi></p>
      <p>{input.channel ? t[input.channel] : (locale === 'he' ? 'ערוץ חסר' : 'Channel missing')}{input.channel === 'physical' && <span> · {place ? localized(place.branch, locale) : input.directoryIntent?.place?.branch || (locale === 'he' ? 'מקום דורש אישור' : 'Place confirmation required')}</span>}</p>
      <p>{locale === 'he' ? 'תאריך ושעה: ' : 'Date/time: '}<bdi>{input.date ? input.date.replace('T', ' ') + ' UTC' : receiptWall.replace('T', ' ') || [typeof receiptDraft.observations.date === 'string' ? receiptDraft.observations.date : (locale === 'he' ? 'תאריך חסר' : 'Date missing'), typeof receiptDraft.observations.time === 'string' ? receiptDraft.observations.time : (locale === 'he' ? 'שעה חסרה' : 'Time missing')].join(' · ')}</bdi>{!input.date && <small> · {locale === 'he' ? 'יש לאשר זמן ואזור זמן' : 'confirm time and timezone'}</small>}</p>
      <p>{t.currency}: {input.currency || (locale === 'he' ? 'חסר' : 'Missing')}</p><p>{t.payment}: {input.payment ? (input.payment === 'unknown' ? t.unknownContext : t[input.payment]) : (locale === 'he' ? 'דורש בחירה מפורשת' : 'Explicit choice required')}</p><p>{t.category}: {input.category ? (input.category === 'unknown' ? t.unknownContext : t[input.category]) : (locale === 'he' ? 'דורשת בחירה מפורשת' : 'Explicit choice required')}</p>
    </div> : <><p>{catalogIntent ? `${catalogChainNames[catalogIntent.chain][locale]} · ${catalogIntent.name}` : input.directoryIntent ? [input.directoryIntent.merchant?.name ?? (merchant ? localized(merchant.name, locale) : t.required), input.directoryIntent.place?.branch].filter(Boolean).join(' · ') : place ? `${localized(place.name, locale)} · ${localized(place.branch, locale)} · ${localized(place.city, locale)}` : merchant ? localized(merchant.name, locale) : t.required}</p><p>{input.channel ? t[input.channel] : t.required}</p><p><bdi>{utcToLocalInput(input.date).replace('T', ' ')}</bdi></p><p>{input.payment ? (input.payment === 'unknown' ? t.unknownContext : t[input.payment]) : t.required}</p></>}{finalPayable ? <ReceiptPayableSummary review itemMinor={itemMinor} payableMinor={minorAmount(input.amount, input.currency)} currency={input.currency} locale={locale} /> : <>{input.lines.length > 0 && <p>{t.total}: <bdi>{validLineTotals ? money(lineTotal) : '—'}</bdi></p>}<p>{t.amount}: <bdi>{money(Number(input.amount) || 0)}</bdi></p></>}{input.baseAmount && <p>{t.baseAmount}: <bdi>{input.baseAmount} ILS</bdi></p>}</aside></div>
    <p ref={status} role="status" aria-live="polite">{Object.keys(errors).length ? t.errors : message ? t[message] : ''}</p>
    </div>
    <div className={`${styles.actions} ${styles.stickyActions}`}><button type="submit" className={styles.primary} data-identification-method={input.identification?.method} data-testid={manualStep ? 'manual-review' : 'capture-confirm'}>{manualStep ? t.review : t.save}</button>{message === 'duplicate' && <button type="button" className={styles.secondary} data-testid="review-save-separate" onClick={() => submit(true)}>{t.again}</button>}<button type="button" className={styles.secondary} onClick={onOther}>{t.other}</button></div>
  </form>
}
