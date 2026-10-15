// User-run private setup only. No inference, geocoding or quota initialization.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, join } from 'node:path'
import { verifyProjectKey } from '../receipt-capture/key-project.mjs'
import { readiness, accessMaterial, PREFIX } from './release-config.mjs'
import { cleanEnv, verifyProject, existingRedis, configure, verifyFreeze } from './release-private.mjs'
const exec = promisify(execFile), root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
let token = '', gemini = process.env.GEMINI_API_KEY ?? '', geo = process.env.GEOAPIFY_API_KEY ?? ''
try {
  readiness(process.argv.slice(2), process.env)
  const head = await verifyFreeze(root)
  for (const name of ['prepared.private.json','access-codes.private.txt','activation.private.json']) {
    try { await stat(join(root,PREFIX,name)); throw Error('preparation-already-exists') } catch(e) { if(e.code !== 'ENOENT') throw e }
  }
  await verifyProject()
  const auth = await exec('gcloud', ['auth','print-access-token','--quiet','--verbosity=none'], { env: { ...cleanEnv(), CLOUDSDK_CORE_LOG_HTTP:'false', CLOUDSDK_CORE_VERBOSITY:'none' }, timeout:15000, maxBuffer:65536 })
  token = auth.stdout.trim(); auth.stdout = ''; auth.stderr = ''
  const verified = await verifyProjectKey(gemini, token, fetch, AbortSignal.timeout(15000)); token = ''
  const redis = await existingRedis(), material = accessMaterial()
  const privateRecord = { head, release:material.release, ownerHash:material.ownerHash, lecturerHash:material.lecturerHash, digestSalt:material.digestSalt }
  await writeFile(join(root,PREFIX,'prepared.private.json'), JSON.stringify(privateRecord), { flag:'wx', mode:0o600 })
  await writeFile(join(root,PREFIX,'access-codes.private.txt'), `PRIVATE — do not paste into chat or a URL.\nOwner access code:\n${material.owner}\n\nLecturer access code:\n${material.lecturer}\n\nBoth share one two-hour session and request limits. Provider window is NOT started yet.\n`, {flag:'wx',mode:0o600})
  await configure({ SPENDSCAPE_HOSTED_MODE:'protected-demo', ...redis, GEMINI_API_KEY:gemini, GEOAPIFY_API_KEY:geo,
    SPENDSCAPE_RECEIPT_PROJECT:'spendscape-receipt-benchmark',SPENDSCAPE_RECEIPT_PROJECT_NUMBER:'376401338717',
    SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256:verified.digest,SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED:'1',SPENDSCAPE_ADDRESS_FREE_READY:'1' })
  for(const key of Object.keys(redis))redis[key]=''
  material.owner='';material.lecturer=''
  console.log(JSON.stringify({status:'private-preview-prepared',keyMatch:true,projectNumber:'376401338717',receiptRequests:0,addressRequests:0,sessionStarted:false}))
} catch(e) {
  const codes=['private-readiness-required','preparation-already-exists','source-freeze-mismatch','protected-project-unverified','existing-redis-unverified','key-project-unverified','vercel-configuration-failed']
  console.error(JSON.stringify({status:'stopped',code:codes.includes(e?.message)?e.message:'private-preparation-failed',receiptRequests:0,addressRequests:0,sessionStarted:false}));process.exitCode=1
} finally { token='';gemini='';geo='';delete process.env.GEMINI_API_KEY;delete process.env.GEOAPIFY_API_KEY }
