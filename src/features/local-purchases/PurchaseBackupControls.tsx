'use client'
import { useEffect, useRef, useState } from 'react'
import type { LocalPurchases } from './local-purchase-store'
import { BACKUP_MAX_BYTES, PurchaseBackupError, type BackupErrorCode, type BackupPreview } from './purchase-backup'
import styles from './LocalDataPanel.module.css'

type Props = {
  he: boolean
  busy: boolean
  emptyDestination: boolean
  onExport: () => Promise<string>
  onInspect: (text: string) => Promise<BackupPreview>
  onRestore: (data: LocalPurchases) => Promise<void>
}
export function PurchaseBackupControls({ he, busy, emptyDestination, onExport, onInspect, onRestore }: Props) {
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [confirmed, setConfirmed] = useState(false), [working, setWorking] = useState(false)
  const [error, setError] = useState<BackupErrorCode | null>(null), [success, setSuccess] = useState(false)
  const alive = useRef(false), generation = useRef(0), pending = useRef(false), urls = useRef(new Set<string>())
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    alive.current = true
    const objectUrls = urls.current
    return () => { alive.current = false; generation.current++; for (const url of objectUrls) URL.revokeObjectURL(url); objectUrls.clear() }
  }, [])
  const clear = () => { generation.current++; pending.current = false; setPreview(null); setConfirmed(false); setError(null); setSuccess(false); setWorking(false); if (input.current) input.current.value = '' }
  const fail = (value: unknown) => setError(value instanceof PurchaseBackupError ? value.code : 'storage')
  const errors: Record<BackupErrorCode, string> = he ? {
    unsupported: 'פורמט או גרסת גיבוי אינם נתמכים. דבר לא נכתב.',
    invalid: 'הקובץ אינו גיבוי תקין ומלא. דבר לא נכתב.',
    corrupted: 'בדיקת השלמות נכשלה. הקובץ נפגם או שונה. דבר לא נכתב.',
    size: 'קובץ הגיבוי גדול מהמגבלה של 8 MiB. דבר לא נכתב.',
    'not-empty': 'היעד אינו ריק. לא נדרסו או מוזגו נתונים.',
    conflict: 'הנתונים השתנו בלשונית אחרת. דבר לא שוחזר; טענו מחדש לפני בדיקה נוספת.',
    storage: 'הפעולה לא הושלמה. שחזור שלא הושלם לא נחשב כשמור; הנתונים הקודמים לא הוחלפו.',
    unavailable: 'גיבוי או שחזור אינם זמינים כרגע. נדרש דפדפן מקומי מאובטח ואחסון זמין.',
  } : {
    unsupported: 'Unsupported backup format or version. Nothing was written.',
    invalid: 'This is not a valid, complete purchase backup. Nothing was written.',
    corrupted: 'Integrity check failed. The file is damaged or changed. Nothing was written.',
    size: 'The backup exceeds the 8 MiB limit. Nothing was written.',
    'not-empty': 'The destination is not empty. No data was overwritten or merged.',
    conflict: 'Data changed in another tab. Nothing was restored; reload before inspecting again.',
    storage: 'The operation did not complete. An incomplete restore is not confirmed as saved; previous data was not replaced.',
    unavailable: 'Backup or restore is unavailable now. A secure local browser and available storage are required.',
  }
  return <section className={styles.backup} aria-labelledby="purchase-backup-title" data-testid="purchase-backup">
    <h3 id="purchase-backup-title">{he ? 'גיבוי ושחזור מקומיים' : 'Local backup and restore'}</h3>
    <p>{he ? 'הקובץ פרטי ואינו מוצפן. הוא כולל רכישות שמורות ופרטי בתי עסק ומקומות, כולל נקודות שאושרו. אין בו תמונות, מפתחות, אבחוני ספק או התאמות מוצרים זמניות. אין העלאה או סנכרון בענן.' : 'The file is private and unencrypted. It includes saved purchases and merchant/place details, including confirmed points. It excludes images, keys, provider diagnostics and temporary product matches. There is no upload or cloud sync.'}</p>
    <button type="button" data-testid="backup-export" disabled={busy || working} onClick={async () => {
      if (pending.current) return
      pending.current = true; setWorking(true); setError(null); setSuccess(false)
      const token = generation.current
      try {
        const text = await onExport()
        if (!alive.current || token !== generation.current) return
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); urls.current.add(url)
        const link = document.createElement('a'); link.href = url; link.download = `spendscape-purchases-${new Date().toISOString().slice(0, 10)}.json`; link.click()
        window.setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url) }, 1000)
      } catch (value) { if (alive.current && token === generation.current) fail(value) }
      finally { if (alive.current && token === generation.current) { pending.current = false; setWorking(false) } }
    }}>{he ? 'הורדת גיבוי JSON' : 'Download JSON backup'}</button>
    <label>{he ? 'בחירת קובץ גיבוי לבדיקה (עד 8 MiB)' : 'Choose a backup to inspect (up to 8 MiB)'}<input ref={input} type="file" accept=".json,application/json" data-testid="backup-file" disabled={busy || working} onChange={async event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''
      clear(); if (!file) return
      const token = generation.current; pending.current = true; setWorking(true)
      try {
        if (file.size > BACKUP_MAX_BYTES) throw new PurchaseBackupError('size')
        const candidate = await onInspect(await file.text())
        if (alive.current && token === generation.current) setPreview(candidate)
      } catch (value) { if (alive.current && token === generation.current) fail(value) }
      finally { if (alive.current && token === generation.current) { pending.current = false; setWorking(false) } }
    }} /></label>
    {!emptyDestination && <p role="status" data-testid="backup-nonempty">{he ? 'שחזור מותר רק ליעד ריק. הרכישות הקיימות לא יוחלפו. אפשר לבדוק קובץ, אך אי אפשר לשחזר אותו כאן.' : 'Restore is allowed only into an empty destination. Existing purchases will not be replaced. You can inspect a file, but cannot restore it here.'}</p>}
    {preview && <div data-testid="backup-preview">
      <p>{he ? 'הקובץ נבדק במלואו. טרם נכתב דבר.' : 'The complete file was validated. Nothing has been written yet.'}</p>
      <dl><dt>{he ? 'רכישות שמורות' : 'Saved purchases'}</dt><dd data-testid="backup-count-purchases">{preview.purchases}</dd><dt>{he ? 'בתי עסק' : 'Merchants'}</dt><dd>{preview.merchants}</dd><dt>{he ? 'מקומות משויכים' : 'Associated places'}</dt><dd data-testid="backup-count-places">{preview.places}</dd><dt>{he ? 'רכישות ללא מיקום פתור' : 'Purchases with unresolved location'}</dt><dd>{preview.unresolved}</dd></dl>
      {preview.historicalSynthetic > 0 && <p>{he ? 'רשומות בדיקה היסטוריות יישארו מסומנות כבדויות ומוסתרות בשימוש רגיל:' : 'Historical QA records retain their synthetic provenance and remain hidden in ordinary use:'} {preview.historicalSynthetic}</p>}
      <p>{he ? 'מזהים, סכומים, תאריכים ומידע מיקום נשמרים כפי שהיו. שחזור אינו מאמת מחדש עובדות או מקומות ואינו משנה מידע לא פתור לאישור.' : 'IDs, amounts, dates and location metadata are preserved. Restore does not re-verify facts or places, or promote unresolved information to confirmed.'}</p>
      <label className={styles.backupConfirm}><input type="checkbox" data-testid="backup-confirm" checked={confirmed} disabled={busy || working || !emptyDestination} onChange={event => setConfirmed(event.target.checked)} />{he ? 'בדקתי את הספירות ואני מאשר/ת שחזור של הרשומות ליעד הריק הזה.' : 'I reviewed the counts and confirm restoring these records into this empty destination.'}</label>
      <button type="button" data-testid="backup-restore" disabled={!confirmed || !emptyDestination || busy || working} onClick={async () => {
        if (pending.current || !confirmed || !emptyDestination) return
        pending.current = true; setWorking(true); setError(null)
        const token = generation.current
        try { await onRestore(preview.data); if (alive.current && token === generation.current) { setPreview(null); setConfirmed(false); setSuccess(true) } }
        catch (value) { if (alive.current && token === generation.current) fail(value) }
        finally { if (alive.current && token === generation.current) { pending.current = false; setWorking(false) } }
      }}>{he ? 'אישור ושחזור במכשיר הזה' : 'Confirm and restore on this device'}</button>
    </div>}
    {(preview || working || error) && <button type="button" disabled={busy} data-testid="backup-cancel" onClick={clear}>{he ? 'ביטול בדיקת הקובץ ללא שינוי' : 'Cancel file inspection without changes'}</button>}
    {working && <p role="status">{he ? 'מבצעים את הפעולה המקומית…' : 'Completing the local operation…'}</p>}
    {error && <p role="alert" data-testid="backup-error">{errors[error]}</p>}
    {success && <p role="status" data-testid="backup-success">{he ? 'השחזור הושלם ונשמר במכשיר הזה. הרכישות והמקומות זמינים גם לאחר רענון.' : 'Restore completed and was saved on this device. Purchases and places remain available after reload.'}</p>}
  </section>
}
