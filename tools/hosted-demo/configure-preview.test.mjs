// Executable preflight controls only: synthetic invalid inputs stop before all I/O.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const script = fileURLToPath(new URL('./configure-preview.mjs', import.meta.url))
const args = '--prepare-private-preview --prepay-ready-confirmed --geoapify-free-two-confirmed --no-concurrent-use --auto-reload-off'.split(' ')
const synthetic = { PATH: process.env.PATH, GEMINI_API_KEY: 'synthetic_'.repeat(5), GEOAPIFY_API_KEY: 'fictional_'.repeat(4) }
const cases = [
  { name: 'missing readiness flag', args: args.slice(1), env: synthetic, code: 'readiness-flags-required' },
  { name: 'CI environment', args, env: { ...synthetic, CI: '1' }, code: 'local-environment-required' },
  { name: 'hosted environment', args, env: { ...synthetic, VERCEL: '1' }, code: 'local-environment-required' },
  { name: 'missing Gemini input', args, env: { ...synthetic, GEMINI_API_KEY: '' }, code: 'gemini-key-input-invalid' },
  { name: 'quoted Geoapify input', args, env: { ...synthetic, GEOAPIFY_API_KEY: '"sensitive_synthetic_geo_value"' }, code: 'geoapify-key-input-invalid' },
]
for (const c of cases) test('private launcher: ' + c.name, () => {
  const r = spawnSync(process.execPath, [script, ...c.args], { env: c.env, encoding: 'utf8', timeout: 5000 })
  assert.equal(r.status, 1)
  assert.equal(r.stdout, '')
  assert.deepEqual(JSON.parse(r.stderr), { status: 'stopped', code: c.code, receiptRequests: 0, addressRequests: 0, sessionStarted: false })
  for (const value of Object.values(c.env).filter(v => v && v.includes('synthetic'))) assert.ok(!r.stderr.includes(value))
})
