import { createHash } from 'node:crypto'
import { demoPolicy, type DemoPolicy } from '../../src/server/demo-access'
import type { DemoKind, DemoQuota, DemoQuotaResult } from '../../src/server/demo-quota'
export const DEMO_TEST_NOW = Date.parse('2026-10-15T12:00:00Z')
// Public synthetic capabilities and provider placeholders; never live credentials.
export const OWNER_CODE = '1'.repeat(64), LECTURER_CODE = '2'.repeat(64)
export function demoTestEnv(): NodeJS.ProcessEnv {
  const key = 'fictional_only_gemini_key_123456'
  return { VERCEL: '1', SPENDSCAPE_HOSTED_MODE: 'protected-demo', SPENDSCAPE_DEMO_ORIGIN: 'https://demo.example',
    SPENDSCAPE_DEMO_RELEASE_ID: 'a'.repeat(32), SPENDSCAPE_DEMO_START_AT: new Date(DEMO_TEST_NOW - 1000).toISOString(), SPENDSCAPE_DEMO_EXPIRES_AT: new Date(DEMO_TEST_NOW + 7_000_000).toISOString(),
    SPENDSCAPE_DEMO_RECEIPT_LIMIT: '2', SPENDSCAPE_DEMO_ADDRESS_LIMIT: '3', SPENDSCAPE_DEMO_CEILING_MICRO_USD: '100000', SPENDSCAPE_DEMO_DIGEST_SALT: 'b'.repeat(64),
    SPENDSCAPE_DEMO_OWNER_SHA256: createHash('sha256').update(OWNER_CODE).digest('hex'), SPENDSCAPE_DEMO_LECTURER_SHA256: createHash('sha256').update(LECTURER_CODE).digest('hex'),
    GEMINI_API_KEY: key, SPENDSCAPE_RECEIPT_PROJECT: 'spendscape-receipt-benchmark', SPENDSCAPE_RECEIPT_PROJECT_NUMBER: '376401338717', SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED: '1', SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256: createHash('sha256').update(key).digest('hex'),
    SPENDSCAPE_ADDRESS_FREE_READY: '1', GEOAPIFY_API_KEY: 'fictional_geoapify_key_123456',
    UPSTASH_REDIS_REST_URL: 'https://fictional-test.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'fictional_redis_token_123456' }
}
export function testPolicy(env = demoTestEnv()): DemoPolicy { const p = demoPolicy(env, DEMO_TEST_NOW); if (!p) throw Error('test-policy-invalid'); return p }
export function demoRequest(path: string, options: RequestInit = {}, code = OWNER_CODE) {
  return new Request('https://demo.example' + path, { ...options, headers: { host: 'demo.example', origin: 'https://demo.example', cookie: '__Host-spendscape-demo=' + code, ...options.headers } })
}
export function fictionalPng(seed = 0) {
  const b = Buffer.alloc(34); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b)
  b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(64, 16); b.writeUInt32BE(64, 20); b[33] = seed; return b
}
// Test-only shared port. Production uses the atomic Redis script, never this fake.
export function fakeQuota(policy = testPolicy()) {
  let active: string | null = null, fail = false
  const counts = { receipt: 0, address: 0 }, stopped = { receipt: false, address: false }, seen = new Set<string>()
  const status = async (kind: DemoKind): Promise<DemoQuotaResult> => ({ status: stopped[kind] ? 'session-stopped' : active ? 'busy' : counts[kind] >= (kind === 'receipt' ? policy.receiptLimit : policy.addressLimit) ? 'limit-reached' : 'available',
    used: counts[kind], maxRequests: kind === 'receipt' ? policy.receiptLimit : policy.addressLimit, remaining: (kind === 'receipt' ? policy.receiptLimit : policy.addressLimit) - counts[kind], reservedMicroUsd: counts.receipt * 35400, expiresAt: policy.expiresAt })
  const port: DemoQuota = { status, reserve: async (kind, digest) => {
    if (fail || active || stopped[kind] || seen.has(kind + digest) || counts[kind] >= (kind === 'receipt' ? policy.receiptLimit : policy.addressLimit)) throw Error('unavailable')
    counts[kind]++; seen.add(kind + digest); active = kind + digest
  }, complete: async (kind, digest, outcome) => { if (fail || active !== kind + digest) throw Error('unavailable'); active = null; if (outcome === 'failure') stopped[kind] = true } }
  return { port, counts, seen, fail: () => { fail = true }, status }
}
