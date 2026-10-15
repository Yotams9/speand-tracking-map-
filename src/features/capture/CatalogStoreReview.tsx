'use client'
import { useEffect, useState } from 'react'
import type { CatalogStoreSummary } from '../../data/price-catalog'
import type { LocaleCode } from '../../data/spendscape-globe'
import type { ReviewContext } from './session-purchase-domain'
import styles from './CaptureExperience.module.css'
import { catalogProposal, isLocated, loadCatalogStores } from './catalog-stores'

/** Choosing a reference store proposes a place; confirmation remains separate. */
export function CatalogStoreReview({ locale, context, onSelect }: {
  locale: LocaleCode; context: ReviewContext; onSelect: (proposal: ReturnType<typeof catalogProposal>) => void
}) {
  const [stores,setStores] = useState<CatalogStoreSummary[]>([])
  const [failed,setFailed] = useState(false)
  const [selected,setSelected] = useState('')
  const he = locale === 'he'
  useEffect(() => { let active = true; void loadCatalogStores().then(s => { if (active) setStores(s) }).catch(() => { if (active) setFailed(true) }); return () => { active = false } }, [])
  return <fieldset className={styles.directoryReview} data-testid="catalog-store-review"><legend>{he ? 'בחירה מפורשת מחנויות תל אביב' : 'Explicit Tel Aviv catalog store selection'}</legend>
    <p>{he ? 'חנויות ייחוס, לא רכישות. מקור הנקודות: OpenStreetMap contributors. יש לבדוק ולאשר את מקום הרכישה; אין שינוי במחיר ששילמתם.' : 'Reference stores, not purchases. Points: OpenStreetMap contributors. Review and confirm the purchase location separately; your paid price is never filled from shelf prices.'}</p>
    {failed ? <p role="status">{he ? 'קטלוג החנויות אינו זמין. אפשר לשמור ללא מיקום.' : 'Store catalog unavailable. You can save with unresolved location.'}</p> : <label>{he ? 'חנות קטלוג' : 'Catalog store'}<select data-testid="catalog-store-select" value={selected} onChange={e => { setSelected(e.target.value); const store = stores.find(s => s.id === e.target.value); if (store && isLocated(store)) onSelect(catalogProposal(store,context)) }}><option value="">{he ? 'ללא בחירה' : 'No selection'}</option>{stores.filter(isLocated).map(s => <option key={s.id} value={s.id}>{s.chainName[locale]} · {s.name} · {s.address}</option>)}</select></label>}
  </fieldset>
}
