// Administrative preparation only. Does not initialize quota or call providers.
import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PREFIX, windowConfig } from './release-config.mjs'
import { verifyFreeze, verifyProject, configure } from './release-private.mjs'
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
try {
  if (process.argv.length !== 4 || process.argv[2] !== '--prepare-one-window' || process.env.VERCEL || process.env.CI) throw Error('activation-approval-required')
  const head = await verifyFreeze(root); await verifyProject()
  const file = join(root,PREFIX,'prepared.private.json')
  if ((await stat(file)).mode & 0o077) throw Error('private-file-invalid')
  const prepared = JSON.parse(await readFile(file,'utf8'))
  if (prepared.head !== head) throw Error('source-freeze-mismatch')
  const env = windowConfig(prepared, process.argv[3])
  // Exclusive marker precedes configuration. A partial failure is never reset.
  await writeFile(join(root,PREFIX,'activation.private.json'), JSON.stringify({head,env}), {flag:'wx',mode:0o600})
  await configure(env)
  console.log(JSON.stringify({status:'window-configured-awaiting-ready-preview-and-quota',startsAt:env.SPENDSCAPE_DEMO_START_AT,expiresAt:env.SPENDSCAPE_DEMO_EXPIRES_AT,receiptRequests:0,addressRequests:0,quotaInitialized:false}))
} catch(e) {
  const codes=['activation-approval-required','private-file-invalid','source-freeze-mismatch','protected-project-unverified','release-policy-invalid','vercel-configuration-failed']
  console.error(JSON.stringify({status:'stopped',code:e.code==='EEXIST'?'activation-already-exists':codes.includes(e.message)?e.message:'activation-failed'}));process.exitCode=1
}
