'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/** One user-triggered browser read. Coordinates live only in the pending review. */
export function useReviewGeolocation() {
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle')
  const generation = useRef(0), pending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const invalidate = useCallback(() => {
    generation.current++; pending.current = false
    clearTimeout(timer.current); timer.current = undefined
  }, [])
  const cancel = useCallback(() => { invalidate(); setState('idle') }, [invalidate])
  useEffect(() => invalidate, [invalidate])
  const read = (onPoint: (point: [number, number]) => void) => {
    if (pending.current) return
    invalidate()
    const attempt = generation.current
    const finish = (point?: [number, number]) => {
      if (attempt !== generation.current || !pending.current) return
      invalidate(); setState(point ? 'idle' : 'failed')
      if (point) onPoint(point)
    }
    pending.current = true; setState('pending')
    timer.current = setTimeout(() => finish(), 10_000)
    if (!navigator.geolocation) { finish(); return }
    try {
      navigator.geolocation.getCurrentPosition(position => {
        const point: [number, number] = [position.coords.longitude, position.coords.latitude]
        if (point.some((n,i) => !Number.isFinite(n) || Math.abs(n) > (i ? 90 : 180))) { finish(); return }
        finish(point)
      }, () => finish(), { enableHighAccuracy: false, maximumAge: 0, timeout: 10_000 })
    } catch { finish() }
  }
  return { state, read, cancel }
}
