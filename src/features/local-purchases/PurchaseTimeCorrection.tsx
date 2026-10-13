'use client'
import {useEffect,useRef,useState} from 'react'
import type {GlobePurchase,LocaleCode} from '../../data/spendscape-globe'
import {receiptReviewZone} from '../capture/receipt-review-prefill'
import {receiptTimeCandidates} from '../capture/receipt-review-time'
import {purchaseWallTime,type PurchaseTimeIntent} from './purchase-time'
import styles from './PurchaseTimeCorrection.module.css'

export function PurchaseTimeCorrection({purchase,locale,onConfirm}:{purchase:GlobePurchase;locale:LocaleCode;onConfirm:(intent:PurchaseTimeIntent)=>Promise<Record<string,string>>}) {
 const he=locale==='he', [editing,setEditing]=useState(false), [zone,setZone]=useState(receiptReviewZone), [wall,setWall]=useState(''), [occurrence,setOccurrence]=useState<PurchaseTimeIntent['occurrence']>(''), [confirmed,setConfirmed]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState(''), pending=useRef(false), button=useRef<HTMLButtonElement>(null)
 const alive=useRef(true)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const candidates=receiptTimeCandidates(wall,zone)
 const reset=()=>{setConfirmed(false);setOccurrence('');setError('')}
 const messages:Record<string,string>={invalid:he?'יש להזין תאריך ושעה תקינים ולבחור אזור זמן.':'Enter a valid date/time and choose its timezone.',confirmation:he?'יש לאשר את התאריך, השעה ואזור הזמן.':'Confirm the date, time and timezone.',ambiguous:he?'השעה מופיעה פעמיים במעבר שעון; בחרו את המופע הנכון.':'This time occurs twice during a clock change; choose its occurrence.',duplicate:he?'התיקון יתאים לרכישה קיימת; לא נשמר שינוי.':'This correction would match an existing purchase; no change saved.',storage:he?'השינוי לא נשמר. האחסון השתנה או אינו זמין; התאריך הקודם נשאר.':'Change not saved. Storage changed or is unavailable; the previous date remains.',protected:he?'לא ניתן לתקן רשומה זו כאן.':'This record cannot be corrected here.'}
 return <section className={styles.section} data-testid="purchase-time-section" aria-labelledby="purchase-time-heading">
  <h3 id="purchase-time-heading">{he?'תאריך ושעת הרכישה':'Purchase date and time'}</h3>
  <p><bdi dir="ltr"><time data-testid="saved-purchase-timestamp" dateTime={purchase.timestamp}>{purchaseWallTime(purchase.timestamp,receiptReviewZone).replace('T',' ')} · {receiptReviewZone}</time></bdi></p>
  <small>{he?'אזור הזמן מוצג לפי העדפת הבדיקה שלך; הוא אינו נתון ששמור בקבלה.':'Shown in your review timezone; the timezone is not a stored receipt observation.'}</small>
  {!editing?<button ref={button} type="button" data-testid="purchase-correct-time" onClick={()=>{setWall(purchaseWallTime(purchase.timestamp,zone));reset();setEditing(true)}}>{he?'תיקון התאריך והשעה':'Correct date and time'}</button>:<form data-testid="purchase-time-form" aria-busy={busy} onSubmit={async e=>{
   e.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setError('')
   try {const result=await onConfirm({wall,zone,occurrence,confirmed});if(alive.current){if(result.time)setError(result.time);else {setEditing(false);requestAnimationFrame(()=>button.current?.focus())}}}
   catch {if(alive.current)setError('storage')}finally{pending.current=false;if(alive.current)setBusy(false)}
  }}>
   <p>{he?'התיקון מעדכן את אותה רכישה. מוצרים, סכומים ומיקום לא משתנים.':'This corrects the same purchase. Products, amounts and location stay unchanged.'}</p>
   <label>{he?'תאריך ושעה במקום הרכישה':'Date and time at the purchase location'}<input autoFocus data-testid="purchase-time-wall" type="datetime-local" step="60" dir="ltr" value={wall} disabled={busy} onChange={e=>{setWall(e.target.value);reset()}} /></label>
   <label>{he?'אזור זמן לבדיקה':'Timezone for review'}<select data-testid="purchase-time-zone" value={zone} disabled={busy} onChange={e=>{setZone(e.target.value);reset()}}>{[...new Set([receiptReviewZone,'UTC',...(typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('timeZone'):[])])].map(z=><option key={z}>{z}</option>)}</select></label>
   {candidates.length>1&&<label>{he?'מופע השעה במעבר שעון':'Clock-change occurrence'}<select data-testid="purchase-time-occurrence" disabled={busy} value={occurrence} onChange={e=>{setOccurrence(e.target.value as PurchaseTimeIntent['occurrence']);setConfirmed(false)}}><option value="">{he?'בחירה…':'Choose…'}</option><option value="0">{he?'המופע המוקדם':'Earlier occurrence'}</option><option value="1">{he?'המופע המאוחר':'Later occurrence'}</option></select></label>}
   <label><input data-testid="purchase-time-confirmed" type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} />{he?'אני מאשר/ת שהתאריך, השעה ואזור הזמן מתארים את הרכישה.':'I confirm this date, time and timezone describe the purchase.'}</label>
   {error&&<p role="alert" data-testid="purchase-time-error">{messages[error]??messages.invalid}</p>}
   <button type="submit" disabled={busy} data-testid="purchase-time-save">{busy?(he?'שומרים…':'Saving…'):(he?'אישור ושמירת תיקון התאריך':'Confirm and save date correction')}</button>
   <button type="button" disabled={busy} data-testid="purchase-time-cancel" onClick={()=>{setEditing(false);reset();requestAnimationFrame(()=>button.current?.focus())}}>{he?'ביטול ללא שינוי':'Cancel without changes'}</button>
  </form>}
 </section>
}
