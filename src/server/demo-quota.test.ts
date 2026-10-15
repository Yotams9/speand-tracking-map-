import { describe, expect, it, vi } from 'vitest'
import { createRedisQuota, DEMO_QUOTA_LUA, initialQuotaState, initializeRedisQuota, quotaPolicyHash, redisConfiguration } from './demo-quota'
import { demoTestEnv, testPolicy } from '../../qa/fixtures/hosted-demo'
describe('hosted shared quota transport', () => {
  it('accepts the Marketplace credential pair without mixing it with explicit configuration', () => {
    const marketplace = { KV_REST_API_URL: 'https://fictional-test.upstash.io', KV_REST_API_TOKEN: 'test-only-token-not-a-secret' }
    expect(redisConfiguration(marketplace)).toEqual({ url: marketplace.KV_REST_API_URL, token: marketplace.KV_REST_API_TOKEN })
    expect(redisConfiguration({ ...marketplace, UPSTASH_REDIS_REST_URL: marketplace.KV_REST_API_URL })).toBeNull()
    expect(redisConfiguration({ ...marketplace, UPSTASH_REDIS_REST_TOKEN: marketplace.KV_REST_API_TOKEN })).toBeNull()
    expect(redisConfiguration({ ...marketplace, UPSTASH_REDIS_REST_URL: 'https://untrusted.example', UPSTASH_REDIS_REST_TOKEN: marketplace.KV_REST_API_TOKEN })).toBeNull()
  })
  it('uses a single atomic EVAL with a fixed key, server time and no fallback initialization', async () => {
    const p = testPolicy(), send = vi.fn<typeof fetch>(async () => Response.json({ result: JSON.stringify({ status: 'available', used: 0, maxRequests: 2, remaining: 2, reservedMicroUsd: 0, expiresAt: p.expiresAt }) }))
    await createRedisQuota(demoTestEnv(), p, send).reserve('receipt', 'c'.repeat(64))
    const options = send.mock.calls[0][1] as RequestInit, command = JSON.parse(options.body as string)
    expect(command.slice(0, 4)).toEqual(['EVAL', DEMO_QUOTA_LUA, '1', 'spendscape:demo:' + p.release]); expect(options.redirect).toBe('error'); expect(command[5]).toBe('reserve')
    expect(DEMO_QUOTA_LUA).toContain("redis.call('TIME')"); expect(DEMO_QUOTA_LUA).toContain("redis.error_reply('state-unavailable')"); expect(DEMO_QUOTA_LUA).not.toContain("redis.call('DEL'")
  })
  it('pins the exact policy across handler recreation and excludes personal content', () => {
    const p = testPolicy(); expect(quotaPolicyHash({ ...p })).toBe(quotaPolicyHash(p)); expect(quotaPolicyHash({ ...p, receiptLimit: 1 })).not.toBe(quotaPolicyHash(p))
    const state = JSON.stringify(initialQuotaState(p)); expect(state).not.toContain('ownerHash'); expect(state).not.toContain('GEMINI'); expect(state).not.toContain('address:'); expect(state).toContain('reserved')
  })
  it('initializes explicitly with NX and an absolute expiry and cannot reset an existing allowance', async () => {
    const send = vi.fn<typeof fetch>(async () => Response.json({ result: 'OK' })), policy = testPolicy()
    await initializeRedisQuota(demoTestEnv(), policy, send)
    const command = JSON.parse(send.mock.calls[0][1]!.body as string)
    expect(command[0]).toBe('SET'); expect(command.slice(3)).toEqual(['NX', 'PXAT', policy.expiresAt + 86_400_000])
    send.mockImplementation(async () => Response.json({ result: null }))
    await expect(initializeRedisQuota(demoTestEnv(), policy, send)).rejects.toThrow('quota-initialization-not-confirmed')
    expect(quotaPolicyHash({ ...policy, digestSalt: 'c'.repeat(64) })).not.toBe(quotaPolicyHash(policy))
  })
  for (const response of [{ error: 'private redis message' }, { result: 'not JSON' }, { result: '{}' }, { result: JSON.stringify({ status: 'available', used: -1 }) }]) it('fails closed for malformed quota results ' + JSON.stringify(response), async () => {
    const send = vi.fn(async () => Response.json(response)); await expect(createRedisQuota(demoTestEnv(), testPolicy(), send).status('receipt')).rejects.toThrow('quota-unavailable'); expect(send).toHaveBeenCalledTimes(1)
  })
  it('does not retry a transport failure or send to an arbitrary endpoint', async () => {
    const send = vi.fn(async () => { throw Error('private token') })
    await expect(createRedisQuota(demoTestEnv(), testPolicy(), send).status('address')).rejects.toThrow('quota-unavailable'); expect(send).toHaveBeenCalledTimes(1)
    send.mockClear(); await expect(createRedisQuota({ ...demoTestEnv(), UPSTASH_REDIS_REST_URL: 'https://untrusted.example' }, testPolicy(), send).status('receipt')).rejects.toThrow('quota-unavailable'); expect(send).not.toHaveBeenCalled()
    expect(redisConfiguration({ ...demoTestEnv(), UPSTASH_REDIS_REST_URL: 'https://fictional-test.upstash.io/path' })).toBeNull()
  })
  it('projects only allowlisted metadata and sanitizes initialization failures', async () => {
    const p = testPolicy(), send = vi.fn<typeof fetch>(async () => Response.json({ result: JSON.stringify({ status: 'available', used: 0, maxRequests: 2, remaining: 2, reservedMicroUsd: 0, expiresAt: p.expiresAt, privateEcho: 'not-retained' }) }))
    expect(await createRedisQuota(demoTestEnv(), p, send).status('receipt')).not.toHaveProperty('privateEcho')
    send.mockImplementation(async () => { throw Error('private token and internal request details') })
    await expect(initializeRedisQuota(demoTestEnv(), p, send)).rejects.toThrow('quota-initialization-not-confirmed')
  })
})
