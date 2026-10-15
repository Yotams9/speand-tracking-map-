// Private CLI transport. Never print command results, environment or API bodies.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT, ORIGINAL_PROJECT, TEAM, BRANCH, previewVariable, redisPair, sha } from './release-config.mjs'
const exec = promisify(execFile)
export const CLI = existsSync('/Users/testing.user/.npm/_npx/59776437f344dde1/node_modules/.bin/vercel') ? '/Users/testing.user/.npm/_npx/59776437f344dde1/node_modules/.bin/vercel' : 'vercel'
export const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !/API_KEY|REST_TOKEN|NODE_DEBUG|NODE_OPTIONS|DEBUG/.test(k)))
export async function api(path, method = 'GET', body) {
  let folder
  try {
    const args = ['api', path + (path.includes('?') ? '&' : '?') + 'teamId=' + TEAM, '--method', method]
    if (body) { folder = await mkdtemp(join(tmpdir(), 'spendscape-private-')); const file = join(folder, 'body.json'); await writeFile(file, JSON.stringify(body), { mode: 0o600 }); args.push('--input', file) }
    const r = await exec(CLI, args, { env: cleanEnv(), timeout: 30000, maxBuffer: 2_000_000 })
    try { return JSON.parse(r.stdout) } finally { r.stdout = ''; r.stderr = '' }
  } catch { throw Error('vercel-configuration-failed') }
  finally { if (folder) await rm(folder, { recursive: true, force: true }) }
}
export async function verifyProject() {
  const p = await api('/v9/projects/' + PROJECT)
  const original = await api('/v9/projects/' + ORIGINAL_PROJECT)
  if (p.id !== PROJECT || p.accountId !== TEAM || p.paused === true || !p.ssoProtection || p.autoAssignCustomDomains !== false || p.targets?.production || original.paused !== true) throw Error('protected-project-unverified')
}
export async function existingRedis() {
  const list = await api('/v10/projects/' + ORIGINAL_PROJECT + '/env?decrypt=false')
  const pair = {}
  for (const key of ['KV_REST_API_URL', 'KV_REST_API_TOKEN']) {
    const rows = list.envs.filter(e => e.key === key && e.target.includes('production'))
    if (rows.length !== 1) throw Error('existing-redis-unverified')
    const entry = await api('/v1/projects/' + ORIGINAL_PROJECT + '/env/' + rows[0].id)
    pair[key] = entry.value
    entry.value = ''
  }
  return redisPair(pair.KV_REST_API_URL, pair.KV_REST_API_TOKEN)
}
export async function configure(values) {
  for (const [key, value] of Object.entries(values)) await api('/v10/projects/' + PROJECT + '/env?upsert=true', 'POST', previewVariable(key, value))
}
export async function verifyFreeze(root) {
  const freeze = JSON.parse(await readFile(join(root, 'artifacts/hosted-completion-20261015/source-freeze.json'), 'utf8'))
  const branch = (await exec('git', ['branch','--show-current'], { cwd: root })).stdout.trim()
  const head = (await exec('git', ['rev-parse','HEAD'], { cwd: root })).stdout.trim()
  if (branch !== BRANCH || head !== freeze.head) throw Error('source-freeze-mismatch')
  for (const [path, expected] of Object.entries(freeze.files)) if (sha(await readFile(join(root, path))) !== expected) throw Error('source-freeze-mismatch')
  return head
}
