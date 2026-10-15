import {DIRECT_MODEL,DIRECT_RESPONSE_BYTES,directRequest} from './direct-image-contract'
import {safeAttemptEvent,type AttemptEmit} from './vision-attempt'
import {GEMINI_ERROR_BYTES,projectGeminiError,unknownGeminiError} from './gemini-error-diagnostic'
class ResponseSizeError extends Error { constructor(){super('ocr-invalid')} }
export async function boundedDirectJson(response:Response,signal:AbortSignal,maximumBytes=DIRECT_RESPONSE_BYTES):Promise<unknown> {
  const reader=response.body?.getReader();if(!reader)throw new Error('ocr-invalid')
  const decoder=new TextDecoder('utf-8',{fatal:true});let size=0,body=''
  const abort=()=>{void reader.cancel().catch(()=>{})};signal.addEventListener('abort',abort,{once:true})
  try {
    while(true){if(signal.aborted)throw new Error('cancelled');const c=await reader.read();if(c.done)break;size+=c.value.length;if(size>maximumBytes){await reader.cancel();throw new ResponseSizeError()}body+=decoder.decode(c.value,{stream:true})}
    if(signal.aborted)throw new Error('cancelled');body+=decoder.decode();return JSON.parse(body)
  }finally{signal.removeEventListener('abort',abort);reader.releaseLock();body=''}
}
export function createDirectTransport(key:()=>string,send:typeof fetch) {
  return async(bytes:Uint8Array,mime:string,signal:AbortSignal,emit:AttemptEmit)=>{
    await emit('authentication-start')
    let credential=key(), body=''
    try {
      if(!/^[A-Za-z0-9_.-]{20,200}$/.test(credential) || signal.aborted)throw new Error('authentication-failed')
      await emit('authentication-complete')
      body=JSON.stringify(directRequest(mime,Buffer.from(bytes).toString('base64')))
      if(signal.aborted)throw new Error('cancelled')
      await emit('dispatch-initiated')
      if(signal.aborted)throw new Error('cancelled')
      let response:Response
      try {response=await send(`https://generativelanguage.googleapis.com/v1beta/models/${DIRECT_MODEL}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':credential},body,signal,redirect:'error',cache:'no-store'})}catch{throw new Error(signal.aborted?'cancelled':'transport-failed')}
      if(signal.aborted){await response.body?.cancel();throw new Error('cancelled')}
      // HTTP status is durable even if the error body is malformed/oversized.
      await emit('provider-http',{httpStatus:response.status})
      if(!response.ok){
        let metadata:unknown
        try {
          const raw=await boundedDirectJson(response,signal,GEMINI_ERROR_BYTES)
          const error=(raw as {error?:{code?:unknown;status?:unknown}})?.error
          metadata={httpStatus:response.status,googleCode:error?.code,googleStatus:error?.status,geminiError:projectGeminiError(raw)}
        }catch(error){
          if(signal.aborted)throw new Error('cancelled')
          metadata={httpStatus:response.status,geminiError:unknownGeminiError(error instanceof ResponseSizeError?'oversized':'malformed')}
        }
        if(signal.aborted)throw new Error('cancelled')
        // Commit only the pure projection. Recording failure is terminal; it
        // cannot trigger another request or leak a raw provider body.
        await emit('provider-http',safeAttemptEvent('provider-http',0,metadata))
        throw new Error('recognition-failed')
      }
      return await boundedDirectJson(response,signal)
    }finally{credential='';body=''}
  }
}
