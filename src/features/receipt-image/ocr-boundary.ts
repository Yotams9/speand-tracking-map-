import { parseOcrReceipt } from './ocr-parser'
import { receiptToReviewDraft } from '../capture/receipt-review-adapter'

export type OcrFixture = 'one' | 'fifteen'
export type MockOcr = (fixture: OcrFixture, signal: AbortSignal) => Promise<unknown>
const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host)
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
// Dependency injection is deliberately server-side. No native provider transport,
// credentials, image upload, persistence or logging exists in this boundary.
export function createOcrHandler(qaEnabled: boolean, mock: MockOcr, timeoutMs = 10_000) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const host = new URL(`${url.protocol}//${request.headers.get('host') ?? url.host}`)
    if (!qaEnabled || !loopback(url.hostname) || !loopback(host.hostname) || request.headers.get('x-spendscape-local-qa') !== '1') return response({ code: 'ocr-unavailable' }, 503)
    const origin = request.headers.get('origin')
    if (!origin || origin !== host.origin || request.headers.get('content-type') !== 'application/json') return response({ code: 'request-invalid' }, 400)
    if (request.signal.aborted) return response({ code: 'cancelled' }, 408)
    // Only a tiny selector for built-in fictional geometry is accepted. Receipts,
    // file names, image bytes and arbitrary OCR payloads are never accepted.
    const reader = request.body?.getReader()
    if (!reader) return response({ code: 'request-invalid' }, 400)
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)])
    const cancel = () => { void reader.cancel().catch(() => {}) }
    signal.addEventListener('abort', cancel, { once: true })
    let body = '', size = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > 128) { await reader.cancel(); return response({ code: 'request-invalid' }, 400) }
        body += new TextDecoder().decode(chunk.value)
      }
      const input: unknown = JSON.parse(body)
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || !Object.hasOwn(input, 'fixture') || !['one', 'fifteen'].includes((input as {fixture:string}).fixture)) return response({ code: 'request-invalid' }, 400)
      if (signal.aborted) return response({ code: 'cancelled' }, 408)
      const result = parseOcrReceipt(await new Promise<unknown>((resolve, reject) => {
        const abort = () => reject(new Error('cancelled'))
        signal.addEventListener('abort', abort, { once: true })
        mock((input as {fixture:OcrFixture}).fixture, signal).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
      }))
      if (signal.aborted) return response({ code: 'cancelled' }, 408)
      receiptToReviewDraft(result.observations) // Runtime contract validation before crossing to the client.
      return response({ code: 'synthetic-qa', ...result })
    } catch { return response({ code: signal.aborted ? 'cancelled' : 'ocr-invalid' }, signal.aborted ? 408 : 422) }
    finally { signal.removeEventListener('abort', cancel); reader.releaseLock() }
  }
}
