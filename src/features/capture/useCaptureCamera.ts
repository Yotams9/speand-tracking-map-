'use client'

import { useEffect, useRef, useState } from 'react'
import { createCameraSession, type CameraState } from './camera-session'

export function useCaptureCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sessionRef = useRef<ReturnType<typeof createCameraSession> | null>(null)
  const [state, setState] = useState<CameraState>('idle')

  useEffect(() => {
    const video = videoRef.current!
    const session = createCameraSession({
      isSecure: () => window.isSecureContext,
      isVisible: () => document.visibilityState === 'visible',
      isSupported: () => typeof navigator.mediaDevices?.getUserMedia === 'function',
      request: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
      attach: async (stream) => {
        video.srcObject = stream
        await video.play()
      },
      detach: () => { video.pause(); video.srcObject = null },
      onState: setState,
    })
    sessionRef.current = session
    const hidden = () => { if (document.visibilityState !== 'visible') session.stop() }
    const pageHide = () => session.stop()
    const videoError = () => session.stop('preview-failed')
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', pageHide)
    video.addEventListener('error', videoError)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', pageHide)
      video.removeEventListener('error', videoError)
      session.dispose()
      sessionRef.current = null
    }
  }, [])

  return {
    videoRef,
    state,
    start: () => { void sessionRef.current?.start() },
    stop: () => sessionRef.current?.stop(),
  }
}
