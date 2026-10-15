import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import type { DemoPolicy } from '../src/server/demo-access'
import { createRedisQuota, initialQuotaState, initializeRedisQuota, redisConfiguration } from '../src/server/demo-quota'

if (process.env.SPENDSCAPE_REDIS_VERIFY !== 'synthetic-counters-only' || !process.env.SPENDSCAPE_REDIS_PRIVATE_FILE || !process.env.SPENDSCAPE_REDIS_RESULT_FILE) throw Error('explicit-redis-verification-required')
const privateFile = process.env.SPENDSCAPE_REDIS_PRIVATE_FILE
if ((statSync(privateFile).mode & 0o077) !== 0 || statSync(privateFile).size > 4096) throw Error('private-configuration-invalid')
const env = JSON.parse(readFileSync(privateFile, 'utf8')) as NodeJS.ProcessEnv
const config = redisConfiguration(env)
if (!config) throw Error('private-configuration-invalid')
const keys: string[] = [], results: string[] = []
let requests = 0
// This sender cannot call a receipt, address or billing provider. It allows only
// the one configured Redis origin and records no headers, body or credentials.
const send: typeof fetch = async (url, init) => {
  if (url !== config.url || ++requests > 100) throw Error('verification-bound-exceeded')
  return fetch(url, init)
}
const digest = () => createHash('sha256').update(randomBytes(32)).digest('hex')
function policy(overrides: Partial<DemoPolicy> = {}): DemoPolicy {
  const now = Date.now()
  const p: DemoPolicy = { origin: 'https://synthetic-verification.invalid', release: randomBytes(16).toString('hex'), startsAt: now - 10_000, expiresAt: now + 600_000,
    receiptLimit: 2, addressLimit: 3, ceilingMicroUsd: 70_800, ownerHash: digest(), lecturerHash: digest(), digestSalt: digest(), test: false, ...overrides }
  keys.push('spendscape:demo:' + p.release)
  return p
}
async function command(args: unknown[]) {
  const response = await send(config!.url, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(3000),
    headers: { Authorization: 'Bearer ' + config!.token, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
  if (!response.ok) throw Error('verification-transport-failure')
  const data = await response.json() as { result?: unknown; error?: unknown }
  if (data.error) throw Error('verification-command-failure')
  return data.result
}
async function state(p: DemoPolicy) {
  const raw = await command(['GET', 'spendscape:demo:' + p.release])
  if (typeof raw !== 'string') throw Error('verification-state-unavailable')
  return JSON.parse(raw) as ReturnType<typeof initialQuotaState>
}
function writeEvidence() {
  writeFileSync(process.env.SPENDSCAPE_REDIS_RESULT_FILE!, JSON.stringify({ version: 1, scope: 'synthetic Redis metadata only', requests, passed: results, testKeys: keys, productionInitialized: false, receiptProviderCalls: 0, addressProviderCalls: 0 }, null, 2), { mode: 0o600 })
}
function record(name: string) { results.push(name); writeEvidence() }
afterAll(writeEvidence)

describe.sequential('authorized real Redis metadata verification', () => {
  it('initializes once, preserves TTL and cannot reset a reservation', async () => {
    const p = policy(), q = createRedisQuota(env, p, send), d = digest()
    await initializeRedisQuota(env, p, send)
    expect((await q.status('address')).status).toBe('available')
    const ttl = await command(['PTTL', 'spendscape:demo:' + p.release])
    expect(ttl).toBeGreaterThan(86_400_000); expect(ttl).toBeLessThanOrEqual(87_000_000)
    await q.reserve('address', d)
    await expect(initializeRedisQuota(env, p, send)).rejects.toThrow('quota-initialization-not-confirmed')
    const fresh = createRedisQuota(env, { ...p }, send)
    expect(await fresh.status('address')).toMatchObject({ status: 'busy', used: 1, remaining: 2 })
    expect((await state(p)).active).toEqual({ kind: 'address', digest: d })
    await fresh.complete('address', d, 'success')
    expect(await fresh.status('address')).toMatchObject({ status: 'available', used: 1 })
    record('NX, TTL, reservation and fresh-client persistence')
  })
  it('permits exactly one concurrent reservation across capabilities', async () => {
    const p = policy(); await initializeRedisQuota(env, p, send)
    const a = createRedisQuota(env, p, send), b = createRedisQuota(env, p, send)
    const settled = await Promise.allSettled([a.reserve('address', digest()), b.reserve('receipt', digest())])
    expect(settled.filter(x => x.status === 'fulfilled')).toHaveLength(1)
    const s = await state(p); expect(s.address + s.receipt).toBe(1)
    expect((await a.status('address')).status).toBe('busy'); expect((await b.status('receipt')).status).toBe('busy')
    record('atomic shared concurrency and unresolved in-flight blocking')
  })
  it('refuses a replay and enforces the finite address allowance', async () => {
    const p = policy({ addressLimit: 2 }); await initializeRedisQuota(env, p, send)
    const q = createRedisQuota(env, p, send), d = digest()
    await q.reserve('address', d); await q.complete('address', d, 'success')
    await expect(q.reserve('address', d)).rejects.toThrow('quota-unavailable')
    expect((await q.status('address')).used).toBe(1)
    const d2 = digest(); await q.reserve('address', d2); await q.complete('address', d2, 'success')
    expect(await q.status('address')).toMatchObject({ status: 'limit-reached', used: 2, remaining: 0 })
    await expect(q.reserve('address', digest())).rejects.toThrow('quota-unavailable')
    record('replay refusal and finite allowance')
  })
  it('reserves the conservative receipt cost and enforces cooldown', async () => {
    const p = policy(); await initializeRedisQuota(env, p, send)
    const q = createRedisQuota(env, p, send), d = digest()
    await q.reserve('receipt', d); await q.complete('receipt', d, 'success')
    expect(await q.status('receipt')).toMatchObject({ status: 'wait', used: 1, reservedMicroUsd: 35_400 })
    await expect(q.reserve('receipt', digest())).rejects.toThrow('quota-unavailable')
    expect((await state(p)).reserved).toBe(35_400)
    record('receipt cost reservation and cooldown')
  })
  it('stops a failed capability without refunding its reservation', async () => {
    const p = policy(); await initializeRedisQuota(env, p, send)
    const q = createRedisQuota(env, p, send), d = digest()
    await q.reserve('receipt', d); await q.complete('receipt', d, 'failure')
    expect(await q.status('receipt')).toMatchObject({ status: 'session-stopped', used: 1, reservedMicroUsd: 35_400 })
    await expect(q.reserve('receipt', digest())).rejects.toThrow('quota-unavailable')
    expect((await q.status('address')).status).toBe('available')
    record('acknowledged failure stops capability without refund')
  })
  it('fails closed on missing state, corruption and changed policy', async () => {
    const absent = policy(), missing = createRedisQuota(env, absent, send)
    await expect(missing.reserve('address', digest())).rejects.toThrow('quota-unavailable')
    expect(await command(['EXISTS', 'spendscape:demo:' + absent.release])).toBe(0)
    const p = policy(); await initializeRedisQuota(env, p, send)
    await expect(createRedisQuota(env, { ...p, addressLimit: 2 }, send).reserve('address', digest())).rejects.toThrow('quota-unavailable')
    expect((await state(p)).address).toBe(0)
    await command(['SET', 'spendscape:demo:' + p.release, '{"version":1}', 'XX', 'KEEPTTL'])
    await expect(createRedisQuota(env, p, send).reserve('address', digest())).rejects.toThrow('quota-unavailable')
    record('missing, corrupted and mismatched state blocks without initialization')
  })
  it('uses Redis time to refuse expired sessions', async () => {
    const p = policy({ startsAt: Date.now() - 120_000, expiresAt: Date.now() - 60_000 }); await initializeRedisQuota(env, p, send)
    const q = createRedisQuota(env, p, send)
    expect((await q.status('address')).status).toBe('expired')
    await expect(q.reserve('address', digest())).rejects.toThrow('quota-unavailable')
    record('server-time expiry')
  })
  it('retains only policy, counters and one-way synthetic identifiers', async () => {
    const p = policy(); await initializeRedisQuota(env, p, send)
    const q = createRedisQuota(env, p, send), d = digest(); await q.reserve('address', d); await q.complete('address', d, 'success')
    const s = await state(p)
    // Upstash's Lua JSON implementation may omit an object member assigned
    // cjson.null. Both null and absent mean no in-flight request in the script.
    expect(Object.keys(s).filter(k => k !== 'active').sort()).toEqual(Object.keys(initialQuotaState(p)).filter(k => k !== 'active').sort())
    expect(s.active == null).toBe(true)
    expect(s.addresses).toEqual([d]); expect(s.address).toBe(1)
    const raw = JSON.stringify(s)
    for (const value of [p.origin, p.ownerHash, p.lecturerHash, p.digestSalt, config!.token, 'KV_REST_API_TOKEN', 'GEMINI_API_KEY']) expect(raw).not.toContain(value)
    record('stored field allowlist; no content or credentials')
  })
})
