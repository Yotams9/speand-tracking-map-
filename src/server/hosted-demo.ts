import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import { demoOrigin, demoPolicy, demoRequestRole, type DemoPolicy } from './demo-access'
import { createRedisQuota, type DemoQuota } from './demo-quota'
import { createDirectHandler, type DirectSlot } from '../features/receipt-image/direct-image-boundary'
import { captureResponse } from '../features/receipt-image/structured-capture-response'
import { safeAttemptEvent, type AttemptEvent, type AttemptDiagnostics } from '../features/receipt-image/vision-attempt'
import { captureTransport } from './receipt-capture'
import { capturePricingReady } from './receipt-capture-session'

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
type QuotaFactory = (policy: DemoPolicy) => DemoQuota
const digest = (policy: DemoPolicy, value: string) => createHmac('sha256', policy.digestSalt).update(value).digest('hex')
// Presentation mode uses the existing API quota without adding an application login.
const authorized = (request: Request, policy: DemoPolicy, env: NodeJS.ProcessEnv) => demoOrigin(request, policy) && (env.SPENDSCAPE_HOSTED_MODE === 'presentation' || !!demoRequestRole(request, policy))
export function hostedReceiptReady(env: NodeJS.ProcessEnv, now: number) {
  return capturePricingReady(new Date(now)) && env.SPENDSCAPE_RECEIPT_PROJECT === 'spendscape-receipt-benchmark' && env.SPENDSCAPE_RECEIPT_PROJECT_NUMBER === '376401338717' && env.SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED === '1' &&
    /^[A-Za-z0-9_.-]{20,200}$/.test(env.GEMINI_API_KEY ?? '') && /^[a-f0-9]{64}$/.test(env.SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256 ?? '') &&
    createHash('sha256').update(env.GEMINI_API_KEY ?? '').digest('hex') === env.SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256
}
export function createHostedReceiptHandler(env: NodeJS.ProcessEnv, send: typeof fetch = fetch, quotaFactory: QuotaFactory = p => createRedisQuota(env, p), now = () => Date.now(), timeoutMs = 45_000) {
  return async (request: Request) => {
    const policy = demoPolicy(env, now())
    if (!policy || !authorized(request, policy, env)) return reply({ code: 'ocr-unavailable' }, 503)
    if (!hostedReceiptReady(env, now()) || policy.receiptLimit === 0) return reply({ code: 'ocr-unavailable' }, 503)
    const quota = quotaFactory(policy)
    if (request.method === 'GET') try {
      const state = await quota.status('receipt')
      const names = { 'limit-reached': 'exhausted', 'session-stopped': 'stopped', busy: 'busy-or-interrupted' }
      return reply({ code: 'local-capture-ready', mode: 'native', session: { ...state, state: names[state.status as keyof typeof names] ?? state.status, ceilingMicroUsd: policy.ceilingMicroUsd } })
    } catch { return reply({ code: 'diagnostics-unavailable' }, 503) }
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
        const hashDigest = digest(policy, 'receipt:' + hash)
        const slot: DirectSlot = { diagnostics, consumed: async () => terminal, reserve: async () => {
          if (now() >= policy.expiresAt) throw Error('pilot-stopped')
          try { await quota.reserve('receipt', hashDigest); slotDigest = hashDigest } catch { throw Error('pilot-stopped') }
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
export const handleHostedReceipt = createHostedReceiptHandler(process.env)
