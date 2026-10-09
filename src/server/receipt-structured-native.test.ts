import {afterEach, expect, it, vi} from 'vitest'
import {createHash} from 'node:crypto'
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
vi.mock('server-only', () => ({}))
const syntheticHistory = vi.hoisted(() => ({bodies: {} as Record<string, string>, roots: [] as string[]}))
vi.mock('./direct-image-diagnostic', async importOriginal => {
  const actual = await importOriginal<typeof import('./direct-image-diagnostic')>()
  const {createHash} = await import('node:crypto')
  // Test-worker-only expected digests. Keep the actual file hashing, fixed
  // paths and exclusive/fsynced reservation implementation under test.
  // Production source and its historical digest constants remain unchanged.
  for (const path of Object.keys(actual.DIRECT_DIAGNOSTIC_HISTORY)) {
    const body = JSON.stringify({fixture: 'synthetic-native-history-only', path}) + '\n'
    syntheticHistory.bodies[path] = body
    Object.assign(actual.DIRECT_DIAGNOSTIC_HISTORY, {[path]: createHash('sha256').update(body).digest('hex')})
  }
  return actual
})
import {createStructuredNativeHandler, structuredNativeReady, structuredNativePilot, STRUCTURED_NATIVE_RUN} from './receipt-structured-native'
import {createStructuredTransport} from '../features/receipt-image/structured-image-transport'
import {createDirectHandler} from '../features/receipt-image/direct-image-boundary'
import {structuredRequest, structuredResponse, structuredEnvelope, fictionalStructured, STRUCTURED_ENDPOINT} from '../features/receipt-image/structured-image-contract'
import {safeAttemptEvent, type AttemptEvent} from '../features/receipt-image/vision-attempt'
import {DIRECT_DIAGNOSTIC_IMAGE} from './direct-image-diagnostic'
const hash = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex')
const key = 'FICTIONAL_NOT_A_PROVIDER_CREDENTIAL'
const env = () => ({NODE_ENV: 'test' as const, SPENDSCAPE_STRUCTURED_NATIVE_RUN: STRUCTURED_NATIVE_RUN, SPENDSCAPE_STRUCTURED_NATIVE_APPROVED: '1', SPENDSCAPE_STRUCTURED_PREPAY_CONFIRMED: '1', SPENDSCAPE_STRUCTURED_PROJECT: 'spendscape-receipt-benchmark', SPENDSCAPE_STRUCTURED_PROJECT_NUMBER: '376401338717', SPENDSCAPE_STRUCTURED_VERIFIED_KEY_SHA256: hash(key), GEMINI_API_KEY: key})
function png() {
  const bytes = new Uint8Array(33); bytes.set([137,80,78,71,13,10,26,10]); const v = new DataView(bytes.buffer)
  v.setUint32(8,13); v.setUint32(12,0x49484452); v.setUint32(16,100); v.setUint32(20,100)
  return bytes
}
const request = (method = 'GET', signal?: AbortSignal) => new Request('http://127.0.0.1:3156/api/receipt-structured', {method, signal, headers: {origin: 'http://127.0.0.1:3156', 'x-spendscape-local-gemini': '1', 'content-type': 'image/png'}, ...(method === 'POST' ? {body: png()} : {})})
async function workspace() {
  const root = await mkdtemp(join(tmpdir(), 'structured-native-test-'))
  syntheticHistory.roots.push(root)
  for (const [path, body] of Object.entries(syntheticHistory.bodies)) {
    const [dir] = path.split('/')
    await mkdir(join(root, 'artifacts', dir, 'receipt-1'), {recursive: true})
    await writeFile(join(root, 'artifacts', path), body)
  }
  return root
}
afterEach(async () => {
  await Promise.all(syntheticHistory.roots.splice(0).map(root => rm(root, {recursive: true, force: true})))
})
it.each([{}, {SPENDSCAPE_STRUCTURED_NATIVE_RUN: 'unknown'}, {...env(), SPENDSCAPE_STRUCTURED_NATIVE_APPROVED: '0'}, {...env(), SPENDSCAPE_STRUCTURED_QA: '1'}, {...env(), VERCEL: '1'}, {...env(), CI: '1'}, {...env(), SPENDSCAPE_STRUCTURED_PROJECT_NUMBER: 'wrong'}])('native defaults and contradictory gates stay disabled', value => expect(structuredNativeReady({NODE_ENV: 'test', ...value})).toBe(false))
it('readiness requires current cost, fixed project and verified digest', () => {
  expect(structuredNativeReady(env(), new Date('2026-10-09'))).toBe(true)
  expect(structuredNativeReady(env(), new Date('2027-01-01'))).toBe(false)
  expect(structuredNativeReady({...env(), SPENDSCAPE_STRUCTURED_VERIFIED_KEY_SHA256: ''})).toBe(false)
})
it('GET confirms native/unused without credential access; foreign origin and wrong image cannot dispatch', async () => {
  const root = await workspace(), e = env(), send = vi.fn()
  Object.defineProperty(e, 'GEMINI_API_KEY', {get() {throw new Error('SECRET')}})
  const handler = createStructuredNativeHandler(e, send, root)
  expect(await (await handler(request())).json()).toMatchObject({mode: 'native', attempts: [{consumed: false, record: null}]})
  const foreign = request('POST'); foreign.headers.set('origin', 'https://example.com')
  expect((await handler(foreign)).status).toBe(503)
  expect(await (await handler(request('POST'))).json()).toEqual({code: 'image-not-approved'})
  expect(send).not.toHaveBeenCalled()
})
it('fixed pilot has one exclusive durable slot across concurrency/restart and validates history', async () => {
  const root = await workspace(), pilot = structuredNativePilot(root)
  expect(await pilot.slot('wrong')).toBeNull()
  const slot = (await pilot.slot(DIRECT_DIAGNOSTIC_IMAGE))!
  const results = await Promise.allSettled([slot.reserve(), slot.reserve()])
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  expect((await structuredNativePilot(root).status())[0].consumed).toBe(true)
  await expect((await structuredNativePilot(root).slot(DIRECT_DIAGNOSTIC_IMAGE))!.reserve()).rejects.toThrow('attempt-consumed')
  for (const [path, body] of Object.entries(syntheticHistory.bodies)) {
    const file = join(root, 'artifacts', path)
    await writeFile(file, 'SYNTHETIC_SECRET')
    await expect(pilot.status()).rejects.toThrow('diagnostics-unavailable')
    await expect(pilot.slot(DIRECT_DIAGNOSTIC_IMAGE)).rejects.toThrow('diagnostics-unavailable')
    await expect(slot.reserve()).rejects.toThrow('diagnostics-unavailable')
    await rm(file)
    await expect(pilot.status()).rejects.toThrow('diagnostics-unavailable')
    await writeFile(file, body)
  }
  expect((await structuredNativePilot(root).status())[0].consumed).toBe(true)
})
it('frozen serialization and establishment of dispatch metadata precede exactly one injected send', async () => {
  const bytes = png(), events: AttemptEvent[] = [], send = vi.fn(async (url, options) => {
    expect(url).toBe(STRUCTURED_ENDPOINT); expect(options.redirect).toBe('error'); expect(options.cache).toBe('no-store')
    expect(JSON.parse(options.body).generationConfig).toEqual({maxOutputTokens: 4096, responseMimeType: 'application/json'})
    expect(events.at(-1)?.stage).toBe('dispatch-initiated')
    return Response.json(structuredEnvelope(fictionalStructured('one')))
  })
  const emit = async (stage: Parameters<typeof safeAttemptEvent>[0], metadata?: unknown) => {events.push(safeAttemptEvent(stage, 0, metadata))}
  const transport = createStructuredTransport(() => key, send as typeof fetch, hash(JSON.stringify(structuredRequest('image/png', Buffer.from(bytes).toString('base64')))))
  expect(structuredResponse(await transport(bytes, 'image/png', new AbortController().signal, emit))).toEqual(fictionalStructured('one'))
  expect(send).toHaveBeenCalledTimes(1); expect(JSON.stringify(events)).not.toMatch(/FICTIONAL|Willow|12\.40|base64|prompt/)
})
it.each(['auth', 'hash', 'record'] as const)('%s failure stops before dispatch without a retry', async kind => {
  const send = vi.fn(), bytes = png(), expected = hash(JSON.stringify(structuredRequest('image/png', Buffer.from(bytes).toString('base64'))))
  const transport = createStructuredTransport(() => {if (kind === 'auth') throw new Error('authentication-failed'); return key}, send, kind === 'hash' ? '0'.repeat(64) : expected)
  await expect(transport(bytes, 'image/png', new AbortController().signal, async stage => {if (kind === 'record' && stage === 'dispatch-initiated') throw new Error('diagnostics-unavailable')})).rejects.toThrow()
  expect(send).not.toHaveBeenCalled()
})
it.each([400, 402, 429])('HTTP %s preserves safe status and unknown fields, excludes arbitrary provider content', async status => {
  const bytes = png(), events: AttemptEvent[] = [], send = vi.fn(async () => Response.json({error: {code: status, status: 'INVALID_ARGUMENT', message: 'SYNTHETIC_SECRET receipt 123.45', details: [{'@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{field: 'generationConfig.responseMimeType', description: 'SYNTHETIC_SECRET'}]}]}}, {status}))
  const transport = createStructuredTransport(() => key, send as typeof fetch, hash(JSON.stringify(structuredRequest('image/png', Buffer.from(bytes).toString('base64')))))
  await expect(transport(bytes, 'image/png', new AbortController().signal, async (stage, metadata) => {events.push(safeAttemptEvent(stage, 0, metadata))})).rejects.toThrow('recognition-failed')
  expect(send).toHaveBeenCalledTimes(1); expect(events.at(-1)).toMatchObject({httpStatus: status, geminiError: {rejectedField: 'rejected field unknown'}})
  expect(JSON.stringify(events)).not.toMatch(/SECRET|123\.45|responseMimeType/)
})
it('durable record failure consumes the slot but causes no request', async () => {
  const root = await workspace(), pilot = structuredNativePilot(root), send = vi.fn()
  const directory = join(root, 'artifacts/receipt-gemini-structured-validation-20261009-one/receipt-1')
  await mkdir(directory, {recursive: true}); await writeFile(join(directory, 'lifecycle.jsonl'), 'SYNTHETIC_SECRET')
  const result = await createDirectHandler({enabled: true, fictionalQa: false, hash: () => DIRECT_DIAGNOSTIC_IMAGE, slot: () => pilot.slot(DIRECT_DIAGNOSTIC_IMAGE), status: pilot.status, recognize: send}, undefined, structuredResponse)(request('POST'))
  expect(await result.json()).toEqual({code: 'diagnostics-unavailable'}); expect(send).not.toHaveBeenCalled()
  expect(await (await pilot.slot(DIRECT_DIAGNOSTIC_IMAGE))!.consumed()).toBe(true)
})
it.each(['success', 'http', 'malformed', 'truncated', 'disconnect'] as const)('native durable %s outcome survives restart, never retries or retains content', async kind => {
  const root = await workspace(), pilot = structuredNativePilot(root), controller = new AbortController()
  let start!: () => void, release!: (v: unknown) => void
  const ready = new Promise<void>(resolve => {start = resolve})
  const recognize = vi.fn(async (_b, _m, _s, emit) => {
    await emit('authentication-start'); await emit('authentication-complete'); await emit('dispatch-initiated')
    if (kind === 'disconnect') {start(); return new Promise(resolve => {release = resolve})}
    await emit('provider-http', {httpStatus: kind === 'http' ? 429 : 200})
    if (kind === 'http') throw new Error('recognition-failed')
    return kind === 'malformed' ? {text: 'SYNTHETIC_SECRET'} : kind === 'truncated' ? {candidates: [{finishReason: 'MAX_TOKENS'}]} : structuredEnvelope(fictionalStructured('fifteen'))
  })
  const handler = createDirectHandler({enabled: true, fictionalQa: false, hash: () => DIRECT_DIAGNOSTIC_IMAGE, slot: () => pilot.slot(DIRECT_DIAGNOSTIC_IMAGE), status: pilot.status, recognize}, undefined, structuredResponse)
  const pending = handler(request('POST', controller.signal))
  if (kind === 'disconnect') {await ready; controller.abort()}
  const response = await pending
  expect(response.status).toBe(kind === 'success' ? 200 : kind === 'disconnect' ? 408 : 422)
  if (kind === 'disconnect') {release(structuredEnvelope(fictionalStructured('one'))); await Promise.resolve()}
  expect((await handler(request('POST'))).status).toBe(409); expect(recognize).toHaveBeenCalledTimes(1)
  const status = await structuredNativePilot(root).status()
  expect(status).toHaveLength(1); expect(status[0].consumed).toBe(true)
  expect(status[0].record?.state).toBe(kind === 'success' ? 'complete' : kind === 'disconnect' ? 'interrupted' : 'failed')
  expect(JSON.stringify(status)).not.toMatch(/SECRET|Willow|40\.90|41\.00|base64|image\/png/)
})
