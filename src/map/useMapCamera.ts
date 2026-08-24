/**
 * Camera state for the map.
 *
 * Owns the view, and animates programmatic moves — selecting a place, zooming
 * into a city — so that the map keeps its sense of place instead of cutting.
 * Direct gestures set the view immediately; only `flyTo` animates.
 *
 * Under `prefers-reduced-motion` the animation is skipped entirely rather than
 * shortened, because the destination is what matters, not the travel.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { clampZoom, fromWorld, toWorld, type LonLat, type MapView } from './projection'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Ease-out cubic. */
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

export function useMapCamera(initial: MapView) {
  const [view, setViewState] = useState<MapView>(initial)

  // The animation reads the current view from a ref rather than from a state
  // updater: scheduling work inside an updater is not safe, and StrictMode's
  // double invocation would fire the animation twice.
  const viewRef = useRef(view)
  const frame = useRef<number | null>(null)
  /** Where an in-flight animation is heading, so it can be completed early. */
  const target = useRef<MapView | null>(null)

  const cancel = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
  }, [])

  const apply = useCallback((next: MapView) => {
    viewRef.current = next
    setViewState(next)
  }, [])

  useEffect(() => cancel, [cancel])

  // A hidden tab stops servicing requestAnimationFrame, which would otherwise
  // leave the camera stranded part-way through a move. If the page goes away
  // mid-flight, finish the journey immediately so it is in the right place
  // when someone looks again.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && target.current) {
        cancel()
        apply(target.current)
        target.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [cancel, apply])

  /** Gesture-driven updates. Instant, and they abort any animation in flight. */
  const setView = useCallback(
    (next: MapView) => {
      cancel()
      apply(next)
    },
    [cancel, apply],
  )

  const flyTo = useCallback(
    (destination: { center: LonLat; zoom?: number }, duration = 520) => {
      cancel()

      const from = viewRef.current
      const to: MapView = {
        center: destination.center,
        zoom: clampZoom(destination.zoom ?? from.zoom),
      }

      // No animation when it cannot be seen, or when it is not wanted.
      if (prefersReducedMotion() || duration <= 0 || document.hidden) {
        target.current = null
        apply(to)
        return
      }

      target.current = to

      // Interpolate in world space so the path does not bow at high zoom.
      const a = toWorld(from.center)
      const b = toWorld(to.center)
      const start = performance.now()

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const k = ease(t)
        apply({
          center: fromWorld({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }),
          zoom: from.zoom + (to.zoom - from.zoom) * k,
        })
        if (t < 1) {
          frame.current = requestAnimationFrame(step)
        } else {
          frame.current = null
          target.current = null
        }
      }

      frame.current = requestAnimationFrame(step)
    },
    [cancel, apply],
  )

  const reset = useCallback(() => flyTo(initial), [flyTo, initial])

  return { view, setView, flyTo, reset }
}
