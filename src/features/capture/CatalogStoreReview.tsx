'use client'
import { useEffect, useState } from 'react'
import type { CatalogStoreSummary } from '../../data/price-catalog'
import type { LocaleCode } from '../../data/spendscape-globe'
import type { ReviewContext } from './session-purchase-domain'
import styles from './CaptureExperience.module.css'
import { catalogProposal, isLocated, loadCatalogStores, nearestCatalogStore, NEAREST_STORE_METERS } from './catalog-stores'
import { useReviewGeolocation } from './useReviewGeolocation'

/** Choosing a reference store proposes a place; confirmation remains separate. */
export function CatalogStoreReview({ locale, context, onSelect }: {
  locale: LocaleCode; context: ReviewContext; onSelect: (proposal: ReturnType<typeof catalogProposal> | null) => void
}) {
  const [stores,setStores] = useState<CatalogStoreSummary[]>([])
  const [failed,setFailed] = useState(false)
  const [selected,setSelected] = useState('')
  const [nearby,setNearby] = useState<ReturnType<typeof nearestCatalogStore> | 'none'>(null)
  const gps = useReviewGeolocation()
  const he = locale === 'he'
  useEffect(() => { let active = true; void loadCatalogStores().then(s => { if (active) setStores(s) }).catch(() => { if (active) setFailed(true) }); return () => { active = false } }, [])
  const choose = (id: string) => {
    gps.cancel(); setNearby(null); setSelected(id)
    const store = stores.find(s => s.id === id)
    if (!id) onSelect(null)
    else if (store && isLocated(store)) onSelect(catalogProposal(store,context))
  }
  return <fieldset className={styles.directoryReview} data-testid="catalog-store-review"><legend>{he ? 'בחירה מפורשת מחנויות תל אביב' : 'Explicit Tel Aviv catalog store selection'}</legend>
    <p>{he ? 'חנויות ייחוס, לא רכישות. מקור הנקודות: OpenStreetMap contributors. יש לבדוק ולאשר את מקום הרכישה; אין שינוי במחיר ששילמתם.' : 'Reference stores, not purchases. Points: OpenStreetMap contributors. Review and confirm the purchase location separately; your paid price is never filled from shelf prices.'}</p>
    {failed ? <p role="status">{he ? 'קטלוג החנויות אינו זמין. אפשר לשמור ללא מיקום.' : 'Store catalog unavailable. You can save with unresolved location.'}</p> : <label>{he ? 'חנות קטלוג' : 'Catalog store'}<select data-testid="catalog-store-select" value={selected} onChange={e => choose(e.target.value)}><option value="">{he ? 'ללא בחירה' : 'No selection'}</option>{stores.filter(isLocated).map(s => <option key={s.id} value={s.id}>{s.chainName[locale]} · {s.name} · {s.address}</option>)}</select></label>}
    {stores.some(isLocated) && <div data-testid="review-nearest-field">
      <button type="button" className={styles.secondary} data-testid="review-nearest" disabled={gps.state === 'pending'} onClick={() => { setNearby(null); gps.read(point => setNearby(nearestCatalogStore(stores,point) ?? 'none')) }}>{gps.state === 'pending' ? (he ? 'מאתרים את המיקום…' : 'Finding your location…') : (he ? 'חיפוש החנות שבה אני נמצא/ת' : 'Find the store I’m in')}</button>
      <p>{he ? 'המיקום נקרא פעם אחת רק בלחיצה, אינו נשמר ואינו נשלח לשירות חיפוש. זו הצעה בלבד, לא הוכחת רכישה או אישור מיקום.' : 'Your browser reads your location once on press. It is not retained or sent to an address service. A suggestion is not proof of purchase or location confirmation.'}</p>
      <p role="status" data-testid="review-nearest-status">{gps.state === 'failed' ? (he ? 'המיקום אינו זמין. אפשר לבחור חנות או להשאיר מיקום לא פתור.' : 'Location unavailable. Choose a store or leave the place unresolved.') : nearby === 'none' ? (he ? `אין חנות קטלוג מוכרת בטווח ${NEAREST_STORE_METERS} מטר.` : `No known catalog store within ${NEAREST_STORE_METERS} m.`) : nearby ? `${he ? 'הצעה בלבד' : 'Suggestion only'}: ${nearby.store.chainName[locale]} · ${nearby.store.name} · ~${Math.round(nearby.meters)} m` : ''}</p>
      {nearby && nearby !== 'none' && <button type="button" className={styles.secondary} data-testid="review-nearest-use" onClick={() => choose(nearby.store.id)}>{he ? 'בדיקת החנות המוצעת' : 'Review this suggested store'}</button>}
    </div>}
  </fieldset>
}
