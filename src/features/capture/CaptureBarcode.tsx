'use client'

import { useEffect, useRef, useState } from 'react'
import type { LocaleCode } from '@/data/spendscape-globe'
import { barcodeFormats, type BarcodeFormat, type BarcodeIdentity } from './barcode-domain'
import { barcodeDemoCatalog, lookupDemoProduct } from './barcode-demo-catalog'
import type { DecoderState } from './barcode-session'
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
    demo: 'Try demo product', provenance: 'Synthetic demo catalog · fictional product',
    unknown: 'Unknown barcode', unknownBody: 'The code is valid, but is not in this small demo catalog. No real product lookup was made.',
    name: 'Product name for review', note: 'Identification only. Nothing is added to your purchases. Price, merchant, date and place are unknown.',
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
    demo: 'ניסיון מוצר הדגמה', provenance: 'קטלוג הדגמה סינתטי · מוצר בדיוני',
    unknown: 'ברקוד לא מוכר', unknownBody: 'הקוד תקין, אך אינו בקטלוג ההדגמה הקטן. לא בוצע חיפוש מוצר אמיתי.',
    name: 'שם מוצר לבדיקה', note: 'זיהוי בלבד. דבר לא נוסף לרכישות. המחיר, בית העסק, התאריך והמקום אינם ידועים.',
    retry: 'ניסיון סריקה נוסף', reset: 'ניקוי תוצאה', original: 'הקוד שנסרק', normalized: 'GTIN מקביל',
  },
} as const

export function CaptureBarcode({ locale, state, identity, onManual, onCancel, onRetry, onReset }: {
  locale: LocaleCode; state: DecoderState; identity: BarcodeIdentity | null
  onManual: (code: string, format: string) => void; onCancel: () => void; onRetry: () => void; onReset: () => void
}) {
  const t = copy[locale]
  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState('')
  const [format, setFormat] = useState<BarcodeFormat>('EAN13')
  const [name, setName] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const result = useRef<HTMLDivElement>(null)
  const product = identity ? lookupDemoProduct(identity) : undefined
  useEffect(() => { setName(product?.name[locale] ?? '') }, [product, locale, identity])
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
    <p role="status" aria-live="polite" aria-atomic="true" id="barcode-status" data-testid="barcode-status">{identity && !product ? t.unknown : t[state]}</p>
    {identity && <div ref={result} tabIndex={-1} className={styles.barcodeResult} data-testid="barcode-result" aria-label={product ? product.name[locale] : t.unknown}>
      <strong>{product ? t.provenance : t.unknown}</strong>
      <p>{product ? `${product.category[locale]} · ${product.size[locale]}` : t.unknownBody}</p>
      <label>{t.name}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} data-testid="barcode-product-name" /></label>
      <p>{t.original}: <bdi dir="ltr" data-testid="barcode-original">{identity.original}</bdi> · {identity.format}</p>
      <p>{t.normalized}: <bdi dir="ltr" data-testid="barcode-normalized">{identity.gtin14}</bdi></p>
      <p>{t.note}</p>
    </div>}
    <div className={styles.barcodeActions}>
      <button type="button" className={styles.secondary} data-testid="barcode-manual-open" aria-expanded={editing} onClick={() => { onCancel(); setEditing((value) => !value) }}>{t.manual}</button>
      <button type="button" className={styles.secondary} data-testid="barcode-demo" onClick={() => { const demo = barcodeDemoCatalog[0]; onManual(demo.barcode, demo.format) }}>{t.demo}</button>
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
