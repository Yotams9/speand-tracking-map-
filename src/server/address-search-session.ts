import 'server-only'
import {createHash} from 'node:crypto'
import {mkdir,open,readFile,stat} from 'node:fs/promises'
import {join} from 'node:path'
import {allowedAddressOrigin,createAddressSearchHandler,createGeoapifyTransport} from './address-search-boundary'
import {searchErrors,type SearchResult} from '../features/local-purchases/address-search'

export interface AddressSessionPolicy {version:1;maxRequests:number;createdAt:number;expiresAt:number}
export function validAddressSessionPolicy(v:unknown):v is AddressSessionPolicy {
 if(!v||typeof v!=='object'||Array.isArray(v))return false
 const p=v as AddressSessionPolicy
 return Object.keys(p).sort().join(',')==='createdAt,expiresAt,maxRequests,version'&&p.version===1&&Number.isInteger(p.maxRequests)&&p.maxRequests>=1&&p.maxRequests<=10&&Number.isSafeInteger(p.createdAt)&&p.createdAt>0&&Number.isSafeInteger(p.expiresAt)&&p.expiresAt-p.createdAt>=300_000&&p.expiresAt-p.createdAt<=7_200_000
}
const absent=(e:unknown)=>(e as NodeJS.ErrnoException).code==='ENOENT'
async function durable(path:string,value:unknown){
 const f=await open(path,'wx',0o600)
 try{await f.writeFile(JSON.stringify(value));await f.sync()}finally{await f.close()}
 const d=await open(join(path,'..'),'r');try{await d.sync()}finally{await d.close()}
}
async function bounded(path:string){if((await stat(path)).size>512)throw Error('unavailable');return JSON.parse(await readFile(path,'utf8')) as any}
type Outcome=SearchResult['status']
const outcomes:readonly Outcome[]=['results',...searchErrors]
// No address, candidate, coordinate, provider text or credential enters these files.
export function addressSession(root:string,id:string,now=()=>Date.now()){
 if(!/^[a-f0-9]{32}$/.test(id))throw Error('unavailable')
 const dir=join(root,'artifacts','address-search-sessions',id)
 const path=(n:number,suffix:string)=>join(dir,`request-${n}-${suffix}.json`)
 async function state(){
  const p=await bounded(join(dir,'session.json'));if(!validAddressSessionPolicy(p))throw Error('unavailable')
  const rows:{ordinal:number;submission:string;outcome?:Outcome}[]=[];let gap=false
  for(let n=1;n<=p.maxRequests;n++){
   let r:any
   try{r=await bounded(path(n,'reserved'))}catch(e){if(absent(e)){gap=true;continue}throw Error('unavailable')}
   if(gap||!r||Object.keys(r).sort().join(',')!=='at,ordinal,submission,version'||r.version!==1||r.ordinal!==n||!/^[a-f0-9]{64}$/.test(r.submission)||!Number.isSafeInteger(r.at)||r.at<p.createdAt||r.at>=p.expiresAt)throw Error('unavailable')
   let terminal:any
   try{terminal=await bounded(path(n,'completed'))}catch(e){if(!absent(e))throw Error('unavailable')}
   if(terminal&&(!Object.keys(terminal).every(k=>['outcome','elapsedMs'].includes(k))||Object.keys(terminal).length!==2||!outcomes.includes(terminal.outcome)||!Number.isInteger(terminal.elapsedMs)||terminal.elapsedMs<0||terminal.elapsedMs>60_000))throw Error('unavailable')
   rows.push({ordinal:n,submission:r.submission,outcome:terminal?.outcome})
  }
  const status=rows.some(r=>!r.outcome)?'busy':rows.some(r=>!['results','no-results'].includes(r.outcome!))?'session-stopped':now()<p.createdAt||now()>=p.expiresAt?'expired':rows.length>=p.maxRequests?'limit-reached':'available'
  return {p,rows,status}
 }
 return {
  initialize:async(p:AddressSessionPolicy)=>{if(!validAddressSessionPolicy(p))throw Error('unavailable');await mkdir(dir,{recursive:true,mode:0o700});await durable(join(dir,'session.json'),p)},
  status:async()=>{const s=await state();return {status:s.status,used:s.rows.length,maxRequests:s.p.maxRequests,remaining:s.p.maxRequests-s.rows.length,expiresAt:s.p.expiresAt}},
  reserve:async(submission:string)=>{
   if(!/^[a-f0-9]{32}$/.test(submission))throw Error('invalid')
   const digest=createHash('sha256').update(id+submission).digest('hex'),s=await state()
   if(s.rows.some(r=>r.submission===digest))throw Error('duplicate')
   if(s.status!=='available')throw Error(s.status)
   const n=s.rows.length+1,at=now(),started=performance.now()
   if(at<s.p.createdAt||at>=s.p.expiresAt)throw Error('expired')
   try{await durable(path(n,'reserved'),{version:1,ordinal:n,submission:digest,at})}catch(e){throw Error((e as NodeJS.ErrnoException).code==='EEXIST'?'busy':'unavailable')}
   const elapsed=()=>Math.min(60_000,Math.max(0,Math.round(performance.now()-started)))
   return {
    dispatch:async()=>{if(now()<s.p.createdAt||now()>=s.p.expiresAt)throw Error('expired');await durable(path(n,'dispatch'),{stage:'dispatch-initiated',elapsedMs:elapsed()});if(now()<s.p.createdAt||now()>=s.p.expiresAt)throw Error('expired')},
    http:async(status:number)=>{if(!Number.isInteger(status)||status<100||status>599)throw Error('unavailable');await durable(path(n,'http'),{httpStatus:status,elapsedMs:elapsed()})},
    complete:async(outcome:Outcome)=>{if(!outcomes.includes(outcome))throw Error('unavailable');await durable(path(n,'completed'),{outcome,elapsedMs:elapsed()})},
   }
  },
 }
}
const reply=(status:string,code=200,extra={})=>Response.json({status,...extra},{status:code,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}})
export function addressSessionReady(env:NodeJS.ProcessEnv){return env.SPENDSCAPE_ADDRESS_SESSION_MODE==='native'&&/^[a-f0-9]{32}$/.test(env.SPENDSCAPE_ADDRESS_SESSION??'')&&env.SPENDSCAPE_ADDRESS_FREE_READY==='1'&&/^[A-Za-z0-9_-]{16,128}$/.test(env.GEOAPIFY_API_KEY??'')&&!env.VERCEL&&!env.CI&&!env.SPENDSCAPE_ADDRESS_SEARCH_QA&&!env.SPENDSCAPE_GEOAPIFY_RUN}
export function createOperationalAddressHandler(env:NodeJS.ProcessEnv,send:typeof fetch,root=process.cwd(),now=()=>Date.now(),timeoutMs=10_000){
 return async(request:Request)=>{
  if(!addressSessionReady(env)||!allowedAddressOrigin(request))return reply('disabled',503)
  const session=addressSession(root,env.SPENDSCAPE_ADDRESS_SESSION!,now)
  if(request.method==='GET')try{const status=await session.status();return reply(status.status,200,{mode:'native-session',session:status})}catch{return reply('unavailable',503)}
  let slot:Awaited<ReturnType<typeof session.reserve>>|undefined,reason='unavailable',sent=false
  const transport=createGeoapifyTransport(()=>env.GEOAPIFY_API_KEY!,async(url,options)=>{
   if(!slot||sent||options?.signal?.aborted)throw Error('unavailable')
   sent=true;await slot.dispatch();if(options?.signal?.aborted)throw Error('cancelled')
   const response=await send(url,options)
   if(options?.signal?.aborted){await response.body?.cancel();throw Error('cancelled')}
   try{await slot.http(response.status)}catch{await response.body?.cancel();throw Error('unavailable')}
   return response
  })
  const handler=createAddressSearchHandler({enabled:true,reserve:async()=>{try{slot=await session.reserve(request.headers.get('x-spendscape-address-submission')??'');return true}catch(e){reason=e instanceof Error&&['invalid','duplicate','busy','expired','limit-reached','session-stopped'].includes(e.message)?e.message:'unavailable';return false}},search:transport},timeoutMs)
  const response=await handler(request),result=await response.clone().json().catch(()=>({status:'unavailable'}))
  if(!slot)return result.status==='consumed'?reply(reason,409):response
  try{await slot.complete(result.status)}catch{return reply('unavailable',503)}
  return response
 }
}
