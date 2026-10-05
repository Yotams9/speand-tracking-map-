export type VisionSend = (url:string, init:RequestInit)=>Promise<Response>
// Injectable transport: tests never read credentials or reach a network.
// Native server wiring is the only caller with gcloud/fetch capabilities.
export function createVisionTransport(tokenFor:(signal:AbortSignal)=>Promise<string>,send:VisionSend) {
  return async(bytes:Uint8Array,signal:AbortSignal):Promise<unknown>=>{
    let token:string|null=await tokenFor(signal),body:string|null=null
    try {
      if(signal.aborted)throw new Error('cancelled')
      body=JSON.stringify({requests:[{image:{content:Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength).toString('base64')},features:[{type:'DOCUMENT_TEXT_DETECTION'}]}]})
      const response=await send('https://vision.googleapis.com/v1/images:annotate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'x-goog-user-project':'spendscape-receipt-benchmark'},body,signal,redirect:'error',cache:'no-store'})
      token=null;body=null
      if(!response.ok){await response.body?.cancel();throw new Error('transport-failed')}
      const reader=response.body?.getReader();if(!reader)throw new Error('recognition-empty')
      let text='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true})
      try {
        while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2*1024*1024){await reader.cancel();throw new Error('normalization-failed')};text+=decoder.decode(part.value,{stream:true});part.value.fill(0)}
        text+=decoder.decode();if(signal.aborted)throw new Error('cancelled')
        return JSON.parse(text)
      } finally {text='';reader.releaseLock()}
    } finally {token=null;body=null}
  }
}
