import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { createHostedAddressHandler, createHostedReceiptHandler } from './hosted-demo'
import { fictionalStructured, structuredEnvelope, structuredRequest, STRUCTURED_ENDPOINT } from '../features/receipt-image/structured-image-contract'
import { DEMO_TEST_NOW, demoRequest, demoTestEnv, fakeQuota, fictionalPng, LECTURER_CODE } from '../../qa/fixtures/hosted-demo'
const receipt = (seed = 0, signal?: AbortSignal, code?: string) => demoRequest('/api/receipt-capture-session', { method: 'POST', headers: { 'content-type': 'image/png' }, body: fictionalPng(seed), signal }, code)
const address = (id = 'a'.repeat(32), code?: string) => demoRequest('/api/address-search', { method: 'POST', headers: { 'content-type': 'application/json', 'x-spendscape-address-submission': id }, body: JSON.stringify({ address: 'Fictional street 12, Fictional city', locale: 'en' }) }, code)
const success = () => Response.json(structuredEnvelope(fictionalStructured('one')))
describe('protected hosted provider adapters with synthetic transports', () => {
  it('sends the exact existing Gemini contract after reservation, without access cookies', async () => {
    const q = fakeQuota(), send = vi.fn(async () => { expect(q.counts.receipt).toBe(1); return success() })
    const result = await createHostedReceiptHandler(demoTestEnv(), send, () => q.port, () => DEMO_TEST_NOW)(receipt())
    expect(result.status).toBe(200); expect((await result.json()).code).toBe('direct-observations')
    const call = send.mock.calls[0] as unknown as [string, RequestInit]; expect(call[0]).toBe(STRUCTURED_ENDPOINT); expect(JSON.parse(call[1].body as string)).toEqual(structuredRequest('image/png', fictionalPng().toString('base64')))
    expect(call[1].headers).not.toHaveProperty('cookie'); expect(await q.status('receipt')).toMatchObject({ used: 1, status: 'available' })
  })
  it('never dispatches for missing consent configuration, wrong keys, cookie or origin', async () => {
    const q = fakeQuota(), send = vi.fn()
    for (const env of [{}, { ...demoTestEnv(), GEMINI_API_KEY: 'mismatched' }, { ...demoTestEnv(), SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED: '0' }]) expect((await createHostedReceiptHandler(env, send, () => q.port, () => DEMO_TEST_NOW)(receipt())).status).toBe(503)
    const handle = createHostedReceiptHandler(demoTestEnv(), send, () => q.port, () => DEMO_TEST_NOW)
    const noCookie = receipt(); noCookie.headers.delete('cookie'); expect((await handle(noCookie)).status).toBe(503)
    const foreign = receipt(); foreign.headers.set('origin', 'https://other.example'); expect((await handle(foreign)).status).toBe(503)
    expect(send).not.toHaveBeenCalled(); expect(q.counts.receipt).toBe(0)
  })
  it('shares replay protection and the request limit across independent handlers and both roles', async () => {
    const q = fakeQuota(), send = vi.fn(async () => success()), env = demoTestEnv()
    const one = createHostedReceiptHandler(env, send, () => q.port, () => DEMO_TEST_NOW), two = createHostedReceiptHandler(env, send, () => q.port, () => DEMO_TEST_NOW)
    expect((await one(receipt(1))).status).toBe(200); expect((await two(receipt(1))).status).toBe(409)
    expect((await two(receipt(2, undefined, LECTURER_CODE))).status).toBe(200); expect((await one(receipt(3))).status).toBe(409); expect(send).toHaveBeenCalledTimes(2)
  })
  it('blocks concurrent independent handlers while a dispatch is unresolved', async () => {
    const q = fakeQuota(); let release!: () => void
    const send = vi.fn(async () => { await new Promise<void>(r => { release = r }); return success() })
    const handle = () => createHostedReceiptHandler(demoTestEnv(), send, () => q.port, () => DEMO_TEST_NOW)
    const pending = handle()(receipt(1)); await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect((await handle()(receipt(2))).status).toBe(409); release(); expect((await pending).status).toBe(200)
  })
  it('quota failure and invalid image data cause no provider dispatch', async () => {
    const q = fakeQuota(), send = vi.fn(), handle = createHostedReceiptHandler(demoTestEnv(), send, () => q.port, () => DEMO_TEST_NOW)
    const bad = receipt(); bad.headers.set('content-type', 'image/heic'); expect((await handle(bad)).status).toBe(400)
    q.fail(); expect((await handle(receipt())).status).toBe(409); expect(send).not.toHaveBeenCalled()
  })
  for (const failure of [() => Response.json({ error: { message: 'private receipt content' } }, { status: 400 }), () => Response.json({ candidates: [] })]) it('consumes a failed request and prevents later dispatch', async () => {
    const q = fakeQuota(), send = vi.fn(async () => failure()), handle = createHostedReceiptHandler(demoTestEnv(), send, () => q.port, () => DEMO_TEST_NOW)
    const result = await handle(receipt()); expect(result.status).toBe(422); expect(await result.text()).not.toContain('private receipt content')
    expect((await handle(receipt(1))).status).toBe(409); expect(send).toHaveBeenCalledTimes(1)
  })
  it('timeout consumes the request and ignores a late success', async () => {
    const q = fakeQuota(); let release!: () => void
    const send = vi.fn(async () => { await new Promise<void>(r => { release = r }); return success() })
    const handle = createHostedReceiptHandler(demoTestEnv(), send, () => q.port, () => DEMO_TEST_NOW, 40)
    const pending = handle(receipt()); await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1), { interval: 1 }); expect((await pending).status).toBe(408); release()
    expect((await handle(receipt(1))).status).toBe(409)
  })
  it('address submission is explicit, reserved once, minimal, and excludes the login capability', async () => {
    const q = fakeQuota(), send = vi.fn(async () => { expect(q.counts.address).toBe(1); return Response.json({ results: [] }) })
    const handle = createHostedAddressHandler(demoTestEnv(), send, () => q.port, () => DEMO_TEST_NOW)
    expect((await handle(address())).status).toBe(200); expect((await handle(address())).status).toBe(409); expect(send).toHaveBeenCalledTimes(1)
    const [url, options] = send.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.origin).toBe('https://api.geoapify.com'); expect(url.searchParams.get('text')).toBe('Fictional street 12, Fictional city'); expect(url.searchParams.get('limit')).toBe('5'); expect(options.headers).not.toHaveProperty('cookie')
    expect([...q.seen][0]).not.toContain('Fictional')
  })
  it('address denial, failure and missing id never fall back or retry', async () => {
    const q = fakeQuota(), send = vi.fn(async () => Response.json({ message: 'private' }, { status: 429 })), handle = createHostedAddressHandler(demoTestEnv(), send, () => q.port, () => DEMO_TEST_NOW)
    const invalid = address(); invalid.headers.delete('x-spendscape-address-submission'); expect((await handle(invalid)).status).toBe(400)
    const unauthorized = address(); unauthorized.headers.delete('cookie'); expect((await handle(unauthorized)).status).toBe(503)
    expect((await handle(address())).status).toBe(200); expect((await handle(address('b'.repeat(32)))).status).toBe(409); expect(send).toHaveBeenCalledTimes(1)
  })
})
