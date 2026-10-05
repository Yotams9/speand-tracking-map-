import 'server-only'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { createVisionLocalHandler } from '../features/receipt-image/vision-local-boundary'
import { visionReservation } from './vision-local-reservation'
import { createVisionTransport } from '../features/receipt-image/vision-transport'
const project='spendscape-receipt-benchmark'
const reservation=visionReservation(join(process.cwd(),'artifacts','receipt-vision-local-capture','attempt-one.reservation.json'))
const enabled=process.env.SPENDSCAPE_RECEIPT_VISION_LOCAL==='1' && process.env.SPENDSCAPE_RECEIPT_VISION_READY==='1' && !process.env.VERCEL && !process.env.CI
function accessToken(signal:AbortSignal):Promise<string> {
  return new Promise((resolve,reject)=>{
    execFile('/Users/testing.user/google-cloud-sdk/bin/gcloud',['auth','print-access-token','--project',project,'--verbosity=none'],{signal,timeout:8_000,maxBuffer:8_192,encoding:'utf8',env:{...process.env,CLOUDSDK_CORE_LOG_HTTP:'false',CLOUDSDK_CORE_VERBOSITY:'none',CLOUDSDK_CORE_DISABLE_USAGE_REPORTING:'true'}},(error,stdout)=>{
      const token=stdout.trim()
      if(error || signal.aborted || token.length<20 || token.length>4096 || !/^[-A-Za-z0-9._~+/]+=*$/.test(token))reject(new Error('authentication-failed'))
      else resolve(token)
    })
  })
}
const recognize=createVisionTransport(accessToken,(url,init)=>fetch(url,init))
export const handleVisionLocal=createVisionLocalHandler({enabled,approvedHash:process.env.SPENDSCAPE_RECEIPT_VISION_IMAGE_SHA256??'',hash:bytes=>createHash('sha256').update(bytes).digest('hex'),...reservation,recognize})
