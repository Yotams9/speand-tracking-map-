import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readiness, accessMaterial, windowConfig, previewVariable, redisPair } from './release-config.mjs'
test('explicit existing-plan readiness and both private inputs required', () => {
  const args = '--prepare-private-preview --prepay-ready-confirmed --geoapify-free-two-confirmed --no-concurrent-use --auto-reload-off'.split(' ')
  const env = { GEMINI_API_KEY: 'synthetic_'.repeat(5), GEOAPIFY_API_KEY: 'fictional_'.repeat(4) }
  readiness(args, env)
  for (const bad of [args.slice(1), [...args, '--retry']]) assert.throws(() => readiness(bad, env), /readiness-flags-required/)
  for (const bad of [{ ...env, CI: '1' }, { ...env, GEMINI_API_KEY: '' }, { ...env, GEOAPIFY_API_KEY: '' }]) assert.throws(() => readiness(args, bad))
})
test('separate 256-bit role capabilities with hashes only in server policy', () => {
  const a = accessMaterial(), b = accessMaterial()
  assert.match(a.owner, /^[a-f0-9]{64}$/); assert.notEqual(a.owner, a.lecturer); assert.notEqual(a.release, b.release)
  const p = windowConfig(a, 'https://spendscape-college-preview-git-release-sk-dev3.vercel.app', 1000000)
  assert.equal(Date.parse(p.SPENDSCAPE_DEMO_EXPIRES_AT)-Date.parse(p.SPENDSCAPE_DEMO_START_AT), 7200000)
  assert.equal(Date.parse(p.SPENDSCAPE_DEMO_START_AT), 1600000)
  assert.equal(p.SPENDSCAPE_DEMO_RECEIPT_LIMIT, '2'); assert.equal(p.SPENDSCAPE_DEMO_ADDRESS_LIMIT, '2'); assert.equal(p.SPENDSCAPE_DEMO_CEILING_MICRO_USD, '100000')
  assert.ok(!JSON.stringify(p).includes(a.owner)); assert.ok(!JSON.stringify(p).includes(a.lecturer))
})
test('reject unrelated or unsafe origins and malformed policy', () => {
  const a = accessMaterial()
  for (const u of ['http://spendscape-college-preview-qa.vercel.app', 'https://evil.test', 'https://spendscape-college-preview-qa.vercel.app/?code=x']) assert.throws(() => windowConfig(a, u))
  assert.throws(() => windowConfig({ ...a, ownerHash: a.lecturerHash }, 'https://spendscape-college-preview-qa.vercel.app'))
})
test('all configuration is sensitive and scoped to Preview only; source freeze separately requires the release branch', () => {
  const v = previewVariable('GEMINI_API_KEY', 'synthetic-key')
  assert.deepEqual(v.target, ['preview']); assert.ok(!('gitBranch' in v)); assert.equal(v.type, 'sensitive')
  assert.throws(() => previewVariable('NEXT_PUBLIC_KEY', 'secret'))
})
test('reuse only an existing HTTPS Upstash pair without URL credentials', () => {
  const t = 'synthetic-token'.repeat(4)
  assert.equal(redisPair('https://synthetic.upstash.io', t).KV_REST_API_TOKEN, t)
  for (const u of ['http://synthetic.upstash.io', 'https://synthetic.upstash.io.evil.test', 'https://user:secret@synthetic.upstash.io', 'https://synthetic.upstash.io/?token=x']) assert.throws(() => redisPair(u, t))
})


test('fixed readiness reasons retain exact key validation without trimming', () => {
  const args = '--prepare-private-preview --prepay-ready-confirmed --geoapify-free-two-confirmed --no-concurrent-use --auto-reload-off'.split(' ')
  const env = { GEMINI_API_KEY: 'synthetic_'.repeat(5), GEOAPIFY_API_KEY: 'fictional_'.repeat(4) }
  for (const name of ['CI', 'VERCEL']) assert.throws(() => readiness(args, { ...env, [name]: '1' }), /local-environment-required/)
  for (const [name, reason] of [['GEMINI_API_KEY', 'gemini-key-input-invalid'], ['GEOAPIFY_API_KEY', 'geoapify-key-input-invalid']]) {
    for (const value of ['', 'short', env[name] + ' ', '\n' + env[name], '"' + env[name] + '"', 'sensitive-value-\u05d0', 'x'.repeat(201)]) {
      assert.throws(() => readiness(args, { ...env, [name]: value }), e => e.message === reason && (value === '' || !e.message.includes(value)))
    }
  }
})
