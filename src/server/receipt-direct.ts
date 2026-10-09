import 'server-only'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {createDirectHandler} from '../features/receipt-image/direct-image-boundary'
import {createDirectTransport} from '../features/receipt-image/direct-image-transport'
import {fictionalDirectResponse} from '../features/receipt-image/direct-image-contract'
import {directPilot,DIRECT_IMAGES} from './direct-image-pilot'
import {DIRECT_RECOVERY_RUN,directRecoveryReady,directRecoveryPilot,verifiedRecoveryKey} from './direct-image-recovery'
import {DIRECT_DIAGNOSTIC_RUN,directDiagnosticReady,directDiagnosticPilot} from './direct-image-diagnostic'
const qa=process.env.SPENDSCAPE_DIRECT_IMAGE_QA==='1',qaRun=process.env.SPENDSCAPE_DIRECT_IMAGE_QA_RUN??''
const qaEnabled=qa&&/^[a-z0-9_-]{8,64}$/.test(qaRun)
// Native readiness is intentionally absent until the user establishes the
// selected key project's actual Free tier/model/quota. No credential read at
// module initialization or during capability/status requests.
const recovery=process.env.SPENDSCAPE_DIRECT_IMAGE_RUN===DIRECT_RECOVERY_RUN
const diagnostic=process.env.SPENDSCAPE_DIRECT_IMAGE_RUN===DIRECT_DIAGNOSTIC_RUN
const ready=process.env.SPENDSCAPE_DIRECT_IMAGE_RUN ? diagnostic?directDiagnosticReady(process.env):directRecoveryReady(process.env) : process.env.SPENDSCAPE_DIRECT_IMAGE_LOCAL==='1'&&process.env.SPENDSCAPE_DIRECT_IMAGE_FREE_CONFIRMED==='1'&&process.env.SPENDSCAPE_DIRECT_IMAGE_QUOTA_CONFIRMED==='1'&&/^[a-z][a-z0-9-]{4,62}$/.test(process.env.SPENDSCAPE_DIRECT_IMAGE_PROJECT??'')
const enabled=(qa?qaEnabled:ready)&&!process.env.VERCEL&&!process.env.CI&&(!diagnostic||ready)
const nativeRoot=join(process.cwd(),'artifacts','receipt-direct-image-20261008-two')
const qaRoot=join(tmpdir(),'spendscape-direct-image-mock-'+qaRun)
const pilot=directPilot(qaEnabled?qaRoot:nativeRoot,qaEnabled?0:60_000)
const recoveryPilot=directRecoveryPilot(join(process.cwd(),'artifacts','receipt-direct-image-'+DIRECT_RECOVERY_RUN),nativeRoot)
const diagnosticPilot=directDiagnosticPilot(join(process.cwd(),'artifacts','receipt-direct-image-diagnostic-20261009-rejected-field-one'),{
  original:join(process.cwd(),'artifacts','receipt-direct-image-20261008-two'),
  recovery:join(process.cwd(),'artifacts','receipt-direct-image-recovery-20261008-prepay-one'),
})
const recognize=createDirectTransport(()=>recovery||diagnostic?verifiedRecoveryKey(process.env.GEMINI_API_KEY??'',process.env.SPENDSCAPE_DIRECT_IMAGE_VERIFIED_KEY_SHA256):process.env.GEMINI_API_KEY??'',(url,options)=>fetch(url,options))
export const handleReceiptDirect=createDirectHandler({enabled,fictionalQa:qaEnabled,hash:bytes=>createHash('sha256').update(bytes).digest('hex'),
  // Mock requests still use valid image intake but never real-image hashes,
  // credentials or native fetch. Their two permanent slots are isolated.
  slot:async(hash,request)=>diagnostic?diagnosticPilot.slot(hash):recovery?recoveryPilot.slot(hash):pilot.slot(qaEnabled?DIRECT_IMAGES[request.headers.get('x-spendscape-direct-fixture')==='fifteen'?1:0]:hash),
  status:diagnostic?diagnosticPilot.status:recovery?recoveryPilot.status:pilot.status,
  recognize:qa?async(bytes,mime,signal,emit,request)=>{
    const kind=request.headers.get('x-spendscape-direct-fixture')==='fifteen'?'fifteen':'one'
    return createDirectTransport(()=> 'FICTIONAL_KEY_NOT_A_CREDENTIAL',async()=>Response.json(fictionalDirectResponse(kind)))(bytes,mime,signal,emit)
  }:recognize,
})
