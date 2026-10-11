'use client'

import { useEffect, useRef, useState } from 'react'
import { localized, type GlobePurchase, type LocaleCode, type Place } from '../../data/spendscape-globe'
import { validatePriceSnapshot, type PriceSnapshot } from './price-contract'
import { comparisonOrigin, receiptComparison, nearbyQaAllowed, type Matches, type RowState } from './receipt-comparison'
import styles from './NearbyPricesReview.module.css'

export function NearbyPricesReview({ purchase, places, locale, onClose }: { purchase: GlobePurchase; places: readonly Place[]; locale: LocaleCode; onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<PriceSnapshot | null>(null)
  const [matches, setMatches] = useState<Matches>({})
  const [now, setNow] = useState(Date.now)
  const [qa, setQa] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  const he = locale === 'he'
  useEffect(() => {
    title.current?.focus()
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    // No native source or transport is activated here. Fictional snapshots may
    // enter only an explicitly opted-in loopback QA page, and never storage.
    const target = window as Window & { __SPENDSCAPE_NEARBY_QA__?: (raw: unknown) => boolean }
    const enabled = nearbyQaAllowed(location.hostname, location.search)
    setQa(enabled)
    const inject = (raw: unknown) => {
      const candidate = validatePriceSnapshot(raw)
      if (!candidate || candidate.classification !== 'fictional') return false
      setSnapshot(candidate); setMatches({}); setNow(Date.now()); return true
    }
    if (enabled) target.__SPENDSCAPE_NEARBY_QA__ = inject
    return () => { window.clearInterval(timer); if (target.__SPENDSCAPE_NEARBY_QA__ === inject) delete target.__SPENDSCAPE_NEARBY_QA__ }
  }, [])
  const result = receiptComparison(purchase, places, snapshot, matches, now)
  const origin = comparisonOrigin(purchase, places)
  const words: Record<RowState, string> = he ? {
    unmatched: 'המוצר לא הותאם', 'confirm-match': 'יש לאשר את הזהות וגודל האריזה', 'package-unknown': 'גודל האריזה לא ידוע', 'identity-unknown': 'מותג או סוג מוצר לא ידועים', 'unsupported-unit': 'יחידת הכמות אינה נתמכת להשוואה זו', 'currency-unknown': 'מטבע המחיר לא אומת', stale: 'המחיר אינו עדכני', 'no-price': 'אין מחיר מאומת', available: 'מחיר לדוגמה זמין',
  } : { unmatched: 'Product not matched', 'confirm-match': 'Confirm identity and package size', 'package-unknown': 'Package size unknown', 'identity-unknown': 'Brand or variant unknown', 'unsupported-unit': 'Quantity unit unsupported for this comparison', 'currency-unknown': 'Price currency not verified', stale: 'Price is out of date', 'no-price': 'No verified price', available: 'Example price available' }
  const money = (minor: number) => new Intl.NumberFormat(he ? 'he-IL' : 'en-GB', { style: 'currency', currency: 'ILS' }).format(minor / 100)
  return <section className={styles.panel} dir={he ? 'rtl' : 'ltr'} aria-labelledby="nearby-prices-title" data-testid="nearby-prices-review">
    <button type="button" className={styles.close} onClick={onClose}>{he ? 'חזרה לרכישה' : 'Back to purchase'}</button>
    <h2 id="nearby-prices-title" ref={title} tabIndex={-1}>{he ? 'מחירים באזור' : 'Nearby Prices'}</h2>
    <p>{he ? 'המחירים בקבלה הם היסטוריים' : 'Receipt prices are historical'} · {he ? 'תאריך רכישה (UTC)' : 'Purchase date (UTC)'}: <bdi>{purchase.timestamp.slice(0, 10)}</bdi>. {he ? 'אין כאן השוואת חיסכון מול הקבלה.' : 'This is not a savings comparison with the receipt.'}</p>
    {origin && <p>{localized(origin.branch, locale)} · {localized(origin.city, locale)}<br/>{he ? 'אזור ההשוואה: עד 5 ק״מ בקו אווירי מהמקום שאושר. לא כל החנויות באזור מכוסות.' : 'Comparison area: within 5 km straight-line distance of the confirmed place. Not every store in the area is covered.'}</p>}
    {qa && <p className={styles.notice} data-testid="nearby-qa-label">{he ? 'בדיקה מקומית בלבד · מוצרים וחנויות בדיוניים · לא מחירי שוק עדכניים' : 'Local QA only · fictional products and stores · not current market prices'}</p>}
    <p className={styles.notice} role="status">{result.state === 'location-unresolved' ? (he ? 'יש לאשר מקום רכישה כדי להשוות חנויות באזור.' : 'Confirm a purchase location to compare nearby stores.') : result.state === 'prices-unavailable' ? (he ? 'מחירים עדכניים מאומתים אינם זמינים. חיבור למקור מחירים עדיין לא הופעל.' : 'Verified current prices are unavailable. A price source has not been activated.') : result.state === 'no-qualified-stores' ? (he ? 'אין חנויות מאומתות באזור ההשוואה.' : 'No qualified stores in this comparison area.') : (he ? 'תצוגה בדיונית לבדיקה בלבד. נדרש אישור מפורש לכל התאמה.' : 'Fictional preview for QA only. Each match needs explicit confirmation.')}</p>
    <ol className={styles.items}>
      {purchase.items.map(item => {
        const match = matches[item.id], product = snapshot?.products.find(p => p.id === match?.productId)
        return <li key={item.id} data-testid={`nearby-item-${item.id}`}>
          <h3>{localized(item.label, locale)}</h3>
          <p>{he ? 'כמות בקבלה' : 'Receipt quantity'}: {item.quantity} {item.unit === 'kg' ? (he ? 'ק״ג' : 'kg') : (he ? 'פריטים' : 'items')}. {he ? 'ברקוד המוצר לא אומת.' : 'Product barcode not verified.'}</p>
          {snapshot ? <>
            <label>{he ? 'הצעת מוצר — יש לבחור במפורש' : 'Proposed product — choose explicitly'}
              <select data-testid={`nearby-match-${item.id}`} value={match?.productId ?? ''} onChange={e => setMatches(current => ({ ...current, [item.id]: { productId: e.target.value, confirmed: false } }))}>
                <option value="">{he ? 'המוצר לא הותאם' : 'Product not matched'}</option>
                {snapshot.products.map(p => <option key={p.id} value={p.id}>{localized(p.label, locale)}</option>)}
              </select>
            </label>
            {product && <p data-testid={`nearby-package-${item.id}`}>{product.brand ?? (he ? 'מותג לא ידוע' : 'Brand unknown')} · {product.variant ?? (he ? 'סוג לא ידוע' : 'Variant unknown')} · {product.package ? `${product.package.count} × ${product.package.quantity} ${product.package.unit}` : words['package-unknown']}</p>}
            {product?.package && product.brand && product.variant && <label className={styles.confirm}><input type="checkbox" data-testid={`nearby-confirm-${item.id}`} checked={match?.confirmed ?? false} onChange={e => setMatches(current => ({ ...current, [item.id]: { productId: product.id, confirmed: e.target.checked } }))}/>{he ? 'בדקתי: זה אותו מוצר, מותג, סוג וגודל אריזה.' : 'I checked: same product, brand, variant and package size.'}</label>}
          </> : <p>{words.unmatched} · {he ? 'זהות, מותג וגודל אריזה עדיין דורשים אישור.' : 'Identity, brand and package size still require confirmation.'}</p>}
        </li>
      })}
    </ol>
    {result.stores.map(store => <article key={store.id} className={styles.store} data-testid={`nearby-store-${store.id}`}>
      <h3>{localized(store.label, locale)}</h3><p>{store.distanceM} {he ? 'מטר בקו אווירי' : 'm straight-line distance'}</p>
      <p>{store.matchedCount} {he ? 'מתוך' : 'of'} {purchase.items.length} {he ? 'שורות עם מחיר' : 'rows priced'} · {snapshot?.source.label}</p>
      <p>{he ? 'זמן פרסום המקור' : 'Source publication'}: <bdi>{snapshot?.source.publishedAt ?? (he ? 'לא ידוע' : 'Unknown')}</bdi></p>
      <ul>{store.rows.map(row => <li key={row.itemId}>{localized(purchase.items.find(i => i.id === row.itemId)!.label, locale)}: {words[row.state]}{row.amountMinor !== null && <> · {money(row.amountMinor)}</>}</li>)}</ul>
      {store.matchedCount > 0 && store.subtotalMinor !== null && <strong data-testid={`nearby-subtotal-${store.id}`}>{store.complete ? (he ? 'סך סל לדוגמה' : 'Example basket total') : (he ? 'סכום חלקי בלבד — לא מחיר הסל המלא' : 'Partial subtotal only — not the whole basket')}: {money(store.subtotalMinor)}</strong>}
      <p>{he ? 'אין מידע על מלאי או מסלול נסיעה. ההתאמות זמניות ולא משנות את הרכישה.' : 'No stock or route information. Matches are temporary and do not change the purchase.'}</p>
    </article>)}
  </section>
}
