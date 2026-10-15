import { receiptToReviewDraft, type ReceiptReviewDraft } from '../capture/receipt-review-adapter'
import type { ReceiptImageInfo } from './image-input'
export type ImagePhase = 'idle' | 'validating' | 'ready' | 'reading' | 'error'
export type ImageError = 'image-size' | 'image-format' | 'ocr-unavailable' | 'ocr-invalid' | 'layout-unsupported' | 'timeout' | 'parser-inspection'
export interface ImageState { phase: ImagePhase; preview: string | null; code: ImageError | null }
export interface ImagePorts {
  inspect: (file: File, signal: AbortSignal) => Promise<ReceiptImageInfo>
  createUrl: (file: File) => string
  revokeUrl: (url: string) => void
  extract: (signal: AbortSignal, file: File) => Promise<unknown>
  state: (state: ImageState) => void
  complete: (draft: ReceiptReviewDraft) => void
}
// One transient input/job. Every asynchronous result belongs to a generation.
// No state, media, URL or OCR text is written to storage or logs.
export class ReceiptImageSession {
  private generation = 0
  private disposed = false
  private preview: string | null = null
  private input: File | null = null
  private controller: AbortController | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private phase: ImagePhase = 'idle'
  constructor(private ports: ImagePorts, private timeoutMs = 15_000) {}
  private emit(phase: ImagePhase, code: ImageError | null = null) { this.phase = phase; if (!this.disposed) this.ports.state({ phase, preview: this.preview, code }) }
  private release() {
    this.controller?.abort(); this.controller = null
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.preview) this.ports.revokeUrl(this.preview)
    this.preview = null; this.input = null
  }
  cancel() { this.generation++; this.release(); this.emit('idle') }
  dispose() { this.disposed = true; this.cancel() }
  private begin(phase: ImagePhase) {
    const generation = ++this.generation, controller = new AbortController()
    this.controller = controller; this.emit(phase)
    this.timer = setTimeout(() => { if (generation === this.generation) { this.generation++; this.release(); this.emit('error', 'timeout') } }, this.timeoutMs)
    return { generation, controller }
  }
  async select(file: File) {
    if (this.disposed) return
    this.cancel()
    const { generation, controller } = this.begin('validating')
    try {
      await this.ports.inspect(file, controller.signal)
      if (generation !== this.generation || this.disposed) return
      if (this.timer) clearTimeout(this.timer); this.timer = null
      this.input = file; this.preview = this.ports.createUrl(file); this.emit('ready')
    } catch (e) { if (generation === this.generation && !this.disposed) this.fail(e) }
  }
  private fail(error: unknown) {
    const message = error instanceof Error ? error.message : ''
    const code: ImageError = ['image-size', 'image-format', 'ocr-unavailable', 'layout-unsupported', 'parser-inspection'].includes(message) ? message as ImageError : 'ocr-invalid'
    this.release(); this.emit('error', code)
  }
  async read() {
    if (this.disposed || this.phase !== 'ready' || !this.input) return
    const { generation, controller } = this.begin('reading')
    try {
      const response = await this.ports.extract(controller.signal, this.input)
      if (generation !== this.generation || this.disposed) return
      const draft = receiptToReviewDraft(response)
      this.release(); this.emit('idle'); this.ports.complete(draft)
    } catch (e) { if (generation === this.generation && !this.disposed) this.fail(e) }
  }
}
