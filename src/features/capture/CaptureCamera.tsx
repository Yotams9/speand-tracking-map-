'use client'

import type { LocaleCode } from '@/data/spendscape-globe'
import { useCaptureCamera } from './useCaptureCamera'
import styles from './CaptureExperience.module.css'

const copy = {
  en: {
    title: 'Try the camera, or explore a demo', label: 'Camera preview',
    body: 'Preview only. Barcode and receipt recognition are not available yet. No photos are recorded, saved or uploaded.',
    start: 'Start camera', stop: 'Stop camera', cancel: 'Cancel camera request', retry: 'Try camera again',
    demo: 'Scan demo receipt', sources: 'Choose another source', manual: 'Manual / cash',
    idle: 'No camera is accessed until you choose Start camera.',
    requesting: 'Waiting for camera access and preview. You can cancel at any time.',
    live: 'Live camera preview · stays on this device.',
    stopped: 'Camera stopped. Choose Start camera to resume.',
    denied: 'Camera permission was denied or blocked. Check this site’s camera permission, or use manual entry.',
    missing: 'No suitable camera was found. You can use manual entry or a built-in demo.',
    busy: 'The camera is unavailable or in use. Close other camera apps, then try again, or use manual entry.',
    insecure: 'Camera access needs a trusted HTTPS connection, or localhost on this device. Manual entry and demos still work.',
    unsupported: 'This browser does not offer camera access. Use manual entry or a built-in demo.',
    interrupted: 'Camera access was interrupted. Choose Start camera to resume, or use manual entry.',
    'preview-failed': 'The preview could not start. The camera has stopped. Try again or use manual entry.',
    error: 'The camera could not start. Try again or use manual entry.',
  },
  he: {
    title: 'נסו את המצלמה, או גלו את ההדגמה', label: 'תצוגת מצלמה',
    body: 'תצוגה בלבד. זיהוי ברקודים וקבלות עדיין אינו זמין. לא מתבצעים צילום, שמירה או העלאה של תמונות.',
    start: 'הפעלת מצלמה', stop: 'עצירת מצלמה', cancel: 'ביטול בקשת מצלמה', retry: 'ניסיון מצלמה נוסף',
    demo: 'סריקת קבלת הדגמה', sources: 'בחירת מקור אחר', manual: 'ידני / מזומן',
    idle: 'אין גישה למצלמה עד לבחירה בהפעלת מצלמה.',
    requesting: 'ממתינים לגישה למצלמה ולתצוגה. אפשר לבטל בכל עת.',
    live: 'תצוגת מצלמה חיה · נשארת במכשיר הזה.',
    stopped: 'המצלמה נעצרה. להפעלה מחדש, בחרו בהפעלת מצלמה.',
    denied: 'ההרשאה למצלמה נדחתה או נחסמה. בדקו את הרשאת המצלמה של האתר, או השתמשו בהזנה ידנית.',
    missing: 'לא נמצאה מצלמה מתאימה. אפשר להשתמש בהזנה ידנית או בהדגמה מובנית.',
    busy: 'המצלמה אינה זמינה או בשימוש. סגרו יישומי מצלמה אחרים ונסו שוב, או השתמשו בהזנה ידנית.',
    insecure: 'גישה למצלמה דורשת חיבור HTTPS מהימן, או localhost במכשיר הזה. הזנה ידנית והדגמות עדיין זמינות.',
    unsupported: 'הדפדפן אינו מאפשר גישה למצלמה. השתמשו בהזנה ידנית או בהדגמה מובנית.',
    interrupted: 'הגישה למצלמה הופסקה. בחרו בהפעלת מצלמה כדי לחדש אותה, או השתמשו בהזנה ידנית.',
    'preview-failed': 'לא ניתן להפעיל את התצוגה. המצלמה נעצרה. נסו שוב או השתמשו בהזנה ידנית.',
    error: 'לא ניתן להפעיל את המצלמה. נסו שוב או השתמשו בהזנה ידנית.',
  },
} as const

export function CaptureCamera({ locale, onDemo, onSources, onManual }: {
  locale: LocaleCode
  onDemo: () => void
  onSources: () => void
  onManual: () => void
}) {
  const { videoRef, state, start, stop } = useCaptureCamera()
  const t = copy[locale]
  const running = state === 'live' || state === 'requesting'
  const leave = (navigate: () => void) => { stop(); navigate() }
  return (
    <div className={`${styles.scannerStage} ${styles.cameraStage}`} data-testid="capture-scanner" data-camera-state={state}>
      <div className={`${styles.viewfinder} ${styles.cameraViewfinder}`}>
        <video ref={videoRef} muted playsInline disablePictureInPicture aria-label={t.label}
          className={styles.cameraVideo} data-live={state === 'live'} data-testid="capture-camera-video" />
        {state !== 'live' && <div className={styles.receiptGlyph} aria-hidden="true"><i /><i /><i /><i /></div>}
        <small>{t.label}</small>
      </div>
      <div className={styles.stageCopy}>
        <h2 id="capture-title">{t.title}</h2>
        <p id="capture-description">{t.body}</p>
        <p className={styles.cameraStatus} role="status" aria-live="polite" aria-atomic="true" data-testid="capture-camera-status">{t[state]}</p>
      </div>
      <div className={`${styles.actions} ${styles.cameraActions}`}>
        <button type="button" className={styles.primary} data-testid="capture-camera-toggle" onClick={running ? stop : start}>
          {state === 'requesting' ? t.cancel : state === 'live' ? t.stop
            : ['idle', 'stopped', 'interrupted'].includes(state) ? t.start : t.retry}
        </button>
        <button type="button" className={styles.secondary} onClick={() => leave(onDemo)} data-testid="capture-scan">{t.demo}</button>
        <button type="button" className={styles.secondary} onClick={() => leave(onManual)} data-testid="capture-camera-manual">{t.manual}</button>
        <button type="button" className={styles.secondary} onClick={() => leave(onSources)} data-testid="capture-sources-open">{t.sources}</button>
      </div>
    </div>
  )
}
