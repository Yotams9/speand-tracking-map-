import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../app/api/savings/route'

// /api/savings only reads, computes and answers: no logging, no storage, no
// outbound request, and the user's origin is not echoed back.
const ORIGIN = { lat: 32.0812345, lon: 34.7704321 }
const body = JSON.stringify({ items: [{ gtin14: '07290008464741', quantity: 1, paidMinor: 4390 }], origin: ORIGIN })

afterEach(() => { vi.restoreAllMocks() })

describe('savings route privacy', () => {
  it('does not log, fetch or echo the origin while answering', async () => {
    const consoles = (['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).map(name => vi.spyOn(console, name).mockImplementation(() => {}))
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const ok = await POST(new Request('http://127.0.0.1/api/savings', { method: 'POST', body }))
    const bad = await POST(new Request('http://127.0.0.1/api/savings', { method: 'POST', body: body.replace('"quantity":1', '"quantity":-1') }))
    expect(ok.status).toBe(200)
    expect(bad.status).toBe(400)
    for (const spy of consoles) expect(spy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    const text = await ok.text()
    expect(text).not.toContain(String(ORIGIN.lat))
    expect(text).not.toContain(String(ORIGIN.lon))
    expect(await bad.text()).toBe(JSON.stringify({ error: 'quantity' }))
    expect(ok.headers.get('cache-control')).toBe('no-store')
  })

  it('has no logging, storage or outbound code in the request path', async () => {
    const files = ['src/app/api/savings/route.ts', 'src/features/savings/savings-request.ts', 'src/features/savings/savings-engine.ts']
    for (const file of files) {
      const source = await readFile(path.join(process.cwd(), file), 'utf8')
      expect(source, file).not.toMatch(/console\.|writeFile|appendFile|createWriteStream|localStorage|indexedDB|fetch\(|cookies\(|headers\(\)/)
    }
  })
})
