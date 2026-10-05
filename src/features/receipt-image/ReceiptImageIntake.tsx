'use client'
import { useEffect, useRef, useState } from 'react'
import type { LocaleCode } from '../../data/spendscape-globe'
import type { ReceiptReviewDraft } from '../capture/receipt-review-adapter'
import { inspectReceiptImage } from './image-input'
import { ReceiptImageSession, type ImageState } from './image-session'
import styles from '../capture/CaptureExperience.module.css'

const copy = {
  en: { title: 'Receipt photo', body: 'Choose a JPEG or PNG, up to 4 MB and 12 million pixels. The photo stays temporary on this device. Receipt recognition is not activated; no photo is sent to a provider.', photo: 'Take receipt photo', upload: 'Choose receipt image', read: 'Read receipt', cancel: 'Discard photo', preview: 'Temporary receipt preview', validating: 'Checking the image…', reading: 'Preparing receipt observations…', unavailable: 'Receipt recognition is unavailable. The photo was discarded. Use manual entry or a built-in demo.', format: 'Use a valid JPEG or PNG. HEIC, PDFs and other formats are not supported yet.', size: 'Choose an image up to 4 MB, 32–6,000 pixels per side and 12 million pixels in total.', failed: 'No reliable draft is available. The photo was discarded. Choose another image or use manual entry.', timeout: 'The operation timed out. The photo was discarded. Nothing was saved.', qa: 'Local QA only · fictional OCR, independent of the selected image. No recognition accuracy is claimed.', ready: 'Image checked. Review is required before any purchase is saved.' },
  he: { title: 'צילום קבלה', body: 'בחרו JPEG או PNG עד 4 MB ועד 12 מיליון פיקסלים. הצילום זמני במכשיר הזה. זיהוי קבלות אינו פעיל; שום צילום לא נשלח לספק.', photo: 'צילום קבלה', upload: 'בחירת תמונת קבלה', read: 'קריאת קבלה', cancel: 'מחיקת הצילום הזמני', preview: 'תצוגה זמנית של הקבלה', validating: 'בודקים את התמונה…', reading: 'מכינים תצפיות לבדיקה…', unavailable: 'זיהוי קבלות אינו זמין. הצילום הזמני נמחק. אפשר להזין ידנית או להשתמש בהדגמה מובנית.', format: 'יש לבחור JPEG או PNG תקינים. HEIC, PDF ופורמטים אחרים עדיין אינם נתמכים.', size: 'בחרו תמונה עד 4 MB, בין 32 ל־6,000 פיקסלים בכל צלע ועד 12 מיליון פיקסלים בסך הכול.', failed: 'אין טיוטה מהימנה. הצילום הזמני נמחק. בחרו תמונה אחרת או הזינו ידנית.', timeout: 'זמן הפעולה הסתיים. הצילום הזמני נמחק. דבר לא נשמר.', qa: 'בדיקה מקומית בלבד · OCR בדיוני שאינו תלוי בתמונה שנבחרה. אין טענה לדיוק זיהוי.', ready: 'התמונה נבדקה. נדרשת בדיקה מפורשת לפני שמירת רכישה.' },
} as const
export function ReceiptImageIntake({ locale, onDraft }: { locale: LocaleCode; onDraft: (draft: ReceiptReviewDraft) => void }) {
  const [state, setState] = useState<ImageState>({ phase: 'idle', preview: null, code: null })
  const [qa, setQa] = useState(false)
  const [live, setLive] = useState(false)
  const fixture = useRef<'one' | 'fifteen'>('one'), complete = useRef(onDraft), session = useRef<ReceiptImageSession | null>(null)
  complete.current = onDraft
  const t = copy[locale], photo = useRef<HTMLInputElement>(null), upload = useRef<HTMLInputElement>(null), read = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const optedIn = ['localhost','127.0.0.1','[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('receiptImageQa') === '1'
    const liveOpted = !optedIn && ['localhost','127.0.0.1','[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('receiptVisionLocal') === '1'
    const capability = new AbortController()
    let available = false
    if (liveOpted) void fetch('/api/receipt-ocr', { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: capability.signal, headers: { 'x-spendscape-local-vision': '1' } }).then(async res => { const value = await res.json(); if (!capability.signal.aborted && res.ok && value.code === 'local-vision-ready') { available = true; setLive(true) } }).catch(() => {})
    setQa(optedIn)
    const current = new ReceiptImageSession({ inspect: inspectReceiptImage, createUrl: file => URL.createObjectURL(file), revokeUrl: url => URL.revokeObjectURL(url), state: setState, complete: draft => complete.current(draft), extract: async (signal, file) => {
      if (!optedIn && (!liveOpted || !available)) throw new Error('ocr-unavailable')
      const res = await fetch('/api/receipt-ocr', { method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error', signal, headers: optedIn ? { 'Content-Type': 'application/json', 'x-spendscape-local-qa': '1' } : { 'Content-Type': file.type, 'x-spendscape-local-vision': '1' }, body: optedIn ? JSON.stringify({ fixture: fixture.current }) : file })
      // Bound response bytes before JSON parsing; no provider payload reaches UI.
      const reader = res.body?.getReader(); if (!reader) throw new Error('ocr-invalid')
      let body = '', count = 0
      const decoder = new TextDecoder('utf-8', { fatal: true })
      try { while (true) { const chunk = await reader.read(); if (chunk.done) break; count += chunk.value.byteLength; if (count > 64_000) { await reader.cancel(); throw new Error('ocr-invalid') }; body += decoder.decode(chunk.value, { stream: true }) }; body += decoder.decode() } finally { reader.releaseLock() }
      if (signal.aborted) throw new Error('cancelled')
      const value = JSON.parse(body)
      if (!res.ok || value.code !== (optedIn ? 'synthetic-qa' : 'vision-observations')) throw new Error(value.code === 'ocr-unavailable' ? 'ocr-unavailable' : 'ocr-invalid')
      return value.observations
    } }, liveOpted ? 30_000 : 15_000)
    session.current = current
    return () => { capability.abort(); current.dispose(); if (session.current === current) session.current = null }
  }, [])
  useEffect(() => {
    if (state.phase !== 'ready') return
    read.current?.focus({ preventScroll: true })
    const frame = requestAnimationFrame(() => read.current?.scrollIntoView({ block: 'center' }))
    return () => cancelAnimationFrame(frame)
  }, [state.phase])
  const choose = (input: HTMLInputElement) => { const file = input.files?.[0]; input.value = ''; if (file) void session.current?.select(file) }
  const message = state.code === 'ocr-unavailable' ? t.unavailable : state.code === 'image-format' ? t.format : state.code === 'image-size' ? t.size : state.code === 'timeout' ? t.timeout : state.code ? t.failed : state.phase === 'validating' ? t.validating : state.phase === 'reading' ? t.reading : state.phase === 'ready' ? t.ready : ''
  return <div className={`${styles.scrollBody} ${styles.receiptImage}`} data-testid="receipt-image-intake" data-phase={state.phase}>
    <h2 id="capture-title">{t.title}</h2><p id="capture-description">{live ? (locale === 'he' ? 'בדיקה מקומית אחת בלבד: לחיצה על קריאת קבלה תשלח רק את הצילום החתוך שאושר ל־Google Vision. הצילום והתצפיות זמניים. נדרשת בדיקה מפורשת לפני שמירה.' : 'One local validation only: Read receipt sends only the approved cropped photo to Google Vision. The photo and observations are temporary. Explicit review is required before saving.') : t.body}</p>
    {qa && <div className={styles.imageQa} data-testid="receipt-image-qa"><p>{t.qa}</p><label>{locale === 'he' ? 'דוגמה בדיונית' : 'Fictional fixture'}<select data-testid="receipt-image-fixture" defaultValue="one" onChange={e => { session.current?.cancel(); fixture.current = e.target.value as 'one' | 'fifteen' }}><option value="one">1 item</option><option value="fifteen">15 items</option></select></label></div>}
    <input ref={photo} type="file" accept="image/jpeg,image/png" capture="environment" aria-label={t.photo} data-testid="receipt-photo-input" className={styles.imageInput} onChange={e => choose(e.currentTarget)} />
    <input ref={upload} type="file" accept="image/jpeg,image/png" aria-label={t.upload} data-testid="receipt-upload-input" className={styles.imageInput} onChange={e => choose(e.currentTarget)} />
    <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => photo.current?.click()} data-testid="receipt-photo">{t.photo}</button><button type="button" className={styles.secondary} onClick={() => upload.current?.click()} data-testid="receipt-upload">{t.upload}</button></div>
    {state.preview && <img src={state.preview} alt={t.preview} className={styles.receiptPreview} data-testid="receipt-image-preview" onLoad={() => { if (state.phase === 'ready' && document.activeElement === read.current) read.current?.scrollIntoView({ block: 'center' }) }} />}
    <p role="status" aria-live="polite" aria-atomic="true" data-testid="receipt-image-status">{message}</p>
    <div className={styles.actions}><button ref={read} type="button" className={styles.primary} disabled={state.phase !== 'ready'} onClick={() => { void session.current?.read() }} data-testid="receipt-image-read">{t.read}</button>{state.phase !== 'idle' && <button type="button" className={styles.secondary} onClick={() => session.current?.cancel()} data-testid="receipt-image-discard">{t.cancel}</button>}</div>
  </div>
}
