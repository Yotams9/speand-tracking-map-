'use client'

import { useEffect, useRef, useState } from 'react'
import type { CatalogCandidate } from '../../data/catalog-search'
import { localized, type GlobePurchase, type LocaleCode, type Place } from '../../data/spendscape-globe'
import { comparisonOrigin } from '../nearby-prices/receipt-comparison'
import { SavingsPanel } from './SavingsPanel'
import type { SavingsStore } from './savings-engine'
import { receiptPriceBasket, validCandidate, knownPackage } from './receipt-price-match'
import styles from './ReceiptPricesReview.module.css'

function ReceiptRowPrices({ purchase, itemId, places, locale, radiusM, onShowStore }: {
  purchase: GlobePurchase; itemId: string; places: readonly Place[]; locale: LocaleCode; radiusM: number; onShowStore: (store: SavingsStore) => void
}) {
  const item = purchase.items.find(i => i.id === itemId)!, he = locale === 'he'
  const [query, setQuery] = useState(localized(item.label, locale).slice(0, 100))
  const [matches, setMatches] = useState<CatalogCandidate[]>([]), [selected, setSelected] = useState<CatalogCandidate | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [nextOffset, setNextOffset] = useState(0), [hasMore, setHasMore] = useState(false)
  const request = useRef<AbortController | null>(null), version = useRef(0), result = useRef<HTMLDivElement>(null)
  useEffect(() => () => { version.current++; request.current?.abort() }, [])
  useEffect(() => { if (selected) result.current?.scrollIntoView({ block: 'start' }) }, [selected])
  async function search(more = false) {
    request.current?.abort()
    const controller = new AbortController(), token = ++version.current
    request.current = controller; setBusy(true); setError('')
    if (!more) { setMatches([]); setSelected(null); setHasMore(false) }
    try {
      const response = await fetch('/api/catalog/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, ...(more ? { offset: nextOffset } : {}) }), signal: controller.signal, cache: 'no-store' })
      if (!response.ok) throw Error('search')
      const body = await response.json()
      if (!Array.isArray(body.matches) || body.matches.length > 15 || !body.matches.every(validCandidate) || typeof body.hasMore !== 'boolean' || !Number.isSafeInteger(body.nextOffset) || body.nextOffset < 0) throw Error('response')
      if (controller.signal.aborted || token !== version.current) return
      setMatches(previous => more ? [...previous, ...body.matches] : body.matches); setHasMore(body.hasMore); setNextOffset(body.nextOffset)
      if (!body.matches.length && !more) setError(he ? 'לא נמצאה התאמה. נסו שם קצר, מותג ואריזה, או ברקוד. אם אין מוצר זהה, לא מוצג לו מחיר.' : 'No match found. Try a shorter name, brand and package, or a barcode. No price is shown without an identical product.')
    } catch { if (!controller.signal.aborted && token === version.current) setError(he ? 'לא ניתן לטעון מוצרים כרגע. אפשר לנסות שוב.' : 'Products could not load. You can try again.') }
    finally { if (token === version.current) setBusy(false) }
  }
  const unsupported = item.unit !== 'item' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000 || purchase.originalCurrency !== 'ILS'
  const basket = selected ? receiptPriceBasket(purchase, item.id, selected, places) : null
  return <article className={styles.row} data-testid={`receipt-price-row-${item.id}`}>
    <h3>{localized(item.label, locale)}</h3>
    <p>{he ? 'כמות להשוואה' : 'Quantity to compare'}: <bdi>{item.quantity}</bdi> · {he ? 'סה״כ בשורת הקבלה' : 'Receipt row total'}: <bdi>{item.lineTotal} {purchase.originalCurrency}</bdi></p>
    {unsupported ? <p role="status">{he ? 'השוואה זו תומכת בכמויות שלמות של מוצרים ארוזים ובשקלים בלבד.' : 'This comparison supports whole quantities of packaged products in ILS only.'}</p> : <>
      {!selected && <>
        <label>{he ? 'איזה מוצר מופיע בקבלה?' : 'Which product is on the receipt?'}<input data-testid={`receipt-price-query-${item.id}`} value={query} maxLength={100} placeholder={he ? 'שם מוצר, מותג וגודל אריזה או ברקוד' : 'Product name, brand and package, or barcode'} onChange={e => { version.current++; request.current?.abort(); setBusy(false); setQuery(e.target.value); setMatches([]); setHasMore(false); setError('') }} /></label>
        <button type="button" className={styles.action} disabled={busy || query.trim().length < 2} data-testid={`receipt-price-search-${item.id}`} onClick={() => void search()}>{busy ? (he ? 'מחפשים…' : 'Searching…') : (he ? 'מציאת המוצר להשוואה' : 'Find product to compare')}</button>
        {matches.length > 0 && <><p className={styles.hint}>{he ? 'בחרו רק את אותו מוצר, מותג, סוג וגודל אריזה. לחיצה תציג מיד מחירים למוצר הזה.' : 'Choose only the same product, brand, variant and package. Selecting it shows its prices immediately.'}</p><ul className={styles.matches}>{matches.map(p => <li key={p.gtin14}>
          <strong>{p.name}</strong><span>{[p.manufacturer, p.quantity || (he ? 'גודל אריזה לא ידוע' : 'Package unknown')].filter(Boolean).join(' · ')}</span><small><bdi>{p.gtin14}</bdi></small>
          <button type="button" disabled={busy || p.weighted || !knownPackage(p.quantity)} className={styles.action} data-testid={`receipt-price-select-${p.gtin14}`} onClick={() => { setSelected(p); setMatches([]) }}>{p.weighted || !knownPackage(p.quantity) ? (he ? 'לא ניתן להשוות אריזה זו' : 'Package cannot be compared') : (he ? 'זה המוצר והאריזה — הצג מחירים' : 'Same product and package — show prices')}</button>
        </li>)}</ul></>}
        {hasMore && <button type="button" className={styles.action} disabled={busy} data-testid={`receipt-price-more-${item.id}`} onClick={() => void search(true)}>{he ? 'הצגת מוצרים נוספים' : 'Show more products'}</button>}
        {error && <p role="status">{error}</p>}
      </>}
      {selected && <div ref={result} className={styles.result} data-testid={`receipt-price-result-${item.id}`}>
        <p><strong>{selected.name}</strong> · {selected.quantity}</p>
        {basket?.origin ? <SavingsPanel key={selected.gtin14} basket={basket} locale={locale} radiusM={radiusM} lineLabel={() => localized(item.label, locale)} onShowStore={onShowStore} /> : <p role="status" data-testid="receipt-prices-origin-required">{he ? 'כדי להציג חנויות ומרחקים, חזרו לקנייה ואשרו את מקום הרכישה על המפה.' : 'To show stores and distances, return to the purchase and confirm its place on the map.'}</p>}
        <button type="button" className={styles.action} data-testid={`receipt-price-change-${item.id}`} onClick={() => { setSelected(null); setHasMore(false); setError('') }}>{he ? 'בחירת מוצר אחר' : 'Choose a different product'}</button>
      </div>}
    </>}
  </article>
}

export function ReceiptPricesReview({ purchase, places, locale, onShowStore }: { purchase: GlobePurchase; places: readonly Place[]; locale: LocaleCode; onShowStore: (store: SavingsStore) => void }) {
  const he = locale === 'he', title = useRef<HTMLHeadingElement>(null), [radiusM, setRadiusM] = useState(5000)
  useEffect(() => { title.current?.focus() }, [])
  return <section className={styles.review} data-testid="receipt-prices-review">
    <h2 ref={title} tabIndex={-1}>{he ? 'איפה זה זול יותר?' : 'Where is it cheaper?'}</h2>
    <p>{he ? 'בחרו מוצר זהה לשורה בקבלה. החנות הזולה, המחיר והמרחק יופיעו מיד בכרטיס של אותו מוצר.' : 'Choose the identical product for a receipt row. The cheapest store, price and distance appear immediately in that product’s card.'}</p>
    <p className={styles.notice}>{he ? 'מחירים מפורסמים של סניפי תל אביב והסביבה. תאריך המקור מופיע לצד המחיר; אין כאן מחיר חי או כיסוי לכל הארץ.' : 'Published prices from Tel Aviv branches and nearby areas. Each result shows its source date; these are not live or nationwide prices.'}</p>
    <label>{he ? 'מרחק ממקום הקנייה שאושר' : 'Distance from the confirmed purchase place'}<select data-testid="receipt-prices-radius" value={radiusM} onChange={e => setRadiusM(Number(e.target.value))}>{[5000, 10000, 20000].map(n => <option key={n} value={n}>{n / 1000} {he ? 'ק״מ' : 'km'}</option>)}</select></label>
    {!comparisonOrigin(purchase, places) && <p role="status" data-testid="receipt-prices-location-needed">{he ? 'לקנייה הזו עדיין אין pin מאושר. אפשר לזהות מוצרים; להצגת חנויות ברדיוס יש לאשר תחילה מקום רכישה.' : 'This purchase has no confirmed pin yet. You can identify products; confirm a purchase place before showing nearby stores.'}</p>}
    {purchase.items.map(item => <ReceiptRowPrices key={item.id} purchase={purchase} itemId={item.id} places={places} locale={locale} radiusM={radiusM} onShowStore={onShowStore} />)}
    <p className={styles.hint}>{he ? 'כל כרטיס משווה מוצר אחד בכמות שבקבלה, ולא את הסל כולו. זו אינה המלצה לפצל קנייה. הנתונים והמיקום השמורים אינם משתנים.' : 'Each card compares one product in its receipt quantity, not the entire basket. This is not a recommendation to split a shopping trip. Saved purchase facts and location stay unchanged.'}</p>
    <small>{he ? 'מרחק בקו אווירי לנקודות כתובת; לא מסלול נסיעה או אימות בית עסק.' : 'Straight-line distances to address points, not driving routes or verified premises.'} · © OpenStreetMap contributors</small>
  </section>
}
