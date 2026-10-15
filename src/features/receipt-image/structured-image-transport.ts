import {createHash} from 'node:crypto'
import {structuredRequest, STRUCTURED_ENDPOINT} from './structured-image-contract'
import {boundedDirectJson} from './direct-image-transport'
import {GEMINI_ERROR_BYTES, projectGeminiError, unknownGeminiError} from './gemini-error-diagnostic'
import {safeAttemptEvent, type AttemptEmit} from './vision-attempt'

// One injected transport; only the separately enabled server supplies native fetch.
export function createStructuredTransport(key: () => string, send: typeof fetch, requestHash: string) {
  return async (bytes: Uint8Array, mime: string, signal: AbortSignal, emit: AttemptEmit) => {
    await emit('authentication-start')
    let credential = '', body = ''
    try {
      credential = key()
      if (!/^[A-Za-z0-9_.-]{20,200}$/.test(credential) || signal.aborted) throw new Error('authentication-failed')
      await emit('authentication-complete')
      body = JSON.stringify(structuredRequest(mime, Buffer.from(bytes).toString('base64')))
      if (!/^[a-f0-9]{64}$/.test(requestHash) || createHash('sha256').update(body).digest('hex') !== requestHash) throw new Error('image-not-approved')
      if (signal.aborted) throw new Error('cancelled')
      await emit('dispatch-initiated')
      if (signal.aborted) throw new Error('cancelled')
      let response: Response
      try {
        response = await send(STRUCTURED_ENDPOINT, {method: 'POST', headers: {'Content-Type': 'application/json', 'x-goog-api-key': credential}, body, signal, redirect: 'error', cache: 'no-store'})
      } catch { throw new Error(signal.aborted ? 'cancelled' : 'transport-failed') }
      if (signal.aborted) { await response.body?.cancel(); throw new Error('cancelled') }
      await emit('provider-http', {httpStatus: response.status})
      if (!response.ok) {
        let metadata: unknown
        try {
          const raw = await boundedDirectJson(response, signal, GEMINI_ERROR_BYTES)
          const error = (raw as {error?: {code?: unknown; status?: unknown}})?.error
          metadata = {httpStatus: response.status, googleCode: error?.code, googleStatus: error?.status, geminiError: projectGeminiError(raw)}
        } catch {
          if (signal.aborted) throw new Error('cancelled')
          metadata = {httpStatus: response.status, geminiError: unknownGeminiError('malformed')}
        }
        // Unknown/new field paths stay unknown. Never retain provider messages.
        await emit('provider-http', safeAttemptEvent('provider-http', 0, metadata))
        throw new Error('recognition-failed')
      }
      return await boundedDirectJson(response, signal)
    } finally { credential = ''; body = '' }
  }
}
