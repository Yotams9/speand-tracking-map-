import {mkdir,open,stat} from 'node:fs/promises'
import {join} from 'node:path'
import {visionAttemptRecord} from './vision-attempt-record'
import type {DirectSlot} from '../features/receipt-image/direct-image-boundary'
export const DIRECT_IMAGES=[
  'aa40404b602ccc38e3f16d75bf30472fc12afc1c69d2a217e869cb6b7376ef46',
  'd5b6213c0e08b1cbc52da36ae888b10a240409a61ca7ac904fb70348238a83bb',
] as const
const exists=async(path:string)=>{try{await stat(path);return true}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw new Error('diagnostics-unavailable')}}
// Fixed ordered slots. Slot two is unavailable until slot one has durably
// completed successfully. An error, interruption or incomplete restart stops
// the whole pilot. Each reservation is permanent; no reset/path override API.
export function directPilot(root:string,minimumGapMs=60_000,now=Date.now) {
  const slots=DIRECT_IMAGES.map((_,i)=>{
    const directory=join(root,`receipt-${i+1}`),path=join(directory,'reservation.json'),diagnostics=visionAttemptRecord(join(directory,'lifecycle.jsonl'))
    const slot:DirectSlot={diagnostics,consumed:()=>exists(path),reserve:async()=>{
      if(i===1) {
        if((await slots[0].diagnostics.status())?.state!=='complete')throw new Error('pilot-stopped')
        // Wait from durable completion, which is later than dispatch. The
        // persisted record's timestamp survives restart; an early submission
        // does not reserve or transmit slot two. Clock rollback fails closed.
        const completedAt=(await stat(join(root,'receipt-1','lifecycle.jsonl'))).mtimeMs
        if(!Number.isFinite(completedAt)||now()-completedAt<minimumGapMs)throw new Error('pilot-wait')
      }
      await mkdir(directory,{recursive:true,mode:0o700})
      let f;try{f=await open(path,'wx',0o600)}catch{throw new Error('attempt-consumed')}
      try{await f.writeFile(JSON.stringify({version:1,attempt:i+1,feature:'generateContent',maximumRequests:1})+'\n');await f.sync();const d=await open(directory,'r');try{await d.sync()}finally{await d.close()}}finally{await f.close()}
    }};return slot
  })
  return {slot:(hash:string)=>slots[DIRECT_IMAGES.findIndex(v=>v===hash)]??null,
    status:async()=>Promise.all(slots.map(async(s,i)=>({attempt:i+1,consumed:await s.consumed(),record:await s.diagnostics.status()})))}
}
