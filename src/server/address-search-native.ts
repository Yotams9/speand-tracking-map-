import 'server-only'
import {mkdir,open,readFile,stat} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {allowedAddressOrigin,createAddressSearchHandler,createGeoapifyTransport} from './address-search-boundary'
import {addressRun,addressRuns,type AddressRun} from './address-search-runs'
import {searchErrors,type SearchResult} from '../features/local-purchases/address-search'

export const ADDRESS_ROOT='/Users/testing.user/Documents/Codex/2026-08-28/referenced-chatgpt-conversation-this-is-an/work/spendscape-worktree'
export const ADDRESS_RUN='geoapify-address-validation-20261011-one'
export const ADDRESS_BUILD='artifacts/geoapify-live-8jiueeim/app'
export const ADDRESS_RECORD=`artifacts/${ADDRESS_RUN}`
const stages=['reserved','dispatch-initiated','provider-http','completed','interrupted'] as const
type Stage=typeof stages[number]
type Event={stage:Stage;elapsedMs:number;httpStatus?:number;outcome?:SearchResult['status']}
const outcomes=['results',...searchErrors] as const
const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex')
const safeEvent=(v:unknown):v is Event=>{
 if(!v||typeof v!=='object'||Array.isArray(v))return false
 const x=v as Event
 return Object.keys(x).every(k=>['stage','elapsedMs','httpStatus','outcome'].includes(k))&&Object.hasOwn(x,'stage')&&Object.hasOwn(x,'elapsedMs')&&stages.includes(x.stage)&&Number.isInteger(x.elapsedMs)&&x.elapsedMs>=0&&x.elapsedMs<=60_000&&(!Object.hasOwn(x,'httpStatus')||(Number.isInteger(x.httpStatus)&&x.httpStatus!>=100&&x.httpStatus!<=599))&&(!Object.hasOwn(x,'outcome')||outcomes.includes(x.outcome!))
}

// Exclusive fsynced marker; uncertainty consumes rather than resets the run.
// Events are separate exclusive/fsynced files. Nothing received from the provider
// is used as a file name or journal string. No candidate/address content is retained.
export function addressJournal(directory:string,run:AddressRun=ADDRESS_RUN) {
 if(!addressRun(run))throw Error('run-disabled')
 const marker=join(directory,'reservation.json')
 let started=performance.now(),sequence=0,queue=Promise.resolve(),closed=false
 const durable=async(path:string,value:unknown)=>{
  const file=await open(path,'wx',0o600)
  try{await file.writeFile(JSON.stringify(value)+'\n');await file.sync()}finally{await file.close()}
  const dir=await open(directory,'r');try{await dir.sync()}finally{await dir.close()}
 }
 const consumed=async()=>{try{await stat(marker);return true}catch(e){return (e as NodeJS.ErrnoException).code!=='ENOENT'}}
 const record=(stage:Stage,extra:Pick<Event,'httpStatus'|'outcome'>={})=>{
  const event={stage,elapsedMs:Math.min(60_000,Math.max(0,Math.round(performance.now()-started))),...extra}
  if(closed||!safeEvent(event))return Promise.reject(Error('record-unavailable'))
  if(stage==='completed'||stage==='interrupted')closed=true
  queue=queue.then(()=>durable(join(directory,`event-${++sequence}.json`),event))
  return queue
 }
 return {
  consumed,record,
  reserve:async()=>{
   try{started=performance.now();await mkdir(directory,{recursive:true,mode:0o700});await durable(marker,{version:1,run,maximumRequests:1});await record('reserved');return true}catch{return false}
  },
  status:async()=>{
   if(!await consumed())return {status:'unused' as const,dispatchInitiations:0}
   const events:Event[]=[]
   try{
    const m=JSON.parse(await readFile(marker,'utf8'))
    if(JSON.stringify(m)!==JSON.stringify({version:1,run,maximumRequests:1}))throw Error()
    for(let i=1;i<=5;i++){
     let data:Buffer;try{data=await readFile(join(directory,`event-${i}.json`))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')break;throw e}
     if(data.length>256)throw Error()
     const event:unknown=JSON.parse(data.toString());if(!safeEvent(event))throw Error();events.push(event)
    }
    return {status:'consumed' as const,dispatchInitiations:events.some(e=>e.stage==='dispatch-initiated')?1:0,events}
   }catch{return {status:'consumed' as const,dispatchInitiations:'unknown' as const,record:'unavailable' as const}}
  },
 }
}

// Internal dependency injection is for offline tests, never request/env paths.
export function createNativeAddressHandler(ports:{directory:string;getKey:()=>string;send:typeof fetch;integrity:()=>Promise<boolean>;run?:AddressRun},timeoutMs=10_000) {
 const run=ports.run??ADDRESS_RUN
 const journal=addressJournal(ports.directory,run)
 let sent=false
 const transport=createGeoapifyTransport(ports.getKey,async(url,options)=>{
  if(sent||options?.signal?.aborted)throw Error('stopped')
  sent=true
  await journal.record('dispatch-initiated') // durable before fetch
  if(options?.signal?.aborted)throw Error('stopped')
  const response=await ports.send(url,options)
  if(options?.signal?.aborted){await response.body?.cancel();throw Error('stopped')}
  try{await journal.record('provider-http',{httpStatus:response.status})}catch{await response.body?.cancel();throw Error('stopped')}
  return response
 })
 return async(request:Request)=>{
  if(!allowedAddressOrigin(request))return Response.json({status:'disabled'},{status:503,headers:{'cache-control':'no-store'}})
  if(request.method==='GET'){
   const state=await journal.status()
   return Response.json({mode:'native',run,status:state.status==='unused'?(await ports.integrity()?'available':'disabled'):'consumed',diagnostics:state},{headers:{'cache-control':'no-store'}})
  }
  let owns=false
  const handler=createAddressSearchHandler({enabled:true,reserve:async()=>{owns=await ports.integrity()&&await journal.reserve();return owns},search:transport},timeoutMs)
  const response=await handler(request)
  // Only the invocation owning the reservation records its terminal result.
  // Competing/repeated requests never write to its journal.
  const value=await response.clone().json().catch(()=>null)
  if(owns&&value&&value.status!=='consumed'&&value.status!=='invalid'&&await journal.consumed()){
   const state=await journal.status()
   if('events' in state&&state.events?.[0]?.stage==='reserved'&&!state.events.some(e=>['completed','interrupted'].includes(e.stage))){
    try{await journal.record(['timeout','cancelled'].includes(value.status)?'interrupted':'completed',{outcome:value.status})}catch{return Response.json({status:'unavailable'},{status:503,headers:{'cache-control':'no-store'}})}
   }
  }
  return response
 }
}

export async function verifyAddressFreeze(root:string,digest:string,run:AddressRun=ADDRESS_RUN):Promise<boolean>{
 try{
  if(!addressRun(run))return false
  const config=addressRuns[run]
  const bytes=await readFile(join(root,config.freeze))
  if(hash(bytes)!==digest)return false
  const f=JSON.parse(bytes.toString())
  if(f.version!==1||f.head!==config.head||f.maximumRequests!==1||f.maximumCredits!==1||f.run!==run||f.build!==config.build||!Array.isArray(f.files)||f.files.length<1||f.files.length>2500)return false
  for(const x of f.files){
   if(!x||typeof x.path!=='string'||!/^[A-Za-z0-9_.\/()[\]@-]+$/.test(x.path)||x.path.split('/').includes('..')||!['src/','package','next.config','tsconfig',config.launcher,`${config.build}/`].some(p=>x.path.startsWith(p))||!/^\w{64}$/.test(x.sha256)||hash(await readFile(join(root,x.path)))!==x.sha256)return false
  }
  return true
 }catch{return false}
}
