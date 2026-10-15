import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { LOCAL_ONLY, localOnly } from './hosted-guard'

const HOSTED = 'https://spendscape-college-demo.vercel.app'
const hosted = (path: string, method = 'GET', headers: Record<string, string> = {}) => new Request(`${HOSTED}${path}`, { method, headers: { host: new URL(HOSTED).host, origin: HOSTED, ...headers }, ...(method === 'POST' ? { body: '{}' } : {}) })
const local = (path: string, method = 'GET', headers: Record<string, string> = {}) => new Request(`http://127.0.0.1:3000${path}`, { method, headers: { host: '127.0.0.1:3000', ...headers }, ...(method === 'POST' ? { body: '{}' } : {}) })
async function closed(response: Response) {
  expect(response.status).toBe(404)
  expect(response.headers.get('cache-control')).toBe('no-store')
  const text = await response.text()
  expect(JSON.parse(text)).toEqual(LOCAL_ONLY)
  expect(text).not.toMatch(/stack|Error|at \w+ \(|node_modules|[A-Z]:\\\\/)
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })

describe('local-only routes on a hosted host', () => {
  it('the guard answers 404 before the handler for hosted or non-loopback requests', async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }))
    await closed(await localOnly(handler, {})(hosted('/api/receipt-ocr')))
    await closed(await localOnly(handler, {})(new Request('http://192.168.1.20:3000/api/receipt-ocr', { headers: { host: '192.168.1.20:3000' } })))
    await closed(await localOnly(handler, {})(local('/api/receipt-ocr', 'GET', { 'x-forwarded-host': 'example.com' })))
    await closed(await localOnly(handler, {})(new Request('http://127.0.0.1:3000/api/receipt-ocr', { headers: { host: 'evil.example' } })))
    // On Vercel even a loopback-looking request stays closed.
    await closed(await localOnly(handler, { VERCEL: '1' })(local('/api/receipt-ocr')))
    expect(handler).not.toHaveBeenCalled()
    // Only on this computer does the handler run (and apply its own checks).
    expect((await localOnly(handler, {})(local('/api/receipt-ocr'))).status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
  })
  const routes = [
    ['address-search', () => import('../app/api/address-search/route')],
    ['receipt-capture-session', () => import('../app/api/receipt-capture-session/route')],
    ['receipt-direct', () => import('../app/api/receipt-direct/route')],
    ['receipt-ocr', () => import('../app/api/receipt-ocr/route')],
    ['receipt-structured', () => import('../app/api/receipt-structured/route')],
  ] as const
  for (const [name, load] of routes) it(`/api/${name} fails closed on Vercel: clean 404, no provider call`, async () => {
    vi.stubEnv('VERCEL', '1')
    const send = vi.fn(async () => new Response('{}')); vi.stubGlobal('fetch', send)
    const route = await load() as Record<string, (request: Request) => Promise<Response>>
    for (const method of ['GET', 'POST'] as const) {
      if (!route[method]) continue
      await closed(await route[method](hosted(`/api/${name}`, method, { 'content-type': 'application/json', 'x-spendscape-local-gemini': '1', 'x-spendscape-local-vision': '1' })))
    }
    expect(send).not.toHaveBeenCalled()
  })
})
