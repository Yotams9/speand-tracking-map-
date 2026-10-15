import { open, stat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { safeAttemptEvent, terminalStage, type AttemptDiagnostics, type AttemptEvent } from '../features/receipt-image/vision-attempt'
// Separate from the immutable one-call reservation. Never backfill old attempts.
export function visionAttemptRecord(path:string):AttemptDiagnostics {
  return {
    start:async()=>{
      const started=performance.now();let closed=false,count=1
      const file=await open(path,'wx',0o600)
      try {await file.writeFile(JSON.stringify(safeAttemptEvent('reserved',0))+'\n');await file.sync();const dir=await open(dirname(path),'r');try{await dir.sync()}finally{await dir.close()}}finally{await file.close()}
      let queue=Promise.resolve()
      return {emit:(stage,metadata)=>{
        queue=queue.then(async()=>{
          if(closed)return
          if(count>=16)throw new Error('diagnostics-unavailable')
          const event=safeAttemptEvent(stage,performance.now()-started,metadata)
          const target=await open(path,'a');try{await target.writeFile(JSON.stringify(event)+'\n');await target.sync()}finally{await target.close()}
          count++;closed=terminalStage(stage)
        });return queue
      }}
    },
    status:async()=>{
      try {
        if((await stat(path)).size>8192)throw new Error('diagnostics-unavailable')
        const file=await open(path,'r');let text:string
        try {const bytes=Buffer.alloc(8193);const {bytesRead}=await file.read(bytes,0,bytes.length,0);if(bytesRead>8192)throw new Error('diagnostics-unavailable');text=bytes.subarray(0,bytesRead).toString('utf8')}finally{await file.close()}
        const lines=text.trim().split('\n');if(lines.length>16)throw new Error('diagnostics-unavailable')
        const events:AttemptEvent[]=lines.map(line=>{const v=JSON.parse(line);if(!Number.isInteger(v.elapsedMs)||v.elapsedMs<0||v.elapsedMs>60000)throw new Error('diagnostics-unavailable');const safe=safeAttemptEvent(v.stage,v.elapsedMs,v);if(JSON.stringify(safe)!==JSON.stringify(v))throw new Error('diagnostics-unavailable');return safe})
        if(events[0]?.stage!=='reserved')throw new Error('diagnostics-unavailable')
        const last=events.at(-1)!.stage
        return {version:1,state:last==='review-response-complete'?'complete':last==='failure'?'failed':last==='interrupted'?'interrupted':'incomplete',events}
      }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw new Error('diagnostics-unavailable')}
    },
  }
}
