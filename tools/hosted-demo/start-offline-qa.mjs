import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
// Synthetic local browser QA only. Never accepts credentials or activates providers.
if (process.env.VERCEL || process.env.CI || process.argv.length !== 2 || !existsSync('.next/BUILD_ID')) throw Error('offline-qa-unavailable')
const now = Date.now()
const env = { PATH: process.env.PATH, LANG: 'en_US.UTF-8', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  SPENDSCAPE_HOSTED_MODE: 'protected-demo', SPENDSCAPE_HOSTED_DEMO_TEST: 'synthetic', SPENDSCAPE_DEMO_ORIGIN: 'http://127.0.0.1:3206',
  SPENDSCAPE_DEMO_START_AT: new Date(now - 1000).toISOString(), SPENDSCAPE_DEMO_EXPIRES_AT: new Date(now + 7_000_000).toISOString(),
  SPENDSCAPE_DEMO_RELEASE_ID: 'f'.repeat(32), SPENDSCAPE_DEMO_DIGEST_SALT: 'b'.repeat(64),
  SPENDSCAPE_DEMO_OWNER_SHA256: createHash('sha256').update('1'.repeat(64)).digest('hex'), SPENDSCAPE_DEMO_LECTURER_SHA256: createHash('sha256').update('2'.repeat(64)).digest('hex'),
  SPENDSCAPE_DEMO_RECEIPT_LIMIT: '1', SPENDSCAPE_DEMO_ADDRESS_LIMIT: '1', SPENDSCAPE_DEMO_CEILING_MICRO_USD: '50000' }
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3206'], { env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', code => process.exit(code ?? 1))
