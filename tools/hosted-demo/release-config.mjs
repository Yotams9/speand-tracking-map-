// Fixed hosted release preparation. Imports perform no network or credentials I/O.
import { createHash, randomBytes } from 'node:crypto'
export const PROJECT = 'prj_PNiKcOoBrfiJQGOTXYhzApxitZp3'
export const TEAM = 'team_yx1kmFpHwN320ijT9Z2Bv2mL'
export const BRANCH = 'codex/hosted-college-release-20261015'
export const PREFIX = `artifacts/hosted-completion-20261015`
export const sha = value => createHash('sha256').update(value).digest('hex')
export function readiness(args, env) {
  if (args.join(' ') !== '--prepare-private-preview --prepay-ready-confirmed --geoapify-free-two-confirmed --no-concurrent-use --auto-reload-off' || env.VERCEL || env.CI || !/^[A-Za-z0-9_.-]{20,200}$/.test(env.GEMINI_API_KEY ?? '') || !/^[A-Za-z0-9_-]{16,128}$/.test(env.GEOAPIFY_API_KEY ?? '')) throw Error('private-readiness-required')
}
export function accessMaterial() {
  const owner = randomBytes(32).toString('hex'), lecturer = randomBytes(32).toString('hex')
  return { owner, lecturer, release: randomBytes(16).toString('hex'), ownerHash: sha(owner), lecturerHash: sha(lecturer), digestSalt: randomBytes(32).toString('hex') }
}
export function windowConfig(prepared, origin, now = Date.now()) {
  const url = new URL(origin)
  if (url.origin !== origin || !/^https:\/\/spendscape-college-demo-[a-z0-9-]+\.vercel\.app$/.test(origin) || !/^[a-f0-9]{32}$/.test(prepared.release) || !['ownerHash','lecturerHash','digestSalt'].every(k => /^[a-f0-9]{64}$/.test(prepared[k])) || prepared.ownerHash === prepared.lecturerHash) throw Error('release-policy-invalid')
  // A future boundary allows the deployed Preview to be checked while inactive.
  // Never extend this boundary after writing it or initialize a replacement.
  const start = now + 10 * 60_000
  return { SPENDSCAPE_HOSTED_MODE: 'protected-demo', SPENDSCAPE_DEMO_ORIGIN: origin,
    SPENDSCAPE_DEMO_RELEASE_ID: prepared.release, SPENDSCAPE_DEMO_START_AT: new Date(start).toISOString(),
    SPENDSCAPE_DEMO_EXPIRES_AT: new Date(start + 7_200_000).toISOString(),
    SPENDSCAPE_DEMO_OWNER_SHA256: prepared.ownerHash, SPENDSCAPE_DEMO_LECTURER_SHA256: prepared.lecturerHash,
    SPENDSCAPE_DEMO_DIGEST_SALT: prepared.digestSalt, SPENDSCAPE_DEMO_RECEIPT_LIMIT: '2',
    SPENDSCAPE_DEMO_ADDRESS_LIMIT: '2', SPENDSCAPE_DEMO_CEILING_MICRO_USD: '100000' }
}
export function previewVariable(key, value) {
  if (!/^(SPENDSCAPE_[A-Z0-9_]+|GEMINI_API_KEY|GEOAPIFY_API_KEY|KV_REST_API_URL|KV_REST_API_TOKEN)$/.test(key) || typeof value !== 'string' || !value || value.length > 2048) throw Error('private-configuration-invalid')
  return { key, value, type: 'sensitive', target: ['preview'] }
}
export function redisPair(url, token) {
  const u = new URL(url)
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.upstash.io') || u.username || u.password || u.port || u.pathname !== '/' || u.search || u.hash || !/^[A-Za-z0-9_./+=-]{20,1000}$/.test(token)) throw Error('existing-redis-unverified')
  return { KV_REST_API_URL: u.origin, KV_REST_API_TOKEN: token }
}
