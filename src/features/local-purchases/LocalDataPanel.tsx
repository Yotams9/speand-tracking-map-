'use client'
import { useEffect, useRef, useState } from 'react'
import styles from './LocalDataPanel.module.css'
import { PurchaseBackupControls } from './PurchaseBackupControls'
import type { BackupPreview } from './purchase-backup'
import type { LocalPurchases } from './local-purchase-store'
// pendingImport: the earlier on-device ledger waits for the published store list.
// The panel is modal while loading, so its two choices must live inside it.
export interface PendingLegacyImport { purchases: number; importing: boolean; onRetry: () => void; onContinue: () => void }
export function LocalDataPanel({ locale, open, phase, busy, writeError, onClose, onErase, emptyDestination, onExport, onInspect, onRestore, pendingImport = null }: { locale: 'en' | 'he'; open: boolean; phase: string; busy: boolean; writeError: boolean; onClose: () => void; onErase: () => Promise<boolean>; emptyDestination: boolean; onExport: () => Promise<string>; onInspect: (text: string) => Promise<BackupPreview>; onRestore: (data: LocalPurchases) => Promise<void>; pendingImport?: PendingLegacyImport | null }) {
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
      {phase === 'loading' && pendingImport ? <div data-testid="legacy-migration-pending" aria-busy={pendingImport.importing}>
        <p role="alert">{he ? `${pendingImport.purchases} רכישות שנשמרו קודם במכשיר הזה ממתינות להעברה, אבל רשימת הסניפים אינה זמינה כרגע. עד שתבחרו, לא ניתן לשמור רכישות חדשות.` : `${pendingImport.purchases} purchases saved earlier on this device are waiting to be moved, but the store list is unavailable right now. New purchases cannot be saved until you choose.`}</p>
        <button type="button" data-testid="legacy-migration-retry" disabled={pendingImport.importing} onClick={pendingImport.onRetry}>{he ? 'נסו שוב' : 'Try again'}</button>
        <button type="button" data-testid="legacy-migration-continue" disabled={pendingImport.importing} onClick={pendingImport.onContinue}>{he ? 'המשך בלי להעביר' : 'Continue without importing'}</button>
      </div> : phase === 'loading' ? <p role="status">{he ? 'טוענים רכישות שנשמרו…' : 'Loading saved purchases…'}</p> : <>
        <p>{he ? 'רכישות, חנויות, מקומות מאושרים (כולל קואורדינטות ידניות וכתובות שאישרת) והחלטות תיבת הדואר נשמרים בדפדפן הזה במכשיר הזה. הן נשארות לאחר רענון. אין חשבון, סנכרון או גיבוי בענן.' : 'Reviewed purchases, stores, confirmed places (including manual coordinates and reviewed addresses) and Inbox decisions are saved in this browser on this device and survive reload. There is no account, sync or cloud backup.'}</p>
        <p>{he ? 'תמונות, פריימים, טיוטות וטקסט חיפוש אינם נשמרים. זיהוי קבלות וחיפוש כתובת אינם פעילים ללא הפעלה נפרדת ושליחה מפורשת. המפה טוענת אריחים חיצוניים. נתונים מקומיים אינם מוצפנים באמצעות סיסמת משתמש; מי שמשתמש בפרופיל הדפדפן הזה יכול לראותם. ניקוי נתוני אתר או מצב גלישה פרטית עלולים למחוק אותם.' : 'Images, frames, drafts and search text are not retained. Receipt recognition and address search are disabled unless separately activated and explicitly submitted. The map loads external tiles. Local data is not encrypted with a user password; anyone using this browser profile can see it. Clearing site data or using private browsing can remove it.'}</p>
        {blocked && <p role="alert">{phase === 'conflict' ? (he ? 'הנתונים השתנו בלשונית אחרת. יש לטעון מחדש לפני המשך כדי למנוע דריסה.' : 'Data changed in another tab. Reload before continuing to avoid overwriting it.') : phase === 'invalid' ? (he ? 'המידע השמור אינו תקין או שייך לגרסה לא נתמכת. הוא לא נטען ולא הוחלף. אפשר לנסות שוב או למחוק אותו במפורש.' : 'Saved data is invalid or uses an unsupported version. It has not been loaded or overwritten. Retry, or explicitly delete it.') : (he ? 'האחסון המקומי אינו זמין. לא ניתן לאשר שמירה. אפשר לנסות שוב; אין מעבר שקט לשמירה זמנית.' : 'Local storage is unavailable. Saving cannot be confirmed. Retry; there is no silent temporary-storage fallback.')}</p>}
        {writeError && <p role="alert">{he ? 'הכתיבה נכשלה. השינוי לא אושר כשמור. הנתונים הקודמים נשארו ללא שינוי.' : 'Writing failed. The change was not confirmed as saved. Previous data is unchanged.'}</p>}
        {open && !blocked && <PurchaseBackupControls he={he} busy={busy} emptyDestination={emptyDestination} onExport={onExport} onInspect={onInspect} onRestore={onRestore} />}
        {confirm ? <div><p>{he ? 'למחוק את כל הרכישות המקומיות, החנויות, המקומות והחלטות תיבת הדואר? אי אפשר לבטל פעולה זו.' : 'Delete all local purchases, stores, places and Inbox decisions? This cannot be undone.'}</p><button disabled={busy} data-testid="local-erase-confirm" onClick={async () => { if (await onErase()) window.location.reload() }}>{he ? 'כן, למחוק את הנתונים המקומיים' : 'Yes, delete local data'}</button><button disabled={busy} onClick={() => setConfirm(false)}>{he ? 'ביטול' : 'Cancel'}</button></div> : <button disabled={busy} data-testid="local-erase" onClick={() => setConfirm(true)}>{he ? 'מחיקת כל הנתונים המקומיים' : 'Delete all local data'}</button>}
        {blocked && <button disabled={busy} onClick={() => window.location.reload()}>{he ? 'טעינה מחדש' : 'Reload'}</button>}
        {!blocked && <button disabled={busy} onClick={onClose}>{he ? 'סגירה' : 'Close'}</button>}
      </>}
    </dialog>
  </>
}
