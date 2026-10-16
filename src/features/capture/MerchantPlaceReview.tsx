'use client'
import { useEffect, useRef, useState } from 'react'
import { locationRequests } from './location-request'
import type { DirectoryIntent } from '../local-purchases/local-directory'
import type { ReviewContext, ReviewErrors, PurchaseReviewInput } from './session-purchase-domain'
import type { LocaleCode } from '../../data/spendscape-globe'
import styles from './CaptureExperience.module.css'
const blankPlace = () => ({ branch: '', city: '', country: '', address: '', longitude: '', latitude: '', confirmed: false, separate: false })
export function MerchantPlaceReview({ intent, merchantId, channel, context, locale, errors, onChange, onChooseMerchant, observedName = '', reviewedAddress = '', receiptMode = false, receiptCategory = '', onReceiptCategory, onReviewedAddress }: {
  intent?: DirectoryIntent; merchantId: string; channel: string; context: ReviewContext; locale: LocaleCode; errors: ReviewErrors; onChange: (intent?: DirectoryIntent) => void; onChooseMerchant: (id: string) => void; observedName?: string; reviewedAddress?: string; receiptMode?: boolean; receiptCategory?: PurchaseReviewInput['category']; onReceiptCategory?: (category: PurchaseReviewInput['category']) => void; onReviewedAddress?: (address: string) => void
}) {
  const he = locale === 'he'
  const [locating, setLocating] = useState<'idle' | 'pending' | 'failed'>('idle')
  // The location can arrive seconds later: apply it to the latest form, not the one at the press.
  const latest = useRef(intent), latestChange = useRef(onChange)
  latest.current = intent; latestChange.current = onChange
  const labels = he ? { merchantName: 'שם החנות', merchantCategory: 'קטגוריית החנות', branch: 'שם הסניף', city: 'עיר', country: 'מדינה', address: 'כתובת שאישרת (רשות)', longitude: 'קו אורך', latitude: 'קו רוחב' } : { merchantName: 'Store name', merchantCategory: 'Store category', branch: 'Branch name', city: 'City', country: 'Country', address: 'Reviewed address (optional)', longitude: 'Longitude', latitude: 'Latitude' }
  const errorText = (field: string) => errors[field] === 'duplicate' ? (he ? 'כבר קיים שם או מקום דומה. בחרו בו או אשרו שמדובר בישות נפרדת.' : 'A similar name or place exists. Reuse it or confirm this is a separate entity.') : errors[field] === 'coordinate' ? (he ? 'הזינו קו אורך בין ‎-180 ל־180 וקו רוחב בין ‎-90 ל־90.' : 'Enter longitude between -180 and 180 and latitude between -90 and 90.') : errors[field] === 'location' ? (he ? 'יש לאשר במפורש את המיקום.' : 'Explicitly confirm this location.') : (he ? 'יש להשלים את השדה.' : 'Complete this field.')
  const attrs = (field: string) => ({ id: `review-${field}`, 'data-testid': `review-${field}`, 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `review-error-${field}` : undefined })
  const error = (field: string) => errors[field] && <small className={styles.fieldError} id={`review-error-${field}`}>{errorText(field)}</small>
  const merchant = context.merchants.find(m => m.id === merchantId)
  const proposedPlace = () => ({ ...blankPlace(), branch: intent?.merchant?.name || (merchant ? merchant.name[locale] : observedName), address: reviewedAddress })
  // The device location is read once, only on this press. It fills editable
  // coordinates; the place is still saved only after the explicit confirmation.
  // A fix that arrives after the person typed coordinates, or after the form
  // closed, is stale and ignored (cf. Shon's 31f271d).
  const reads = useRef(locationRequests())
  useEffect(() => () => reads.current.cancel(), [])
  const locate = () => {
    if (!intent?.place || !('geolocation' in navigator)) { setLocating('failed'); return }
    setLocating('pending')
    const request = reads.current.start(), pressed = { longitude: intent.place.longitude, latitude: intent.place.latitude }
    navigator.geolocation.getCurrentPosition(position => {
      if (!reads.current.isCurrent(request)) return
      setLocating('idle')
      const current = latest.current
      if (current?.place && current.place.longitude === pressed.longitude && current.place.latitude === pressed.latitude) latestChange.current({ ...current, place: { ...current.place, longitude: position.coords.longitude.toFixed(6), latitude: position.coords.latitude.toFixed(6), confirmed: false, separate: false } })
    }, () => { if (reads.current.isCurrent(request)) setLocating('failed') }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 })
  }
  return <fieldset className={styles.directoryReview} data-testid="merchant-place-review"><legend>{he ? 'חנות ומיקום במכשיר הזה' : 'Store and place on this device'}</legend>
    <p>{receiptMode ? (he ? 'אין צורך במיקום כדי לשמור. שם החנות והכתובת מולאו לבדיקה; סיכה דורשת אישור מיקום נפרד לאחר שמירה.' : 'Location is not needed to save. Store name and address are filled for review; a pin requires separate location confirmation after saving.') : he ? 'אין הסקת מיקום. מקום חדש דורש פרטים וקואורדינטות שתאשרו. אם אינם ידועים, בחרו מקום לא פתור ללא סיכה.' : 'No location is inferred. A new place needs details and coordinates you confirm. If unknown, choose unresolved with no pin.'}</p>
    {receiptMode && <label>{he ? 'כתובת מהקבלה · לבדיקה ואישור מיקום' : 'Receipt address · review before confirming a location'}<input data-testid="receipt-address-review" dir="auto" maxLength={500} value={reviewedAddress} onChange={e => onReviewedAddress?.(e.target.value)} /><small>{he ? 'הכתובת מולאה מהקבלה וניתנת לתיקון. לאחר שמירה היא תועבר לטופס אישור המיקום; סיכה תתווסף רק לאחר אישור נקודה במפה.' : 'Prefilled from the receipt and editable. After saving, it carries into location confirmation; a pin is added only after you confirm a map point.'}</small></label>}
    {receiptMode && !intent?.merchant && <label>{he ? 'קטגוריה' : 'Category'}<select {...attrs('category')} value={receiptCategory} onChange={e => onReceiptCategory?.(e.target.value as PurchaseReviewInput['category'])}><option value="">{he ? 'בחירה…' : 'Choose…'}</option>{(['groceries','food','retail','travel','unknown'] as const).map((v,i)=><option key={v} value={v}>{he ? ['מכולת','אוכל','קמעונאות','נסיעות','לא ידוע'][i] : v === 'unknown' ? 'Unknown' : v}</option>)}</select>{error('category')}</label>}
    {!intent ? <div className={styles.directoryActions}>
      {!receiptMode && channel === 'physical' && <label>{he ? 'חנות קיימת לסניף חדש' : 'Existing store for a new branch'}<select data-testid="review-branch-merchant" value={merchantId} onChange={e => onChooseMerchant(e.target.value)}><option value="">{he ? 'בחירה…' : 'Choose…'}</option>{context.merchants.filter(m => !m.onlineOnly).map(m => <option key={m.id} value={m.id}>{m.name[locale]}</option>)}</select></label>}
      <button type="button" data-testid="review-new-merchant" onClick={() => onChange({ merchant: { name: observedName, category: '', separate: false }, ...(!receiptMode && channel === 'physical' ? { place: proposedPlace() } : {}) })}>{observedName ? (he ? 'בדיקה והוספה של החנות שנצפתה' : 'Review and create the observed store') : (he ? 'הוספת חנות חדשה' : 'Create a new store')}</button>
      {!receiptMode && channel === 'physical' && merchant && !merchant.onlineOnly && <button type="button" data-testid="review-new-branch" onClick={() => onChange({ place: proposedPlace() })}>{he ? 'הוספת סניף לחנות הנבחרת' : 'Add a branch to the selected store'}</button>}
    </div> : <>
      <button type="button" onClick={() => onChange()}>{he ? 'חזרה לבחירת חנות ומקום קיימים' : 'Use an existing store and place'}</button>
      {intent.merchant && <>
        {observedName && <p>{he ? 'השם שנצפה מולא לבדיקה. יש לאשר אותו ואת קטגוריית החנות לפני שמירה; אין התאמה אוטומטית לחנות קיימת.' : 'The observed name is filled for review. Confirm it and the store category before saving; no existing store is matched automatically.'}</p>}
        <label>{labels.merchantName}<input {...attrs('merchantName')} dir="auto" maxLength={100} value={intent.merchant.name} onChange={e => onChange({ ...intent, merchant: { ...intent.merchant!, name: e.target.value, separate: false } })} />{error('merchantName')}</label>
        <label>{labels.merchantCategory}<select {...attrs('merchantCategory')} value={intent.merchant.category} onChange={e => onChange({ ...intent, merchant: { ...intent.merchant!, category: e.target.value as typeof intent.merchant.category } })}><option value="">{he ? 'בחירה…' : 'Choose…'}</option>{(['groceries','food','retail','travel','unknown'] as const).map((v,i)=><option key={v} value={v}>{he ? ['מכולת','אוכל','קמעונאות','נסיעות','לא ידוע'][i] : v === 'unknown' ? 'Unknown' : v}</option>)}</select>{error('merchantCategory')}</label>
        <label className={styles.directoryCheck}><input type="checkbox" {...attrs('merchantSeparate')} checked={intent.merchant.separate} onChange={e => onChange({ ...intent, merchant: { ...intent.merchant!, separate: e.target.checked } })} />{he ? 'זו חנות נפרדת, גם אם קיים שם דומה' : 'This is a separate store, even if a similar name exists'}{error('merchantSeparate')}</label>
      </>}
      {!receiptMode && channel === 'physical' && !intent.place && <button type="button" data-testid="review-create-place" onClick={() => onChange({ ...intent, place: proposedPlace() })}>{he ? 'הוספת מקום מאושר לחנות' : 'Add a confirmed place for this store'}</button>}
      {!receiptMode && intent.place && <>
        <div className={styles.directoryFields}>{(['branch','city','country','address','longitude','latitude'] as const).map(k=><label key={k}>{labels[k]}<input {...attrs(`place-${k}`)} dir={k === 'longitude' || k === 'latitude' ? 'ltr' : 'auto'} inputMode={k === 'longitude' || k === 'latitude' ? 'decimal' : 'text'} maxLength={100} value={intent.place![k]} onChange={e => onChange({ ...intent, place: { ...intent.place!, [k]: e.target.value, confirmed: false, separate: false } })} />{error(`place-${k}`)}</label>)}</div>
        <div className={styles.storeLocation} data-testid="review-place-locate-field">
          <button type="button" className={styles.secondary} data-testid="review-place-locate" disabled={locating === 'pending'} onClick={locate}>{locating === 'pending' ? (he ? 'מאתרים את המיקום…' : 'Finding your location…') : (he ? 'שימוש במיקום הנוכחי שלי' : 'Use my current location')}</button>
          <small role="status">{locating === 'failed' ? (he ? 'המיקום אינו זמין כאן. הזינו קואורדינטות, או בחרו ערוץ ללא סיכה במפה.' : 'Location is unavailable here. Enter coordinates, or choose a channel without a map pin.') : ''}</small>
          <small>{he ? 'המיקום נקרא פעם אחת, רק בלחיצה, וממלא את הקואורדינטות לעריכה. הוא מסמן היכן לדבריך נמצאת החנות ואינו הוכחה לרכישה.' : 'Read once, only when you press the button, into the editable coordinates. It marks where you say the store is; it is not proof of a purchase.'}</small>
        </div>
        <label className={styles.directoryCheck}><input type="checkbox" {...attrs('place-confirmed')} checked={intent.place.confirmed} onChange={e => onChange({ ...intent, place: { ...intent.place!, confirmed: e.target.checked } })} />{he ? 'אני מאשר/ת שהפרטים והקואורדינטות שהזנתי מתארים את מקום הרכישה' : 'I confirm these manually entered details and coordinates describe the purchase place'}{error('place-confirmed')}</label>
        <label className={styles.directoryCheck}><input type="checkbox" {...attrs('place-separate')} checked={intent.place.separate} onChange={e => onChange({ ...intent, place: { ...intent.place!, separate: e.target.checked } })} />{he ? 'זה מקום נפרד, גם אם קיים סניף או מיקום דומה' : 'This is a separate place, even if a similar branch or location exists'}{error('place-separate')}</label>
      </>}
      {error('directory')}
    </>}
  </fieldset>
}
