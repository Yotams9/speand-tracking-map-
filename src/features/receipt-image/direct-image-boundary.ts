import {receiptFailureFrom} from './receipt-failure'
import {MAX_RECEIPT_BYTES,receiptImageHeader} from './image-input'
import {directResponse} from './direct-image-contract'
import type {ReceiptObservations} from '../capture/receipt-review-adapter'
import type {AttemptDiagnostics,AttemptEmit,AttemptSession} from './vision-attempt'
export const DIRECT_JOB_MS=45_000
export interface DirectSlot { diagnostics:AttemptDiagnostics; consumed:()=>Promise<boolean>; reserve:()=>Promise<void> }
export interface DirectPorts {
  enabled:boolean; fictionalQa:boolean
  hash:(bytes:Uint8Array)=>string
  slot:(hash:string,request:Request)=>Promise<DirectSlot|null>
  status:()=>Promise<unknown>
  recognize:(bytes:Uint8Array,mime:string,signal:AbortSignal,emit:AttemptEmit,request:Request)=>Promise<unknown>
}
const loopback=(name:string)=>['localhost','127.0.0.1','[::1]'].includes(name)
export function directLocal(request:Request) {
  try {
    const url=new URL(request.url),host=new URL(`${url.protocol}//${request.headers.get('host')??url.host}`)
    // Next reconstructs the server URL with localhost even for a 127.0.0.1
    // request. Require a loopback host, the same port and exact browser Origin.
    return loopback(url.hostname)&&loopback(host.hostname)&&host.port===url.port&&
      (request.headers.get('origin')===host.origin || request.method==='GET'&&!request.headers.get('origin')&&request.headers.get('sec-fetch-site')==='same-origin')&&
      request.headers.get('x-spendscape-local-gemini')==='1'&&
      (!request.headers.get('x-forwarded-host')||request.headers.get('x-forwarded-host')===host.host)&&
      (!request.headers.get('x-forwarded-for')||['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.headers.get('x-forwarded-for')!))
  }catch{return false}
}
const reply=(code:string,status:number,extra={})=>Response.json({code,...extra},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
export function createDirectHandler(ports:DirectPorts,timeoutMs=DIRECT_JOB_MS,decode:(raw:unknown)=>ReceiptObservations=directResponse) {
  return async(request:Request)=>{
    if(!ports.enabled || !directLocal(request))return reply('ocr-unavailable',503)
    if(request.method==='GET')try{return reply('local-gemini-ready',200,{mode:ports.fictionalQa?'fictional-qa':'native',attempts:await ports.status()})}catch{return reply('diagnostics-unavailable',503)}
    if(request.method!=='POST')return reply('request-invalid',400)
    const mime=request.headers.get('content-type')
    if(!mime || !['image/jpeg','image/png'].includes(mime))return reply('image-format',400)
    const length=request.headers.get('content-length')
    if(length&&(!/^\d+$/.test(length)||Number(length)>MAX_RECEIPT_BYTES))return reply('image-size',413)
    const controller=new AbortController(),signal=AbortSignal.any([request.signal,controller.signal])
    const timer=setTimeout(()=>controller.abort(),timeoutMs),reader=request.body?.getReader()
    let bytes:Uint8Array|null=null,attempt:AttemptSession|null=null,slot:DirectSlot|null=null
    const chunks:Uint8Array[]=[]
    const abortRead=()=>{void reader?.cancel().catch(()=>{})};signal.addEventListener('abort',abortRead,{once:true})
    try {
      if(!reader||signal.aborted)throw new Error('cancelled')
      let count=0
      while(true){const c=await reader.read();if(c.done)break;chunks.push(c.value);count+=c.value.length;if(count>MAX_RECEIPT_BYTES)throw new Error('image-size');if(signal.aborted)throw new Error('cancelled')}
      bytes=new Uint8Array(count);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;c.fill(0)}
      receiptImageHeader(bytes,mime)
      slot=await ports.slot(ports.hash(bytes),request);if(!slot)throw new Error('image-not-approved')
      if(signal.aborted)throw new Error('cancelled')
      await slot.reserve()
      try{attempt=await slot.diagnostics.start()}catch{throw new Error('diagnostics-unavailable')}
      if(signal.aborted)throw new Error('cancelled')
      const raw=await new Promise<unknown>((resolve,reject)=>{
        const abort=()=>reject(new Error('cancelled'));signal.addEventListener('abort',abort,{once:true})
        ports.recognize(bytes!,mime,signal,attempt!.emit,request).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort))
      })
      if(signal.aborted)throw new Error('cancelled')
      await attempt.emit('parsing-start')
      // No OCR geometry normalizer/parser is reachable here.
      const observations=decode(raw)
      if(new TextEncoder().encode(JSON.stringify(observations)).length>64_000)throw new Error('ocr-invalid')
      await attempt.emit('parsing-complete')
      if(signal.aborted)throw new Error('cancelled')
      const response=reply('direct-observations',200,{observations})
      await attempt.emit('review-response-complete')
      return response
    }catch(error){
      const message=error instanceof Error?error.message:''
      const allowed=['image-format','image-size','image-not-approved','attempt-consumed','pilot-stopped','pilot-wait','authentication-failed','transport-failed','recognition-failed','diagnostics-unavailable']
      const code=signal.aborted?'cancelled':allowed.includes(message)?message:'ocr-invalid'
      const detail=signal.aborted?undefined:receiptFailureFrom(error)
      if(attempt)try{await attempt.emit(signal.aborted?'interrupted':'failure',{code,...(detail?{receiptFailure:detail}:{})})}catch{/* Incomplete durable records block further calls. */}
      // Safe HTTP information can be inspected even after browser disconnect.
      let httpStatus:number|undefined,googleStatus:string|undefined
      try{const events=(await slot?.diagnostics.status())?.events;const http=events?.filter(e=>e.stage==='provider-http').at(-1);httpStatus=http?.httpStatus;googleStatus=http?.googleStatus}catch{}
      return reply(code,['attempt-consumed','pilot-stopped','pilot-wait'].includes(code)?409:signal.aborted?408:422,{...(httpStatus!==undefined?{httpStatus}:{}),...(googleStatus?{googleStatus}:{}),...(detail?{receiptFailure:detail}:{})})
    }finally{clearTimeout(timer);signal.removeEventListener('abort',abortRead);reader?.releaseLock();bytes?.fill(0);for(const c of chunks)c.fill(0)}
  }
}
