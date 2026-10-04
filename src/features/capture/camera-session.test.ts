import { describe, expect, it, vi } from 'vitest'
import { createCameraSession, type CameraState } from './camera-session'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function fakeStream() {
  const track = Object.assign(new EventTarget(), {
    readyState: 'live', muted: false,
    stop: vi.fn(() => { track.readyState = 'ended' }),
  })
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
  return { stream, track }
}

function setup() {
  const pending = deferred<MediaStream>()
  const request = vi.fn((_constraints: MediaStreamConstraints) => pending.promise)
  const attach = vi.fn(async (_stream: MediaStream) => {})
  const detach = vi.fn()
  const states: CameraState[] = []
  const environment = {
    isSecure: () => true, isVisible: () => true, isSupported: () => true,
    request, attach, detach, onState: (state: CameraState) => states.push(state),
  }
  const session = createCameraSession(environment)
  return { session, environment, pending, request, attach, detach, states }
}

describe('ephemeral camera ownership', () => {
  it('requests only on start, prefers the rear camera, never requests audio, and ignores double start', async () => {
    const h = setup()
    expect(h.request).not.toHaveBeenCalled()
    const camera = fakeStream()
    const first = h.session.start()
    await h.session.start()
    expect(h.request).toHaveBeenCalledExactlyOnceWith({ audio: false, video: { facingMode: { ideal: 'environment' } } })
    h.pending.resolve(camera.stream)
    await first
    expect(h.states).toEqual(['requesting', 'live'])
    h.session.stop()
    expect(camera.track.stop).toHaveBeenCalledOnce()
    expect(h.detach).toHaveBeenCalledOnce()
    expect(h.states.at(-1)).toBe('stopped')
  })

  for (const operation of ['stop', 'dispose'] as const) {
    it(`stops a late permission grant after ${operation}, without attaching or publishing live`, async () => {
      const h = setup()
      const camera = fakeStream()
      const task = h.session.start()
      h.session[operation]()
      const states = [...h.states]
      h.pending.resolve(camera.stream)
      await task
      expect(camera.track.stop).toHaveBeenCalledOnce()
      expect(h.attach).not.toHaveBeenCalled()
      expect(h.states).toEqual(states)
    })
  }

  it('does not let a stale request replace or stop the newer stream', async () => {
    const h = setup()
    const old = fakeStream()
    const fresh = fakeStream()
    const first = h.session.start()
    h.session.stop()
    h.request.mockResolvedValueOnce(fresh.stream)
    await h.session.start()
    h.pending.resolve(old.stream)
    await first
    expect(old.track.stop).toHaveBeenCalledOnce()
    expect(fresh.track.stop).not.toHaveBeenCalled()
    expect(h.attach).toHaveBeenCalledExactlyOnceWith(fresh.stream)
    expect(h.states.at(-1)).toBe('live')
    h.session.dispose()
    expect(fresh.track.stop).toHaveBeenCalledOnce()
  })

  it('releases an attached stream while play is pending and ignores its late completion', async () => {
    const h = setup()
    const play = deferred<void>()
    h.attach.mockReturnValue(play.promise)
    const camera = fakeStream()
    h.request.mockResolvedValue(camera.stream)
    const task = h.session.start()
    await vi.waitFor(() => expect(h.attach).toHaveBeenCalledOnce())
    h.session.stop()
    play.resolve()
    await task
    expect(camera.track.stop).toHaveBeenCalledOnce()
    expect(h.states.at(-1)).toBe('stopped')
    expect(h.states).not.toContain('live')
  })

  it('stops all tracks and clears the preview when playback fails', async () => {
    const h = setup()
    const camera = fakeStream()
    h.request.mockResolvedValue(camera.stream)
    h.attach.mockRejectedValue(new Error('play rejected'))
    await h.session.start()
    expect(camera.track.stop).toHaveBeenCalledOnce()
    expect(h.detach).toHaveBeenCalledOnce()
    expect(h.states.at(-1)).toBe('preview-failed')
  })

  it('allows a temporarily muted new track to initialize before playback is ready', async () => {
    const h = setup()
    const camera = fakeStream()
    camera.track.muted = true
    h.request.mockResolvedValue(camera.stream)
    h.attach.mockImplementation(async () => { camera.track.muted = false })
    await h.session.start()
    expect(h.attach).toHaveBeenCalledOnce()
    expect(camera.track.stop).not.toHaveBeenCalled()
    expect(h.states.at(-1)).toBe('live')
    h.session.dispose()
  })

  for (const event of ['ended', 'mute']) {
    it(`stops on track ${event}, removes listeners, and does not auto restart`, async () => {
      const h = setup()
      const camera = fakeStream()
      h.request.mockResolvedValue(camera.stream)
      await h.session.start()
      camera.track.dispatchEvent(new Event(event))
      expect(h.states.at(-1)).toBe('interrupted')
      expect(camera.track.stop).toHaveBeenCalledOnce()
      camera.track.dispatchEvent(new Event(event))
      expect(camera.track.stop).toHaveBeenCalledOnce()
      expect(h.request).toHaveBeenCalledOnce()
    })
  }

  for (const [check, state] of [['isSecure', 'insecure'], ['isSupported', 'unsupported'], ['isVisible', 'stopped']] as const) {
    it(`does not request media when ${check} fails`, async () => {
      const h = setup()
      h.environment[check] = () => false
      await h.session.start()
      expect(h.states).toEqual([state])
      expect(h.request).not.toHaveBeenCalled()
    })
  }

  for (const [name, state] of [
    ['NotAllowedError', 'denied'], ['SecurityError', 'denied'], ['NotFoundError', 'missing'],
    ['NotReadableError', 'busy'], ['AbortError', 'interrupted'], ['InvalidStateError', 'interrupted'], ['Other', 'error'],
  ]) {
    it(`handles ${name} without retrying permission or exposing raw errors`, async () => {
      const h = setup()
      h.request.mockRejectedValue({ name, message: 'private device detail' })
      await h.session.start()
      expect(h.states.at(-1)).toBe(state)
      expect(h.request).toHaveBeenCalledOnce()
      expect(h.attach).not.toHaveBeenCalled()
    })
  }

  it('retries unsatisfied constraints once with any camera and no microphone', async () => {
    const h = setup()
    const camera = fakeStream()
    h.request.mockRejectedValueOnce({ name: 'OverconstrainedError' }).mockResolvedValueOnce(camera.stream)
    await h.session.start()
    expect(h.request).toHaveBeenNthCalledWith(2, { audio: false, video: true })
    expect(h.states.at(-1)).toBe('live')
    h.session.dispose()
  })

  it('does not retry a constraints error arriving after cancellation', async () => {
    const h = setup()
    const task = h.session.start()
    h.session.stop()
    h.pending.reject({ name: 'OverconstrainedError' })
    await task
    expect(h.request).toHaveBeenCalledOnce()
    expect(h.states.at(-1)).toBe('stopped')
  })

  it('disposes live media and makes future start calls inert', async () => {
    const h = setup()
    const camera = fakeStream()
    h.request.mockResolvedValue(camera.stream)
    await h.session.start()
    h.session.dispose()
    await h.session.start()
    expect(camera.track.stop).toHaveBeenCalledOnce()
    expect(h.request).toHaveBeenCalledOnce()
  })
})
