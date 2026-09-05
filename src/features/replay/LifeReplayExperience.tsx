import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from 'react'
import {
  localized,
  merchantForId,
  type GlobePurchase,
  type LocaleCode,
  type Merchant,
  type Place,
} from '../../data/spendscape-globe'
import { deriveReplayEvents, emptyReplayRange, initialReplayState, isReplayRange, ReplayClock, replayPlace, replayReducer, type ReplayAction, type ReplayRange } from './life-replay-domain'
import styles from './LifeReplayExperience.module.css'

export interface ReplayController { pause: () => void; inspectPlace: (placeId: string) => void }
interface Props {
  purchases: readonly GlobePurchase[]
  places: readonly Place[]
  merchants: readonly Merchant[]
  locale: LocaleCode
  mapAvailable: boolean
  rendererUnavailable: boolean
  reducedMotion: boolean
  controllerRef: RefObject<ReplayController | null>
  onPresent: (purchase: GlobePurchase | undefined, intent?: 'details' | 'show-place') => void
  onClose: () => void
  onRetryMap?: () => void
}

export function LifeReplayExperience({ purchases, places, merchants, locale, mapAvailable, rendererUnavailable, reducedMotion, controllerRef, onPresent, onClose, onRetryMap }: Props) {
  const he = locale === 'he'
  const [range, setRange] = useState<ReplayRange>(emptyReplayRange)
  const [draftRange, setDraftRange] = useState<ReplayRange>(emptyReplayRange)
  const [state, setState] = useState(initialReplayState)
  const stateRef = useRef(state)
  stateRef.current = state
  const [scrub, setScrub] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const playRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const clock = useRef(new ReplayClock())
  const events = useMemo(() => deriveReplayEvents(purchases, range), [purchases, range])
  const eventsRef = useRef(events)
  eventsRef.current = events
  const event = events[scrub ?? state.index]
  const place = replayPlace(event, places)
  const formatDate = (timestamp: string) => new Intl.DateTimeFormat(he ? 'he-IL' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(timestamp))
  const merchant = event ? merchantForId(event.merchantId, merchants) : undefined
  const eventName = merchant ? localized(merchant.name, locale) : ''
  const progress = event ? `${(scrub ?? state.index) + 1} / ${events.length}` : `0 / 0`
  const paymentContext = event ? {
    card: he ? 'תשלום בכרטיס' : 'Card payment',
    cash: he ? 'רכישת מזומן' : 'Cash purchase',
    manual: he ? 'קלט ידני' : 'Manual input',
  }[event.paymentMode] : ''
  const itemSummary = event?.items.length
    ? `${event.items.length} ${he ? 'פריטי קבלה' : 'receipt items'} · ${event.items.slice(0, 2).map((item) => localized(item.label, locale)).join(', ')}${event.items.length > 2 ? ` +${event.items.length - 2}` : ''}`
    : null

  const pause = useCallback(() => {
    clock.current.cancel()
    setState((current) => {
      const next = replayReducer(current, { type: 'pause' }, eventsRef.current.length)
      stateRef.current = next
      return next
    })
  }, [])
  useImperativeHandle(controllerRef, () => ({ pause, inspectPlace: (placeId) => {
    pause()
    const index = eventsRef.current.findIndex((purchase) => replayPlace(purchase, places)?.id === placeId)
    if (index < 0) return
    const next = replayReducer(stateRef.current, { type: 'seek', index }, eventsRef.current.length)
    stateRef.current = next
    setState(next)
    setScrub(null)
    onPresent(eventsRef.current[index])
  } }), [onPresent, pause, places])

  useEffect(() => {
    (eventsRef.current.length && !playRef.current?.disabled ? playRef : closeRef).current?.focus({ preventScroll: true })
    const timer = clock.current
    const background = () => { if (document.hidden) pause() }
    document.addEventListener('visibilitychange', background)
    return () => { timer.cancel(); document.removeEventListener('visibilitychange', background) }
  }, [pause])

  useEffect(() => {
    if (!mapAvailable) {
      pause()
      // A newly disabled Play/Show place must not strand keyboard focus on BODY.
      // Preserve focus elsewhere (including the interactive globe).
      if (document.activeElement instanceof HTMLButtonElement && document.activeElement.disabled
        && document.activeElement.closest('[data-testid="replay-player"]')) closeRef.current?.focus({ preventScroll: true })
    }
  }, [mapAvailable, pause])

  useEffect(() => {
    const timer = clock.current
    if (state.status === 'playing' && mapAvailable) {
      timer.schedule(state.speed, () => {
        const next = replayReducer(stateRef.current, { type: 'tick' }, eventsRef.current.length)
        stateRef.current = next
        setState(next)
        if (next.status === 'playing') onPresent(eventsRef.current[next.index])
      })
    }
    return () => timer.cancel()
  }, [mapAvailable, onPresent, state.index, state.speed, state.status])

  useEffect(() => {
    setAnnouncement(state.status === 'playing' ? (he ? 'הניגון התחיל' : 'Playback started')
      : state.status === 'complete' ? (he ? 'הסיפור הושלם' : 'Replay complete')
        : (he ? 'הניגון מושהה' : 'Playback paused'))
  }, [he, state.status])

  const act = (action: ReplayAction) => {
    clock.current.cancel()
    const next = replayReducer(stateRef.current, action, events.length)
    stateRef.current = next
    setState(next)
    setScrub(null)
    if (action.type === 'play' && events.length || action.type === 'seek' && next !== state) {
      onPresent(events[next.index])
      if (action.type === 'seek') setAnnouncement(`${next.index + 1} / ${events.length} · ${formatDate(events[next.index].timestamp)}`)
    }
  }
  const commitScrub = (value: string) => {
    if (scrub !== null) act({ type: 'seek', index: Number(value) })
  }
  const validRange = isReplayRange(draftRange)

  return (
    <section className={styles.player} role="region" aria-labelledby="replay-title" data-testid="replay-player"
      data-status={state.status} data-index={state.index} data-count={events.length} data-purchase-id={event?.id ?? ''}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>{he ? 'סיפור רכישות סינתטי · לא מסלול נסיעה' : 'Synthetic purchase story · not a travel route'}</p><h2 id="replay-title">{he ? 'הרכישות לאורך הזמן' : 'Life Replay'}</h2></div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={he ? 'סגירת סיפור הרכישות' : 'Close Life Replay'} data-testid="replay-close">×</button>
      </header>
      {event ? <div key={event.id} className={styles.event} aria-live="off" data-testid="replay-event-details">
        <div className={styles.eventCopy}><time dateTime={event.timestamp}>{formatDate(event.timestamp)}</time><h3>{eventName}</h3>
          <p>{place ? `${localized(place.city, locale)} · ${localized(place.branch, locale)}`
            : event.channel === 'online' ? (he ? 'רכישה מקוונת · ללא מיקום פיזי' : 'Online purchase · no physical location')
              : (he ? 'מיקום לא פתור · ללא סיכה במפה' : 'Unresolved location · no map pin')}</p>
          <div className={styles.eventMeta}><span>{paymentContext}</span><span>{event.channel === 'online' ? (he ? 'מקוון' : 'Online') : event.resolution === 'unresolved' ? (he ? 'לא פתור' : 'Unresolved') : (he ? 'מקום מאומת' : 'Resolved place')}</span></div>
          {itemSummary && <p className={styles.itemSummary}>{itemSummary}</p>}
        </div>
        <strong className={styles.amount}><bdi>{new Intl.NumberFormat(he ? 'he-IL' : 'en-GB', { style: 'currency', currency: event.originalCurrency }).format(event.originalAmount)}</bdi><small>{he ? 'סכום ומטבע מקוריים' : 'Original amount & currency'}</small></strong>
      </div> : <div className={styles.empty}><h3>{he ? 'אין רכישות בטווח הזה' : 'No purchases in this range'}</h3><p>{he ? 'אפשר לשנות את טווח הסיפור או לסגור ולשנות את המסננים.' : 'Adjust the replay dates, or close to change your shared filters.'}</p></div>}
      <div className={styles.progress}><span>{he ? 'מוקדם' : 'Earlier'}</span><output aria-live="off" dir="ltr">{progress}</output><span>{he ? 'מאוחר' : 'Later'}</span></div>
      <input className={styles.scrubber} type="range" min={0} max={Math.max(0, events.length - 1)} step={1}
        value={scrub ?? state.index} disabled={events.length < 2}
        aria-label={he ? 'מיקום בסיפור הרכישות' : 'Purchase story position'}
        aria-valuetext={event ? `${progress} · ${eventName} · ${formatDate(event.timestamp)}` : (he ? 'אין רכישות' : 'No purchases')}
        onChange={(e) => { pause(); setScrub(Number(e.target.value)) }}
        onPointerDown={pause} onPointerUp={(e) => commitScrub(e.currentTarget.value)}
        onKeyUp={(e) => commitScrub(e.currentTarget.value)} onBlur={(e) => commitScrub(e.currentTarget.value)} data-testid="replay-scrub" />
      <div className={styles.transport}>
        <button type="button" disabled={!events.length || state.index === 0} onClick={() => act({ type: 'seek', index: state.index - 1 })} data-testid="replay-previous">{he ? 'הקודמת' : 'Previous'}</button>
        <button className={styles.play} ref={playRef} type="button" disabled={!events.length || !mapAvailable}
          onClick={() => state.status === 'playing' ? pause() : act({ type: 'play' })} data-testid="replay-play">
          <span aria-hidden="true">{state.status === 'playing' ? 'Ⅱ' : '▶'}</span>
          {state.status === 'playing' ? (he ? 'השהיה' : 'Pause') : state.status === 'complete' ? (he ? 'ניגון מחדש' : 'Replay again') : (he ? 'ניגון' : 'Play')}
        </button>
        <button type="button" disabled={!events.length || state.index >= events.length - 1} onClick={() => act({ type: 'seek', index: state.index + 1 })} data-testid="replay-next">{he ? 'הבאה' : 'Next'}</button>
        {place && <button className={styles.showPlace} type="button" disabled={!mapAvailable} onClick={() => { pause(); onPresent(event, 'show-place') }} data-testid="replay-show-place">{he ? 'הצגה במפה' : 'Show place'}</button>}
      </div>
      <div className={styles.note} role={!mapAvailable ? 'status' : undefined}>
        {!mapAvailable ? onRetryMap || rendererUnavailable
          ? (he ? 'המפה אינה זמינה. אפשר לדפדף ברכישות; הניגון ימתין.' : 'Map unavailable. Browse purchases manually; playback is paused.')
          : (he ? 'המפה נטענת. אפשר לדפדף ברכישות; הניגון ימתין.' : 'Map loading. Browse purchases manually; playback is paused.')
          : reducedMotion ? (he ? 'תנועה מופחתת · המצלמה נשארת בשליטתך' : 'Reduced motion · camera stays under your control')
            : state.status === 'complete' ? `${he ? 'הושלם' : 'Complete'} · ${events.length} ${he ? (events.length === 1 ? 'רכישה' : 'רכישות') : (events.length === 1 ? 'purchase' : 'purchases')} · ${events[0] ? formatDate(events[0].timestamp) : ''} — ${event ? formatDate(event.timestamp) : ''}`
              : (he ? 'פרטי הרכישה מתקדמים בלי להזיז את המפה' : 'Purchase details advance without moving the globe')}
      </div>
      {!mapAvailable && onRetryMap && <button className={styles.retry} type="button" onClick={() => {
        // Retry disappears as loading starts. Keep focus on a surviving control.
        closeRef.current?.focus()
        onRetryMap()
      }}>{he ? 'נסה שוב' : 'Retry map'}</button>}
      <details className={styles.options} onToggle={(e) => { if (e.currentTarget.open) pause() }}>
        <summary>{he ? 'תאריכים ומהירות' : 'Dates & speed'}<span>{events.length} / {purchases.length} · <bdi>{state.speed}×</bdi></span></summary>
        <p>{he ? 'הטווח מצמצם את תוצאות המסננים הנוכחיים. התאריכים ב־UTC.' : 'Narrows your current filtered results. Dates use UTC.'}</p>
        <form onSubmit={(e) => { e.preventDefault(); if (!validRange) return; pause(); setRange({ ...draftRange }); act({ type: 'reset' }); onPresent(undefined) }}>
          <label>{he ? 'מתאריך' : 'From'}<input type="date" value={draftRange.start} onChange={(e) => { pause(); setDraftRange({ ...draftRange, start: e.target.value }) }} data-testid="replay-from" /></label>
          <label>{he ? 'עד תאריך' : 'Through'}<input type="date" value={draftRange.end} onChange={(e) => { pause(); setDraftRange({ ...draftRange, end: e.target.value }) }} data-testid="replay-through" /></label>
          <button type="submit" disabled={!validRange}>{he ? 'החלת תאריכים' : 'Apply dates'}</button>
        </form>
        {!validRange && <p role="alert">{he ? 'יש לבחור טווח תאריכים תקין.' : 'Choose a valid date range.'}</p>}
        <label className={styles.speed}>{he ? 'מהירות הצגה' : 'Presentation speed'}<select value={state.speed} onChange={(e) => act({ type: 'speed', speed: Number(e.target.value) })} data-testid="replay-speed"><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label>
      </details>
      <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </section>
  )
}
