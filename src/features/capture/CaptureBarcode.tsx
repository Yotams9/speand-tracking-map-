'use client'

import { useEffect, useRef, useState } from 'react'
import type { LocaleCode } from '@/data/spendscape-globe'
import { barcodeFormats, type BarcodeFormat, type BarcodeIdentity } from './barcode-domain'
import { barcodeDemoCatalog, lookupDemoProduct } from './barcode-demo-catalog'
import type { DecoderState } from './barcode-session'
import type { CatalogProduct } from '@/data/price-catalog'
import styles from './CaptureExperience.module.css'

const copy = {
  en: {
    idle: 'EAN-13, EAN-8, UPC-A and UPC-E · local decoding only.',
    loading: 'Loading the local barcode reader…', ready: 'Reader ready. Hold one barcode inside the guide.',
    found: 'Barcode found. Review the identification below.', invalid: 'Invalid barcode. Check the format, digits and checksum, then correct or retry.',
    empty: 'No barcode found. Adjust the light and position, then retry, or enter the code.',
    'load-error': 'The barcode reader could not load. Retry, enter the code or explore a demo.',
    'decode-error': 'The barcode could not be read. Retry, enter the code or explore a demo.',
    cancelled: 'Barcode scanning cancelled. You can enter a code or start the camera again.',
    manual: 'Enter barcode', format: 'Barcode format', code: 'Barcode digits', identify: 'Check barcode',
    demo: 'Load demo product for review', loaded: 'Demo product loaded — review only', continue: 'Continue to purchase details', provenance: 'Synthetic demo catalog · fictional product',
    unknown: 'Unknown barcode', unknownBody: 'The code is valid, but is not in this small demo catalog. No real product lookup was made.',
    real: 'Found in Tel Aviv published prices', checking: 'Checking the Tel Aviv price files…', missing: 'Not in the Tel Aviv price files of Shufersal, Rami Levy and Osher Ad. Type the product name below.', lookupError: 'The price files could not be checked right now. Type the product name below.',
    prices: 'Published shelf prices in Tel Aviv', stores: 'stores', perKg: 'per kg', more: 'more stores · up to', priceNote: 'From the chains’ official price files ({date}). Promotions and club prices are not applied; the price you pay may differ.',
    name: 'Product name for review', note: 'Identification only. Nothing is added to your purchases. The price you paid, merchant, date and place are unknown.',
    retry: 'Retry barcode scan', reset: 'Clear result', original: 'Scanned code', normalized: 'Equivalent GTIN',
  },
  he: {
    idle: 'EAN-13, EAN-8, UPC-A ו־UPC-E · פענוח מקומי בלבד.',
    loading: 'טוענים את קורא הברקודים המקומי…', ready: 'הקורא מוכן. מקמו ברקוד אחד בתוך המסגרת.',
    found: 'נמצא ברקוד. בדקו את הזיהוי למטה.', invalid: 'ברקוד לא תקין. בדקו את הסוג, הספרות וספרת הביקורת, ותקנו או נסו שוב.',
    empty: 'לא נמצא ברקוד. שפרו תאורה ומיקום ונסו שוב, או הזינו את הקוד.',
    'load-error': 'לא ניתן לטעון את קורא הברקודים. נסו שוב, הזינו קוד או פתחו הדגמה.',
    'decode-error': 'לא ניתן לקרוא את הברקוד. נסו שוב, הזינו קוד או פתחו הדגמה.',
    cancelled: 'סריקת הברקוד בוטלה. אפשר להזין קוד או להפעיל שוב את המצלמה.',
    manual: 'הזנת ברקוד', format: 'סוג ברקוד', code: 'ספרות הברקוד', identify: 'בדיקת ברקוד',
    demo: 'טעינת מוצר הדגמה לבדיקה', loaded: 'מוצר ההדגמה נטען — לבדיקה בלבד', continue: 'המשך לפרטי רכישה', provenance: 'קטלוג הדגמה סינתטי · מוצר בדיוני',
    unknown: 'ברקוד לא מוכר', unknownBody: 'הקוד תקין, אך אינו בקטלוג ההדגמה הקטן. לא בוצע חיפוש מוצר אמיתי.',
    real: 'נמצא במחירוני תל אביב', checking: 'בודקים במחירוני תל אביב…', missing: 'המוצר לא נמצא במחירונים של שופרסל, רמי לוי ואושר עד בתל אביב. הקלידו את שם המוצר למטה.', lookupError: 'לא ניתן לבדוק במחירונים כרגע. הקלידו את שם המוצר למטה.',
    prices: 'מחירי מדף מפורסמים בתל אביב', stores: 'סניפים', perKg: 'לק״ג', more: 'סניפים נוספים · עד', priceNote: 'מתוך קובצי המחירים הרשמיים של הרשתות ({date}). מבצעים ומחירי מועדון אינם כלולים; המחיר בקופה עשוי להיות שונה.',
    name: 'שם מוצר לבדיקה', note: 'זיהוי בלבד. דבר לא נוסף לרכישות. המחיר ששילמתם, בית העסק, התאריך והמקום אינם ידועים.',
    retry: 'ניסיון סריקה נוסף', reset: 'ניקוי תוצאה', original: 'הקוד שנסרק', normalized: 'GTIN מקביל',
  },
} as const

export function CaptureBarcode({ locale, state, identity, onManual, onDemo, onCandidate, onCancel, onRetry, onReset }: {
  locale: LocaleCode; state: DecoderState; identity: BarcodeIdentity | null
  onDemo: (code: string, format: string) => void; onCandidate: (name: string, syntheticCatalog: boolean, catalogPrices?: Record<string, number>) => void
  onManual: (code: string, format: string) => void; onCancel: () => void; onRetry: () => void; onReset: () => void
}) {
  const t = copy[locale]
  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState('')
  const [format, setFormat] = useState<BarcodeFormat>('EAN13')
  const [name, setName] = useState('')
  const [demoLoaded, setDemoLoaded] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const result = useRef<HTMLDivElement>(null)
  const product = identity ? lookupDemoProduct(identity) : undefined
  // Barcodes outside the demo catalog are looked up in the Tel Aviv price files on our own server.
  const [lookup, setLookup] = useState<{ gtin: string; state: 'checking' | 'found' | 'missing' | 'error'; product?: CatalogProduct } | null>(null)
  useEffect(() => {
    if (!identity || product) { setLookup(null); return }
    const gtin = identity.gtin14, controller = new AbortController()
    setLookup({ gtin, state: 'checking' })
    fetch(`/api/catalog/${gtin}`, { signal: controller.signal })
      .then(async response => {
        if (response.status === 404) { setLookup({ gtin, state: 'missing' }); return }
        if (!response.ok) throw new Error('lookup')
        const found = await response.json() as CatalogProduct
        setLookup({ gtin, state: 'found', product: found })
        setName(current => current || found.name)
      })
      .catch(() => { if (!controller.signal.aborted) setLookup({ gtin, state: 'error' }) })
    return () => controller.abort()
  }, [identity, product])
  const real = lookup?.gtin === identity?.gtin14 && lookup?.state === 'found' ? lookup.product : undefined
  const money = (value: number) => new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', { style: 'currency', currency: 'ILS' }).format(value)
  // Locale changes must not overwrite a name the user edited.
  useEffect(() => { setName(product?.name[locale] ?? ''); setDemoLoaded(false) }, [identity, product])
  useEffect(() => {
    if (identity) {
      setEditing(false)
      setCode(identity.original); setFormat(identity.format)
      result.current?.focus({ preventScroll: true })
    }
  }, [identity])
  useEffect(() => { if (editing) input.current?.focus() }, [editing])
  useEffect(() => { if (state === 'invalid' && editing) input.current?.focus() }, [state, editing])

  return <section className={styles.barcodePanel} data-testid="capture-barcode" data-decoder-state={state}>
    <p role="status" aria-live="polite" aria-atomic="true" id="barcode-status" data-testid="barcode-status">{identity && !product ? (real ? t.real : t.unknown) : t[state]}</p>
    {identity && <div ref={result} tabIndex={-1} className={styles.barcodeResult} data-testid="barcode-result" aria-label={product ? product.name[locale] : real ? real.name : t.unknown}>
      <strong>{product ? t.provenance : real ? t.real : t.unknown}</strong>
      <p>{product ? `${product.category[locale]} · ${product.size[locale]}` : real ? [real.manufacturer, real.quantity].filter(Boolean).join(' · ') || real.name : lookup?.state === 'missing' ? t.missing : lookup?.state === 'error' ? t.lookupError : lookup ? t.checking : t.unknownBody}</p>
      {real && <div className={styles.catalogPrices} data-testid="catalog-prices">
        <p>{t.prices} · {real.prices.length}/{real.storesInArea} {t.stores}</p>
        <ul>{real.prices.slice(0, 5).map(entry => <li key={entry.store.id}><span><bdi>{entry.store.chainName[locale]}</bdi> · <bdi>{entry.store.name}</bdi></span><strong>{money(entry.price)}{real.weighted ? ` ${t.perKg}` : ''}</strong></li>)}</ul>
        {real.prices.length > 5 && <p>+{real.prices.length - 5} {t.more} · {money(real.prices.at(-1)!.price)}</p>}
        <small>{t.priceNote.replace('{date}', real.prices[0].store.publishedLocal.slice(0, 10))}</small>
      </div>}
      <label>{t.name}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} data-testid="barcode-product-name" /></label>
      <p>{t.original}: <bdi dir="ltr" data-testid="barcode-original">{identity.original}</bdi> · {identity.format}</p>
      <p>{t.normalized}: <bdi dir="ltr" data-testid="barcode-normalized">{identity.gtin14}</bdi></p>
      <p>{t.note}</p>
      <button type="button" className={styles.primary} data-testid="barcode-review-purchase" onClick={() => onCandidate(name, Boolean(product), real && !real.weighted ? Object.fromEntries(real.prices.map(entry => [entry.store.id, entry.price])) : undefined)}>{t.continue}</button>
    </div>}
    {(demoLoaded || product?.id === barcodeDemoCatalog[0].id) && <p role="status" data-testid="barcode-demo-loaded">{t.loaded}</p>}
    <div className={styles.barcodeActions}>
      <button type="button" className={styles.secondary} data-testid="barcode-manual-open" aria-expanded={editing} onClick={() => { onCancel(); setEditing((value) => !value) }}>{t.manual}</button>
      <button type="button" className={styles.secondary} data-testid="barcode-demo" disabled={product?.id === barcodeDemoCatalog[0].id} onClick={() => { const demo = barcodeDemoCatalog[0]; onDemo(demo.barcode, demo.format); setDemoLoaded(true) }}>{t.demo}</button>
      {['empty', 'invalid', 'load-error', 'decode-error', 'found'].includes(state) && <button type="button" className={styles.secondary} data-testid="barcode-retry" onClick={onRetry}>{t.retry}</button>}
      {identity && <button type="button" className={styles.secondary} data-testid="barcode-reset" onClick={() => { onReset(); setCode(''); setName(''); setEditing(false) }}>{t.reset}</button>}
    </div>
    {editing && <form className={styles.barcodeForm} onSubmit={(event) => { event.preventDefault(); onManual(code, format) }}>
      <label>{t.format}<select value={format} onChange={(e) => setFormat(e.target.value as BarcodeFormat)} data-testid="barcode-format">{barcodeFormats.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>{t.code}<input ref={input} type="text" inputMode="numeric" autoComplete="off" spellCheck={false} dir="ltr" maxLength={32} value={code} onChange={(e) => setCode(e.target.value)} data-testid="barcode-input" aria-invalid={state === 'invalid'} aria-describedby="barcode-status" /></label>
      <button type="submit" className={styles.primary} data-testid="barcode-submit">{t.identify}</button>
    </form>}
  </section>
}
