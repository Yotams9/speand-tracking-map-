'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { CameraState } from './camera-session'
import { createBarcodeSession, type BarcodeWorker, type DecoderState } from './barcode-session'
import { validateBarcode, type BarcodeIdentity } from './barcode-domain'

export function useCaptureBarcode(videoRef: RefObject<HTMLVideoElement | null>, targetRef: RefObject<HTMLDivElement | null>, cameraState: CameraState, stopCamera: () => void) {
  const [state, setState] = useState<DecoderState>('idle')
  const [identity, setIdentity] = useState<BarcodeIdentity | null>(null)
  const [attempt, setAttempt] = useState(0)
  const session = useRef<ReturnType<typeof createBarcodeSession> | null>(null)
  const stopRef = useRef(stopCamera)
  stopRef.current = stopCamera

  useEffect(() => {
    if (cameraState !== 'live') {
      setState((current) => current === 'loading' || current === 'ready' ? 'cancelled' : current)
      return
    }
    const video = videoRef.current!
    let canvas: HTMLCanvasElement | null = null
    const controller = createBarcodeSession({
      worker: () => new Worker(new URL('./barcode.worker.ts', import.meta.url), { type: 'module', name: 'spendscape-barcode' }) as unknown as BarcodeWorker,
      active: () => document.visibilityState === 'visible' && video.srcObject !== null && !video.paused,
      frame: () => {
        if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null
        const box = video.getBoundingClientRect()
        const target = targetRef.current!.getBoundingClientRect()
        // Convert the visible target into source pixels, accounting for object-fit: contain.
        const scale = Math.min(box.width / video.videoWidth, box.height / video.videoHeight)
        const left = box.left + (box.width - video.videoWidth * scale) / 2
        const top = box.top + (box.height - video.videoHeight * scale) / 2
        const x = Math.max(0, (target.left - left) / scale)
        const y = Math.max(0, (target.top - top) / scale)
        const width = Math.min(video.videoWidth, (target.right - left) / scale) - x
        const height = Math.min(video.videoHeight, (target.bottom - top) / scale) - y
        if (width <= 0 || height <= 0) return null
        canvas ??= document.createElement('canvas')
        const shrink = Math.min(1, 960 / width, 640 / height)
        canvas.width = Math.max(1, Math.round(width * shrink)); canvas.height = Math.max(1, Math.round(height * shrink))
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('canvas unavailable')
        try {
          context.drawImage(video, x, y, width, height, 0, 0, canvas.width, canvas.height)
          return context.getImageData(0, 0, canvas.width, canvas.height)
        } finally { canvas.width = 0; canvas.height = 0 }
      },
      release: () => { if (canvas) { canvas.width = 0; canvas.height = 0; canvas = null } },
      state: (next) => {
        setState(next)
        if (['load-error', 'decode-error', 'invalid', 'empty'].includes(next)) stopRef.current()
      },
      found: (value) => { setIdentity(value); stopRef.current() },
    })
    session.current = controller
    setIdentity(null)
    controller.start()
    const cancel = () => controller.cancel()
    const hidden = () => { if (document.visibilityState !== 'visible') cancel() }
    const interrupted = () => { if (!video.srcObject || video.paused) cancel() }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', cancel)
    video.addEventListener('pause', interrupted)
    video.addEventListener('error', cancel)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', cancel)
      video.removeEventListener('pause', interrupted)
      video.removeEventListener('error', cancel)
      controller.dispose(); session.current = null
    }
  }, [cameraState, attempt, videoRef, targetRef])

  const cancel = () => { session.current?.cancel(); stopRef.current() }
  const manual = (code: string, format: string) => {
    cancel()
    const result = validateBarcode(code, format)
    setIdentity(result.valid ? result.identity : null)
    setState(result.valid ? 'found' : 'invalid')
  }
  return { state, identity, manual, cancel, retry: () => { setIdentity(null); setState('idle'); setAttempt((n) => n + 1) } }
}
