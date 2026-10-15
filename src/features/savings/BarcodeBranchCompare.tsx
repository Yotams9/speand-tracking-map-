'use client'

import { useState } from 'react'
import type { LocaleCode } from '@/data/spendscape-globe'
import type { CatalogPrice } from '@/data/price-catalog'
import { distanceMeters, isLocated, loadCatalogStores } from '@/features/capture/catalog-stores'
import { toMinor } from './savings-money'
import { formatMinorIls } from './savings-copy'
import styles from './SavingsPanel.module.css'

const copy = {
  he: {
    distance: 'הצגת מרחק ממני', locating: 'מאתרים את המיקום…', failed: 'המיקום אינו זמין כאן.',
    locationNote: 'המיקום נקרא פעם אחת לחישוב מרחק בקו ישר ואינו נשמר או נשלח.',
    branch: 'הסניף שבחרת', none: 'בחירה…',
    cheaper: 'זול ב-{amount} מהסניף שבחרת', same: 'הסניף שבחרת הוא מהזולים ביותר למוצר הזה.', perKg: ' לק״ג',
  },
  en: {
    distance: 'Show distance from me', locating: 'Finding your location…', failed: 'Location is unavailable here.',
    locationNote: 'Your location is read once for a straight-line distance and is not saved or sent.',
    branch: 'Your branch', none: 'Choose…',
    cheaper: '{amount} cheaper than your branch', same: 'Your branch is among the cheapest for this product.', perKg: ' per kg',
  },
} as const

// Additive to the barcode result: optional straight-line distances (computed in
// the browser from the published store points) and "cheaper than the branch you
// chose" in integer agorot. Nothing is saved; the purchase form is unaffected.
export function BarcodeBranchCompare({ locale, prices, weighted, onDistances }: {
  locale: LocaleCode
  prices: readonly CatalogPrice[]
  weighted: boolean
  onDistances: (distances: Record<string, number>) => void
}) {
  const t = copy[locale]
  const [locate, setLocate] = useState<'idle' | 'pending' | 'done' | 'failed'>('idle')
  const [chosen, setChosen] = useState('')

  const showDistances = () => {
    if (!('geolocation' in navigator)) { setLocate('failed'); return }
    setLocate('pending')
    navigator.geolocation.getCurrentPosition(position => {
      const here: [number, number] = [position.coords.longitude, position.coords.latitude]
      loadCatalogStores().then(stores => {
        onDistances(Object.fromEntries(stores.filter(isLocated).map(store => [store.id, Math.round(distanceMeters(here, [store.location.lon, store.location.lat]))])))
        setLocate('done')
      }).catch(() => setLocate('failed'))
    }, () => setLocate('failed'), { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 })
  }

  const cheapestMinor = prices.length ? toMinor(prices[0].price) : null
  const chosenPrice = prices.find(entry => entry.store.id === chosen)
  const chosenMinor = chosenPrice ? toMinor(chosenPrice.price) : null
  const differenceMinor = cheapestMinor !== null && chosenMinor !== null ? chosenMinor - cheapestMinor : null

  return <div data-testid="barcode-branch-compare">
    <label className={styles.branchLabel}>{t.branch}
      <select value={chosen} onChange={event => setChosen(event.target.value)} data-testid="barcode-chosen-branch">
        <option value="">{t.none}</option>
        {prices.map(entry => <option key={entry.store.id} value={entry.store.id}>{entry.store.chainName[locale]} · {entry.store.name}</option>)}
      </select>
    </label>
    {differenceMinor !== null && <p role="status" className={differenceMinor > 0 ? styles.cheaperBy : styles.muted} data-testid="barcode-cheaper-by">
      {differenceMinor > 0 ? t.cheaper.replace('{amount}', formatMinorIls(differenceMinor, locale) + (weighted ? t.perKg : '')) : t.same}
    </p>}
    {locate !== 'done' && <button type="button" className={styles.secondary} onClick={showDistances} disabled={locate === 'pending'} data-testid="barcode-show-distance">{locate === 'pending' ? t.locating : t.distance}</button>}
    {locate === 'failed' && <p role="status" className={styles.muted}>{t.failed}</p>}
    {locate !== 'done' && <small className={styles.note}>{t.locationNote}</small>}
  </div>
}
