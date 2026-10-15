import { describe, expect, it } from 'vitest'
import { createDemoAccessHandler, demoCookie, demoOrigin, demoPolicy, demoRequestRole, demoRole } from './demo-access'
import { DEMO_TEST_NOW, demoRequest, demoTestEnv, LECTURER_CODE, OWNER_CODE, testPolicy } from '../../qa/fixtures/hosted-demo'
describe('private college access capabilities', () => {
  it('recognizes two separate roles without serializing codes into policy', () => {
    const p = testPolicy(); expect(demoRole(OWNER_CODE, p)).toBe('owner'); expect(demoRole(LECTURER_CODE, p)).toBe('lecturer')
    expect(JSON.stringify(p)).not.toContain(OWNER_CODE); expect(demoRole('3'.repeat(64), p)).toBeNull()
  })
  for (const patch of [{ SPENDSCAPE_HOSTED_MODE: undefined }, { SPENDSCAPE_HOSTED_MODE: 'unknown' }, { VERCEL: undefined }, { SPENDSCAPE_HOSTED_DEMO_TEST: 'synthetic' }, { SPENDSCAPE_DEMO_RECEIPT_LIMIT: '11' }, { SPENDSCAPE_DEMO_ADDRESS_LIMIT: '11' }, { SPENDSCAPE_DEMO_CEILING_MICRO_USD: '50000' }, { SPENDSCAPE_DEMO_ORIGIN: 'https://demo.example/' }, { SPENDSCAPE_DEMO_ORIGIN: 'http://demo.example' }, { SPENDSCAPE_DEMO_EXPIRES_AT: new Date(DEMO_TEST_NOW).toISOString() }, { SPENDSCAPE_DEMO_START_AT: new Date(DEMO_TEST_NOW + 1).toISOString() }]) {
    it('fails closed for invalid activation ' + JSON.stringify(patch), () => expect(demoPolicy({ ...demoTestEnv(), ...patch }, DEMO_TEST_NOW)).toBeNull())
  }
  it('limits synthetic HTTP mode to a local non-Vercel non-CI process', () => {
    const env = { ...demoTestEnv(), VERCEL: undefined, SPENDSCAPE_HOSTED_DEMO_TEST: 'synthetic', SPENDSCAPE_DEMO_ORIGIN: 'http://127.0.0.1:3206' }
    expect(demoPolicy(env, DEMO_TEST_NOW)?.test).toBe(true); expect(demoPolicy({ ...env, CI: '1' }, DEMO_TEST_NOW)).toBeNull()
    const p = demoPolicy(env, DEMO_TEST_NOW)!
    expect(demoOrigin(new Request('http://localhost:3206/', { headers: { host: '127.0.0.1:3206' } }), p)).toBe(true)
    expect(demoOrigin(new Request('http://localhost:3207/', { headers: { host: '127.0.0.1:3206' } }), p)).toBe(false)
  })
  it('rejects origin, host, forwarded host and cross-site inconsistencies', () => {
    const p = testPolicy(); expect(demoOrigin(demoRequest('/'), p)).toBe(true)
    const variants: Record<string, string>[] = [{ origin: 'https://other.example' }, { origin: 'null' }, { host: 'other.example' }, { 'x-forwarded-host': 'other.example' }, { 'sec-fetch-site': 'cross-site' }]
    for (const headers of variants) expect(demoOrigin(demoRequest('/', { method: 'POST', headers }), p)).toBe(false)
    const post = demoRequest('/', { method: 'POST' }); post.headers.delete('origin'); expect(demoOrigin(post, p)).toBe(false)
  })
  it('rejects malformed and duplicated cookies', () => {
    const p = testPolicy(); expect(demoRequestRole(demoRequest('/'), p)).toBe('owner')
    expect(demoRequestRole(demoRequest('/', { headers: { cookie: '__Host-spendscape-demo=' + OWNER_CODE + '; __Host-spendscape-demo=' + LECTURER_CODE } }), p)).toBeNull()
    expect(demoRequestRole(demoRequest('/', {}, OWNER_CODE + '%00'), p)).toBeNull()
  })
  it('logs in with an HttpOnly secure cookie and fixed redirect; logout clears it', async () => {
    const handler = createDemoAccessHandler(demoTestEnv(), () => DEMO_TEST_NOW)
    const r = await handler(demoRequest('/api/demo-access', { method: 'POST', body: new URLSearchParams({ code: OWNER_CODE }) }))
    expect(r.status).toBe(303); expect(r.headers.get('location')).toBe('/'); expect(await r.text()).toBe('')
    expect(r.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict; Secure;'); expect(r.headers.get('location')).not.toContain(OWNER_CODE)
    const out = await handler(demoRequest('/api/demo-access', { method: 'POST', body: 'action=logout' })); expect(out.headers.get('set-cookie')).toContain('Max-Age=0')
  })
  it('rejects bad and oversized input without reflecting it', async () => {
    const handler = createDemoAccessHandler(demoTestEnv(), () => DEMO_TEST_NOW)
    const bad = await handler(demoRequest('/api/demo-access', { method: 'POST', body: 'code=private-text' })); expect(bad.headers.get('location')).toBe('/demo-access?error=invalid'); expect(await bad.text()).not.toContain('private-text')
    expect((await handler(demoRequest('/api/demo-access', { method: 'POST', body: 'code=' + '1'.repeat(300) }))).status).toBe(400)
    expect(demoCookie('', testPolicy(), true)).toContain('Max-Age=0')
  })
})
