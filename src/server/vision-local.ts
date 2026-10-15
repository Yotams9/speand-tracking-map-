import 'server-only'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { visionAttemptRecord } from './vision-attempt-record'
import { visionNativeRunDirectory } from './vision-local-run'
import { fictionalShortOcr, visionResponse } from '../features/receipt-image/vision-fixtures'
import { createVisionLocalHandler } from '../features/receipt-image/vision-local-boundary'
import { visionReservation } from './vision-local-reservation'
import { createVisionTransport } from '../features/receipt-image/vision-transport'
const project='spendscape-receipt-benchmark'
const qaRequested=process.env.SPENDSCAPE_VISION_DIAGNOSTIC_QA==='1'
const qaRun=process.env.SPENDSCAPE_VISION_DIAGNOSTIC_QA_RUN??''
const qaValid=qaRequested && /^[a-z0-9_-]{8,64}$/.test(qaRun)
const nativeDirectory=visionNativeRunDirectory(process.env.SPENDSCAPE_RECEIPT_VISION_RUN)
const nativeRoot=nativeDirectory==='receipt-vision-local-validation-20261006-two'?join(process.cwd(),'artifacts','receipt-vision-local-validation-20261006-two'):nativeDirectory==='receipt-vision-local-validation-20261006-one'?join(process.cwd(),'artifacts','receipt-vision-local-validation-20261006-one'):join(process.cwd(),'artifacts','receipt-vision-local-capture')
const root=qaValid?join(process.cwd(),'artifacts','vision-diagnostics-qa',qaRun):nativeRoot
const reservation=visionReservation(join(root,'attempt-one.reservation.json'))
const diagnostics=visionAttemptRecord(join(root,'attempt-one.lifecycle.jsonl'))
const enabled=(qaRequested?qaValid:nativeDirectory!==null && process.env.SPENDSCAPE_RECEIPT_VISION_LOCAL==='1' && process.env.SPENDSCAPE_RECEIPT_VISION_READY==='1') && !process.env.VERCEL && !process.env.CI
function accessToken(signal:AbortSignal):Promise<string> {
  return new Promise((resolve,reject)=>{
    execFile('/Users/testing.user/google-cloud-sdk/bin/gcloud',['auth','print-access-token','--project',project,'--verbosity=none'],{signal,timeout:8_000,maxBuffer:8_192,encoding:'utf8',env:{...process.env,CLOUDSDK_CORE_LOG_HTTP:'false',CLOUDSDK_CORE_VERBOSITY:'none',CLOUDSDK_CORE_DISABLE_USAGE_REPORTING:'true'}},(error,stdout)=>{
      const token=stdout.trim()
      if(error || signal.aborted || token.length<20 || token.length>4096 || !/^[-A-Za-z0-9._~+/]+=*$/.test(token))reject(new Error('authentication-failed'))
      else resolve(token)
    })
  })
}
// Explicit fictional QA has no credential or native transport capability.
const recognize=qaRequested?createVisionTransport(async()=> 'FICTIONAL_TOKEN',async()=>{const doc=fictionalShortOcr();if(qaValid&&process.env.SPENDSCAPE_VISION_INSPECTION_QA==='1')doc.words.push({text:'Fictional unassigned row',x:10,y:320,width:180,height:20});return Response.json(visionResponse(doc))}):createVisionTransport(accessToken,(url,init)=>fetch(url,init))
export const handleVisionLocal=createVisionLocalHandler({enabled,fictionalQa:qaValid,inspectionEnabled:process.env.SPENDSCAPE_RECEIPT_VISION_INSPECTION==='1',approvedHash:process.env.SPENDSCAPE_RECEIPT_VISION_IMAGE_SHA256??'',hash:bytes=>createHash('sha256').update(bytes).digest('hex'),...reservation,diagnostics,recognize})
