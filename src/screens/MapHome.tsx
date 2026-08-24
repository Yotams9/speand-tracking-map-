import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapSurface } from '@/map/MapSurface'
import { useMapCamera } from '@/map/useMapCamera'
import type { LonLat } from '@/map/projection'
import {
  clusterPins, historyRange, merchantPins, merchantStats, purchasesForMerchant, round2,
} from '@/data/derive'
import { useApp } from '@/state/AppState'
import { useLocale } from '@/i18n'
import { Sheet } from '@/components/Sheet'
import { PurchaseRow, Stats } from '@/components/ui'
import { CATEGORY_ORDER, categoryColor, categoryLabelKey } from '@/components/categories'
import styles from './MapHome.module.css'

/** Opening camera: wide enough to hold every cluster with room to breathe. */
const HOME_VIEW = { center: [34.83, 32.115] as LonLat, zoom: 10.6 }

/**
 * The loading state is shown once per session, on the first mount. Replaying it
 * every time someone taps back to the map would be theatre, not feedback.
 */
let hasBooted = false

export function MapHome() {
  const { t, L, money, number, date, plural } = useLocale()
  const { category, setCategory, extra } = useApp()
  const { view, setView, flyTo } = useMapCamera(HOME_VIEW)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [booting, setBooting] = useState(!hasBooted)

  useEffect(() => {
    if (hasBooted) return
    const id = window.setTimeout(() => {
      hasBooted = true
      setBooting(false)
    }, 620)
    return () => window.clearTimeout(id)
  }, [])

  // The headline is summed from the very same cluster pins that are drawn
  // below it, so the two can never drift apart.
  const pins = useMemo(() => merchantPins(category, extra), [category, extra])
  const clusters = useMemo(() => clusterPins(category, extra), [category, extra])
  const range = useMemo(() => historyRange(extra), [extra])

  const purchaseCount = clusters.reduce((s, c) => s + c.purchaseCount, 0)
  const spendShown = round2(clusters.reduce((s, c) => s + c.totalSpend, 0))
  const selected = selectedId ? merchantStats(selectedId, extra) : null
  const selectedPurchases = selectedId ? purchasesForMerchant(selectedId, extra).slice(0, 4) : []

  // Changing the filter must never strand the user looking at an empty patch of
  // map, so the camera reframes onto whatever is still visible.
  const handleCategory = (next: typeof category) => {
    setCategory(next)
    setSelectedId(null)
  }

  const maxClusterSpend = Math.max(1, ...clusters.map((c) => c.totalSpend))

  return (
    <div className={styles.wrap}>
      <MapSurface
        view={view}
        onViewChange={setView}
        onBackgroundTap={() => setSelectedId(null)}
        labels={{ zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut') }}
      >
        {({ project, tier }) => (
          <>
            {tier === 'clusters' &&
              clusters.map((c) => {
                const p = project(c.center)
                // Area scales with spend; the label carries the real number.
                const size = 34 + Math.round((c.totalSpend / maxClusterSpend) * 22)
                return (
                  <button
                    key={c.clusterId}
                    type="button"
                    className={`${styles.marker} ${styles.clusterBtn}`}
                    style={{ insetInlineStart: p.x, insetBlockStart: p.y }}
                    onClick={() => flyTo({ center: c.center, zoom: 13.2 })}
                    aria-label={`${L(c.name)}, ${c.purchaseCount} ${t('map.purchases')}, ${money(c.totalSpend, { decimals: false })}`}
                  >
                    <span
                      className={styles.clusterDot}
                      style={{ inlineSize: size, blockSize: size }}
                    >
                      {c.purchaseCount}
                    </span>
                    <span className={styles.clusterLabel}>
                      {L(c.name)} · {money(c.totalSpend, { decimals: false })}
                    </span>
                  </button>
                )
              })}

            {tier !== 'clusters' &&
              pins.map((pin) => {
                const p = project(pin.merchant.coord)
                const isSelected = pin.merchant.id === selectedId
                const showLabel = view.zoom >= 13
                return (
                  <button
                    key={pin.merchant.id}
                    type="button"
                    className={`${styles.marker} ${styles.merchantBtn}`}
                    style={{ insetInlineStart: p.x, insetBlockStart: p.y, zIndex: isSelected ? 4 : 2 }}
                    data-selected={isSelected}
                    onClick={() => {
                      setSelectedId(pin.merchant.id)
                      flyTo({ center: pin.merchant.coord, zoom: Math.max(view.zoom, 13.6) })
                    }}
                    aria-label={`${L(pin.merchant.name)}, ${plural(pin.visits, 'common.visit', 'common.visits')}`}
                  >
                    <span
                      className={styles.merchantDot}
                      style={{ background: categoryColor(pin.merchant.category) }}
                    />
                    {showLabel && (
                      <span className={styles.merchantLabel}>{L(pin.merchant.name)}</span>
                    )}
                  </button>
                )
              })}

            {/* At the closest tier every purchase gets its own dot, orbiting the
                place it happened at — the data knows the shop, not the metre. */}
            {tier === 'purchases' &&
              pins.flatMap((pin) => {
                const p = project(pin.merchant.coord)
                const purchases = purchasesForMerchant(pin.merchant.id, extra)
                return purchases.map((purchase, i) => {
                  const angle = (i / Math.max(purchases.length, 1)) * Math.PI * 2 - Math.PI / 2
                  const radius = 22 + (i % 3) * 7
                  return (
                    <span
                      key={purchase.id}
                      className={styles.purchaseDot}
                      style={{
                        insetInlineStart: p.x + Math.cos(angle) * radius,
                        insetBlockStart: p.y + Math.sin(angle) * radius,
                        background: categoryColor(pin.merchant.category),
                      }}
                    />
                  )
                })
              })}
          </>
        )}
      </MapSurface>

      {/* ---- Floating chrome ---- */}
      <div className={styles.top}>
        <div className={styles.summary}>
          <div className={styles.summaryFigure}>
            <span className={`${styles.summaryAmount} num`}>{money(spendShown, { decimals: false })}</span>
            <span className="caption">
              {t('map.summaryMeta', {
                n: number(purchaseCount),
                from: range ? date(range.from) : '',
              })}
            </span>
          </div>
          <span className="badge badge-demo">{t('demo.badge')}</span>
        </div>

        <div className={`scroll-x ${styles.chips}`} role="group" aria-label={t('cat.all')}>
          <button
            type="button"
            className="chip"
            aria-pressed={category === 'all'}
            onClick={() => handleCategory('all')}
          >
            {t('cat.all')}
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              className="chip"
              aria-pressed={category === c}
              onClick={() => handleCategory(c)}
            >
              <span className="chip-dot" style={{ color: categoryColor(c) }} />
              {t(categoryLabelKey(c))}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Empty filter ---- */}
      {pins.length === 0 && !booting && (
        <div className={styles.emptyOverlay} role="status">
          <h3 className="heading">{t('map.emptyFilter')}</h3>
          <p className="sub" style={{ marginBlockStart: 6 }}>{t('map.emptyFilterHint')}</p>
          <button
            type="button"
            className="btn btn-quiet"
            style={{ marginBlockStart: 'var(--s-4)' }}
            onClick={() => handleCategory('all')}
          >
            {t('cat.all')}
          </button>
        </div>
      )}

      {/* ---- Zoom hint ---- */}
      {!selectedId && pins.length > 0 && !booting && (
        <div className={styles.hint}>
          <span className={styles.hintPill}>
            {view.zoom < 12 ? t('map.tapCluster') : t('map.tapMerchant')}
          </span>
        </div>
      )}

      {/* ---- First-load state ---- */}
      {booting && (
        <div className={styles.loading} role="status">
          <div className={styles.loadingBars}>
            <span className="skeleton" style={{ width: 172, height: 12 }} />
            <span className="skeleton" style={{ width: 116, height: 12 }} />
          </div>
          <span className="caption">{t('map.loading')}</span>
        </div>
      )}

      {/* ---- Selected place ---- */}
      <Sheet
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? L(selected.merchant.name) : ''}
        subtitle={
          selected
            ? [selected.merchant.branch ? L(selected.merchant.branch) : null, L(selected.merchant.address)]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      >
        {selected && (
          <>
            <Stats
              items={[
                { label: t('merchant.visits'), value: number(selected.visits) },
                { label: t('map.totalSpend'), value: money(selected.totalSpend, { decimals: false }) },
                { label: t('map.avgPurchase'), value: money(selected.avgPurchase, { decimals: false }) },
              ]}
            />

            <div className={styles.sheetActions}>
              <Link to={`/merchant/${selected.merchant.id}`} className="btn btn-primary btn-block">
                {t('map.seePlace')}
              </Link>
            </div>

            <div style={{ marginBlockStart: 'var(--s-5)' }}>
              <h3 className="kicker" style={{ marginBlockEnd: 'var(--s-2)' }}>
                {t('merchant.history')}
              </h3>
              {selectedPurchases.map((p) => (
                <PurchaseRow key={p.id} purchase={p} />
              ))}
            </div>
          </>
        )}
      </Sheet>

    </div>
  )
}
