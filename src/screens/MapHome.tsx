import { useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import Globe from 'react-globe.gl'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { useMapCamera } from '@/map/useMapCamera'
import type { LonLat } from '@/map/projection'
import { historyRange, merchantPins, merchantStats, purchasesForMerchant, round2 } from '@/data/derive'
import { useApp } from '@/state/AppState'
import { useLocale } from '@/i18n'
import { Sheet } from '@/components/Sheet'
import { PurchaseRow, Stats } from '@/components/ui'
import { CATEGORY_ORDER, categoryColor, categoryLabelKey } from '@/components/categories'
import { CitySearch } from '@/components/CitySearch'
import styles from './MapHome.module.css'

const HOME_VIEW = { center: [0, 20] as LonLat, zoom: 2 }
let hasBooted = false

function LeafletCameraSync({ view, setView, onBackgroundTap }: any) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter()
      setView({ center: [center.lng, center.lat], zoom: map.getZoom() })
    },
    click: () => onBackgroundTap?.(),
  })

  useEffect(() => {
    const current = map.getCenter()
    if (Math.abs(current.lat - view.center[1]) > 0.0001 || Math.abs(current.lng - view.center[0]) > 0.0001) {
      map.flyTo([view.center[1], view.center[0]], view.zoom, { animate: true, duration: 1.5 })
    }
  }, [view.center, view.zoom, map])

  return null
}

export function MapHome() {
  const { t, L: localeL, money, number, date, dir } = useLocale()
  const { category, setCategory, extra } = useApp()
  const { view, setView, flyTo } = useMapCamera(HOME_VIEW)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [booting, setBooting] = useState(!hasBooted)
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  const globeRef = useRef<any>(null)

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (hasBooted) return
    const id = window.setTimeout(() => {
      hasBooted = true
      setBooting(false)
    }, 620)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (globeRef.current && view.zoom < 6) {
      const [lng, lat] = view.center
      const altitude = Math.max(0.1, 3.5 / Math.pow(1.3, (view.zoom || 2) - 2))
      globeRef.current.pointOfView({ lat, lng, altitude }, 1000)
    }
  }, [view.center, view.zoom])

  const pins = useMemo(() => merchantPins(category, extra), [category, extra])
  const range = useMemo(() => historyRange(extra), [extra])

  const purchaseCount = pins.reduce((s, p) => s + purchasesForMerchant(p.merchant.id, extra).length, 0)
  const spendShown = round2(pins.reduce((s, p) => s + p.totalSpend, 0))

  const selected = selectedId ? merchantStats(selectedId, extra) : null
  const selectedPurchases = selectedId ? purchasesForMerchant(selectedId, extra).slice(0, 4) : []

  const handleCategory = (next: typeof category) => {
    setCategory(next)
    setSelectedId(null)
  }

  // חישוב האלמנטים בגלובוס שמציגים את סך הרכישות או כמות הקניות במבט רחב
  const globeElements = useMemo(() => {
    return pins.map((pin) => {
      const purchases = purchasesForMerchant(pin.merchant.id, extra)
      const color = categoryColor(pin.merchant.category)
      return {
        lat: pin.merchant.coord[1],
        lng: pin.merchant.coord[0],
        merchantId: pin.merchant.id,
        count: purchases.length,
        color: color,
      }
    })
  }, [pins, extra])

  // סמן אישי לכל חנות במפת ה-Leaflet
  const createMarkerIcon = (color: string) => L.divIcon({
    className: 'custom-pin',
    html: `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  })

  // קלאסטר חכם שמציג את סך הרכישות באזור ככל שעושים זום אאוט, ומתפצל בזום אין
  const createClusterIcon = (cluster: any) => {
    const childMarkers = cluster.getAllChildMarkers()
    // חישוב סך כל הרכישות או העסקאות בקלאסטר הנוכחי
    const totalClusterCount = childMarkers.reduce((sum: number, m: any) => sum + (m.options.purchaseCount || 1), 0)

    return L.divIcon({
      className: 'custom-cluster',
      html: `<div style="background-color: #0f5c57; color: white; border-radius: 50%; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; border: 2.5px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.4);">${totalClusterCount}</div>`,
      iconSize: L.point(42, 42, true),
    })
  }

  const isDetailedView = view.zoom >= 6

  return (
    <div className={styles.wrap} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>

      <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: '#0a0f18', zIndex: 0 }}>
        {!isDetailedView ? (
          <Globe
            ref={globeRef}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
            htmlElementsData={globeElements}
            htmlLat="lat"
            htmlLng="lng"
            htmlElement={(d: any) => {
              const el = document.createElement('div')
              el.innerHTML = `
                <div style="
                  background-color: ${d.color};
                  color: white;
                  border-radius: 50%;
                  width: 32px;
                  height: 32px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                  font-weight: bold;
                  border: 2px solid white;
                  box-shadow: 0 3px 6px rgba(0,0,0,0.5);
                  cursor: pointer;
                ">
                  ${d.count}
                </div>
              `
              el.style.pointerEvents = 'auto'
              el.onclick = () => {
                setSelectedId(d.merchantId)
                flyTo({ center: [d.lng, d.lat], zoom: 14 })
              }
              return el
            }}
            onGlobeClick={() => setSelectedId(null)}
            width={windowSize.width}
            height={windowSize.height}
          />
        ) : (
          <MapContainer
            center={[view.center[1], view.center[0]]}
            zoom={view.zoom}
            zoomControl={false}
            maxBounds={[[-90, -180], [90, 180]]}
            minZoom={2}
            style={{ width: '100%', height: '100%', background: '#0a1014' }}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri"
            />
            <LeafletCameraSync view={view} setView={setView} onBackgroundTap={() => setSelectedId(null)} />

            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={createClusterIcon}
              maxClusterRadius={50}
              showCoverageOnHover={false}
              spiderfyOnMaxZoom={true}
            >
              {pins.flatMap((pin) => {
                const purchases = purchasesForMerchant(pin.merchant.id, extra)
                return purchases.map((purchase) => (
                  <Marker
                    key={purchase.id}
                    position={[pin.merchant.coord[1], pin.merchant.coord[0]]}
                    icon={createMarkerIcon(categoryColor(pin.merchant.category))}
                    // מעבירים את כמות הרכישות כדי שהקלאסטר יסכום אותן בזום אאוט
                    //@ts-ignore
                    purchaseCount={purchases.length}
                    eventHandlers={{
                      click: () => {
                        setSelectedId(pin.merchant.id)
                        flyTo({ center: pin.merchant.coord, zoom: 15 })
                      }
                    }}
                  />
                ))
              })}
            </MarkerClusterGroup>
          </MapContainer>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: dir === 'rtl' ? 'flex-end' : 'flex-start',
          padding: '16px',
          direction: dir,
          pointerEvents: 'none'
        }}
      >
        <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: '400px' }}>
          <CitySearch onLocationFound={(lng, lat) => flyTo({ center: [lng, lat], zoom: 14 })} />
        </div>
      </div>

      <div className={styles.top} style={{ position: 'relative', zIndex: 10, pointerEvents: 'none', direction: dir }}>
        <div className={styles.summary} style={{ pointerEvents: 'auto' }}>
          <div className={styles.summaryFigure}>
            <span className={`${styles.summaryAmount} num`}>{money(spendShown, { decimals: false })}</span>
            <span className="caption">
              {t('map.summaryMeta', { n: number(purchaseCount), from: range ? date(range.from) : '' })}
            </span>
          </div>
          <span className="badge badge-demo">{t('demo.badge')}</span>
        </div>

        <div className={`scroll-x ${styles.chips}`} role="group" aria-label={t('cat.all')} style={{ pointerEvents: 'auto' }}>
          <button type="button" className="chip" aria-pressed={category === 'all'} onClick={() => handleCategory('all')}>
            {t('cat.all')}
          </button>
          {CATEGORY_ORDER.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={category === c} onClick={() => handleCategory(c)}>
              <span className="chip-dot" style={{ color: categoryColor(c) }} />
              {t(categoryLabelKey(c))}
            </button>
          ))}
        </div>
      </div>

      {pins.length === 0 && !booting && (
        <div className={styles.emptyOverlay} role="status" style={{ position: 'relative', zIndex: 10 }}>
          <h3 className="heading">{t('map.emptyFilter')}</h3>
          <p className="sub" style={{ marginBlockStart: 6 }}>{t('map.emptyFilterHint')}</p>
          <button type="button" className="btn btn-quiet" style={{ marginBlockStart: 'var(--s-4)' }} onClick={() => handleCategory('all')}>
            {t('cat.all')}
          </button>
        </div>
      )}

      {booting && (
        <div className={styles.loading} role="status" style={{ position: 'relative', zIndex: 10 }}>
          <div className={styles.loadingBars}>
            <span className="skeleton" style={{ width: 172, height: 12 }} />
            <span className="skeleton" style={{ width: 116, height: 12 }} />
          </div>
          <span className="caption">{t('map.loading')}</span>
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', zIndex: 9999, background: '#ffffff', color: '#0f172a', padding: '24px', boxShadow: '-5px 0 25px rgba(0,0,0,0.3)', maxWidth: '420px', width: '100%', overflowY: 'auto', direction: dir }}>
          <Sheet
            open={Boolean(selected)}
            onClose={() => setSelectedId(null)}
            title={selected ? localeL(selected.merchant.name) : ''}
            subtitle={selected ? [selected.merchant.branch ? localeL(selected.merchant.branch) : null, localeL(selected.merchant.address)].filter(Boolean).join(' · ') : undefined}
          >
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
          </Sheet>
        </div>
      )}

    </div>
  )
}