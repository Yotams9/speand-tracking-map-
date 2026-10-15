import 'server-only'
import {createHash} from 'node:crypto'
import {createDirectHandler, directLocal} from '../features/receipt-image/direct-image-boundary'
import {structuredRequest, STRUCTURED_ENDPOINT} from '../features/receipt-image/structured-image-contract'
import {captureResponse,boundedCaptureJson} from '../features/receipt-image/structured-capture-response'
import {boundedDirectJson} from '../features/receipt-image/direct-image-transport'
import {GEMINI_ERROR_BYTES, projectGeminiError, unknownGeminiError} from '../features/receipt-image/gemini-error-diagnostic'
import {safeAttemptEvent, type AttemptEmit} from '../features/receipt-image/vision-attempt'
import {capturePricingReady, captureSession} from './receipt-capture-session'

// Operational path only. No historical pilot, image freeze or namespace is altered.
export function captureReady(env:NodeJS.ProcessEnv,now=new Date()) {
  return capturePricingReady(now) && env.SPENDSCAPE_RECEIPT_CAPTURE==='native' &&
    /^[a-f0-9]{32}$/.test(env.SPENDSCAPE_RECEIPT_SESSION??'') &&
    env.SPENDSCAPE_RECEIPT_PROJECT==='spendscape-receipt-benchmark' &&
    env.SPENDSCAPE_RECEIPT_PROJECT_NUMBER==='376401338717' &&
    /^[a-f0-9]{64}$/.test(env.SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256??'') &&
    env.SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED==='1' && !env.VERCEL && !env.CI && !env.SPENDSCAPE_RECEIPT_QA
}
export function captureTransport(key:()=>string,send:typeof fetch) {
  return async(bytes:Uint8Array,mime:string,signal:AbortSignal,emit:AttemptEmit)=>{
    let credential='',body=''
    try {
      await emit('authentication-start');credential=key()
      if(!/^[A-Za-z0-9_.-]{20,200}$/.test(credential))throw Error('authentication-failed')
      await emit('authentication-complete')
      // Exactly the successful JSON mode builder. No geometry parser/schema/tool.
      body=JSON.stringify(structuredRequest(mime,Buffer.from(bytes).toString('base64')))
      if(signal.aborted)throw Error('cancelled')
      await emit('dispatch-initiated')
      if(signal.aborted)throw Error('cancelled')
      let response:Response
      try{response=await send(STRUCTURED_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':credential},body,signal,redirect:'error',cache:'no-store'})}catch{throw Error(signal.aborted?'cancelled':'transport-failed')}
      if(signal.aborted){await response.body?.cancel();throw Error('cancelled')}
      await emit('provider-http',{httpStatus:response.status})
      if(!response.ok){
        let metadata:unknown
        try{const raw=await boundedDirectJson(response,signal,GEMINI_ERROR_BYTES);const e=(raw as {error?:{code?:unknown;status?:unknown}})?.error;metadata={httpStatus:response.status,googleCode:e?.code,googleStatus:e?.status,geminiError:projectGeminiError(raw)}}
        catch{if(signal.aborted)throw Error('cancelled');metadata={httpStatus:response.status,geminiError:unknownGeminiError('malformed')}}
        await emit('provider-http',safeAttemptEvent('provider-http',0,metadata));throw Error('recognition-failed')
      }
      return await boundedCaptureJson(response,signal)
    }finally{credential='';body=''}
  }
}
const reply=(code:string,status:number,extra={})=>Response.json({code,...extra},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
export function createCaptureHandler(env:NodeJS.ProcessEnv,send:typeof fetch,root=process.cwd(),timeoutMs=45_000,now=()=>Date.now()) {
  // QA transport lives in a separate module; an unknown mode cannot select it.
  return async(request:Request)=>{
    if(!captureReady(env,new Date(now()))||!directLocal(request))return reply('ocr-unavailable',503)
    const session=captureSession(root,env.SPENDSCAPE_RECEIPT_SESSION!,now)
    if(request.method==='GET')try{return reply('local-capture-ready',200,{mode:'native',session:await session.status()})}catch{return reply('diagnostics-unavailable',503)}
    const recognize=captureTransport(()=>{
      const key=env.GEMINI_API_KEY??''
      if(createHash('sha256').update(key).digest('hex')!==env.SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256)throw Error('authentication-failed')
      return key
    },send)
    return createDirectHandler({enabled:true,fictionalQa:false,hash:b=>createHash('sha256').update(b).digest('hex'),slot:hash=>session.slot(hash),status:session.status,recognize},timeoutMs,captureResponse)(request)
  }
}
export const handleReceiptCapture=createCaptureHandler(process.env,(url,options)=>fetch(url,options))
