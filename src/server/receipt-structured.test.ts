import {expect, it, vi} from 'vitest'
import {randomUUID} from 'node:crypto'
vi.mock('server-only', () => ({}))
import {createStructuredQaHandler} from './receipt-structured'
import {createDirectHandler, type DirectPorts} from '../features/receipt-image/direct-image-boundary'
import {safeAttemptEvent, type AttemptEvent} from '../features/receipt-image/vision-attempt'
import {fictionalStructured, structuredEnvelope, structuredResponse} from '../features/receipt-image/structured-image-contract'

const request = (method = 'GET', kind = 'one') => {
  const bytes = new Uint8Array(33); bytes.set([137,80,78,71,13,10,26,10]); const view = new DataView(bytes.buffer); view.setUint32(8, 13); view.setUint32(12, 0x49484452); view.setUint32(16, 100); view.setUint32(20, 100)
  return new Request('http://127.0.0.1:3154/api/receipt-structured', {method, headers: {'origin': 'http://127.0.0.1:3154', 'x-spendscape-local-gemini': '1', 'content-type': 'image/png', 'x-spendscape-direct-fixture': kind}, ...(method === 'POST' ? {body: bytes} : {})})
}
it.each([{}, {SPENDSCAPE_STRUCTURED_QA: '1', SPENDSCAPE_STRUCTURED_QA_RUN: '../invalid'}, {SPENDSCAPE_STRUCTURED_QA: '1', SPENDSCAPE_STRUCTURED_QA_RUN: 'valid-mock-test', VERCEL: '1'}, {SPENDSCAPE_STRUCTURED_QA: '1', SPENDSCAPE_STRUCTURED_QA_RUN: 'valid-mock-test', CI: '1'}])('fails closed outside opt-in local mock QA', async env => {
  const handler = createStructuredQaHandler(env)
  expect((await handler(request())).status).toBe(503)
  expect((await handler(request('POST'))).status).toBe(503)
})
it('never reads credentials even when configured and refuses foreign origins', async () => {
  const env = {SPENDSCAPE_STRUCTURED_QA: '1', SPENDSCAPE_STRUCTURED_QA_RUN: randomUUID()}
  Object.defineProperty(env, 'GEMINI_API_KEY', {get() { throw new Error('credential-access-forbidden') }})
  const handler = createStructuredQaHandler(env)
  expect(await (await handler(request())).json()).toMatchObject({mode: 'fictional-qa'})
  const r = request('POST'); r.headers.set('origin', 'https://example.com')
  expect((await handler(r)).status).toBe(503)
})
it('validates actual mock raw JSON before review, permanently consumes slots and survives restart without content', async () => {
  const env = {SPENDSCAPE_STRUCTURED_QA: '1', SPENDSCAPE_STRUCTURED_QA_RUN: randomUUID()}, handler = createStructuredQaHandler(env)
  const results = await Promise.all([handler(request('POST')), handler(request('POST'))])
  expect(results.map(r => r.status).sort()).toEqual([200,409])
  const success = await results.find(r => r.status === 200)!.json()
  expect(success).toMatchObject({code: 'direct-observations', observations: {finalAmount: '12.40'}})
  const restarted = createStructuredQaHandler(env)
  expect((await restarted(request('POST'))).status).toBe(409)
  expect((await restarted(request('POST', 'fifteen'))).status).toBe(200)
  const status = await (await restarted(request())).json()
  expect(status.attempts).toHaveLength(2)
  expect(status.attempts.every((a: {consumed: boolean}) => a.consumed)).toBe(true)
  const serialized = JSON.stringify(status)
  expect(serialized).not.toMatch(/Willow|12\.40|12\.50|שיבולת|receipt-private|authentication|dispatch-initiated|provider-http/)
  expect(serialized).toContain('review-response-complete')
})

function memory(recognize: DirectPorts['recognize'], recordFailure = false) {
  const events: AttemptEvent[] = []
  let consumed = false
  const diagnostics = {start: async () => {
    if (recordFailure) throw new Error('SYNTHETIC_SECRET')
    events.push(safeAttemptEvent('reserved', 0))
    return {emit: async (stage: Parameters<typeof safeAttemptEvent>[0], raw?: unknown) => {events.push(safeAttemptEvent(stage, 0, raw))}}
  }, status: async () => null}
  const ports: DirectPorts = {enabled: true, fictionalQa: true, hash: () => 'mock', status: async () => null,
    slot: async () => ({diagnostics, consumed: async () => consumed, reserve: async () => {if (consumed) throw new Error('attempt-consumed'); consumed = true}}), recognize}
  return {ports, events}
}
it.each(['malformed', 'truncated', 'unsafe-error'] as const)('candidate failure %s leaves only safe diagnostics and no observations', async kind => {
  const {ports, events} = memory(async (_b, _m, _s, emit) => {
    if (kind === 'unsafe-error') {await emit('provider-http', {httpStatus: 400, googleStatus: 'INVALID_ARGUMENT', message: 'SYNTHETIC_SECRET 99.99'}); throw new Error('SYNTHETIC_SECRET')}
    return kind === 'malformed' ? {private: 'SYNTHETIC_SECRET'} : {...structuredEnvelope(fictionalStructured('one')), candidates: [{finishReason: 'MAX_TOKENS'}]}
  })
  const result = await createDirectHandler(ports, undefined, structuredResponse)(request('POST'))
  expect(await result.json()).toEqual({code: 'ocr-invalid'})
  expect(events.at(-1)?.stage).toBe('failure'); expect(JSON.stringify(events)).not.toMatch(/SECRET|99\.99|Willow|12\.40/)
})
it('diagnostic establishment fails closed before mock extraction', async () => {
  let calls = 0
  const {ports} = memory(async () => {calls++; return structuredEnvelope(fictionalStructured('one'))}, true)
  expect(await (await createDirectHandler(ports, undefined, structuredResponse)(request('POST'))).json()).toEqual({code: 'diagnostics-unavailable'})
  expect(calls).toBe(0)
})
it.each(['cancel', 'timeout'] as const)('%s prevents a late result from producing a review', async action => {
  let release!: (v: unknown) => void, started!: () => void
  const ready = new Promise<void>(r => {started = r}), controller = new AbortController()
  const {ports, events} = memory(async () => {started(); return new Promise(r => {release = r})})
  const original = request('POST'), r = new Request(original, {signal: controller.signal})
  const pending = createDirectHandler(ports, action === 'timeout' ? 30 : 45000, structuredResponse)(r)
  await ready; if (action === 'cancel') controller.abort()
  expect(await (await pending).json()).toEqual({code: 'cancelled'})
  release(structuredEnvelope(fictionalStructured('one'))); await Promise.resolve()
  expect(events.at(-1)?.stage).toBe('interrupted')
  expect(events.some(e => e.stage === 'review-response-complete')).toBe(false)
})
