import { MAX_RECEIPT_BYTES, receiptImageHeader } from './image-input'
import { normalizeVisionResponse } from './vision-normalize'
import { parseVisionReceipt } from './short-receipt-parser'
import { receiptToReviewDraft } from '../capture/receipt-review-adapter'
export interface VisionLocalPorts {
  enabled: boolean
  approvedHash: string
  hash: (bytes: Uint8Array) => string
  consumed: () => Promise<boolean>
  reserve: () => Promise<void>
  recognize: (bytes: Uint8Array, signal: AbortSignal) => Promise<unknown>
}
export const VISION_JOB_MS = 25_000
const loopback = (host: string) => ['localhost','127.0.0.1','[::1]'].includes(host)
const reply = (code: string, status: number, extra = {}) => Response.json({code,...extra},{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
function local(request: Request) {
  try {
    const url=new URL(request.url), host=new URL(`${url.protocol}//${request.headers.get('host') ?? url.host}`)
    return loopback(url.hostname) && loopback(host.hostname) && (request.headers.get('origin')===host.origin || request.method==='GET' && !request.headers.get('origin') && request.headers.get('sec-fetch-site')==='same-origin') && request.headers.get('x-spendscape-local-vision')==='1' && (!request.headers.get('x-forwarded-host') || request.headers.get('x-forwarded-host')===host.host) && (!request.headers.get('x-forwarded-for') || ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.headers.get('x-forwarded-for')!))
  } catch { return false }
}
export function createVisionLocalHandler(ports: VisionLocalPorts, timeoutMs=VISION_JOB_MS) {
  return async(request: Request) => {
    if (!ports.enabled || !/^[a-f0-9]{64}$/.test(ports.approvedHash) || !local(request)) return reply('ocr-unavailable',503)
    if (request.method === 'GET') return reply(await ports.consumed() ? 'attempt-consumed' : 'local-vision-ready',200)
    if (request.method !== 'POST') return reply('request-invalid',400)
    const mime=request.headers.get('content-type')
    if (!mime || !['image/jpeg','image/png'].includes(mime)) return reply('image-format',400)
    const declared=request.headers.get('content-length')
    if (declared && (!/^\d+$/.test(declared) || Number(declared)>MAX_RECEIPT_BYTES)) return reply('image-size',413)
    const controller=new AbortController(), signal=AbortSignal.any([request.signal,controller.signal])
    const timer=setTimeout(()=>controller.abort(),timeoutMs)
    const reader=request.body?.getReader();let bytes:Uint8Array|null=null
    const chunks:Uint8Array[]=[];let length=0
    const abortRead=()=>{void reader?.cancel().catch(()=>{})}
    signal.addEventListener('abort',abortRead,{once:true})
    try {
      if (!reader || signal.aborted) throw new Error('cancelled')
      while (true) {
        const chunk=await reader.read();if(chunk.done)break
        chunks.push(chunk.value);length+=chunk.value.length
        if(length>MAX_RECEIPT_BYTES)throw new Error('image-size')
        if(signal.aborted)throw new Error('cancelled')
      }
      bytes=new Uint8Array(length);let offset=0
      for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;chunk.fill(0)}
      receiptImageHeader(bytes,mime)
      if(ports.hash(bytes)!==ports.approvedHash)throw new Error('image-not-approved')
      if(signal.aborted)throw new Error('cancelled')
      // Reservation is permanent even on auth/load/error/cancellation. Exactly
      // one future provider dispatch is permitted across processes/restarts.
      await ports.reserve()
      if(signal.aborted)throw new Error('cancelled')
      const raw=await new Promise<unknown>((resolve,reject)=>{
        const abort=()=>reject(new Error('cancelled'))
        signal.addEventListener('abort',abort,{once:true})
        ports.recognize(bytes!,signal).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort))
      })
      if(signal.aborted)throw new Error('cancelled')
      const parsed=parseVisionReceipt(normalizeVisionResponse(raw))
      receiptToReviewDraft(parsed.observations)
      if(signal.aborted)throw new Error('cancelled')
      return reply('vision-observations',200,parsed)
    } catch(error) {
      const message=error instanceof Error ? error.message : ''
      const allowed=['image-size','image-format','image-not-approved','attempt-consumed','authentication-failed','transport-failed','recognition-failed','recognition-empty','normalization-failed','layout-unsupported']
      const code=signal.aborted ? 'cancelled' : allowed.includes(message) ? message : 'ocr-invalid'
      return reply(code,code==='attempt-consumed'?409:signal.aborted?408:422)
    } finally {clearTimeout(timer);signal.removeEventListener('abort',abortRead);reader?.releaseLock();bytes?.fill(0);for(const chunk of chunks)chunk.fill(0)}
  }
}
