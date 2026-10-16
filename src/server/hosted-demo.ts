import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import { demoOrigin, demoPolicy, demoRequestRole, type DemoPolicy } from './demo-access'
import { createRedisQuota, DemoQuotaRejection, type DemoQuota } from './demo-quota'
import { createDirectHandler, type DirectSlot } from '../features/receipt-image/direct-image-boundary'
import { captureResponse } from '../features/receipt-image/structured-capture-response'
import { safeAttemptEvent, type AttemptEvent, type AttemptDiagnostics } from '../features/receipt-image/vision-attempt'
import { captureTransport } from './receipt-capture'
import { capturePricingReady } from './receipt-capture-session'
import { continuousProviderMode, createContinuousAddressHandler, createContinuousReceiptHandler, serviceReceiptCredentialsReady } from './hosted-provider-service'
import { createAddressSearchHandler, createGeoapifyTransport } from './address-search-boundary'

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
type QuotaFactory = (policy: DemoPolicy) => DemoQuota
const digest = (policy: DemoPolicy, value: string) => createHmac('sha256', policy.digestSalt).update(value).digest('hex')
// Presentation mode uses the existing API quota without adding an application login.
const authorized = (request: Request, policy: DemoPolicy, env: NodeJS.ProcessEnv) => demoOrigin(request, policy) && (env.SPENDSCAPE_HOSTED_MODE === 'presentation' || !!demoRequestRole(request, policy))
export function hostedReceiptReady(env: NodeJS.ProcessEnv, now: number) {
  return capturePricingReady(new Date(now)) && serviceReceiptCredentialsReady(env)
}
export function createHostedReceiptHandler(env: NodeJS.ProcessEnv, send: typeof fetch = fetch, quotaFactory: QuotaFactory = p => createRedisQuota(env, p), now = () => Date.now(), timeoutMs = 45_000) {
  const continuous = createContinuousReceiptHandler(env, send, timeoutMs)
  return async (request: Request) => {
    if (continuousProviderMode(env)) return continuous(request)
    const policy = demoPolicy(env, now())
    if (!policy || !authorized(request, policy, env)) return reply({ code: 'ocr-unavailable' }, 503)
    if (!hostedReceiptReady(env, now()) || policy.receiptLimit === 0) return reply({ code: 'ocr-unavailable' }, 503)
    const quota = quotaFactory(policy)
    if (request.method === 'GET') try {
      const state = await quota.status('receipt')
      const names = { 'limit-reached': 'exhausted', 'session-stopped': 'stopped', busy: 'busy-or-interrupted' }
      return reply({ code: 'local-capture-ready', mode: 'native', session: { ...state, state: names[state.status as keyof typeof names] ?? state.status, ceilingMicroUsd: policy.ceilingMicroUsd } })
    } catch { return reply({ code: 'diagnostics-unavailable' }, 503) }
    const repeat = request.headers.get('x-spendscape-receipt-repeat')
    if (repeat !== null && !/^[a-f0-9]{32}$/.test(repeat)) return reply({ code: 'request-invalid' }, 400)
    let slotDigest = '', terminal = false
    const events: AttemptEvent[] = [], started = performance.now()
    const finish = async (success: boolean) => { if (slotDigest && !terminal) { terminal = true; await quota.complete('receipt', slotDigest, success ? 'success' : 'failure') } }
    const diagnostics: AttemptDiagnostics = {
      start: async () => ({ emit: async (stage, metadata) => {
        if (terminal) return
        events.push(safeAttemptEvent(stage, performance.now() - started, metadata))
        if (stage === 'review-response-complete' || stage === 'failure' || stage === 'interrupted') await finish(stage === 'review-response-complete')
      } }),
      status: async () => ({ version: 1, state: events.some(e => e.stage === 'review-response-complete') ? 'complete' : events.some(e => e.stage === 'failure') ? 'failed' : 'incomplete', events })
    }
    const handler = createDirectHandler({ enabled: true, fictionalQa: false, allowRequest: r => authorized(r, policy, env),
      hash: bytes => createHash('sha256').update(bytes).digest('hex'), status: () => quota.status('receipt'),
      slot: async hash => {
        // A repeat is a new explicit, charged action. Its ID makes retransmission
        // idempotent; the original image reservation is never cleared.
        const hashDigest = digest(policy, 'receipt:' + hash + (repeat ? ':repeat:' + repeat : ''))
        const slot: DirectSlot = { diagnostics, consumed: async () => terminal, reserve: async () => {
          if (now() >= policy.expiresAt) throw Error('pilot-stopped')
          try { await quota.reserve('receipt', hashDigest); slotDigest = hashDigest } catch (error) {
            if (error instanceof DemoQuotaRejection) {
              if (error.reason === 'duplicate') throw Error('attempt-consumed')
              if (error.reason === 'busy' || error.reason === 'wait') throw Error('pilot-wait')
              throw Error('pilot-stopped')
            }
            throw Error('diagnostics-unavailable')
          }
        } }; return slot
      },
      recognize: async (bytes, mime, signal, emit) => {
        if (now() >= policy.expiresAt || signal.aborted) throw Error('cancelled')
        return captureTransport(() => env.GEMINI_API_KEY!, send)(bytes, mime, signal, emit)
      }
    }, timeoutMs, captureResponse)
    try { return await handler(request) } finally { try { await finish(false) } catch { /* Persisted in-flight reservation stays blocked. */ } }
  }
}
// A separately activated address namespace never changes the receipt quota policy.
export function hostedAddressPolicy(env: NodeJS.ProcessEnv, now = Date.now()): DemoPolicy | null {
  if (!env.SPENDSCAPE_ADDRESS_RELEASE_ID) return null
  return demoPolicy({ ...env,
    SPENDSCAPE_DEMO_RELEASE_ID: env.SPENDSCAPE_ADDRESS_RELEASE_ID,
    SPENDSCAPE_DEMO_START_AT: env.SPENDSCAPE_ADDRESS_START_AT,
    SPENDSCAPE_DEMO_EXPIRES_AT: env.SPENDSCAPE_ADDRESS_EXPIRES_AT,
    SPENDSCAPE_DEMO_RECEIPT_LIMIT: '0',
    SPENDSCAPE_DEMO_ADDRESS_LIMIT: env.SPENDSCAPE_ADDRESS_REQUEST_LIMIT,
    SPENDSCAPE_DEMO_CEILING_MICRO_USD: '0',
  }, now)
}
export function createHostedAddressHandler(env: NodeJS.ProcessEnv, send: typeof fetch = fetch, quotaFactory: QuotaFactory = p => createRedisQuota(env, p), now = () => Date.now(), timeoutMs = 10_000) {
  const continuous = createContinuousAddressHandler(env, send, timeoutMs)
  return async (request: Request) => {
    if (continuousProviderMode(env)) return continuous(request)
    const policy = hostedAddressPolicy(env, now())
    if (!policy || !authorized(request, policy, env) || policy.addressLimit === 0 || env.SPENDSCAPE_ADDRESS_FREE_READY !== '1' || !/^[A-Za-z0-9_-]{16,128}$/.test(env.GEOAPIFY_API_KEY ?? '')) return reply({ status: 'disabled' }, 503)
    const quota = quotaFactory(policy)
    if (request.method === 'GET') try { const state = await quota.status('address'); return reply({ status: state.status, mode: 'native-session', session: state }) } catch { return reply({ status: 'unavailable' }, 503) }
    const id = request.headers.get('x-spendscape-address-submission') ?? ''
    if (!/^[a-f0-9]{32}$/.test(id)) return reply({ status: 'invalid' }, 400)
    const submission = digest(policy, 'address:' + id)
    let reserved = false
    const handler = createAddressSearchHandler({ enabled: true, allowRequest: r => authorized(r, policy, env),
      reserve: async () => { if (now() >= policy.expiresAt) return false; try { await quota.reserve('address', submission); reserved = true; return true } catch { return false } },
      search: async (input, signal) => {
        if (now() >= policy.expiresAt || signal.aborted) return { status: 'cancelled' }
        return createGeoapifyTransport(() => env.GEOAPIFY_API_KEY!, send)(input, signal)
      }
    }, timeoutMs)
    const response = await handler(request)
    if (reserved) {
      const result = await response.clone().json().catch(() => ({ status: 'unavailable' }))
      try { await quota.complete('address', submission, ['results', 'no-results'].includes(result.status) ? 'success' : 'failure') } catch { return reply({ status: 'unavailable' }, 503) }
    }
    return response
  }
}
export const handleHostedAddress = createHostedAddressHandler(process.env)
export const handleHostedReceipt = createHostedReceiptHandler(process.env)
