import type { AttemptEmit } from './vision-attempt'
export type VisionSend = (url:string, init:RequestInit)=>Promise<Response>
// Injectable transport: tests never read credentials or reach a network.
// Native server wiring is the only caller with gcloud/fetch capabilities.
export function createVisionTransport(tokenFor:(signal:AbortSignal)=>Promise<string>,send:VisionSend) {
  return async(bytes:Uint8Array,signal:AbortSignal,emit:AttemptEmit=async()=>{}):Promise<unknown>=>{
    await emit('authentication-start')
    let token:string|null=await tokenFor(signal),body:string|null=null
    try {
      if(signal.aborted)throw new Error('cancelled')
      await emit('authentication-complete')
      body=JSON.stringify({requests:[{image:{content:Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength).toString('base64')},features:[{type:'DOCUMENT_TEXT_DETECTION'}]}]})
      await emit('dispatch-initiated')
      if(signal.aborted)throw new Error('cancelled')
      const response=await send('https://vision.googleapis.com/v1/images:annotate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'x-goog-user-project':'spendscape-receipt-benchmark'},body,signal,redirect:'error',cache:'no-store'})
      token=null;body=null
      await emit('provider-http',{httpStatus:response.status})
      if(!response.ok){
        const errorReader=response.body?.getReader();let text='',size=0
        try {
          if(errorReader)while(true){const part=await errorReader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096){await errorReader.cancel();text='';break};text+=new TextDecoder().decode(part.value);part.value.fill(0)}
          if(text){try{const raw=JSON.parse(text);await emit('provider-http',{httpStatus:response.status,googleCode:raw?.error?.code,googleStatus:raw?.error?.status})}catch{/* No provider message is retained. */}}
        }finally{text='';errorReader?.releaseLock()}
        throw new Error('transport-failed')
      }
      const reader=response.body?.getReader();if(!reader)throw new Error('recognition-empty')
      let text='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true})
      try {
        while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2*1024*1024){await reader.cancel();throw new Error('normalization-failed')};text+=decoder.decode(part.value,{stream:true});part.value.fill(0)}
        text+=decoder.decode();if(signal.aborted)throw new Error('cancelled')
        const raw=JSON.parse(text)
        if(Array.isArray(raw?.responses) && raw.responses.length===1 && raw.responses[0]?.error)await emit('provider-http',{httpStatus:response.status,googleCode:raw.responses[0].error.code,googleStatus:raw.responses[0].error.status})
        return raw
      } finally {text='';reader.releaseLock()}
    } finally {token=null;body=null}
  }
}
