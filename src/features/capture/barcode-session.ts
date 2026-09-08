import { validateBarcode, type BarcodeIdentity } from './barcode-domain'

export type DecoderState = 'idle' | 'loading' | 'ready' | 'found' | 'invalid' | 'empty' | 'load-error' | 'decode-error' | 'cancelled'
export type DecoderMessage = { type: 'ready' | 'load-error' | 'decode-error' }
  | { type: 'result'; results: { text: string; format: string; invalid: boolean }[] }
export interface BarcodeWorker {
  onmessage: ((event: MessageEvent<DecoderMessage>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage: (message: unknown, transfer?: Transferable[]) => void
  terminate: () => void
}
interface BarcodeEnvironment {
  worker: () => BarcodeWorker
  frame: () => ImageData | null
  active: () => boolean
  release: () => void
  state: (state: DecoderState) => void
  found: (identity: BarcodeIdentity) => void
}

export function createBarcodeSession(environment: BarcodeEnvironment) {
  let worker: BarcodeWorker | null = null
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let watchdog: ReturnType<typeof setTimeout> | undefined
  let attempts = 0
  let pending = false
  let initialized = false

  const release = () => {
    generation++
    clearTimeout(timer); clearTimeout(watchdog)
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); worker = null }
    pending = false; initialized = false
    environment.release()
  }
  const finish = (state: DecoderState) => { release(); environment.state(state) }
  const start = () => {
    release()
    if (!environment.active()) { environment.state('cancelled'); return }
    const current = generation
    const valid = () => current === generation && worker !== null && environment.active()
    const live = () => {
      if (current !== generation || !worker) return false
      if (!environment.active()) { finish('cancelled'); return false }
      return true
    }
    attempts = 0
    environment.state('loading')
    try {
      worker = environment.worker()
      const schedule = () => { timer = setTimeout(sample, 450) }
      const sample = () => {
        if (!live() || pending) return
        if (++attempts > 20) { finish('empty'); return }
        let image: ImageData | null = null
        try {
          image = environment.frame()
          if (!image) { schedule(); return }
          pending = true
          watchdog = setTimeout(() => { if (valid()) finish('decode-error') }, 5_000)
          worker!.postMessage({ type: 'frame', image }, [image.data.buffer as ArrayBuffer])
        } catch { finish('decode-error') }
        finally {
          // Transferred buffers are detached. Clear any buffer left by a failed transfer.
          if (image?.data.byteLength) image.data.fill(0)
        }
      }
      worker.onerror = () => { if (live()) finish(initialized ? 'decode-error' : 'load-error') }
      worker.onmessage = ({ data }) => {
        if (!live()) return
        if (data.type === 'load-error' || data.type === 'decode-error') { finish(data.type); return }
        if (data.type === 'ready') {
          if (initialized) return
          clearTimeout(watchdog); initialized = true
          environment.state('ready'); schedule(); return
        }
        if (data.type !== 'result' || !pending) return
        clearTimeout(watchdog); pending = false
        const result = data.results[0]
        if (!result) { schedule(); return }
        const validated = validateBarcode(result.text, result.format)
        // Camera noise is a no-result sample, counted within the same bounded attempt.
        // Manual validation is separate and still reports invalid input immediately.
        if (result.invalid || !validated.valid) { schedule(); return }
        finish('found')
        environment.found(validated.identity)
      }
      watchdog = setTimeout(() => { if (valid()) finish('load-error') }, 12_000)
      worker.postMessage({ type: 'init' })
    } catch { finish('load-error') }
  }
  return { start, cancel: () => { if (worker) finish('cancelled'); else release() }, dispose: release }
}
