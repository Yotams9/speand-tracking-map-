import {describe,it,expect,vi} from 'vitest'
vi.mock('server-only',()=>({}))
import {mkdtemp,readFile,readdir,writeFile,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {addressJournal,createNativeAddressHandler,verifyAddressFreeze,ADDRESS_BUILD,ADDRESS_RUN} from './address-search-native'
import {addressRun,addressRuns} from './address-search-runs'
import {createLocalAddressHandler} from './address-search-local'
const key='SYNTHETIC_KEY_SECRET_1234567890',secret='SYNTHETIC_RECEIPT_SECRET_329_87'
const input={address:'Fictional street 12, Fictional city, Fictional country',locale:'en'}
const provider=()=>({results:[{formatted:'Fictional street 12',city:'Fictional city',country:'Fictional country',lon:34.75,lat:32.1,result_type:'building',rank:{match_type:'full_match'},datasource:{sourcename:'openstreetmap'},message:secret}]})
const request=(signal?:AbortSignal)=>new Request('http://localhost:3172/api/address-search',{method:'POST',headers:{origin:'http://localhost:3172','content-type':'application/json'},body:JSON.stringify(input),signal})
const get=()=>new Request('http://localhost:3172/api/address-search')
const directory=()=>mkdtemp(join(tmpdir(),'spendscape-address-native-synthetic-'))
const make=(dir:string,send:typeof fetch,integrity=async()=>true,timeout=1000)=>createNativeAddressHandler({directory:dir,getKey:()=>key,send,integrity},timeout)
async function bytes(dir:string){return (await Promise.all((await readdir(dir)).map(f=>readFile(join(dir,f),'utf8')))).join('')}
describe('fixed one-search native reservation and safe status',()=>{
 it('corrected fixed run has its own exclusive marker; historical marker remains untouched',async()=>{
  const run='geoapify-corrected-address-validation-20261011-one' as const
  expect(addressRun(run)).toBe(run)
  for(const name of ['unknown','constructor','__proto__','../secret'])expect(addressRun(name)).toBeNull()
  const old=await directory(),fresh=await directory()
  const historical=addressJournal(old);expect(await historical.reserve()).toBe(true)
  const oldBytes=await bytes(old),send=vi.fn(async()=>Response.json(provider()))
  const makeFresh=()=>createNativeAddressHandler({run,directory:fresh,getKey:()=>key,send,integrity:async()=>true})
  const responses=await Promise.all([makeFresh()(request()),makeFresh()(request())])
  expect(responses.map(r=>r.status).sort()).toEqual([200,409])
  expect((await makeFresh()(request())).status).toBe(409)
  expect(await (await makeFresh()(get())).json()).toMatchObject({run,status:'consumed',diagnostics:{dispatchInitiations:1}})
  expect(send).toHaveBeenCalledOnce();expect(await bytes(old)).toBe(oldBytes)
  expect(await addressJournal(fresh).status()).toMatchObject({record:'unavailable'})
  expect(await addressJournal(fresh,run).status()).toMatchObject({status:'consumed',dispatchInitiations:1})
  expect(await bytes(fresh)).not.toContain(secret)
 })
 it('corrected freeze requires its exact head/build/run and fails closed before dispatch',async()=>{
  const run='geoapify-corrected-address-validation-20261011-one' as const,config=addressRuns[run]
  const root=await directory();await mkdir(join(root,'qa/address-search-corrected'),{recursive:true});await mkdir(join(root,'src'))
  const data=Buffer.from('synthetic corrected source'),sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex')
  await writeFile(join(root,'src/fictional.ts'),data)
  const f={version:1,head:config.head,maximumRequests:1,maximumCredits:1,run,build:config.build,files:[{path:'src/fictional.ts',sha256:sha(data)}]}
  const install=async(v:unknown)=>{const b=Buffer.from(JSON.stringify(v));await writeFile(join(root,config.freeze),b);return sha(b)}
  expect(await verifyAddressFreeze(root,await install(f),run)).toBe(true)
  for(const bad of [{...f,head:'old'},{...f,run:ADDRESS_RUN},{...f,build:ADDRESS_BUILD},{...f,maximumRequests:2}])expect(await verifyAddressFreeze(root,await install(bad),run)).toBe(false)
  const d=await directory(),send=vi.fn(async()=>Response.json(provider()))
  const h=createNativeAddressHandler({run,directory:d,getKey:()=>key,send,integrity:async()=>false})
  expect((await h(request())).status).toBe(409);expect(send).not.toHaveBeenCalled();expect(await readdir(d)).toEqual([])
 })
 it('verifies frozen bytes and rejects drift, bad limits and unsafe paths',async()=>{const root=await directory();await mkdir(join(root,'qa/address-search-native'),{recursive:true});await mkdir(join(root,'src'));const data=Buffer.from('synthetic source'),sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');await writeFile(join(root,'src/fictional.ts'),data);const f={version:1,head:'cbf62a12acbd8be2e649a44d17064acaf82d6482',maximumRequests:1,maximumCredits:1,run:ADDRESS_RUN,build:ADDRESS_BUILD,files:[{path:'src/fictional.ts',sha256:sha(data)}]};const install=async(v:unknown)=>{const b=Buffer.from(JSON.stringify(v));await writeFile(join(root,'qa/address-search-native/freeze.json'),b);return sha(b)};expect(await verifyAddressFreeze(root,await install(f))).toBe(true);await writeFile(join(root,'src/fictional.ts'),'changed');expect(await verifyAddressFreeze(root,await install(f))).toBe(false);expect(await verifyAddressFreeze(root,await install({...f,maximumRequests:2}))).toBe(false);expect(await verifyAddressFreeze(root,await install({...f,files:[{path:'../secret',sha256:sha(data)}]}))).toBe(false)})
 it('defaults/hosted/unknown/unfrozen native modes attach no transport',async()=>{for(const env of [{},{GEOAPIFY_API_KEY:key},{SPENDSCAPE_GEOAPIFY_RUN:'arbitrary'},{SPENDSCAPE_GEOAPIFY_RUN:ADDRESS_RUN,VERCEL:'1'}])expect((await createLocalAddressHandler(env)(get())).status).toBe(503)})
 it('GET is native/unused; origin restrictions occur before reservation',async()=>{const dir=await directory(),send=vi.fn(async()=>Response.json(provider())),h=make(dir,send);expect(await (await h(get())).json()).toMatchObject({status:'available',mode:'native',diagnostics:{status:'unused'}});expect((await h(new Request('http://evil.invalid/api/address-search'))).status).toBe(503);expect(send).not.toHaveBeenCalled();expect(await readdir(dir)).toEqual([])})
 it('records exclusive success independent of browser; drops all content',async()=>{const dir=await directory(),send=vi.fn(async()=>Response.json(provider())),h=make(dir,send);const r=await h(request());expect(await r.json()).toMatchObject({status:'results'});expect(send).toHaveBeenCalledOnce();const state=await (await h(get())).json();expect(state).toMatchObject({mode:'native',status:'consumed',diagnostics:{status:'consumed',dispatchInitiations:1}});expect(state.diagnostics.events.map((e:any)=>e.stage)).toEqual(['reserved','dispatch-initiated','provider-http','completed']);expect(state.diagnostics.events[2].httpStatus).toBe(200);const data=await bytes(dir);for(const forbidden of [key,secret,input.address,'Fictional street','34.75','32.1','apiKey','https://'])expect(data).not.toContain(forbidden);for(const e of state.diagnostics.events)expect(Object.keys(e).every(k=>['stage','elapsedMs','httpStatus','outcome'].includes(k))).toBe(true)})
 it('two independent processes/concurrent handlers and restart dispatch exactly once',async()=>{const dir=await directory(),send=vi.fn(async()=>Response.json(provider()));const replies=await Promise.all([make(dir,send)(request()),make(dir,send)(request())]);expect(replies.map(r=>r.status).sort()).toEqual([200,409]);const h=make(dir,send);expect((await h(request())).status).toBe(409);expect(await (await h(get())).json()).toMatchObject({status:'consumed'});expect(send).toHaveBeenCalledOnce()})
 it('integrity failure, corrupt marker and journal write failure fail closed',async()=>{const dir=await directory(),send=vi.fn(async()=>Response.json(provider()));expect((await make(dir,send,async()=>false)(request())).status).toBe(409);expect(send).not.toHaveBeenCalled();await writeFile(join(dir,'reservation.json'),secret);expect((await make(dir,send)(request())).status).toBe(409);expect(await addressJournal(dir).status()).toMatchObject({status:'consumed',record:'unavailable'});expect(JSON.stringify(await addressJournal(dir).status())).not.toContain(secret);const d=await directory();await mkdir(join(d,'event-1.json'));expect((await make(d,send)(request())).status).toBe(409);expect(send).not.toHaveBeenCalled();expect(await addressJournal(d).consumed()).toBe(true)})
 it('dispatch journal failure stops before fetch without resetting marker',async()=>{const dir=await directory(),send=vi.fn(async()=>Response.json(provider()));await mkdir(join(dir,'event-2.json'));expect(await (await make(dir,send)(request())).json()).toEqual({status:'unavailable'});expect(send).not.toHaveBeenCalled();expect(await addressJournal(dir).consumed()).toBe(true)})
 it.each([400,401,403,429,500])('retains only numeric HTTP %i and fixed outcome',async code=>{const dir=await directory(),send=vi.fn(async()=>new Response(secret,{status:code})),h=make(dir,send);expect(await (await h(request())).json()).toEqual({status:code===429?'quota':'http-error'});const state=await addressJournal(dir).status();expect('events' in state&&state.events?.[2]).toMatchObject({stage:'provider-http',httpStatus:code});expect(await bytes(dir)).not.toContain(secret);expect(send).toHaveBeenCalledOnce()})
 it('malformed provider output and no-results remain consumed with safe outcomes',async()=>{for(const body of [secret,JSON.stringify({results:[]})]){const dir=await directory(),h=make(dir,async()=>new Response(body,{headers:{'content-type':'application/json'}}));const r=await (await h(request())).json();expect(['malformed','no-results']).toContain(r.status);expect(await bytes(dir)).not.toContain(secret);expect((await h(request())).status).toBe(409)}})
 it('transport exception is safe; timeout and late response never append content/events',async()=>{const dir=await directory(),h=make(dir,async()=>{throw Error(secret)});expect(await (await h(request())).json()).toEqual({status:'unavailable'});expect(await bytes(dir)).not.toContain(secret);const d=await directory();let finish:(v:Response)=>void=()=>{};const timed=make(d,()=>new Promise(r=>{finish=r}),async()=>true,15);expect(await (await timed(request())).json()).toEqual({status:'timeout'});const before=await bytes(d);finish(Response.json(provider()));await new Promise(r=>setTimeout(r,20));expect(await bytes(d)).toBe(before);expect(await addressJournal(d).status()).toMatchObject({status:'consumed',dispatchInitiations:1});expect((await timed(request())).status).toBe(409)})
 it('browser disconnect records interruption and independent GET recovers it',async()=>{const dir=await directory(),c=new AbortController(),send=vi.fn(()=>new Promise<Response>(()=>{})),h=make(dir,send);const pending=h(request(c.signal));await vi.waitFor(()=>expect(send).toHaveBeenCalledOnce());c.abort();expect(await (await pending).json()).toEqual({status:'cancelled'});const restarted=make(dir,send);const state=await (await restarted(get())).json();expect(state.diagnostics.events.at(-1)).toMatchObject({stage:'interrupted',outcome:'cancelled'});expect((await restarted(request())).status).toBe(409)})
 it('cancelled competing invocation cannot interrupt the actual owner',async()=>{const dir=await directory();let finish:(v:Response)=>void=()=>{};const send=vi.fn(()=>new Promise<Response>(r=>{finish=r})),h=make(dir,send),owner=h(request());await vi.waitFor(()=>expect(send).toHaveBeenCalledOnce());const c=new AbortController();c.abort();expect(await (await h(request(c.signal))).json()).toEqual({status:'cancelled'});finish(Response.json(provider()));expect(await (await owner).json()).toMatchObject({status:'results'});const state=await addressJournal(dir).status();expect('events' in state&&state.events?.at(-1)).toMatchObject({stage:'completed',outcome:'results'})})
 it('strict status reader rejects injected event strings/values rather than reflecting them',async()=>{const dir=await directory(),j=addressJournal(dir);expect(await j.reserve()).toBe(true);await writeFile(join(dir,'event-2.json'),JSON.stringify({stage:secret,elapsedMs:1,address:input.address}));const state=await j.status();expect(state).toEqual({status:'consumed',dispatchInitiations:'unknown',record:'unavailable'});expect(JSON.stringify(state)).not.toContain(secret)})
})
