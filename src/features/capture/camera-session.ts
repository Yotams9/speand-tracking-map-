export type CameraState = 'idle' | 'requesting' | 'live' | 'stopped' | 'denied'
  | 'missing' | 'busy' | 'insecure' | 'unsupported' | 'interrupted' | 'preview-failed' | 'error'

interface CameraEnvironment {
  isSecure: () => boolean
  isVisible: () => boolean
  isSupported: () => boolean
  request: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  attach: (stream: MediaStream) => Promise<void>
  detach: () => void
  onState: (state: CameraState) => void
}

function errorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
}

function requestError(error: unknown): CameraState {
  switch (errorName(error)) {
    case 'NotAllowedError': case 'SecurityError': return 'denied'
    case 'NotFoundError': case 'OverconstrainedError': return 'missing'
    case 'NotReadableError': return 'busy'
    case 'AbortError': case 'InvalidStateError': return 'interrupted'
    default: return 'error'
  }
}

// Owns only an ephemeral stream. No frames, device IDs or permission details are retained.
export function createCameraSession(environment: CameraEnvironment) {
  let generation = 0
  let disposed = false
  let state: CameraState = 'idle'
  let stream: MediaStream | null = null
  let removeTrackListeners = () => {}

  const publish = (next: CameraState) => {
    state = next
    if (!disposed) environment.onState(next)
  }
  const release = () => {
    removeTrackListeners()
    removeTrackListeners = () => {}
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    environment.detach()
  }
  const stop = (next: CameraState = 'stopped') => {
    generation += 1
    release()
    publish(next)
  }
  const start = async () => {
    if (disposed || state === 'requesting' || state === 'live') return
    if (!environment.isVisible()) { publish('stopped'); return }
    if (!environment.isSecure()) { publish('insecure'); return }
    if (!environment.isSupported()) { publish('unsupported'); return }
    const attempt = ++generation
    const current = () => !disposed && attempt === generation && environment.isVisible()
    publish('requesting')
    let acquired: MediaStream
    try {
      try {
        acquired = await environment.request({ audio: false, video: { facingMode: { ideal: 'environment' } } })
      } catch (error) {
        if (errorName(error) !== 'OverconstrainedError' || !current()) throw error
        // Retry only unsatisfied camera constraints, never a denied permission.
        acquired = await environment.request({ audio: false, video: true })
      }
    } catch (error) {
      if (current()) publish(requestError(error))
      return
    }
    // getUserMedia cannot be aborted: a late grant must never reattach the camera.
    if (!current()) {
      acquired.getTracks().forEach((track) => track.stop())
      return
    }
    stream = acquired
    const tracks = acquired.getVideoTracks()
    if (!tracks.length || tracks.some((track) => track.readyState === 'ended')) {
      stop('interrupted')
      return
    }
    const interrupted = () => stop('interrupted')
    tracks.forEach((track) => {
      track.addEventListener('ended', interrupted)
      track.addEventListener('mute', interrupted)
    })
    removeTrackListeners = () => tracks.forEach((track) => {
      track.removeEventListener('ended', interrupted)
      track.removeEventListener('mute', interrupted)
    })
    try {
      await environment.attach(acquired)
      if (current()) publish('live')
    } catch {
      if (current()) stop('preview-failed')
    }
  }
  return {
    start,
    stop,
    dispose: () => { disposed = true; stop() },
  }
}
