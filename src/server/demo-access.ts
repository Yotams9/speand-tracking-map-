import { createHash, timingSafeEqual } from 'node:crypto'

export const DEMO_COOKIE = '__Host-spendscape-demo'
export const DEMO_LOCAL_COOKIE = 'spendscape-demo-test'
export type DemoRole = 'owner' | 'lecturer'
export interface DemoPolicy {
  origin: string; release: string; startsAt: number; expiresAt: number
  receiptLimit: number; addressLimit: number; ceilingMicroUsd: number
  ownerHash: string; lecturerHash: string; digestSalt: string; test: boolean
}
const hex = (value: string | undefined, length = 64) => !!value && new RegExp(`^[a-f0-9]{${length}}$`).test(value)
const number = (value: string | undefined, max: number) => value !== undefined && /^(0|[1-9]\d*)$/.test(value) && Number(value) <= max ? Number(value) : -1
export const demoRequested = (env: NodeJS.ProcessEnv) => env.SPENDSCAPE_HOSTED_MODE !== undefined
export function demoPolicy(env: NodeJS.ProcessEnv, now = Date.now()): DemoPolicy | null {
  try {
    if (env.SPENDSCAPE_HOSTED_MODE !== 'protected-demo') return null
    const test = env.SPENDSCAPE_HOSTED_DEMO_TEST === 'synthetic' && !env.VERCEL && !env.CI
    if (!test && (!env.VERCEL || env.SPENDSCAPE_HOSTED_DEMO_TEST)) return null
    const url = new URL(env.SPENDSCAPE_DEMO_ORIGIN ?? '')
    if (url.origin !== env.SPENDSCAPE_DEMO_ORIGIN || url.username || url.password ||
      (test ? url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) : url.protocol !== 'https:')) return null
    const startsAt = Date.parse(env.SPENDSCAPE_DEMO_START_AT ?? ''), expiresAt = Date.parse(env.SPENDSCAPE_DEMO_EXPIRES_AT ?? '')
    if (![startsAt, expiresAt, now].every(Number.isSafeInteger) || startsAt > now || now >= expiresAt || expiresAt - startsAt > 7_200_000 || expiresAt <= startsAt) return null
    const receiptLimit = number(env.SPENDSCAPE_DEMO_RECEIPT_LIMIT, 10), addressLimit = number(env.SPENDSCAPE_DEMO_ADDRESS_LIMIT, 10), ceilingMicroUsd = number(env.SPENDSCAPE_DEMO_CEILING_MICRO_USD, 500_000)
    if (receiptLimit < 0 || addressLimit < 0 || receiptLimit + addressLimit === 0 || ceilingMicroUsd < receiptLimit * 35_400) return null
    if (!hex(env.SPENDSCAPE_DEMO_RELEASE_ID, 32) || !hex(env.SPENDSCAPE_DEMO_OWNER_SHA256) || !hex(env.SPENDSCAPE_DEMO_LECTURER_SHA256) || !hex(env.SPENDSCAPE_DEMO_DIGEST_SALT) || env.SPENDSCAPE_DEMO_OWNER_SHA256 === env.SPENDSCAPE_DEMO_LECTURER_SHA256) return null
    return { origin: url.origin, release: env.SPENDSCAPE_DEMO_RELEASE_ID!, startsAt, expiresAt, receiptLimit, addressLimit, ceilingMicroUsd,
      ownerHash: env.SPENDSCAPE_DEMO_OWNER_SHA256!, lecturerHash: env.SPENDSCAPE_DEMO_LECTURER_SHA256!, digestSalt: env.SPENDSCAPE_DEMO_DIGEST_SALT!, test }
  } catch { return null }
}
export function demoRole(code: string, policy: DemoPolicy): DemoRole | null {
  if (!hex(code)) return null
  const digest = createHash('sha256').update(code).digest()
  for (const role of ['owner', 'lecturer'] as const) {
    if (timingSafeEqual(digest, Buffer.from(role === 'owner' ? policy.ownerHash : policy.lecturerHash, 'hex'))) return role
  }
  return null
}
export function demoRequestRole(request: Request, policy: DemoPolicy): DemoRole | null {
  const name = policy.test ? DEMO_LOCAL_COOKIE : DEMO_COOKIE
  const matches = (request.headers.get('cookie') ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith(name + '='))
  return matches.length === 1 ? demoRole(matches[0].slice(name.length + 1), policy) : null
}
export function demoOrigin(request: Request, policy: DemoPolicy): boolean {
  try {
    const url = new URL(request.url), expected = new URL(policy.origin)
    // Next's local production server reconstructs 127.0.0.1 requests with a
    // localhost URL. Permit that alias only in explicit synthetic loopback QA.
    const localAlias = policy.test && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.port === expected.port
    if ((!localAlias && url.origin !== policy.origin) || (request.headers.get('host') ?? url.host) !== expected.host ||
      (request.headers.get('x-forwarded-host') && request.headers.get('x-forwarded-host') !== expected.host)) return false
    const origin = request.headers.get('origin')
    return !['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site') ?? '') &&
      (origin === policy.origin || request.method === 'GET' && !origin)
  } catch { return false }
}
export function demoCookie(value: string, policy: DemoPolicy, remove = false): string {
  const name = policy.test ? DEMO_LOCAL_COOKIE : DEMO_COOKIE
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; ${policy.test ? '' : 'Secure; '}Max-Age=${remove ? 0 : Math.max(0, Math.floor((policy.expiresAt - Date.now()) / 1000))}`
}
export function createDemoAccessHandler(env: NodeJS.ProcessEnv, now = () => Date.now()) {
  return async (request: Request) => {
    const policy = demoPolicy(env, now())
    // Native HTML form navigation needs its same-origin Origin header. A
    // no-referrer document policy makes Chromium serialize that origin as null.
    const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin' }
    if (!policy || !demoOrigin(request, policy)) return Response.json({ status: 'unavailable' }, { status: 503, headers })
    if (request.method !== 'POST') return Response.json({ status: 'invalid' }, { status: 405, headers })
    const reader = request.body?.getReader(); if (!reader) return Response.json({ status: 'invalid' }, { status: 400, headers })
    let content = '', size = 0
    try {
      for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 256) { await reader.cancel(); return Response.json({ status: 'invalid' }, { status: 400, headers }) }; content += new TextDecoder().decode(value) }
      const data = new URLSearchParams(content), code = data.get('code') ?? ''
      if (data.get('action') === 'logout') return new Response(null, { status: 303, headers: { ...headers, Location: '/demo-access', 'Set-Cookie': demoCookie('', policy, true) } })
      if (data.size !== 1 || !demoRole(code, policy)) return new Response(null, { status: 303, headers: { ...headers, Location: '/demo-access?error=invalid' } })
      return new Response(null, { status: 303, headers: { ...headers, Location: '/', 'Set-Cookie': demoCookie(code, policy) } })
    } catch { return Response.json({ status: 'invalid' }, { status: 400, headers }) }
    finally { reader.releaseLock(); content = '' }
  }
}
