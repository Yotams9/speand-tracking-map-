'use client'
import type { DirectoryIntent } from '../local-purchases/local-directory'
import type { ReviewContext, ReviewErrors } from './session-purchase-domain'
import type { LocaleCode } from '../../data/spendscape-globe'
import styles from './CaptureExperience.module.css'
const blankPlace = () => ({ branch: '', city: '', country: '', address: '', longitude: '', latitude: '', confirmed: false, separate: false })
export function MerchantPlaceReview({ intent, merchantId, channel, context, locale, errors, onChange, onChooseMerchant }: {
  intent?: DirectoryIntent; merchantId: string; channel: string; context: ReviewContext; locale: LocaleCode; errors: ReviewErrors; onChange: (intent?: DirectoryIntent) => void; onChooseMerchant: (id: string) => void
}) {
  const he = locale === 'he'
  const labels = he ? { merchantName: 'שם בית העסק', merchantCategory: 'קטגוריית בית העסק', branch: 'שם הסניף', city: 'עיר', country: 'מדינה', address: 'כתובת שאישרת (רשות)', longitude: 'קו אורך', latitude: 'קו רוחב' } : { merchantName: 'Merchant name', merchantCategory: 'Merchant category', branch: 'Branch name', city: 'City', country: 'Country', address: 'Reviewed address (optional)', longitude: 'Longitude', latitude: 'Latitude' }
  const errorText = (field: string) => errors[field] === 'duplicate' ? (he ? 'כבר קיים שם או מקום דומה. בחרו בו או אשרו שמדובר בישות נפרדת.' : 'A similar name or place exists. Reuse it or confirm this is a separate entity.') : errors[field] === 'coordinate' ? (he ? 'הזינו קו אורך בין ‎-180 ל־180 וקו רוחב בין ‎-90 ל־90.' : 'Enter longitude between -180 and 180 and latitude between -90 and 90.') : errors[field] === 'location' ? (he ? 'יש לאשר במפורש את המיקום.' : 'Explicitly confirm this location.') : (he ? 'יש להשלים את השדה.' : 'Complete this field.')
  const attrs = (field: string) => ({ id: `review-${field}`, 'data-testid': `review-${field}`, 'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? `review-error-${field}` : undefined })
  const error = (field: string) => errors[field] && <small className={styles.fieldError} id={`review-error-${field}`}>{errorText(field)}</small>
  const merchant = context.merchants.find(m => m.id === merchantId)
  return <fieldset className={styles.directoryReview} data-testid="merchant-place-review"><legend>{he ? 'בית עסק ומיקום במכשיר הזה' : 'Merchant and place on this device'}</legend>
    <p>{he ? 'אין הסקת מיקום. מקום חדש דורש פרטים וקואורדינטות שתאשרו. אם אינם ידועים, בחרו מקום לא פתור ללא סיכה.' : 'No location is inferred. A new place needs details and coordinates you confirm. If unknown, choose unresolved with no pin.'}</p>
    {!intent ? <div className={styles.directoryActions}>
      {channel === 'physical' && <label>{he ? 'בית עסק קיים לסניף חדש' : 'Existing merchant for a new branch'}<select data-testid="review-branch-merchant" value={merchantId} onChange={e => onChooseMerchant(e.target.value)}><option value="">{he ? 'בחירה…' : 'Choose…'}</option>{context.merchants.filter(m => !m.onlineOnly).map(m => <option key={m.id} value={m.id}>{m.name[locale]}</option>)}</select></label>}
      <button type="button" data-testid="review-new-merchant" onClick={() => onChange({ merchant: { name: '', category: '', separate: false }, ...(channel === 'physical' ? { place: blankPlace() } : {}) })}>{he ? 'הוספת בית עסק חדש' : 'Create a new merchant'}</button>
      {channel === 'physical' && merchant && !merchant.onlineOnly && <button type="button" data-testid="review-new-branch" onClick={() => onChange({ place: blankPlace() })}>{he ? 'הוספת סניף לבית העסק הנבחר' : 'Add a branch to the selected merchant'}</button>}
    </div> : <>
      <button type="button" onClick={() => onChange()}>{he ? 'חזרה לבחירת בית עסק ומקום קיימים' : 'Use an existing merchant and place'}</button>
      {intent.merchant && <>
        <label>{labels.merchantName}<input {...attrs('merchantName')} dir="auto" maxLength={100} value={intent.merchant.name} onChange={e => onChange({ ...intent, merchant: { ...intent.merchant!, name: e.target.value, separate: false } })} />{error('merchantName')}</label>
        <label>{labels.merchantCategory}<select {...attrs('merchantCategory')} value={intent.merchant.category} onChange={e => onChange({ ...intent, merchant: { ...intent.merchant!, category: e.target.value as typeof intent.merchant.category } })}><option value="">{he ? 'בחירה…' : 'Choose…'}</option>{(['groceries','food','retail','travel'] as const).map((v,i)=><option key={v} value={v}>{he ? ['מכולת','אוכל','קמעונאות','נסיעות'][i] : v}</option>)}</select>{error('merchantCategory')}</label>
        <label className={styles.directoryCheck}><input type="checkbox" {...attrs('merchantSeparate')} checked={intent.merchant.separate} onChange={e => onChange({ ...intent, merchant: { ...intent.merchant!, separate: e.target.checked } })} />{he ? 'זה בית עסק נפרד, גם אם קיים שם דומה' : 'This is a separate merchant, even if a similar name exists'}{error('merchantSeparate')}</label>
      </>}
      {intent.place && <>
        <div className={styles.directoryFields}>{(['branch','city','country','address','longitude','latitude'] as const).map(k=><label key={k}>{labels[k]}<input {...attrs(`place-${k}`)} dir={k === 'longitude' || k === 'latitude' ? 'ltr' : 'auto'} inputMode={k === 'longitude' || k === 'latitude' ? 'decimal' : 'text'} maxLength={100} value={intent.place![k]} onChange={e => onChange({ ...intent, place: { ...intent.place!, [k]: e.target.value, confirmed: false, separate: false } })} />{error(`place-${k}`)}</label>)}</div>
        <label className={styles.directoryCheck}><input type="checkbox" {...attrs('place-confirmed')} checked={intent.place.confirmed} onChange={e => onChange({ ...intent, place: { ...intent.place!, confirmed: e.target.checked } })} />{he ? 'אני מאשר/ת שהפרטים והקואורדינטות שהזנתי מתארים את מקום הרכישה' : 'I confirm these manually entered details and coordinates describe the purchase place'}{error('place-confirmed')}</label>
        <label className={styles.directoryCheck}><input type="checkbox" {...attrs('place-separate')} checked={intent.place.separate} onChange={e => onChange({ ...intent, place: { ...intent.place!, separate: e.target.checked } })} />{he ? 'זה מקום נפרד, גם אם קיים סניף או מיקום דומה' : 'This is a separate place, even if a similar branch or location exists'}{error('place-separate')}</label>
      </>}
      {error('directory')}
    </>}
  </fieldset>
}
