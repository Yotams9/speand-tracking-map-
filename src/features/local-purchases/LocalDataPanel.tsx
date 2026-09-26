'use client'
import { useEffect, useRef, useState } from 'react'
import styles from './LocalDataPanel.module.css'
export function LocalDataPanel({ locale, open, phase, busy, writeError, onClose, onErase }: { locale: 'en' | 'he'; open: boolean; phase: string; busy: boolean; writeError: boolean; onClose: () => void; onErase: () => Promise<boolean> }) {
  const he = locale === 'he', dialog = useRef<HTMLDialogElement>(null)
  const [confirm, setConfirm] = useState(false)
  const blocked = phase !== 'ready'
  useEffect(() => {
    const d = dialog.current
    if (open || blocked) { if (!d?.open) d?.showModal() }
    else { d?.close(); setConfirm(false) }
  }, [open, blocked])
  return <>
    {busy && <div className={styles.busy} role="status">{he ? 'שומרים במכשיר…' : 'Saving on this device…'}</div>}
    <dialog ref={dialog} className={styles.panel} dir={he ? 'rtl' : 'ltr'} aria-labelledby="local-data-title" onKeyDown={e => { if (e.key === 'Escape') e.stopPropagation() }} onCancel={e => { if (blocked || busy) e.preventDefault(); else onClose() }}>
      <h2 id="local-data-title">{he ? 'נתונים במכשיר ופרטיות' : 'On-device data & privacy'}</h2>
      {phase === 'loading' ? <p role="status">{he ? 'טוענים רכישות שנשמרו…' : 'Loading saved purchases…'}</p> : <>
        <p>{he ? 'רכישות שאישרת והחלטות תיבת הדואר נשמרות בדפדפן הזה במכשיר הזה. הן נשארות לאחר רענון. אין חשבון, סנכרון או גיבוי בענן.' : 'Reviewed purchases and Inbox decisions are saved in this browser on this device and survive reload. There is no account, sync or cloud backup.'}</p>
        <p>{he ? 'תמונות, פריימים, טיוטות וטקסט חיפוש אינם נשמרים. נתוני רכישות אינם נשלחים לספק. המפה טוענת אריחים חיצוניים. נתונים מקומיים אינם מוצפנים באמצעות סיסמת משתמש; מי שמשתמש בפרופיל הדפדפן הזה יכול לראותם. ניקוי נתוני אתר או מצב גלישה פרטית עלולים למחוק אותם.' : 'Images, frames, drafts and search text are not retained. Purchase data is not sent to a provider. The map loads external tiles. Local data is not encrypted with a user password; anyone using this browser profile can see it. Clearing site data or using private browsing can remove it.'}</p>
        {blocked && <p role="alert">{phase === 'conflict' ? (he ? 'הנתונים השתנו בלשונית אחרת. יש לטעון מחדש לפני המשך כדי למנוע דריסה.' : 'Data changed in another tab. Reload before continuing to avoid overwriting it.') : phase === 'invalid' ? (he ? 'המידע השמור אינו תקין או שייך לגרסה לא נתמכת. הוא לא נטען ולא הוחלף. אפשר לנסות שוב או למחוק אותו במפורש.' : 'Saved data is invalid or uses an unsupported version. It has not been loaded or overwritten. Retry, or explicitly delete it.') : (he ? 'האחסון המקומי אינו זמין. לא ניתן לאשר שמירה. אפשר לנסות שוב; אין מעבר שקט לשמירה זמנית.' : 'Local storage is unavailable. Saving cannot be confirmed. Retry; there is no silent temporary-storage fallback.')}</p>}
        {writeError && <p role="alert">{he ? 'הכתיבה נכשלה. השינוי לא אושר כשמור. הנתונים הקודמים נשארו ללא שינוי.' : 'Writing failed. The change was not confirmed as saved. Previous data is unchanged.'}</p>}
        {confirm ? <div><p>{he ? 'למחוק את כל הרכישות המקומיות והחלטות תיבת הדואר? אי אפשר לבטל פעולה זו. נתוני הדוגמה המקוריים יישארו.' : 'Delete all local purchases and Inbox decisions? This cannot be undone. Original sample data will remain.'}</p><button disabled={busy} data-testid="local-erase-confirm" onClick={async () => { if (await onErase()) window.location.reload() }}>{he ? 'כן, למחוק את הנתונים המקומיים' : 'Yes, delete local data'}</button><button disabled={busy} onClick={() => setConfirm(false)}>{he ? 'ביטול' : 'Cancel'}</button></div> : <button disabled={busy} data-testid="local-erase" onClick={() => setConfirm(true)}>{he ? 'מחיקת כל הנתונים המקומיים' : 'Delete all local data'}</button>}
        {blocked && <button disabled={busy} onClick={() => window.location.reload()}>{he ? 'טעינה מחדש' : 'Reload'}</button>}
        {!blocked && <button disabled={busy} onClick={onClose}>{he ? 'סגירה' : 'Close'}</button>}
      </>}
    </dialog>
  </>
}
