'use client'
import { useEffect, useRef, useState } from 'react'
import type { LocaleCode } from '../../data/spendscape-globe'
import type { ReceiptReviewDraft } from '../capture/receipt-review-adapter'
import {validReceiptFailure,type ReceiptFailure} from './receipt-failure'
import { inspectReceiptImage } from './image-input'
import { ReceiptImageSession, type ImageState } from './image-session'
import {INSPECTION_MS,validateParserInspection,type ParserInspection} from './parser-inspection'
import styles from '../capture/CaptureExperience.module.css'

const copy = {
  en: { title: 'Receipt photo', body: 'Choose a JPEG or PNG, up to 4 MB and 12 million pixels. The photo stays temporary on this device. Receipt recognition is not activated; no photo is sent to a provider.', photo: 'Take receipt photo', upload: 'Choose receipt image', read: 'Read receipt', cancel: 'Discard photo', preview: 'Temporary receipt preview', validating: 'Checking the image…', reading: 'Preparing receipt observations…', unavailable: 'Receipt recognition is unavailable. The photo was discarded. Use manual entry.', format: 'Use a valid JPEG or PNG. HEIC, PDFs and other formats are not supported yet.', size: 'Choose an image up to 4 MB, 32–6,000 pixels per side and 12 million pixels in total.', failed: 'No reliable draft is available. The photo was discarded. Choose another image or use manual entry.', timeout: 'The operation timed out. The photo was discarded. Nothing was saved.', qa: 'Local QA only · fictional OCR, independent of the selected image. No recognition accuracy is claimed.', ready: 'Image checked. Review is required before any purchase is saved.' },
  he: { title: 'צילום קבלה', body: 'בחרו JPEG או PNG עד 4 MB ועד 12 מיליון פיקסלים. הצילום זמני במכשיר הזה. זיהוי קבלות אינו פעיל; שום צילום לא נשלח לספק.', photo: 'צילום קבלה', upload: 'בחירת תמונת קבלה', read: 'קריאת קבלה', cancel: 'מחיקת הצילום הזמני', preview: 'תצוגה זמנית של הקבלה', validating: 'בודקים את התמונה…', reading: 'מכינים תצפיות לבדיקה…', unavailable: 'זיהוי קבלות אינו זמין. הצילום הזמני נמחק. אפשר להזין ידנית.', format: 'יש לבחור JPEG או PNG תקינים. HEIC, PDF ופורמטים אחרים עדיין אינם נתמכים.', size: 'בחרו תמונה עד 4 MB, בין 32 ל־6,000 פיקסלים בכל צלע ועד 12 מיליון פיקסלים בסך הכול.', failed: 'אין טיוטה מהימנה. הצילום הזמני נמחק. בחרו תמונה אחרת או הזינו ידנית.', timeout: 'זמן הפעולה הסתיים. הצילום הזמני נמחק. דבר לא נשמר.', qa: 'בדיקה מקומית בלבד · OCR בדיוני שאינו תלוי בתמונה שנבחרה. אין טענה לדיוק זיהוי.', ready: 'התמונה נבדקה. נדרשת בדיקה מפורשת לפני שמירת רכישה.' },
} as const
export function ReceiptImageIntake({ locale, onDraft }: { locale: LocaleCode; onDraft: (draft: ReceiptReviewDraft) => void }) {
  const [state, setState] = useState<ImageState>({ phase: 'idle', preview: null, code: null })
  const [qa, setQa] = useState(false)
  const [live, setLive] = useState(false)
  const directFailure = useRef<HTMLParagraphElement>(null)
  const [operational, setOperational] = useState(false)
  const [capabilityChecked, setCapabilityChecked] = useState(false)
  const [budget, setBudget] = useState<{used:number;maxRequests:number;state:string}|null>(null)
  const [direct, setDirect] = useState(false), [directQa, setDirectQa] = useState(false), [directError, setDirectError] = useState<{httpStatus?:number;code:string;receiptFailure?:ReceiptFailure}|null>(null)
  const [inspectionAvailable,setInspectionAvailable]=useState(false),[inspection,setInspection]=useState<ParserInspection|null>(null)
  const inspectOptIn=useRef(false)
  const fixture = useRef<'one' | 'fifteen'>('one'), complete = useRef(onDraft), session = useRef<ReceiptImageSession | null>(null)
  complete.current = onDraft
  const t = copy[locale], photo = useRef<HTMLInputElement>(null), upload = useRef<HTMLInputElement>(null), read = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const local = ['localhost','127.0.0.1','[::1]'].includes(location.hostname)
    const captureQa = local && new URLSearchParams(location.search).get('receiptCaptureQa') === '1'
    const captureHeaders = {'x-spendscape-local-gemini':'1',...(captureQa?{'x-spendscape-capture-qa':'1'}:{})}
    const structuredOpted = local && new URLSearchParams(location.search).get('receiptStructuredLocal') === '1'
    const directOpted = structuredOpted || local && new URLSearchParams(location.search).get('receiptGeminiLocal') === '1'
    let directEndpoint = structuredOpted ? '/api/receipt-structured' : '/api/receipt-direct'
    let operationalAvailable = false
    const optedIn = !directOpted && ['localhost','127.0.0.1','[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('receiptImageQa') === '1'
    const liveOpted = !directOpted && !optedIn && ['localhost','127.0.0.1','[::1]'].includes(location.hostname) && new URLSearchParams(location.search).get('receiptVisionLocal') === '1'
    const capability = new AbortController()
    let available = false
    let check: Promise<unknown> | null = null
    if (liveOpted) check = fetch('/api/receipt-ocr', { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: capability.signal, headers: { 'x-spendscape-local-vision': '1' } }).then(async res => { const value = await res.json(); if (!capability.signal.aborted && res.ok && value.code === 'local-vision-ready') { available = true; setLive(true);setInspectionAvailable(value.inspectionAvailable===true) } }).catch(() => {})
    if (directOpted) check = fetch(directEndpoint, {cache:'no-store',credentials:'omit',redirect:'error',signal:capability.signal,headers:{'x-spendscape-local-gemini':'1'}}).then(async res=>{const v=await res.json();if(!capability.signal.aborted && res.ok && v.code==='local-gemini-ready' && ['native','fictional-qa'].includes(v.mode)){available=true;setDirect(true);setDirectQa(v.mode==='fictional-qa')}}).catch(()=>{})
    if (local && !directOpted && !liveOpted && !optedIn) check = fetch('/api/receipt-capture-session', {cache:'no-store',credentials:'omit',redirect:'error',signal:capability.signal,headers:captureHeaders}).then(async res=>{const v=await res.json();if(!capability.signal.aborted && res.ok && v.code==='local-capture-ready' && (v.mode==='native'||captureQa&&v.mode==='fictional-qa')){available=true;operationalAvailable=true;directEndpoint='/api/receipt-capture-session';setOperational(true);setDirect(true);setDirectQa(v.mode==='fictional-qa');setBudget(v.session)}}).catch(()=>{})
    if (check) void check.finally(() => { if (!capability.signal.aborted) setCapabilityChecked(true) })
    else setCapabilityChecked(true)
    setQa(optedIn)
    const current = new ReceiptImageSession({ inspect: inspectReceiptImage, createUrl: file => URL.createObjectURL(file), revokeUrl: url => URL.revokeObjectURL(url), state: value=>{if(['idle','validating','reading'].includes(value.phase)){setInspection(null);setDirectError(null)}setState(value)}, complete: draft => complete.current(draft), extract: async (signal, file) => {
      if (!optedIn && (!(liveOpted||directOpted||operationalAvailable) || !available)) throw new Error('ocr-unavailable')
      const res = await fetch((directOpted||operationalAvailable)?directEndpoint:'/api/receipt-ocr', { method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error', signal, headers: (directOpted||operationalAvailable) ? {'Content-Type':file.type,...captureHeaders,'x-spendscape-direct-fixture':fixture.current} : optedIn ? { 'Content-Type': 'application/json', 'x-spendscape-local-qa': '1' } : { 'Content-Type': file.type, 'x-spendscape-local-vision': '1',...(inspectOptIn.current?{'x-spendscape-parser-inspection':'1'}:{}) }, body: optedIn ? JSON.stringify({ fixture: fixture.current }) : file })
      // Bound response bytes before JSON parsing; no provider payload reaches UI.
      const reader = res.body?.getReader(); if (!reader) throw new Error('ocr-invalid')
      let body = '', count = 0
      const decoder = new TextDecoder('utf-8', { fatal: true })
      try { while (true) { const chunk = await reader.read(); if (chunk.done) break; count += chunk.value.byteLength; if (count > (inspectOptIn.current?256_000:64_000)) { await reader.cancel(); throw new Error('ocr-invalid') }; body += decoder.decode(chunk.value, { stream: true }) }; body += decoder.decode() } finally { reader.releaseLock() }
      if (signal.aborted) throw new Error('cancelled')
      const value = JSON.parse(body)
      if(operationalAvailable) void fetch(directEndpoint,{cache:'no-store',credentials:'omit',redirect:'error',signal:capability.signal,headers:captureHeaders}).then(async r=>{const v=await r.json();if(!capability.signal.aborted && r.ok)setBudget(v.session)}).catch(()=>{})
      if(inspectOptIn.current && validateParserInspection(value.inspection)){if(document.hidden)throw new Error('cancelled');setInspection(value.inspection);throw new Error(value.code==='parser-inspection'?'parser-inspection':'layout-unsupported')}
      if((directOpted||operationalAvailable) && !res.ok){const codes=['attempt-consumed','pilot-wait','pilot-stopped','authentication-failed','transport-failed','recognition-failed','diagnostics-unavailable','image-not-approved','ocr-invalid','cancelled'];if(codes.includes(value.code))setDirectError({code:value.code,...(operationalAvailable&&validReceiptFailure(value.receiptFailure)?{receiptFailure:value.receiptFailure}:{}),...(Number.isInteger(value.httpStatus)&&value.httpStatus>=100&&value.httpStatus<=599?{httpStatus:value.httpStatus}:{})})}
      if (!res.ok || value.code !== ((directOpted||operationalAvailable)?'direct-observations':optedIn ? 'synthetic-qa' : 'vision-observations')) throw new Error(value.code === 'ocr-unavailable' ? 'ocr-unavailable' : 'ocr-invalid')
      return value.observations
    } }, directOpted || local && !liveOpted && !optedIn ? 50_000 : liveOpted ? 30_000 : 15_000)
    session.current = current
    // Listen before a response exists. Cancellation invalidates this generation
    // even if the tab becomes visible again before the response arrives.
    const clearHidden = () => { if (document.hidden) { setInspection(null); if (inspectOptIn.current || directOpted || operationalAvailable) current.cancel() } }
    document.addEventListener('visibilitychange', clearHidden)
    return () => { document.removeEventListener('visibilitychange', clearHidden); capability.abort(); current.dispose(); if (session.current === current) session.current = null }
  }, [])
  useEffect(()=>{if(directError){directFailure.current?.focus({preventScroll:true});directFailure.current?.scrollIntoView({block:'nearest'})}},[directError])
  useEffect(()=>{if(!inspection)return;const timer=setTimeout(()=>setInspection(null),INSPECTION_MS);return()=>clearTimeout(timer)},[inspection])
  useEffect(() => {
    if (state.phase !== 'ready') return
    read.current?.focus({ preventScroll: true })
    const frame = requestAnimationFrame(() => read.current?.scrollIntoView({ block: 'center' }))
    return () => cancelAnimationFrame(frame)
  }, [state.phase])
  const choose = (input: HTMLInputElement) => { const file = input.files?.[0]; input.value = ''; if (file) void session.current?.select(file) }
  const message = state.code === 'parser-inspection' ? (locale==='he'?'הבדיקה הזמנית הושלמה. לא נוצרה טיוטה לשמירה.':'Temporary inspection complete. No purchase draft was created.') : state.code === 'ocr-unavailable' ? t.unavailable : state.code === 'image-format' ? t.format : state.code === 'image-size' ? t.size : state.code === 'timeout' ? t.timeout : state.code ? t.failed : state.phase === 'validating' ? t.validating : state.phase === 'reading' ? t.reading : state.phase === 'ready' ? capabilityChecked ? t.ready : locale==='he'?'בודקים זמינות קריאת קבלות…':'Checking receipt-reading availability…' : ''
  return <div className={`${styles.scrollBody} ${styles.receiptImage}`} data-testid="receipt-image-intake" data-phase={state.phase}>
    <h2 id="capture-title">{t.title}</h2><p id="capture-description">{directQa ? (locale==='he'?'בדיקה מקומית עם תצפיות בדיוניות בלבד. שום צילום לא נשלח לספק. יש לבדוק ולתקן לפני שמירה.':'Local QA with fictional observations only. No photo is sent to a provider. Review and correct before saving.') : operational ? (locale==='he'?'קריאת קבלה שולחת את התמונה ל־Google Gemini בחיבור המקומי הפרטי. הסירו פרטי תשלום ופרטים אישיים שאינם נחוצים. Google מעבדת את התוכן לפי תנאי השירות בתשלום ועשויה לשמור אותו לזמן מוגבל למניעת שימוש לרעה. אצלנו הצילום והתצפיות זמניים. בדקו כל פריט לפני שמירה; אין שמירה אוטומטית.':'Read receipt sends this image to Google Gemini through your private local session. Remove payment details and unrelated personal information first. Google processes content under its paid-service terms and may retain it temporarily for abuse prevention. This app keeps images and observations temporary. Check every item before saving; saving is never automatic.') : direct ? (locale==='he'?'בדיקה מקומית מוגבלת: קריאת קבלה שולחת את הצילום שאושר ל־Gemini. בשכבה החינמית Google עשויה להשתמש בתוכן לשיפור מוצרים. אין שמירת צילום במכשיר. יש להשוות כל פריט ומספר ולתקן לפני שמירה.':'Bounded local pilot: Read receipt sends the approved crop to Gemini. Google may use Free-tier content to improve products. The photo is not retained on this device. Compare every item and number and correct them before saving.') : live ? (locale === 'he' ? 'בדיקה מקומית אחת בלבד: לחיצה על קריאת קבלה תשלח רק את הצילום החתוך שאושר ל־Google Vision. הצילום והתצפיות זמניים. נדרשת בדיקה מפורשת לפני שמירה.' : 'One local validation only: Read receipt sends only the approved cropped photo to Google Vision. The photo and observations are temporary. Explicit review is required before saving.') : t.body}</p>
    {(qa||directQa) && <div className={styles.imageQa} data-testid="receipt-image-qa"><p>{directQa?(locale==='he'?'בדיקה מקומית בלבד · תוצאת מודל בדיונית; ללא קריאת ספק.':'Local QA only · fictional model output; no provider call.'):t.qa}</p><label>{locale === 'he' ? 'דוגמה בדיונית' : 'Fictional fixture'}<select data-testid="receipt-image-fixture" defaultValue="one" onChange={e => { session.current?.cancel(); fixture.current = e.target.value as 'one' | 'fifteen' }}><option value="one">1 item</option><option value="fifteen">15 items</option></select></label></div>}
    {operational && budget && <p role="status" data-testid="receipt-session-budget">{locale==='he'?'קריאות שנשמרו בתקציב':'Reserved reads'}: {budget.used}/{budget.maxRequests}. {locale==='he'?'זמן ההמתנה בין קריאות: דקה. אין ניסיון חוזר אוטומטי.':'Allow one minute between reads. No automatic retry.'}</p>}
    {directError && <p ref={directFailure} tabIndex={-1} role="alert" data-testid="receipt-direct-error">{operational ? (directError.code==='attempt-consumed' ? (locale==='he'?'התמונה הזאת כבר נשלחה במפגש הזה. השתמשו בטיוטה או ברכישה הקיימת.':'This image was already submitted in this session. Use its existing draft or purchase.') : directError.code==='pilot-wait' ? (locale==='he'?'קריאה קודמת עדיין בתהליך, נקטעה, או נדרשת המתנה של דקה. שום בקשה נוספת לא נשלחה.':'A previous read is active, interrupted, or still within the one-minute interval. No additional request was sent.') : (locale==='he'?'הקריאה נעצרה או שתקציב המפגש הסתיים. אין לנסות שוב את התמונה הזאת.':'The read stopped or this session ended. Do not retry this image.')) : (locale==='he'?'הניסיון נעצר. אין לנסות שוב.':'The attempt stopped. Do not retry.')} <bdi>{directError.httpStatus?`HTTP ${directError.httpStatus} · `:''}{directError.code}</bdi>{directError.receiptFailure && <bdi data-testid="receipt-response-diagnostic" dir="ltr" style={{display:'block',overflowWrap:'anywhere'}}>{directError.receiptFailure.category} · {directError.receiptFailure.path}{directError.receiptFailure.finishReason?` · ${directError.receiptFailure.finishReason}`:''}</bdi>}</p>}
    {inspectionAvailable && <label><input type="checkbox" data-testid="parser-inspection-opt-in" disabled={state.phase==='reading'} onChange={e=>{inspectOptIn.current=e.target.checked;setInspection(null)}} />{locale==='he'?'בדיקת שורות מקומית וזמנית בלבד — ללא שמירה':'Temporary local row inspection only — no saving'}</label>}
    {inspection && <section aria-label={locale==='he'?'בדיקת שורות זמנית':'Temporary row inspection'} data-testid="parser-inspection" dir={locale==='he'?'rtl':'ltr'}>
      <p>{locale==='he'?'תוכן זמני בלבד. יימחק תוך שתי דקות או בסגירה. שורה שלא סווגה עשויה להיות שורה שטרם נבדקה.':'Memory only. Cleared after two minutes or on close. Unassigned can also mean not yet reached.'}</p>
      <p data-testid="parser-inspection-reason">{inspection.reason??(locale==='he'?'אין דחיית מבנה':'No layout rejection')}</p>
      <button type="button" className={styles.secondary} data-testid="parser-inspection-close" onClick={()=>setInspection(null)}>{locale==='he'?'סגירת הבדיקה':'Close inspection'}</button>
      <ol>{inspection.rows.map((row,i)=><li key={i} data-testid="parser-inspection-row"><strong>{i+1} · {row.kind}{row.rejected?' · REJECTED':''}</strong><p dir="auto">{row.words.map(index=>inspection.document.words[index].text).join(' ')}</p><details><summary>{locale==='he'?'מיקום המילים':'Word geometry'}</summary><ul>{row.words.map(index=>{const w=inspection.document.words[index];return <li key={index} dir="auto">{w.text} · x={w.x}, y={w.y}, w={w.width}, h={w.height}</li>})}</ul></details></li>)}</ol>
    </section>}
    <input ref={photo} type="file" accept="image/jpeg,image/png" capture="environment" aria-label={t.photo} data-testid="receipt-photo-input" className={styles.imageInput} onChange={e => choose(e.currentTarget)} />
    <input ref={upload} type="file" accept="image/jpeg,image/png" aria-label={t.upload} data-testid="receipt-upload-input" className={styles.imageInput} onChange={e => choose(e.currentTarget)} />
    <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => photo.current?.click()} data-testid="receipt-photo">{t.photo}</button><button type="button" className={styles.secondary} onClick={() => upload.current?.click()} data-testid="receipt-upload">{t.upload}</button></div>
    {state.preview && <img src={state.preview} alt={t.preview} className={styles.receiptPreview} data-testid="receipt-image-preview" onLoad={() => { if (state.phase === 'ready' && document.activeElement === read.current) read.current?.scrollIntoView({ block: 'center' }) }} />}
    <p role="status" aria-live="polite" aria-atomic="true" data-testid="receipt-image-status">{message}</p>
    <div className={styles.actions}><button ref={read} type="button" className={styles.primary} disabled={state.phase !== 'ready' || !capabilityChecked} onClick={() => { void session.current?.read() }} data-testid="receipt-image-read">{t.read}</button>{state.phase !== 'idle' && <button type="button" className={styles.secondary} onClick={() => session.current?.cancel()} data-testid="receipt-image-discard">{t.cancel}</button>}</div>
  </div>
}
