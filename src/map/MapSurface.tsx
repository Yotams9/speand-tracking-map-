/**
 * The map surface.
 *
 * This is a deliberately simplified, self-contained map: real Web Mercator
 * projection, hand-authored abstract basemap geometry, pan, wheel zoom, pinch
 * zoom, and a scale bar that tells the truth about the current scale.
 *
 * What it is not is a tile client. There is no provider, no API key, no network
 * request, and nothing to rate-limit — which is why the demo runs offline and
 * why visual QA is deterministic. Everything downstream talks to it through
 * lon/lat and the `project` callback, so replacing it with MapLibre later
 * touches this file and nothing else.
 */

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react'
import { fixtures } from '@/data/fixtures'
import {
  clampZoom, fromScreen, fromWorld, metresPerPixel, pathFor, tierFor, toScreen,
  toWorld, worldSize,
  type LonLat, type MapView, type Point, type Size, type ZoomTier,
} from './projection'
import styles from './MapSurface.module.css'

export interface MapRenderProps {
  project: (lonLat: LonLat) => Point
  size: Size
  tier: ZoomTier
  zoom: number
}

interface Props {
  view: MapView
  onViewChange: (view: MapView) => void
  /** Fired for a tap that was not a drag — used to clear a selection. */
  onBackgroundTap?: () => void
  children?: (props: MapRenderProps) => ReactNode
  labels?: { zoomIn: string; zoomOut: string }
}

/** Drag distance, in px, below which a pointer sequence counts as a tap. */
const TAP_SLOP = 6

export function MapSurface({ view, onViewChange, onBackgroundTap, children, labels }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  const [dragging, setDragging] = useState(false)

  // Live pointer bookkeeping. Kept in a ref so that a move handler never
  // depends on stale state between frames.
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<{ startView: MapView; startDist: number; moved: number } | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  // -- Size ------------------------------------------------------------------

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return

    let frame: number | null = null

    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize({ width: r.width, height: r.height })

      // A tab that is not compositing — backgrounded, or inside a collapsed
      // ancestor — can measure zero at mount and never report a change
      // afterwards, which would leave the map permanently blank. Keep asking
      // until the element has a real size.
      if (r.width === 0 || r.height === 0) {
        frame = requestAnimationFrame(measure)
      } else {
        frame = null
      }
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)

    return () => {
      ro.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [])

  const project = useCallback(
    (lonLat: LonLat) => toScreen(lonLat, view, size),
    [view, size],
  )

  // -- Zoom about a fixed screen point --------------------------------------

  const zoomAround = useCallback(
    (anchor: Point, nextZoom: number) => {
      const current = viewRef.current
      const clamped = clampZoom(nextZoom)
      if (clamped === current.zoom) return

      const held = fromScreen(anchor, current, size)
      const scale = worldSize(clamped)
      const w = toWorld(held)
      const center = fromWorld({
        x: w.x - (anchor.x - size.width / 2) / scale,
        y: w.y - (anchor.y - size.height / 2) / scale,
      })
      onViewChange({ center, zoom: clamped })
    },
    [onViewChange, size],
  )

  const zoomByButton = useCallback(
    (delta: number) => {
      zoomAround({ x: size.width / 2, y: size.height / 2 }, viewRef.current.zoom + delta)
    },
    [zoomAround, size],
  )

  // -- Pointer gestures ------------------------------------------------------

  const localPoint = (e: ReactPointerEvent | PointerEvent): Point => {
    const rect = wrapRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!wrapRef.current) return
    wrapRef.current.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, localPoint(e))

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        startView: viewRef.current,
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        moved: 0,
      }
    } else {
      gesture.current = { startView: viewRef.current, startDist: 0, moved: 0 }
      setDragging(true)
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    const prev = pointers.current.get(e.pointerId)!
    const next = localPoint(e)
    pointers.current.set(e.pointerId, next)

    const dx = next.x - prev.x
    const dy = next.y - prev.y
    gesture.current.moved += Math.hypot(dx, dy)

    // Two fingers: pinch.
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (gesture.current.startDist > 0 && dist > 0) {
        const ratio = dist / gesture.current.startDist
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        zoomAround(mid, gesture.current.startView.zoom + Math.log2(ratio))
      }
      return
    }

    // One finger: pan.
    const current = viewRef.current
    const scale = worldSize(current.zoom)
    const c = toWorld(current.center)
    onViewChange({
      center: fromWorld({ x: c.x - dx / scale, y: c.y - dy / scale }),
      zoom: current.zoom,
    })
  }

  const endPointer = (e: ReactPointerEvent) => {
    const wasTap = (gesture.current?.moved ?? Infinity) < TAP_SLOP
    const wasSingle = pointers.current.size === 1

    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) {
      setDragging(false)
      gesture.current = null
      if (wasTap && wasSingle && e.target === e.currentTarget) onBackgroundTap?.()
    } else if (pointers.current.size === 1) {
      // Coming out of a pinch — re-anchor so the remaining finger does not jump.
      gesture.current = { startView: viewRef.current, startDist: 0, moved: TAP_SLOP + 1 }
    }
  }

  // Wheel is attached natively so it can be non-passive and preventDefault the
  // page scroll without React's passive listener getting in the way.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      zoomAround(anchor, viewRef.current.zoom - e.deltaY * 0.0022)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAround])

  // -- Basemap geometry ------------------------------------------------------

  const geometry = useMemo(() => {
    if (size.width === 0) return null
    const { basemap } = fixtures
    return {
      sea: pathFor(basemap.sea as LonLat[], view, size, true),
      river: pathFor(basemap.river as LonLat[], view, size),
      parks: basemap.parks.map((p) => pathFor(p as LonLat[], view, size, true)),
      arterials: basemap.arterials.map((a) => pathFor(a as LonLat[], view, size)),
    }
  }, [view, size])

  // Graticule spacing widens as you pull back, so the lines stay sparse.
  const graticule = useMemo(() => {
    if (size.width === 0) return []
    const step = view.zoom > 13 ? 0.02 : view.zoom > 11 ? 0.05 : 0.1
    const tl = fromScreen({ x: 0, y: 0 }, view, size)
    const br = fromScreen({ x: size.width, y: size.height }, view, size)

    const lines: { d: string }[] = []
    const startLon = Math.floor(tl[0] / step) * step
    for (let lon = startLon; lon <= br[0]; lon += step) {
      const a = toScreen([lon, tl[1]], view, size)
      const b = toScreen([lon, br[1]], view, size)
      lines.push({ d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}` })
    }
    const startLat = Math.floor(br[1] / step) * step
    for (let lat = startLat; lat <= tl[1]; lat += step) {
      const a = toScreen([tl[0], lat], view, size)
      const b = toScreen([br[0], lat], view, size)
      lines.push({ d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}` })
    }
    return lines
  }, [view, size])

  // -- Scale bar -------------------------------------------------------------

  const scale = useMemo(() => {
    if (size.width === 0) return null
    const mpp = metresPerPixel(view.center[1], view.zoom)
    const targets = [50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000]
    const target = targets.find((t) => t / mpp > 56 && t / mpp < 132) ?? targets[targets.length - 1]
    return {
      px: Math.round(target / mpp),
      label: target >= 1000 ? `${target / 1000} km` : `${target} m`,
    }
  }, [view, size])

  const tier = tierFor(view.zoom)
  // Fade the curvature in only once the view is wide enough to justify it.
  const curveOpacity = Math.max(0, Math.min(1, (11.6 - view.zoom) / 1.8))

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      data-dragging={dragging}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      role="application"
      aria-label="Purchase map"
    >
      <svg className={styles.svg} aria-hidden="true">
        {geometry && (
          <>
            <g>
              {graticule.map((l, i) => (
                <path key={i} d={l.d} stroke="var(--map-graticule)" strokeWidth={1} fill="none" />
              ))}
            </g>

            <path d={geometry.sea} fill="var(--map-sea)" />

            {geometry.parks.map((d, i) => (
              <path key={i} d={d} fill="var(--map-park)" />
            ))}

            <path
              d={geometry.river}
              stroke="var(--map-river)"
              strokeWidth={Math.max(2, view.zoom - 8)}
              strokeLinecap="round"
              fill="none"
            />

            {geometry.arterials.map((d, i) => (
              <path
                key={i}
                d={d}
                stroke={i === 0 ? 'var(--map-road-major)' : 'var(--map-road)'}
                strokeWidth={Math.max(1.5, (view.zoom - 9) * 1.1)}
                strokeLinecap="round"
                fill="none"
              />
            ))}
          </>
        )}
      </svg>

      <div className={styles.curvature} style={{ opacity: curveOpacity }} />

      <div className={styles.overlay}>
        {size.width > 0 && children?.({ project, size, tier, zoom: view.zoom })}
      </div>

      {scale && (
        <div className={styles.scaleBar} aria-hidden="true">
          <span>{scale.label}</span>
          <div className={styles.scaleBarLine} style={{ inlineSize: scale.px }} />
        </div>
      )}

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.ctrl}
          onClick={() => zoomByButton(1)}
          disabled={view.zoom >= 17}
          aria-label={labels?.zoomIn ?? 'Zoom in'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M9 3.5v11M3.5 9h11" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.ctrl}
          onClick={() => zoomByButton(-1)}
          disabled={view.zoom <= 8.5}
          aria-label={labels?.zoomOut ?? 'Zoom out'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3.5 9h11" />
          </svg>
        </button>
      </div>

      <span className="sr-only">Map zoom tier: {tier}</span>
    </div>
  )
}
