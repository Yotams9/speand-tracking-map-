'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LocaleCode } from '@/data/spendscape-globe'
import type { SavingsOrigin, SavingsResult, SavingsStore } from './savings-engine'
import type { SavingsBasket } from './purchase-basket'
import { formatDistance, formatMinorIls, priceDateNote, savingsCopy } from './savings-copy'
import styles from './SavingsPanel.module.css'

type Load = { state: 'idle' | 'loading' | 'error' } | { state: 'ready'; result: SavingsResult }
type Locate = 'idle' | 'pending' | 'failed'

export async function fetchSavings(basket: Pick<SavingsBasket, 'items'>, origin: SavingsOrigin, signal?: AbortSignal): Promise<SavingsResult> {
  const response = await fetch('/api/savings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: basket.items, origin }), signal })
  if (!response.ok) throw new Error('savings')
  return response.json() as Promise<SavingsResult>
}

// Read-only "where is it cheaper?" for one saved purchase. Every number comes
// from /api/savings (published catalog + the user's own amounts); nothing is
// saved, no purchase is edited and no place or pin is created.
export function SavingsPanel({ basket, locale, lineLabel, onShowStore }: {
  basket: SavingsBasket
  locale: LocaleCode
  lineLabel: (ref: string | undefined) => string
  onShowStore: (store: SavingsStore) => void
}) {
  const t = savingsCopy[locale]
  const [origin, setOrigin] = useState<SavingsOrigin | null>(basket.origin)
  const [fromDevice, setFromDevice] = useState(false)
  const [load, setLoad] = useState<Load>({ state: 'idle' })
  const [locate, setLocate] = useState<Locate>('idle')
  const [attempt, setAttempt] = useState(0)

  // Keyed on content, so a re-rendered but unchanged purchase never refetches.
  const request = origin ? JSON.stringify({ items: basket.items, origin }) : null
  useEffect(() => {
    if (!request) return
    const { items, origin: from } = JSON.parse(request) as { items: SavingsBasket['items']; origin: SavingsOrigin }
    const controller = new AbortController()
    setLoad({ state: 'loading' })
    fetchSavings({ items }, from, controller.signal)
      .then(result => setLoad({ state: 'ready', result }))
      .catch(() => { if (!controller.signal.aborted) setLoad({ state: 'error' }) })
    return () => controller.abort()
  }, [request, attempt])

  // One explicit read; the position is only the comparison origin, never saved or sent elsewhere.
  const useMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) { setLocate('failed'); return }
    setLocate('pending')
    navigator.geolocation.getCurrentPosition(
      position => { setLocate('idle'); setFromDevice(true); setOrigin({ lat: position.coords.latitude, lon: position.coords.longitude }) },
      () => setLocate('failed'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  const result = load.state === 'ready' ? load.result : null
  const radius = formatDistance(result?.radiusM ?? 5000, locale)
  const money = (minor: number) => formatMinorIls(minor, locale)
  const storeLine = (store: SavingsStore) => <>
    <bdi>{store.chainName[locale]}</bdi> · <bdi>{store.name}</bdi>
  </>
  const distance = (store: SavingsStore) => store.isOrigin && !fromDevice ? t.here : t.away.replace('{distance}', formatDistance(store.distanceM, locale))

  return <section className={styles.panel} aria-labelledby="savings-title" data-testid="savings-panel" data-outcome={result?.outcome}>
    <h3 id="savings-title">{t.title}</h3>

    {!origin && <div className={styles.locate}>
      <p>{t.noPlace}</p>
      <button type="button" className={styles.secondary} onClick={useMyLocation} disabled={locate === 'pending'} data-testid="savings-use-location">{locate === 'pending' ? t.locating : t.useLocation}</button>
      {locate === 'failed' && <p role="status">{t.locationFailed}</p>}
      <small>{t.locationNote}</small>
    </div>}

    {load.state === 'loading' && <p role="status" className={styles.muted}>{t.loading}</p>}
    {load.state === 'error' && <p role="status" className={styles.muted}>{t.error} <button type="button" className={styles.link} onClick={() => setAttempt(n => n + 1)}>{t.retry}</button></p>}

    {result && <>
      {result.best && result.outcome === 'saving' && <div className={styles.hero} data-testid="savings-hero">
        <p className={styles.heroAmount} data-testid="savings-amount">{t.save.replace('{amount}', money(result.savingMinor!))}</p>
        <p className={styles.heroStore} data-testid="savings-best-store">{t.at}{storeLine(result.best.store)}</p>
        <p className={styles.heroMeta}><span>{distance(result.best.store)}</span><span>{t.storeTotal}: <strong>{money(result.best.totalMinor)}</strong></span></p>
        {result.baseline && <p className={styles.basis} data-testid="savings-basis">{(result.baseline.basis === 'origin-shelf' ? t.basisShelf : t.basisPaid).replace('{amount}', money(result.baseline.totalMinor))}</p>}
      </div>}

      {result.best && result.outcome !== 'saving' && <div className={styles.calm} data-testid="savings-best">
        <p className={styles.calmTitle}>{result.outcome === 'already-cheapest' ? (result.baseline?.basis === 'origin-shelf' ? t.cheapestShelf : t.cheapestPaid) : t.noBaseline}</p>
        <p className={styles.heroStore} data-testid="savings-best-store">{storeLine(result.best.store)}</p>
        <p className={styles.heroMeta}><span>{distance(result.best.store)}</span><span>{t.storeTotal}: <strong>{money(result.best.totalMinor)}</strong></span></p>
        {result.baseline && <p className={styles.basis} data-testid="savings-basis">{(result.baseline.basis === 'origin-shelf' ? t.basisShelf : t.basisPaid).replace('{amount}', money(result.baseline.totalMinor))}</p>}
      </div>}

      {result.outcome === 'no-complete-store' && <p className={styles.muted}>{t.noComplete.replace('{radius}', radius)}</p>}
      {result.outcome === 'nothing-comparable' && <p className={styles.muted}>{t.nothing}</p>}

      {result.best && !(result.best.store.isOrigin && !fromDevice) && <button type="button" className={styles.primary} onClick={() => onShowStore(result.best!.store)} data-testid="savings-show-store">{t.showOnGlobe}</button>}

      {result.complete.length > 1 && <div className={styles.group}>
        <h4>{t.alternatives}</h4>
        <ul>{result.complete.slice(1, 4).map(entry => <li key={entry.store.id} data-testid="savings-alternative">
          <span><strong className={styles.storeName}>{storeLine(entry.store)}</strong><small>{distance(entry.store)}</small></span>
          <strong className={styles.amount}>{money(entry.totalMinor)}</strong>
        </li>)}</ul>
      </div>}

      {result.partial.length > 0 && <div className={styles.group}>
        <h4>{t.partial}</h4>
        <ul>{result.partial.slice(0, 3).map(entry => <li key={entry.store.id} data-testid="savings-partial">
          <span><strong className={styles.storeName}>{storeLine(entry.store)}</strong><small>{distance(entry.store)}</small></span>
          <small>{t.partialCount.replace('{count}', String(entry.pricedItems)).replace('{total}', String(entry.totalItems))}</small>
        </li>)}</ul>
      </div>}

      {result.notCompared.length > 0 && <div className={styles.group} data-testid="savings-not-compared">
        <h4>{t.notCompared}</h4>
        <ul>{result.notCompared.map(entry => <li key={entry.index}>
          <span><bdi>{lineLabel(entry.ref)}</bdi></span><small>{t.reasons[entry.reason]}</small>
        </li>)}</ul>
      </div>}

      <p className={styles.note} data-testid="savings-price-date">{priceDateNote(result, locale)} · {t.notLive}</p>
      <p className={styles.note}>{(fromDevice ? t.radiusDevice : t.radius).replace('{radius}', radius)}</p>
    </>}
  </section>
}
