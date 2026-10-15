import {createHash} from 'node:crypto'
import {mkdir, open, readFile, stat} from 'node:fs/promises'
import {join} from 'node:path'
import {structuredCost, STRUCTURED_MODEL, STRUCTURED_PROMPT} from '../features/receipt-image/structured-image-contract'
import {visionAttemptRecord} from './vision-attempt-record'
import type {DirectSlot} from '../features/receipt-image/direct-image-boundary'

export const CAPTURE_SESSION_MS = 2 * 60 * 60 * 1000
export const CAPTURE_COOLDOWN_MS = 60_000
export const CAPTURE_REQUEST_MICRO_USD = 35_400
export const captureContractHash = createHash('sha256').update(STRUCTURED_MODEL + STRUCTURED_PROMPT + '|4096|application/json').digest('hex')
export interface CapturePolicy {version:1; model:typeof STRUCTURED_MODEL; contractHash:string; maxRequests:number; ceilingMicroUsd:number; createdAt:number; expiresAt:number}
export function validCapturePolicy(value:unknown):value is CapturePolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const p=value as CapturePolicy
  return Object.keys(p).sort().join(',')==='ceilingMicroUsd,contractHash,createdAt,expiresAt,maxRequests,model,version' &&
    p.version===1 && p.model===STRUCTURED_MODEL && p.contractHash===captureContractHash &&
    Number.isInteger(p.maxRequests) && p.maxRequests>=1 && p.maxRequests<=10 &&
    Number.isInteger(p.ceilingMicroUsd) && p.ceilingMicroUsd>=CAPTURE_REQUEST_MICRO_USD && p.ceilingMicroUsd<=500_000 &&
    p.maxRequests*CAPTURE_REQUEST_MICRO_USD<=p.ceilingMicroUsd && Number.isSafeInteger(p.createdAt) && p.createdAt>0 &&
    p.expiresAt===p.createdAt+CAPTURE_SESSION_MS
}
async function durableNew(path:string,value:unknown) {
  const f=await open(path,'wx',0o600)
  try {await f.writeFile(JSON.stringify(value));await f.sync()}finally{await f.close()}
  const d=await open(join(path,'..'),'r');try{await d.sync()}finally{await d.close()}
}
async function bounded(path:string) {
  if((await stat(path)).size>2048)throw Error('diagnostics-unavailable')
  return JSON.parse(await readFile(path,'utf8')) as unknown
}
const absent=(e:unknown)=>(e as NodeJS.ErrnoException).code==='ENOENT'
export function captureSession(root:string,id:string,now=()=>Date.now()) {
  if(!/^[a-f0-9]{32}$/.test(id))throw Error('diagnostics-unavailable')
  const directory=join(root,'artifacts','receipt-capture-sessions',id)
  const policyPath=join(directory,'session.json')
  const record=(n:number)=>visionAttemptRecord(join(directory,`request-${n}.jsonl`))
  async function policy(){const p=await bounded(policyPath);if(!validCapturePolicy(p))throw Error('diagnostics-unavailable');return p}
  async function state() {
    const p=await policy();const rows:{ordinal:number;digest:string;reservedAt:number;state:string}[]=[]
    let gap=false
    for(let n=1;n<=p.maxRequests;n++) {
      let r:any
      try{r=await bounded(join(directory,`request-${n}.json`))}catch(e){if(absent(e)){gap=true;continue}throw Error('diagnostics-unavailable')}
      if(gap || !r || Object.keys(r).sort().join(',')!=='digest,ordinal,reservedAt,version' || r.version!==1 || r.ordinal!==n || !/^[a-f0-9]{64}$/.test(r.digest) || !Number.isSafeInteger(r.reservedAt) || r.reservedAt<p.createdAt || r.reservedAt>=p.expiresAt)throw Error('diagnostics-unavailable')
      const diagnostics=await record(n).status()
      rows.push({ordinal:n,digest:r.digest,reservedAt:r.reservedAt,state:diagnostics?.state??'incomplete'})
    }
    const failed=rows.some(r=>r.state==='failed'||r.state==='interrupted')
    const incomplete=rows.some(r=>r.state==='incomplete')
    const expired=now()<p.createdAt||now()>=p.expiresAt
    const waiting=!!rows.length && now()-rows.at(-1)!.reservedAt<CAPTURE_COOLDOWN_MS
    const status=failed?'stopped':incomplete?'busy-or-interrupted':expired?'expired':rows.length>=p.maxRequests?'exhausted':waiting?'wait':'available'
    return {p,rows,status}
  }
  return {
    initialize:async(p:CapturePolicy)=>{if(!validCapturePolicy(p))throw Error('diagnostics-unavailable');await mkdir(directory,{recursive:true,mode:0o700});await durableNew(policyPath,p)},
    status:async()=>{const {p,rows,status}=await state();return {state:status,used:rows.length,maxRequests:p.maxRequests,reservedMicroUsd:rows.length*CAPTURE_REQUEST_MICRO_USD,ceilingMicroUsd:p.ceilingMicroUsd,remaining:p.maxRequests-rows.length,lastAttempt:rows.length?await record(rows.length).status():null}},
    slot:async(hash:string):Promise<DirectSlot>=>{
      if(!/^[a-f0-9]{64}$/.test(hash))throw Error('image-format')
      // Salt the content fingerprint per private session; never store image bytes.
      const digest=createHash('sha256').update(id+hash).digest('hex')
      const s=await state()
      if(s.rows.some(r=>r.digest===digest))throw Error('attempt-consumed')
      if(['busy-or-interrupted','wait'].includes(s.status))throw Error('pilot-wait')
      if(s.status!=='available')throw Error('pilot-stopped')
      const n=s.rows.length+1
      return {diagnostics:record(n),consumed:async()=>{try{await stat(join(directory,`request-${n}.json`));return true}catch(e){if(absent(e))return false;throw Error('diagnostics-unavailable')}},reserve:async()=>{
        const current=await state()
        if(current.rows.some(r=>r.digest===digest))throw Error('attempt-consumed')
        if(current.rows.length!==n-1||current.status!=='available')throw Error('pilot-wait')
        try{await durableNew(join(directory,`request-${n}.json`),{version:1,ordinal:n,digest,reservedAt:now()})}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')throw Error('pilot-wait');throw Error('diagnostics-unavailable')}
      }}
    },
    attemptStatus:async(n:number)=>{if(!Number.isInteger(n)||n<1||n>10)throw Error('diagnostics-unavailable');return record(n).status()},
  }
}
export function capturePricingReady(now=new Date()) {
  try{return Math.round(structuredCost(now).estimatedUsd*1_000_000)===CAPTURE_REQUEST_MICRO_USD}catch{return false}
}
