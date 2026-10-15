import { createHash } from 'node:crypto'
import type { DemoPolicy } from './demo-access'
import { captureContractHash } from './receipt-capture-session'

export type DemoKind = 'receipt' | 'address'
export type DemoQuotaStatus = 'available' | 'busy' | 'wait' | 'expired' | 'limit-reached' | 'session-stopped'
export interface DemoQuotaResult { status: DemoQuotaStatus; used: number; maxRequests: number; remaining: number; reservedMicroUsd: number; expiresAt: number }
export interface DemoQuota {
  status: (kind: DemoKind) => Promise<DemoQuotaResult>
  reserve: (kind: DemoKind, digest: string) => Promise<void>
  complete: (kind: DemoKind, digest: string, outcome: 'success' | 'failure') => Promise<void>
}
export function quotaPolicy(policy: DemoPolicy) {
  return { version: 1, release: policy.release, startsAt: policy.startsAt, expiresAt: policy.expiresAt,
    receiptLimit: policy.receiptLimit, addressLimit: policy.addressLimit, ceilingMicroUsd: policy.ceilingMicroUsd,
    contractHash: captureContractHash, receiptCostMicroUsd: 35_400,
    accessVersion: createHash('sha256').update(policy.ownerHash + policy.lecturerHash + policy.digestSalt).digest('hex') }
}
export const quotaPolicyHash = (policy: DemoPolicy) => createHash('sha256').update(JSON.stringify(quotaPolicy(policy))).digest('hex')
// Initialize explicitly before activation. Runtime never recreates a missing
// record: deletion, eviction, state corruption and policy changes fail closed.
export function initialQuotaState(policy: DemoPolicy) {
  return { ...quotaPolicy(policy), policyHash: quotaPolicyHash(policy), receipt: 0, address: 0, reserved: 0,
    stoppedReceipt: false, stoppedAddress: false, lastReceipt: 0, active: null, receipts: [], addresses: [] }
}
export const DEMO_QUOTA_LUA = `
local raw=redis.call('GET',KEYS[1])
if not raw then return redis.error_reply('state-unavailable') end
local ok,s=pcall(cjson.decode,raw)
if not ok or s.policyHash~=ARGV[1] or s.version~=1 or type(s.receipt)~='number' or type(s.address)~='number' or type(s.reserved)~='number' or type(s.receipts)~='table' or type(s.addresses)~='table' or #s.receipts~=s.receipt or #s.addresses~=s.address or s.reserved~=s.receipt*35400 then return redis.error_reply('state-invalid') end
local expected=cjson.decode(ARGV[6])
for k,v in pairs(expected) do if s[k]~=v then return redis.error_reply('policy-invalid') end end
if s.receipt<0 or s.receipt>s.receiptLimit or s.address<0 or s.address>s.addressLimit or s.reserved>s.ceilingMicroUsd or s.receipt~=math.floor(s.receipt) or s.address~=math.floor(s.address) or type(s.stoppedReceipt)~='boolean' or type(s.stoppedAddress)~='boolean' or type(s.lastReceipt)~='number' then return redis.error_reply('state-invalid') end
local time=redis.call('TIME');local now=tonumber(time[1])*1000+math.floor(tonumber(time[2])/1000)
local kind=ARGV[3];local isReceipt=kind=='receipt'
if not isReceipt and kind~='address' then return redis.error_reply('kind-invalid') end
local limit=isReceipt and s.receiptLimit or s.addressLimit
local used=isReceipt and s.receipt or s.address
local seen=isReceipt and s.receipts or s.addresses
local stopped=s.stoppedAddress;if isReceipt then stopped=s.stoppedReceipt end
local active=s.active and s.active~=cjson.null
local state='available'
if now<s.startsAt or now>=s.expiresAt then state='expired'
elseif stopped then state='session-stopped'
elseif active then state='busy'
elseif used>=limit then state='limit-reached'
elseif isReceipt and s.lastReceipt>0 and now-s.lastReceipt<60000 then state='wait' end
local action=ARGV[2];local digest=ARGV[4]
if action=='reserve' then
  if state~='available' then return redis.error_reply(state) end
  for _,v in ipairs(seen) do if v==digest then return redis.error_reply('duplicate') end end
  if isReceipt and s.reserved+35400>s.ceilingMicroUsd then return redis.error_reply('limit-reached') end
  if isReceipt then s.receipt=s.receipt+1;s.reserved=s.reserved+35400;s.lastReceipt=now else s.address=s.address+1 end
  table.insert(seen,digest);s.active={kind=kind,digest=digest}
elseif action=='complete' then
  if not active or s.active.kind~=kind or s.active.digest~=digest or (ARGV[5]~='success' and ARGV[5]~='failure') then return redis.error_reply('state-invalid') end
  if ARGV[5]=='failure' then if isReceipt then s.stoppedReceipt=true else s.stoppedAddress=true end end
  s.active=cjson.null
elseif action~='status' then return redis.error_reply('action-invalid') end
if action~='status' then redis.call('SET',KEYS[1],cjson.encode(s),'KEEPTTL') end
return cjson.encode({status=state,used=used,maxRequests=limit,remaining=limit-used,reservedMicroUsd=s.reserved,expiresAt=s.expiresAt})
`
export function redisConfiguration(env: NodeJS.ProcessEnv) {
  try {
    const url = new URL(env.UPSTASH_REDIS_REST_URL ?? '')
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.upstash.io') || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !/^[A-Za-z0-9_./+=-]{20,1000}$/.test(env.UPSTASH_REDIS_REST_TOKEN ?? '')) return null
    return { url: url.origin, token: env.UPSTASH_REDIS_REST_TOKEN! }
  } catch { return null }
}
// Administrative preparation only. No route calls this function. Existing
// records cannot be replaced, even if an operator repeats initialization.
async function initializeQuota(env: NodeJS.ProcessEnv, policy: DemoPolicy, send: typeof fetch) {
  const config = redisConfiguration(env)
  if (!config) throw Error('quota-unavailable')
  const response = await send(config.url, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(3000),
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', `spendscape:demo:${policy.release}`, JSON.stringify(initialQuotaState(policy)), 'NX', 'PXAT', policy.expiresAt + 86_400_000]) })
  if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 128 || !response.body) { await response.body?.cancel(); throw Error('quota-unavailable') }
  const reader = response.body.getReader(); let text = '', size = 0
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 128) { await reader.cancel(); throw Error('quota-unavailable') }; text += new TextDecoder().decode(value) } }
  finally { reader.releaseLock() }
  try { if (JSON.parse(text).result !== 'OK') throw 0 } catch { throw Error('quota-initialization-not-confirmed') }
}
export async function initializeRedisQuota(env: NodeJS.ProcessEnv, policy: DemoPolicy, send: typeof fetch) {
  try { await initializeQuota(env, policy, send) } catch { throw Error('quota-initialization-not-confirmed') }
}
export function createRedisQuota(env: NodeJS.ProcessEnv, policy: DemoPolicy, send: typeof fetch = fetch): DemoQuota {
  const config = redisConfiguration(env), key = `spendscape:demo:${policy.release}`
  const command = async (action: string, kind: DemoKind, digest = '', outcome = ''): Promise<DemoQuotaResult> => {
    if (!config) throw Error('quota-unavailable')
    if (action !== 'status' && !/^[a-f0-9]{64}$/.test(digest)) throw Error('quota-unavailable')
    try {
      const response = await send(config.url, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(3000),
        headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', DEMO_QUOTA_LUA, '1', key, quotaPolicyHash(policy), action, kind, digest, outcome, JSON.stringify(quotaPolicy(policy))]) })
      if (!response.ok || !response.body) { await response.body?.cancel(); throw 0 }
      const reader = response.body.getReader(); let size = 0, text = ''
      try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2048) { await reader.cancel(); throw 0 }; text += new TextDecoder().decode(value) } } finally { reader.releaseLock() }
      const outer = JSON.parse(text)
      if (typeof outer.result !== 'string' || outer.error) throw 0
      const result = JSON.parse(outer.result) as DemoQuotaResult
      const max = kind === 'receipt' ? policy.receiptLimit : policy.addressLimit
      if (!result || !['available', 'busy', 'wait', 'expired', 'limit-reached', 'session-stopped'].includes(result.status) || result.maxRequests !== max ||
        !Number.isInteger(result.used) || result.used < 0 || result.used > max || result.remaining !== max - result.used ||
        !Number.isInteger(result.reservedMicroUsd) || result.reservedMicroUsd < 0 || result.reservedMicroUsd > policy.ceilingMicroUsd || result.expiresAt !== policy.expiresAt) throw 0
      return { status: result.status, used: result.used, maxRequests: result.maxRequests, remaining: result.remaining, reservedMicroUsd: result.reservedMicroUsd, expiresAt: result.expiresAt }
    } catch { throw Error('quota-unavailable') }
  }
  return { status: kind => command('status', kind), reserve: async (kind, digest) => { await command('reserve', kind, digest) }, complete: async (kind, digest, outcome) => { await command('complete', kind, digest, outcome) } }
}
