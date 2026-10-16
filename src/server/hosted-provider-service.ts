import 'server-only'
import { createHash } from 'node:crypto'
import { demoOrigin } from './demo-access'
import { createDirectHandler } from '../features/receipt-image/direct-image-boundary'
import { captureResponse } from '../features/receipt-image/structured-capture-response'
import { safeAttemptEvent, type AttemptEvent, type AttemptDiagnostics } from '../features/receipt-image/vision-attempt'
import { captureTransport } from './receipt-capture'
import { createAddressSearchHandler, createGeoapifyTransport } from './address-search-boundary'

// Continuous operation has no app quota, budget ceiling, cooldown or session
// expiry. Existing frozen session records are never read, reset or rewritten.
export function continuousProviderMode(env: NodeJS.ProcessEnv): boolean {
  return env.SPENDSCAPE_API_USAGE_MODE === 'continuous'
}
function serviceOrigin(request: Request, env: NodeJS.ProcessEnv): boolean {
  try {
    const origin = env.SPENDSCAPE_DEMO_ORIGIN ?? '', url = new URL(origin)
    return !!env.VERCEL && env.SPENDSCAPE_HOSTED_MODE === 'presentation' && url.protocol === 'https:' && url.origin === origin &&
      demoOrigin(request, { origin, test: false })
  } catch { return false }
}
export function serviceReceiptCredentialsReady(env: NodeJS.ProcessEnv): boolean {
  return env.SPENDSCAPE_RECEIPT_PROJECT === 'spendscape-receipt-benchmark' && env.SPENDSCAPE_RECEIPT_PROJECT_NUMBER === '376401338717' && env.SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED === '1' &&
    /^[A-Za-z0-9_.-]{20,200}$/.test(env.GEMINI_API_KEY ?? '') && /^[a-f0-9]{64}$/.test(env.SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256 ?? '') &&
    createHash('sha256').update(env.GEMINI_API_KEY ?? '').digest('hex') === env.SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256
}
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
export function createContinuousReceiptHandler(env: NodeJS.ProcessEnv, send: typeof fetch = fetch, timeoutMs = 45_000) {
  return async (request: Request) => {
    if (!continuousProviderMode(env) || !serviceOrigin(request, env) || !serviceReceiptCredentialsReady(env)) return reply({ code: 'ocr-unavailable' }, 503)
    if (request.method === 'GET') return reply({ code: 'local-capture-ready', mode: 'native-service' })
    const events: AttemptEvent[] = [], started = performance.now()
    const diagnostics: AttemptDiagnostics = {
      start: async () => ({ emit: async (stage, metadata) => { events.push(safeAttemptEvent(stage, performance.now() - started, metadata)) } }),
      status: async () => ({ version: 1, state: events.some(e => e.stage === 'review-response-complete') ? 'complete' : events.some(e => e.stage === 'failure') ? 'failed' : 'incomplete', events }),
    }
    return createDirectHandler({ enabled: true, fictionalQa: false, allowRequest: r => serviceOrigin(r, env),
      hash: bytes => createHash('sha256').update(bytes).digest('hex'), status: async () => ({ status: 'available' }),
      slot: async () => ({ diagnostics, consumed: async () => false, reserve: async () => {} }),
      recognize: captureTransport(() => env.GEMINI_API_KEY!, send),
    }, timeoutMs, captureResponse)(request)
  }
}
export function createContinuousAddressHandler(env: NodeJS.ProcessEnv, send: typeof fetch = fetch, timeoutMs = 10_000) {
  return async (request: Request) => {
    if (!continuousProviderMode(env) || !serviceOrigin(request, env) || env.SPENDSCAPE_ADDRESS_FREE_READY !== '1' || !/^[A-Za-z0-9_-]{16,128}$/.test(env.GEOAPIFY_API_KEY ?? '')) return reply({ status: 'disabled' }, 503)
    if (request.method === 'GET') return reply({ status: 'available', mode: 'native-service' })
    return createAddressSearchHandler({ enabled: true, allowRequest: r => serviceOrigin(r, env), reserve: async () => true,
      search: createGeoapifyTransport(() => env.GEOAPIFY_API_KEY!, send),
    }, timeoutMs)(request)
  }
}
