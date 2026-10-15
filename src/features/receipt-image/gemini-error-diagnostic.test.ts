import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { GEMINI_ERROR_BYTES, geminiErrorFieldPaths, projectGeminiError, unknownGeminiError, validGeminiErrorDiagnostic } from './gemini-error-diagnostic'
import { createDirectTransport } from './direct-image-transport'
import { safeAttemptEvent } from './vision-attempt'
import { directPilot, DIRECT_IMAGES } from '../../server/direct-image-pilot'
import { createDirectHandler, DIRECT_JOB_MS } from './direct-image-boundary'
import { fictionalDirectResponse } from './direct-image-contract'
import { visionAttemptRecord } from '../../server/vision-attempt-record'

const secret = 'SYNTHETIC_SECRET_IMAGE_PROMPT_RECEIPT_987.65'
const credentials = 'FICTIONAL_CREDENTIAL_ONLY'
const badRequest = (fields: unknown[]) => ({ error: { code: 400, status: 'INVALID_ARGUMENT', message: secret,
  details: [{ '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: fields.map(field => ({ field, description: secret, reason: secret, localizedMessage: { message: secret } })) },
    { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: secret, metadata: { secret } }],
} })
const roots: string[] = []
afterEach(async () => { vi.useRealTimers(); for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
async function root() { const dir = await mkdtemp(join(tmpdir(), 'gemini-diagnostic-offline-')); roots.push(dir); return dir }
function png() { const bytes = new Uint8Array(33); bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); const view = new DataView(bytes.buffer); view.setUint32(8, 13); view.setUint32(12, 0x49484452); view.setUint32(16, 32); view.setUint32(20, 32); return bytes }
function request(method = 'POST', signal?: AbortSignal) { return new Request('http://127.0.0.1:3130/api/receipt-direct', { method, headers: { origin: 'http://127.0.0.1:3130', 'x-spendscape-local-gemini': '1', 'content-type': 'image/png' }, ...(method === 'POST' ? { body: png() } : {}), signal }) }

describe('pure bounded rejected-field projection', () => {
  it('keeps exact canonical request and nested schema paths only, without messages or arbitrary reasons', () => {
    const fields = ['model', 'contents[0].parts[1].inlineData.mimeType', 'generationConfig.responseFormat.text.schema.properties.currency.anyOf[1].type']
    const projected = projectGeminiError(badRequest([...fields, secret]))
    expect(projected).toEqual({ version: 1, capture: 'parsed', rejectedField: 'provided', fields, reason: 'structured-field-violation', truncated: false })
    expect(Object.keys(projected)).toEqual(['version', 'capture', 'rejectedField', 'fields', 'reason', 'truncated'])
    expect(validGeminiErrorDiagnostic(projected)).toBe(true)
    expect(JSON.stringify(projected)).not.toMatch(/SYNTHETIC|987\.65|message|description|metadata|localized/)
  })
  it('accepts documented proto request aliases while preserving literal JSON schema property names', () => {
    expect(projectGeminiError(badRequest(['generation_config.response_format.text.mime_type', 'contents[0].parts[1].inline_data.data', 'generation_config.response_format.text.schema.properties.unit_price'])) .fields)
      .toEqual(['generationConfig.responseFormat.text.mimeType', 'contents[0].parts[1].inlineData.data'])
  })
  it.each([secret, 'model=' + secret, 'contents[1].parts[1].inlineData.data', 'contents[0].parts[99].text', 'generationConfig.responseFormat.text.schema.properties.' + secret, 'request.generationConfig', '__proto__', 'x'.repeat(257), null, 400])('rejects unsafe or unsupported path case %#', field => {
    const projected = projectGeminiError(badRequest([field]))
    expect(projected.rejectedField).toBe('rejected field unknown')
    expect(projected.fields).toEqual([])
    expect(JSON.stringify(projected)).not.toContain(secret)
  })
  it('does not parse messages or accept untyped field violations', () => {
    for (const raw of [{ error: { message: 'Unknown name "generationConfig.responseFormat" ' + secret } }, { error: { details: [{ fieldViolations: [{ field: 'model' }] }] } }, { error: { details: [{ '@type': secret, fieldViolations: [{ field: 'model' }] }] } }]) {
      expect(projectGeminiError(raw)).toEqual(unknownGeminiError())
    }
  })
  it.each([null, [], 'bad', { error: null }, { error: [] }])('reports malformed structure %# without values', raw => expect(projectGeminiError(raw)).toEqual(unknownGeminiError('malformed')))
  it('bounds detail traversal, violation traversal and deduplicated output independently', () => {
    const fields = geminiErrorFieldPaths.slice(0, 9)
    const capped = projectGeminiError(badRequest([...fields, ...fields]))
    expect(capped.fields).toEqual(fields.slice(0, 8)); expect(capped.truncated).toBe(true)
    const duplicates = projectGeminiError(badRequest(['model', 'model']))
    expect(duplicates.fields).toEqual(['model']); expect(duplicates.truncated).toBe(false)
    const late = projectGeminiError(badRequest([...Array(32).fill(secret), 'model']))
    expect(late.fields).toEqual([]); expect(late.truncated).toBe(true)
    const details = Array.from({ length: 9 }, (_, i) => ({ '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: i === 8 ? 'model' : secret }] }))
    expect(projectGeminiError({ error: { details } })).toMatchObject({ fields: [], truncated: true })
  })
  it('strict durable validation rejects content, aliases, duplicates, sparse arrays and inconsistent categories', () => {
    const valid = projectGeminiError(badRequest(['model']))
    for (const raw of [{ ...valid, message: secret }, { ...valid, fields: [secret] }, { ...valid, fields: ['generation_config'] }, { ...valid, fields: ['model', 'model'] }, { ...valid, fields: new Array(1) }, { ...valid, fields: geminiErrorFieldPaths.slice(0, 9) }, { ...valid, capture: 'malformed' }, { ...valid, reason: secret }, { ...valid, rejectedField: 'rejected field unknown' }]) {
      expect(validGeminiErrorDiagnostic(raw)).toBe(false)
      expect(safeAttemptEvent('provider-http', 1, { httpStatus: 400, geminiError: raw })).not.toHaveProperty('geminiError')
    }
    const accessor = { ...valid }; Object.defineProperty(accessor, 'reason', { get() { throw Error('must not access') }, enumerable: true })
    expect(validGeminiErrorDiagnostic(accessor)).toBe(false)
    expect(projectGeminiError(Object.defineProperty({}, 'error', { get() { throw Error('must not access') }, enumerable: true }))).toEqual(unknownGeminiError('malformed'))
    expect(safeAttemptEvent('failure', 1, { geminiError: valid })).not.toHaveProperty('geminiError')
    expect(safeAttemptEvent('provider-http', 1, { httpStatus: 200, geminiError: valid })).not.toHaveProperty('geminiError')
  })
})

describe('mock transport and durable local failure inspection', () => {
  it('records structured paths before failure, survives restart, preserves old error reply and consumes one slot', async () => {
    const dir = await root(), pilot = directPilot(dir, 0); let calls = 0
    const transport = createDirectTransport(() => credentials, async () => { calls++; return Response.json(badRequest(['generationConfig.responseFormat.text.schema']), { status: 400 }) })
    const handler = createDirectHandler({ enabled: true, fictionalQa: false, hash: () => DIRECT_IMAGES[0], slot: async h => pilot.slot(h), status: pilot.status, recognize: (b, m, s, e) => transport(b, m, s, e) })
    const response = await handler(request())
    expect(await response.json()).toEqual({ code: 'recognition-failed', httpStatus: 400, googleStatus: 'INVALID_ARGUMENT' })
    const restarted = directPilot(dir, 0), status = await restarted.status()
    expect(status[0].record?.state).toBe('failed')
    expect(status[0].record?.events.filter(e => e.stage === 'provider-http').at(-1)).toMatchObject({ googleCode: 400, geminiError: { fields: ['generationConfig.responseFormat.text.schema'], reason: 'structured-field-violation' } })
    expect((await (await handler(request('GET'))).json()).attempts[0].record.events).toEqual(status[0].record?.events)
    const text = await readFile(join(dir, 'receipt-1/lifecycle.jsonl'), 'utf8')
    expect(text).not.toMatch(/SYNTHETIC|FICTIONAL_CREDENTIAL|987\.65|message|description|metadata|prompt|inlineData\.data.*secret/)
    expect((await handler(request())).status).toBe(409); expect(calls).toBe(1)
    await expect(restarted.slot(DIRECT_IMAGES[1])!.reserve()).rejects.toThrow('pilot-stopped')
    await appendFile(join(dir, 'receipt-1/lifecycle.jsonl'), JSON.stringify({ ...safeAttemptEvent('provider-http', 1, { httpStatus: 400 }), geminiError: { ...unknownGeminiError(), secret } }) + '\n')
    await expect(visionAttemptRecord(join(dir, 'receipt-1/lifecycle.jsonl')).status()).rejects.toThrow('diagnostics-unavailable')
  })
  it.each(['unstructured', 'malformed', 'invalid-utf8', 'oversized', 'at-cap'] as const)('reports %s error capture safely with numeric HTTP status retained', async kind => {
    const events: unknown[] = []
    const body = kind === 'unstructured' ? JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: secret } }) :
      kind === 'malformed' ? secret : kind === 'invalid-utf8' ? new Uint8Array([255]) : kind === 'oversized' ? secret + 'x'.repeat(GEMINI_ERROR_BYTES) : JSON.stringify({ error: {} }).padEnd(GEMINI_ERROR_BYTES, ' ')
    const run = createDirectTransport(() => credentials, async () => new Response(body, { status: 429 }))
    await expect(run(png(), 'image/png', new AbortController().signal, async (stage, meta) => { events.push({ stage, meta }) })).rejects.toThrow('recognition-failed')
    const capture = kind === 'oversized' ? 'oversized' : ['malformed', 'invalid-utf8'].includes(kind) ? 'malformed' : 'parsed'
    expect(events).toContainEqual({ stage: 'provider-http', meta: { httpStatus: 429 } })
    expect(events.at(-1)).toMatchObject({ stage: 'provider-http', meta: { httpStatus: 429, geminiError: { capture, rejectedField: 'rejected field unknown', fields: [] } } })
    expect(JSON.stringify(events)).not.toContain(secret)
  })
  it('discards unknown Google codes/status strings independently of rejected-field paths', async () => {
    const events: unknown[] = []
    const run = createDirectTransport(() => credentials, async () => Response.json({ error: { code: 99999, status: secret, message: secret } }, { status: 400 }))
    await expect(run(png(), 'image/png', new AbortController().signal, async (stage, meta) => { events.push({ stage, meta }) })).rejects.toThrow('recognition-failed')
    expect(events.at(-1)).toEqual({ stage: 'provider-http', meta: { stage: 'provider-http', elapsedMs: 0, httpStatus: 400, geminiError: unknownGeminiError() } })
  })
  it('a durable write failure terminates after one request without raw error escape', async () => {
    let calls = 0
    const run = createDirectTransport(() => credentials, async () => { calls++; return Response.json(badRequest(['model']), { status: 400 }) })
    await expect(run(png(), 'image/png', new AbortController().signal, async (_stage, meta) => { if (meta && typeof meta === 'object' && 'geminiError' in meta) throw Error('diagnostics-unavailable') })).rejects.toThrow('diagnostics-unavailable')
    expect(calls).toBe(1)
  })
  it('unchanged successful output has no failure projection', async () => {
    const events: unknown[] = [], original = fictionalDirectResponse('one')
    const run = createDirectTransport(() => credentials, async () => Response.json(original))
    expect(await run(png(), 'image/png', new AbortController().signal, async (stage, meta) => { events.push({ stage, meta }) })).toEqual(original)
    expect(JSON.stringify(events)).not.toMatch(/geminiError|rejectedField/)
  })
  it.each(['cancelled', 'timeout'] as const)('%s prevents a late error body from entering the journal', async kind => {
    if (kind === 'timeout') vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const dir = await root(), pilot = directPilot(dir, 0), controller = new AbortController()
    let started!: () => void, deliver!: (v: Uint8Array) => void
    const ready = new Promise<void>(r => { started = r })
    const stream = new ReadableStream<Uint8Array>({ start(c) { deliver = bytes => { try { c.enqueue(bytes); c.close() } catch { /* Abort closed this stream. */ } } }, cancel() {} })
    const transport = createDirectTransport(() => credentials, async () => new Response(stream, { status: 400 }))
    const handler = createDirectHandler({ enabled: true, fictionalQa: false, hash: () => DIRECT_IMAGES[0], slot: async h => pilot.slot(h), status: pilot.status, recognize: (b, m, s, emit) => transport(b, m, s, async (stage, meta) => { await emit(stage, meta); if (stage === 'provider-http') started() }) })
    const pending = handler(request('POST', controller.signal)); await ready
    if (kind === 'cancelled') controller.abort()
    else await vi.advanceTimersByTimeAsync(DIRECT_JOB_MS)
    expect(await (await pending).json()).toMatchObject({ code: 'cancelled', httpStatus: 400 })
    vi.useRealTimers()
    const before = await readFile(join(dir, 'receipt-1/lifecycle.jsonl'))
    deliver(new TextEncoder().encode(JSON.stringify(badRequest(['model'])))); await new Promise(r => setTimeout(r, 10))
    expect(await readFile(join(dir, 'receipt-1/lifecycle.jsonl'))).toEqual(before)
    expect((await directPilot(dir).status())[0].record?.state).toBe('interrupted')
    expect(before.toString()).not.toMatch(/geminiError|SYNTHETIC/)
  })
})
