'use client'
import { useEffect, useRef, useState } from 'react'
import type { CatalogProduct, CatalogStoreSummary } from '../../data/price-catalog'
import type { CatalogCandidate } from '../../data/catalog-search'
import { localized, type GlobePurchase, type LocaleCode, type Place } from '../../data/spendscape-globe'
import { catalogReceiptComparison, validCatalogQuote, type CatalogSelections } from './catalog-receipt-comparison'
import styles from './NearbyPricesReview.module.css'
function ProductChoice({ item, he, onChoose }: { item: GlobePurchase['items'][number]; he: boolean; onChoose: (p: CatalogProduct | null) => void }) {
  const [query, setQuery] = useState(localized(item.label, he ? 'he' : 'en').slice(0, 100)), [candidates, setCandidates] = useState<CatalogCandidate[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const generation = useRef(0), controller = useRef<AbortController | null>(null)
  useEffect(() => () => { generation.current++; controller.current?.abort() }, [])
  async function load(code?: string) {
    controller.current?.abort(); const c = new AbortController(), token = ++generation.current; controller.current = c; setBusy(true); setError(''); onChoose(null)
    try {
      const r = await fetch(code ? '/api/catalog/' + code : '/api/catalog/search', code ? { signal: c.signal, cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }), signal: c.signal, cache: 'no-store' })
      if (!r.ok) throw 0; const value: unknown = await r.json()
      if (c.signal.aborted || generation.current !== token) return
      if (code) { if (!validCatalogQuote(value) || value.gtin14 !== code) throw 0; onChoose(value); setCandidates([]) }
      else {
        const list = (value as { matches?: unknown }).matches
        if (!Array.isArray(list) || list.length > 15 || !list.every(p => p && typeof p.gtin14 === 'string' && /^\d{14}$/.test(p.gtin14) && typeof p.name === 'string' && typeof p.quantity === 'string' && typeof p.manufacturer === 'string')) throw 0
        setCandidates(list); if (!list.length) setError(he ? 'לא נמצא מוצר. נסו שם קצר יותר או ברקוד.' : 'No product found. Try a shorter name or a barcode.')
      }
    } catch { if (!c.signal.aborted && generation.current === token) setError(he ? 'הקטלוג אינו זמין או שהחיפוש לא נתמך. אפשר לנסות חיפוש אחר.' : 'Catalog unavailable or unsupported search. Try another query.') }
    finally { if (generation.current === token) setBusy(false) }
  }
  return <div data-testid={`catalog-choice-${item.id}`}>
    <label>{he ? 'שם מוצר או ברקוד לחיפוש בקטלוג' : 'Product name or barcode to search'}<input data-testid={`catalog-query-${item.id}`} maxLength={100} value={query} onChange={e => { generation.current++; controller.current?.abort(); setBusy(false); setQuery(e.target.value); setCandidates([]); setError(''); onChoose(null) }} /></label>
    <button type="button" className={styles.catalogAction} disabled={busy || query.trim().length < 2} onClick={() => { setCandidates([]); void load() }} data-testid={`catalog-search-${item.id}`}>{busy ? (he ? 'מחפשים…' : 'Searching…') : (he ? 'חיפוש בקטלוג הקיים' : 'Search existing catalog')}</button>
    {error && <p role="status">{error}</p>}
    {candidates.length > 0 && <ul className={styles.candidates}>{candidates.map(p => <li key={p.gtin14}><button type="button" className={styles.catalogAction} disabled={busy} data-testid={`catalog-select-${p.gtin14}`} onClick={() => void load(p.gtin14)}><strong>{p.name}</strong><span>{p.manufacturer || (he ? 'יצרן לא ידוע' : 'Manufacturer unknown')} · {p.quantity || (he ? 'אריזה לא ידועה' : 'Package unknown')}</span><bdi>{p.gtin14}</bdi></button></li>)}</ul>}
  </div>
}
export function CatalogReceiptComparison({ purchase, places, locale }: { purchase: GlobePurchase; places: readonly Place[]; locale: LocaleCode }) {
  const he = locale === 'he', title = useRef<HTMLHeadingElement>(null)
  const [stores, setStores] = useState<CatalogStoreSummary[]>([]), [unavailable, setUnavailable] = useState(false), [radius, setRadius] = useState(5000), [selected, setSelected] = useState<CatalogSelections>({})
  useEffect(() => { title.current?.focus(); const c = new AbortController(); void fetch('/api/catalog/stores', { signal: c.signal }).then(async r => { if (!r.ok) throw 0; const body = await r.json(); if (!Array.isArray(body.stores) || body.stores.length > 100) throw 0; if (!c.signal.aborted) setStores(body.stores) }).catch(() => { if (!c.signal.aborted) setUnavailable(true) }); return () => c.abort() }, [])
  const result = catalogReceiptComparison(purchase, places, stores, selected, radius)
  const money = (n: number) => new Intl.NumberFormat(he ? 'he-IL' : 'en-GB', { style: 'currency', currency: 'ILS' }).format(n / 100)
  const completeTotals = result.stores.filter(s => s.complete).map(s => s.totalMinor), cheapest = completeTotals.length ? Math.min(...completeTotals) : null
  return <section data-testid="catalog-receipt-comparison">
    <h2 ref={title} tabIndex={-1}>{he ? 'מחירי קטלוג בקרבת הקנייה' : 'Catalog prices near this purchase'}</h2>
    <p className={styles.notice} data-testid="catalog-historical-notice">{he ? 'מחירי ארכיון מהקטלוג הקיים של תל אביב, אוקטובר 2026. אלו אינם מחירים עדכניים או חיסכון מובטח היום. תאריך הפרסום מוצג לכל חנות. אין התחייבות למלאי או למחיר בקופה.' : 'Archived prices from the existing Tel Aviv catalog, October 2026. These are not current prices or guaranteed savings today. Publication dates are shown for each store. Stock and checkout prices are not guaranteed.'}</p>
    <p>{he ? 'תאריך הקנייה השמור' : 'Saved purchase date'}: <bdi>{purchase.timestamp.slice(0, 10)}</bdi> · {he ? 'סה״כ ששולם' : 'Total paid'}: {purchase.originalAmount} {purchase.originalCurrency}</p>
    <label>{he ? 'רדיוס בקו אווירי ממקום הקנייה שאושר' : 'Straight-line radius from the confirmed purchase place'}<select data-testid="catalog-radius" value={radius} onChange={e => setRadius(Number(e.target.value))}>{[5000, 10000, 20000].map(n => <option key={n} value={n}>{n / 1000} {he ? 'ק״מ' : 'km'}</option>)}</select></label>
    <p>{he ? 'נקודות החנויות הן נקודות כתובת של OpenStreetMap; אינן אימות בית עסק או מסלול נסיעה. חנויות ללא נקודה אינן נכללות בסינון.' : 'Store points are OpenStreetMap address points, not verified business premises or driving routes. Stores without a point are excluded.'}</p>
    {result.state === 'location-unresolved' && <p role="status" data-testid="catalog-origin-required">{he ? 'יש לאשר תחילה מקום קנייה עם pin כדי לסנן לפי רדיוס. אפשר כבר לחפש ולהתאים מוצרים.' : 'Confirm a purchase place with a pin before filtering by radius. You can already search and match products.'}</p>}
    {purchase.originalCurrency !== 'ILS' && <p role="status">{he ? 'הקטלוג נקוב בשקלים; השוואה לקבלה במטבע אחר אינה נתמכת.' : 'The catalog uses ILS; comparison with a receipt in another currency is unsupported.'}</p>}
    {unavailable && <p role="status">{he ? 'קטלוג החנויות לא נטען. המחירים אינם זמינים.' : 'The store catalog could not load. Prices are unavailable.'}</p>}
    <ol className={styles.items}>{purchase.items.map(item => {
      const choice = selected[item.id], p = choice?.product
      return <li key={item.id}><h3>{localized(item.label, locale)}</h3><p>{he ? 'כמות בקבלה' : 'Receipt quantity'}: {item.quantity} {item.unit}</p>
        <ProductChoice item={item} he={he} onChoose={product => setSelected(s => ({ ...s, [item.id]: product ? { product, confirmed: false } : undefined }))} />
        {p && <><p data-testid={`catalog-package-${item.id}`}>{p.name} · {p.manufacturer || (he ? 'יצרן לא ידוע' : 'Manufacturer unknown')} · {p.quantity || (he ? 'אריזה לא ידועה' : 'Package unknown')} · <bdi>{p.gtin14}</bdi></p><label className={styles.confirm}><input type="checkbox" data-testid={`catalog-confirm-${item.id}`} disabled={p.weighted || !p.name.trim() || !p.quantity.trim() || item.unit !== 'item' || !Number.isSafeInteger(item.quantity)} checked={choice?.confirmed ?? false} onChange={e => setSelected(s => ({ ...s, [item.id]: { product: p, confirmed: e.target.checked } }))} />{he ? 'בדקתי: אותו מוצר, מותג, סוג וגודל אריזה.' : 'I checked: same product, brand, variant and package size.'}</label>{(p.weighted || item.unit !== 'item' || !Number.isSafeInteger(item.quantity)) && <p>{he ? 'השוואה לפריטים במשקל או בכמות חלקית אינה נתמכת כאן.' : 'Weighted or fractional-item comparison is unsupported here.'}</p>}</>}
      </li>
    })}</ol>
    {result.state === 'no-matched-prices' && <p role="status" data-testid="catalog-no-prices">{he ? 'לא נמצאו מחירי ארכיון למוצרים שאושרו בטווח שנבחר. בדקו התאמות או הגדילו את הרדיוס.' : 'No archived prices for confirmed products within this radius. Check matches or widen the radius.'}</p>}
    {result.stores.map(s => <article className={styles.store} key={s.store.id} data-testid={`catalog-store-${s.store.id}`}><h3>{localized(s.store.chainName, locale)} · {s.store.name}</h3><p>{s.store.address} · {s.distanceM} {he ? 'מ׳ בקו אווירי' : 'm straight line'}</p><p>{s.matchedCount}/{purchase.items.length} {he ? 'שורות עם מחיר ארכיוני' : 'rows with archived prices'}</p><ul>{s.rows.map(row => <li key={row.itemId}>{localized(purchase.items.find(i => i.id === row.itemId)!.label, locale)}: {row.amountMinor === null ? (he ? 'אין מחיר מותאם' : 'No matched price') : money(row.amountMinor)}{row.publishedLocal && <p>{he ? 'פורסם — זמן ישראל' : 'Published — Israel time'}: <bdi>{row.publishedLocal}</bdi></p>}</li>)}</ul><strong>{s.complete ? (he ? 'סה״כ ארכיוני לכל שורות הקבלה' : 'Archived total for all receipt rows') : (he ? 'סכום חלקי בלבד' : 'Partial subtotal only')}: {money(s.totalMinor)}</strong>{s.complete && s.totalMinor === cheapest && <p className={styles.referenceBest}>{he ? 'הסכום הארכיוני הנמוך ביותר בין ההתאמות המלאות בטווח שנבחר' : 'Lowest archived total among complete matches within this radius'}</p>}{s.historicalDifferenceMinor !== null && <p data-testid={`catalog-difference-${s.store.id}`}>{he ? 'הפרש היסטורי מול הסכום ששולם בקבלה (לא חיסכון נוכחי)' : 'Historical difference from the receipt total (not current savings)'}: {money(s.historicalDifferenceMinor)}</p>}</article>)}
    <p>{he ? 'ההתאמות זמניות; סכומי הקנייה וה־pin אינם משתנים. אין פיצול סל בין חנויות.' : 'Matches are temporary; paid amounts and the pin remain unchanged. No basket splitting between stores.'}</p>
    <small>© OpenStreetMap contributors · {he ? 'מחירי קטלוג: פרסומי הרשתות הקיימים בקוד' : 'Catalog prices: existing retailer publications'}</small>
  </section>
}
