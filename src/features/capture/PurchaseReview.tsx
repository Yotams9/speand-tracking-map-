'use client'

import { useEffect, useRef, useState } from 'react'
import { localized, type LocaleCode } from '@/data/spendscape-globe'
import { catalogPlaceId, lineMinorTotal, reviewCategories, reviewCurrencies, validateReview, type PurchaseReviewInput, type ReviewContext, type ReviewErrors, type SaveReviewResult } from './session-purchase-domain'
import { catalogChoice, catalogIdForPlace, isLocated, loadCatalogStores, localInputToUtc, nearestCatalogStore, NEAREST_STORE_METERS, utcToLocalInput, withNowIfEmpty, withPublishedPrice, type LocatedCatalogStore } from './catalog-stores'
import type { CatalogStoreSummary } from '@/data/price-catalog'
import styles from './CaptureExperience.module.css'

const copy = {
  en: { title: 'Review your purchase', manualTitle: 'Quick Add', description: 'Check every detail before adding. It is saved on this device until you remove it.', demo: 'Built-in synthetic demo · review only', user: 'Details supplied by you · not independently verified', product: 'A barcode identifies a candidate only. It is not proof of purchase. No purchase or store is inferred. Product photos are not retained.', channel: 'Channel', physical: 'Physical place', online: 'Online purchase · no map pin', unknown: 'Unresolved place · no map pin', merchantId: 'Store', placeId: 'Store', unresolved: 'Store not identified', places: 'Choose a place, or add a new store. No location is inferred.', nearest: 'Find the store I’m in', nearestPending: 'Finding your location…', nearestFound: 'Nearest known store: {store}, about {m} m away. Change it below if that is wrong.', nearestNone: 'No known store within {radius} m. Choose from the list or add a new store.', nearestFailed: 'Location is unavailable here. Choose the store from the list.', nearestNote: 'Your location is read once when you press the button and is not saved. It only suggests a store; it is not proof of a purchase.', catalogGroup: 'Tel Aviv supermarkets', priceFilled: 'Published shelf price at this store: {price}. Filled in for you; change it if you paid a different price.', newStore: '＋ New store…', newStoreName: 'Store name', locate: 'Use my current location', locateAgain: 'Update to my current location', locating: 'Finding your location…', located: 'Location set', locationFailed: 'Location is unavailable here. Allow location access, or choose a channel without a map pin.', locationNote: 'Read once, only when you press the button, and kept on this device. It marks where you say the store is; it is not proof of a purchase.', date: 'Date and time', currency: 'Currency', payment: 'Payment context', category: 'Category', amount: 'Purchase total', baseAmount: 'Paid amount in ILS, reported by you', conversion: 'Enter the ILS amount you can confirm. If unknown, leave this as a draft. No exchange rate is looked up.', name: 'Item name', quantity: 'Quantity', price: 'Unit price', unit: 'Unit', item: 'Item', kg: 'kg', addLine: 'Add receipt item', remove: 'Remove item', total: 'Item total', cash: 'Cash', card: 'Card', manual: 'Manual payment', groceries: 'Groceries', food: 'Food', retail: 'Retail', travel: 'Travel', required: 'Choose…', save: 'Save purchase', review: 'Review purchase', other: 'Choose another source', errors: 'Check the highlighted fields.', duplicate: 'A purchase with the same details already exists. Add another only if this is a separate purchase.', again: 'Add a separate purchase with these details', consumed: 'This confirmation has already been used. Start a new purchase to add another.', summary: 'Review summary', noItems: 'Total-only manual purchase. Quantity and unit price apply when you add items.', close: 'Cancel',
    error: { required: 'Complete this field.', storeExists: 'A store with this name already exists. Choose it from the list.', location: 'Set the store location, or choose a channel without a map pin.', amount: 'Enter a positive decimal amount in this currency’s precision (up to 9,999,999).', quantity: 'Enter a positive quantity: whole items or kg with up to 3 decimals.', date: 'Enter a valid date and time between 1900 and 2100.', place: 'Choose a store from the list, or a channel without a map pin.', conversion: 'Enter the ILS amount you can confirm.', arithmetic: 'The purchase total must equal the rounded item totals.', items: 'Provide 1–50 valid items.', barcode: 'The barcode identity is invalid.' } },
  he: { title: 'בדיקת פרטי הרכישה', manualTitle: 'הוספה מהירה', description: 'בדקו את כל הפרטים לפני ההוספה. הרכישה נשמרת במכשיר הזה עד שתסירו אותה.', demo: 'הדגמה סינתטית מובנית · לבדיקה בלבד', user: 'פרטים שסופקו על ידך · ללא אימות עצמאי', product: 'ברקוד מזהה מועמד בלבד. אין הסקת רכישה או חנות. תמונות מוצר אינן נשמרות.', channel: 'ערוץ', physical: 'מקום פיזי', online: 'רכישה מקוונת · ללא סיכה במפה', unknown: 'מקום לא פתור · ללא סיכה במפה', merchantId: 'חנות', placeId: 'חנות', unresolved: 'חנות לא מזוהה', places: 'בחרו מקום או הוסיפו חנות חדשה. אין הסקת מיקום.', nearest: 'מצאו את החנות שבה אני נמצא', nearestPending: 'מאתרים את המיקום…', nearestFound: 'החנות המוכרת הקרובה: {store}, כ־{m} מ׳ ממך. אם זה לא נכון, שנו למטה.', nearestNone: 'אין חנות מוכרת ברדיוס {radius} מ׳. בחרו מהרשימה או הוסיפו חנות חדשה.', nearestFailed: 'המיקום אינו זמין כאן. בחרו את החנות מהרשימה.', nearestNote: 'המיקום נקרא פעם אחת בלחיצה ואינו נשמר. הוא רק מציע חנות ואינו הוכחה לרכישה.', catalogGroup: 'סופרמרקטים בתל אביב', priceFilled: 'מחיר המדף המפורסם בחנות הזו: {price}. מילאנו אותו בשבילכם; שנו אם שילמתם מחיר אחר.', newStore: '＋ חנות חדשה…', newStoreName: 'שם החנות', locate: 'שימוש במיקום הנוכחי שלי', locateAgain: 'עדכון למיקום הנוכחי שלי', locating: 'מאתרים את המיקום…', located: 'המיקום נקבע', locationFailed: 'המיקום אינו זמין כאן. אפשרו גישה למיקום, או בחרו ערוץ ללא סיכה במפה.', locationNote: 'המיקום נקרא פעם אחת, רק בלחיצה על הכפתור, ונשמר במכשיר הזה. הוא מסמן היכן לדבריך נמצאת החנות ואינו הוכחה לרכישה.', date: 'תאריך ושעה', currency: 'מטבע', payment: 'אמצעי תשלום', category: 'קטגוריה', amount: 'סכום הרכישה', baseAmount: 'סכום ששולם בש״ח, לפי הדיווח שלך', conversion: 'הזינו סכום בש״ח שאפשר לאשר. אם אינו ידוע, השאירו טיוטה. לא מתבצע חיפוש שער מטבע.', name: 'שם פריט', quantity: 'כמות', price: 'מחיר יחידה', unit: 'יחידה', item: 'פריט', kg: 'ק״ג', addLine: 'הוספת פריט לקבלה', remove: 'הסרת פריט', total: 'סכום הפריטים', cash: 'מזומן', card: 'כרטיס', manual: 'תשלום ידני', groceries: 'מכולת', food: 'אוכל', retail: 'קמעונאות', travel: 'נסיעות', required: 'בחירה…', save: 'שמירת הרכישה', review: 'בדיקת הרכישה', other: 'בחירת מקור אחר', errors: 'בדקו את השדות המסומנים.', duplicate: 'כבר קיימת רכישה עם אותם פרטים. הוסיפו שוב רק אם זו רכישה נפרדת.', again: 'הוספת רכישה נפרדת עם אותם פרטים', consumed: 'האישור הזה כבר נוצל. להוספה נוספת יש להתחיל רכישה חדשה.', summary: 'סיכום לבדיקה', noItems: 'רכישה ידנית בסכום כולל. כמות ומחיר יחידה נדרשים בהוספת פריטים.', close: 'ביטול',
    error: { required: 'יש להשלים את השדה.', storeExists: 'כבר קיימת חנות בשם הזה. בחרו אותה מהרשימה.', location: 'קבעו את מיקום החנות, או בחרו ערוץ ללא סיכה במפה.', amount: 'יש להזין סכום עשרוני חיובי בדיוק המטבע (עד 9,999,999).', quantity: 'יש להזין כמות חיובית: פריטים שלמים או ק״ג עד 3 ספרות עשרוניות.', date: 'יש להזין תאריך ושעה תקינים בין 1900 ל־2100.', place: 'יש לבחור חנות מהרשימה, או ערוץ ללא סיכה במפה.', conversion: 'יש להזין סכום בש״ח שניתן לאשר.', arithmetic: 'סכום הרכישה חייב להתאים לסכום שורות הפריטים המעוגלות.', items: 'יש לספק 1–50 פריטים תקינים.', barcode: 'זיהוי הברקוד אינו תקין.' } },
} as const

const NEW_STORE = '__new_store__'
const CATALOG = 'catalog:'

export function PurchaseReview({ initial, locale, context, offered, manualStep, onReviewed, onSave, onOther }: {
  initial: PurchaseReviewInput; locale: LocaleCode; context: ReviewContext; offered?: ReviewContext; manualStep: boolean
  onReviewed: () => void; onSave: (input: PurchaseReviewInput, allowDuplicate: boolean) => SaveReviewResult; onOther: () => void
}) {
  const [input, setInput] = useState(initial), [errors, setErrors] = useState<ReviewErrors>({}), [message, setMessage] = useState<'duplicate' | 'consumed' | null>(null)
  const form = useRef<HTMLFormElement>(null), heading = useRef<HTMLHeadingElement>(null), saving = useRef(false)
  const [locating, setLocating] = useState<'idle' | 'pending' | 'failed'>('idle')
  const [catalogStores, setCatalogStores] = useState<CatalogStoreSummary[]>([])
  const [nearby, setNearby] = useState<{ state: 'idle' | 'pending' | 'found' | 'none' | 'failed'; label?: string; meters?: number }>({ state: 'idle' })
  const t = copy[locale]
  // The lists show the offered stores plus whatever is already chosen; validation uses the full context.
  const offeredPlaces = offered ? context.places.filter(p => p.id === input.placeId || offered.places.some(o => o.id === p.id)) : context.places
  const offeredMerchants = offered ? context.merchants.filter(m => m.id === input.merchantId || offered.merchants.some(o => o.id === m.id)) : context.merchants
  useEffect(() => { let live = true; loadCatalogStores().then(stores => { if (live) setCatalogStores(stores) }).catch(() => {}); return () => { live = false } }, [])
  const shownCatalogStores = catalogStores.filter(isLocated).filter(store => !context.places.some(p => p.id === catalogPlaceId(store.id)))
  const withCatalogStore = (current: PurchaseReviewInput, store: LocatedCatalogStore): PurchaseReviewInput => {
    const existing = context.places.find(p => p.id === catalogPlaceId(store.id))
    const chosen = existing ? { ...current, newStore: undefined, catalogStore: undefined, placeId: existing.id, merchantId: existing.merchantId } : { ...current, newStore: undefined, placeId: '', merchantId: '', catalogStore: catalogChoice(store) }
    return withPublishedPrice(chosen, store.id)
  }
  // The device location is read only on this press, to suggest the closest known store.
  const findNearest = () => {
    if (!('geolocation' in navigator)) { setNearby({ state: 'failed' }); return }
    setNearby({ state: 'pending' })
    navigator.geolocation.getCurrentPosition(position => {
      const found = nearestCatalogStore(catalogStores, [position.coords.longitude, position.coords.latitude])
      if (!found) { setNearby({ state: 'none' }); return }
      setNearby({ state: 'found', label: `${found.store.chainName[locale]} · ${found.store.name}`, meters: Math.round(found.meters) })
      setErrors({}); setMessage(null)
      // Being in the store now makes "now" and groceries the sensible defaults; both stay editable.
      setInput(current => withCatalogStore(withNowIfEmpty({ ...current, channel: 'physical', category: current.category || 'groceries' }), found.store))
    }, () => setNearby({ state: 'failed' }), { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
  }
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [manualStep])
  const patch = (value: Partial<PurchaseReviewInput>) => { setInput(current => ({ ...current, ...value })); setErrors({}); setMessage(null) }
  // The device location is read only on this explicit press, for a store the user is naming.
  const locate = () => {
    if (!('geolocation' in navigator)) { setLocating('failed'); return }
    setLocating('pending')
    navigator.geolocation.getCurrentPosition(position => {
      setLocating('idle'); setErrors({})
      setInput(current => current.newStore ? { ...current, newStore: { ...current.newStore, coordinates: [position.coords.longitude, position.coords.latitude] } } : current)
    }, () => setLocating('failed'), { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 })
  }
  const blankStore = { name: '', coordinates: null }
  const errorText = (field: string) => errors[field] ? t.error[errors[field] as keyof typeof t.error] ?? t.error.required : null
  const attrs = (field: string) => ({ id: `review-${field}`, 'data-testid': `review-${field}`, 'aria-invalid': Boolean(errors[field]), 'aria-required': true, 'aria-describedby': errors[field] ? `review-error-${field}` : undefined })
  const error = (field: string) => errorText(field) && <small className={styles.fieldError} id={`review-error-${field}`}>{errorText(field)}</small>
  const submit = (allowDuplicate = false) => {
    if (saving.current) return
    const nextErrors = validateReview(input, context)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    if (manualStep) { onReviewed(); return }
    saving.current = true
    const result = onSave(input, allowDuplicate)
    if (result.code !== 'saved') {
      saving.current = false
      if (result.code === 'invalid') setErrors(result.errors)
      else setMessage(result.code)
    }
  }
  const factor = input.currency === 'JPY' ? 1 : 100
  const lineTotal = input.lines.reduce((sum, line) => sum + (lineMinorTotal(line, input.currency) ?? 0), 0) / factor
  const money = (amount: number) => input.currency ? new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', { style: 'currency', currency: input.currency }).format(amount) : '—'
  const merchant = context.merchants.find(m => m.id === input.merchantId)
  const place = context.places.find(p => p.id === input.placeId)
  return <form ref={form} noValidate autoComplete="off" className={`${styles.review} ${styles.purchaseReview}`} data-identification-method={input.identification?.method} data-testid={manualStep ? 'capture-manual' : 'capture-review'} onSubmit={event => { event.preventDefault(); submit() }}>
    <div className={styles.reviewScroll}>
    <div className={styles.stageCopy}><p className={styles.kicker}>{input.provenance === 'synthetic-demo' ? t.demo : t.user}</p><h2 id="capture-title" ref={heading} tabIndex={-1}>{manualStep ? t.manualTitle : t.title}</h2><p id="capture-description">{t.description}</p><small>{locale === 'he' ? 'כל שדות הפרטים המוצגים הם חובה. הוספת פריטים לרכישה ידנית היא רשות.' : 'All displayed detail fields are required. Items are optional for a total-only manual purchase.'}</small></div>
    {(input.identification || input.source === 'product' || input.source === 'barcode') && <div className={styles.truthCallout} data-testid="product-proof-boundary"><p>{t.product}</p><bdi dir="ltr">{input.identification?.identity.original}</bdi>{input.identification?.syntheticCatalog && <p>{t.demo}</p>}</div>}
    <div className={styles.reviewColumns}><div className={styles.formGrid}>
      {catalogStores.some(isLocated) && <div className={`${styles.fullField} ${styles.storeLocation}`} data-testid="review-nearest-field">
        <button type="button" className={styles.secondary} data-testid="review-nearest" disabled={nearby.state === 'pending'} onClick={findNearest}>{nearby.state === 'pending' ? t.nearestPending : t.nearest}</button>
        <small role="status" data-testid="review-nearest-status">{nearby.state === 'found' ? t.nearestFound.replace('{store}', nearby.label!).replace('{m}', String(nearby.meters)) : nearby.state === 'none' ? t.nearestNone.replace('{radius}', String(NEAREST_STORE_METERS)) : nearby.state === 'failed' ? t.nearestFailed : ''}</small>
        <small>{t.nearestNote}</small>
      </div>}
      <label>{t.channel}<select {...attrs('channel')} value={input.channel} onChange={e => patch({ channel: e.target.value as PurchaseReviewInput['channel'], placeId: '', merchantId: '', catalogStore: undefined })}><option value="">{t.required}</option>{(['physical', 'online', 'unknown'] as const).map(key => <option key={key} value={key}>{t[key]}</option>)}</select>{error('channel')}</label>
      {input.channel === 'physical' ? <label>{t.placeId}<select {...attrs('placeId')} value={input.newStore ? NEW_STORE : input.catalogStore ? CATALOG + input.catalogStore.id : input.placeId} onChange={e => {
        const value = e.target.value
        setNearby({ state: 'idle' })
        if (value === NEW_STORE) { patch({ placeId: '', merchantId: '', newStore: input.newStore ?? blankStore, catalogStore: undefined }); return }
        const store = value.startsWith(CATALOG) ? shownCatalogStores.find(s => s.id === value.slice(CATALOG.length)) : undefined
        // Picking a chain store means shopping there: an empty date becomes now (still editable).
        if (store) { setErrors({}); setMessage(null); setInput(current => withCatalogStore(withNowIfEmpty({ ...current, category: current.category || 'groceries' }), store)); return }
        const p = context.places.find(p => p.id === value)
        setErrors({}); setMessage(null)
        const chainStoreId = p ? catalogIdForPlace(p.id) : null
        setInput(current => { const chosen = { ...current, placeId: p?.id ?? '', merchantId: p?.merchantId ?? '', newStore: undefined, catalogStore: undefined }; return withPublishedPrice(chainStoreId ? withNowIfEmpty(chosen) : chosen, chainStoreId) })
      }}><option value="">{t.required}</option><option value={NEW_STORE}>{t.newStore}</option>{offeredPlaces.map(p => <option key={p.id} value={p.id}>{localized(p.name, locale)} · {localized(p.branch, locale)}</option>)}{shownCatalogStores.length > 0 && <optgroup label={t.catalogGroup}>{shownCatalogStores.map(s => <option key={s.id} value={CATALOG + s.id}>{s.chainName[locale]} · {s.name}</option>)}</optgroup>}</select>{error('placeId')}<small>{t.places}</small></label> : <label>{t.merchantId}<select {...attrs('merchantId')} value={input.newStore ? NEW_STORE : input.merchantId} onChange={e => patch(e.target.value === NEW_STORE ? { merchantId: '', placeId: '', newStore: input.newStore ?? blankStore } : { merchantId: e.target.value, newStore: undefined })}><option value="">{t.required}</option><option value={NEW_STORE}>{t.newStore}</option>{offeredMerchants.map(m => <option key={m.id} value={m.id}>{localized(m.name, locale)}</option>)}</select>{error('merchantId')}</label>}
      {input.newStore && <label>{t.newStoreName}<input {...attrs('newStoreName')} dir="auto" maxLength={60} value={input.newStore.name} onChange={e => patch({ newStore: { ...input.newStore!, name: e.target.value } })} />{error('newStoreName')}</label>}
      {input.newStore && input.channel === 'physical' && <div className={`${styles.fullField} ${styles.storeLocation}`} data-testid="review-newStoreLocation-field">
        <button type="button" className={styles.secondary} id="review-newStoreLocation" data-testid="review-newStoreLocation" aria-invalid={Boolean(errors.newStoreLocation)} aria-describedby={errors.newStoreLocation ? 'review-error-newStoreLocation' : undefined} disabled={locating === 'pending'} onClick={locate}>{locating === 'pending' ? t.locating : input.newStore.coordinates ? t.locateAgain : t.locate}</button>
        {error('newStoreLocation')}
        <small role="status" data-testid="review-newStoreLocation-status">{input.newStore.coordinates ? <>{t.located} · <bdi dir="ltr">{input.newStore.coordinates[1].toFixed(4)}, {input.newStore.coordinates[0].toFixed(4)}</bdi></> : locating === 'failed' ? t.locationFailed : ''}</small>
        <small>{t.locationNote}</small>
      </div>}
      <label>{t.date}<input {...attrs('date')} type="datetime-local" step="60" dir="ltr" value={utcToLocalInput(input.date)} onChange={e => patch({ date: localInputToUtc(e.target.value) })} />{error('date')}</label>
      <label>{t.currency}<select {...attrs('currency')} value={input.currency} onChange={e => patch({ currency: e.target.value as PurchaseReviewInput['currency'], baseAmount: '' })}><option value="">{t.required}</option>{reviewCurrencies.map(c => <option key={c}>{c}</option>)}</select>{error('currency')}</label>
      <label>{t.payment}<select {...attrs('payment')} value={input.payment} onChange={e => patch({ payment: e.target.value as PurchaseReviewInput['payment'] })}><option value="">{t.required}</option>{(['card', 'cash', 'manual'] as const).map(p => <option key={p} value={p}>{t[p]}</option>)}</select>{error('payment')}</label>
      <label>{t.category}<select {...attrs('category')} value={input.category} onChange={e => patch({ category: e.target.value as PurchaseReviewInput['category'] })}><option value="">{t.required}</option>{reviewCategories.map(c => <option key={c} value={c}>{t[c]}</option>)}</select>{error('category')}</label>
      <label>{t.amount}<input {...attrs('amount')} dir="ltr" inputMode="decimal" value={input.amount} onChange={e => patch({ amount: e.target.value })} />{error('amount')}</label>
      {input.provenance === 'user-reviewed' && input.currency && input.currency !== 'ILS' && <label>{t.baseAmount}<input {...attrs('baseAmount')} dir="ltr" inputMode="decimal" value={input.baseAmount} onChange={e => patch({ baseAmount: e.target.value })} />{error('baseAmount')}<small>{t.conversion}</small></label>}
      <div className={styles.fullField}><p>{input.lines.length ? t.total : t.noItems}</p>{input.lines.map((line, i) => <fieldset key={i} className={styles.reviewLine}><legend>{i + 1}. {line.name || t.name}</legend>
        <label>{t.name}<input {...attrs(`name-${i}`)} dir="auto" maxLength={100} value={line.name} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, name: e.target.value } : l) })} />{error(`name-${i}`)}</label>
        <label>{t.quantity}<input {...attrs(`quantity-${i}`)} dir="ltr" inputMode="decimal" value={line.quantity} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l) })} />{error(`quantity-${i}`)}</label>
        <label>{t.price}<input {...attrs(`price-${i}`)} dir="ltr" inputMode="decimal" value={line.price} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, price: e.target.value } : l) })} />{error(`price-${i}`)}</label>
        <label>{t.unit}<select value={line.unit} onChange={e => patch({ lines: input.lines.map((l, j) => j === i ? { ...l, unit: e.target.value as 'item' | 'kg' } : l) })}><option value="item">{t.item}</option><option value="kg">{t.kg}</option></select></label>
        <output>{money((lineMinorTotal(line, input.currency) ?? 0) / factor)}</output><button type="button" className={styles.secondary} onClick={() => patch({ lines: input.lines.filter((_, j) => j !== i) })}>{t.remove} {i + 1}</button>
      </fieldset>)}{error('lines')}{(() => {
        const storeId = input.catalogStore?.id ?? catalogIdForPlace(input.placeId)
        const price = storeId ? input.catalogPrices?.[storeId] : undefined
        return price !== undefined && input.lines.length === 1 && input.lines[0].price === price.toFixed(2) && <small data-testid="review-price-filled">{t.priceFilled.replace('{price}', new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', { style: 'currency', currency: 'ILS' }).format(price))}</small>
      })()}<button type="button" className={styles.secondary} disabled={input.lines.length >= 50} onClick={() => patch({ lines: [...input.lines, { name: '', quantity: '', price: '', unit: 'item' }] })}>{t.addLine}</button></div>
    </div><aside className={styles.reviewSummary} aria-label={t.summary}><strong>{t.summary}</strong><p>{input.newStore ? input.newStore.name.trim() || t.required : input.catalogStore ? `${input.catalogStore.chainName[locale]} · ${input.catalogStore.name}` : place ? `${localized(place.name, locale)} · ${localized(place.branch, locale)} · ${localized(place.city, locale)}` : merchant ? localized(merchant.name, locale) : t.required}</p><p>{input.channel ? t[input.channel] : t.required}</p><p><bdi>{utcToLocalInput(input.date).replace('T', ' ')}</bdi></p><p>{input.payment ? t[input.payment] : t.required}</p>{input.lines.length > 0 && <p>{t.total}: <bdi>{money(lineTotal)}</bdi></p>}<p>{t.amount}: <bdi>{money(Number(input.amount) || 0)}</bdi></p>{input.baseAmount && <p>{t.baseAmount}: <bdi>{input.baseAmount} ILS</bdi></p>}</aside></div>
    <p role="status" aria-live="polite">{Object.keys(errors).length ? t.errors : message ? t[message] : ''}</p>
    </div>
    <div className={`${styles.actions} ${styles.stickyActions}`}><button type="submit" className={styles.primary} data-identification-method={input.identification?.method} data-testid={manualStep ? 'manual-review' : 'capture-confirm'}>{manualStep ? t.review : t.save}</button>{message === 'duplicate' && <button type="button" className={styles.secondary} data-testid="review-save-separate" onClick={() => submit(true)}>{t.again}</button>}<button type="button" className={styles.secondary} onClick={onOther}>{t.other}</button></div>
  </form>
}
