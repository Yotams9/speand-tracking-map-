import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest'
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {visionAttemptRecord} from '../../server/vision-attempt-record'
import {visionReservation} from '../../server/vision-local-reservation'
import {createVisionLocalHandler} from './vision-local-boundary'
import {createVisionTransport} from './vision-transport'
import {fictionalShortOcr,visionResponse} from './vision-fixtures'
import {safeAttemptEvent} from './vision-attempt'
let dir:string
const hash='a'.repeat(64),secret='PRIVATE_RECEIPT_TOKEN_PAYMENT_MARKER'
function image(){const b=new Uint8Array(33);b.set([137,80,78,71,13,10,26,10]);const v=new DataView(b.buffer);v.setUint32(8,13);v.setUint32(12,0x49484452);v.setUint32(16,64);v.setUint32(20,64);return b}
function request(signal?:AbortSignal){return new Request('http://127.0.0.1:3000/api/receipt-ocr',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'image/png','x-spendscape-local-vision':'1'},body:image(),signal})}
function setup(send=vi.fn(async()=>Response.json(visionResponse(fictionalShortOcr()))),auth=vi.fn(async()=>secret)){
 const diagnostics=visionAttemptRecord(join(dir,'record.jsonl')),reservation=visionReservation(join(dir,'lock.json'))
 const ports={enabled:true,approvedHash:hash,hash:()=>hash,...reservation,diagnostics,recognize:createVisionTransport(auth,send)}
 return {diagnostics,ports,send,auth,handler:createVisionLocalHandler(ports)}
}
beforeEach(async()=>{dir=await mkdtemp(join(tmpdir(),'vision-diagnostic-offline-'));vi.stubGlobal('fetch',()=>{throw new Error('OFFLINE_NETWORK_GUARD')})})
afterEach(async()=>{vi.unstubAllGlobals();await rm(dir,{recursive:true})})
describe('durable private attempt lifecycle',()=>{
 it('records complete success independently of reading the browser response; restart cannot dispatch again',async()=>{
  const p=setup();const response=await p.handler(request());expect(response.status).toBe(200)
  const state=await visionAttemptRecord(join(dir,'record.jsonl')).status();expect(state?.state).toBe('complete')
  expect(state?.events.map(e=>e.stage)).toEqual(['reserved','authentication-start','authentication-complete','dispatch-initiated','provider-http','normalization-start','normalization-complete','parsing-start','parsing-complete','review-response-complete'])
  expect(await readFile(join(dir,'record.jsonl'),'utf8')).not.toContain(secret)
  expect(await readFile(join(dir,'record.jsonl'),'utf8')).not.toContain('מוצר')
  expect((await createVisionLocalHandler({...p.ports,...visionReservation(join(dir,'lock.json'))})(request())).status).toBe(409);expect(p.send).toHaveBeenCalledTimes(1)
 })
 it('auth failure is distinct from dispatch',async()=>{
  const p=setup(undefined,vi.fn(async()=>{throw new Error('authentication-failed')}));await p.handler(request());const state=await p.diagnostics.status()
  expect(state?.state).toBe('failed');expect(state?.events.map(e=>e.stage)).toEqual(['reserved','authentication-start','failure']);expect(p.send).not.toHaveBeenCalled()
 })
 it.each([400,403,429,500])('preserves HTTP %s and allowlisted codes, never messages or field values',async status=>{
  const p=setup(vi.fn(async()=>Response.json({error:{code:status,status:'INVALID_ARGUMENT',message:secret,details:[{reason:secret}]}},{status})))
  await p.handler(request());const state=await p.diagnostics.status()
  expect(state?.state).toBe('failed');expect(state?.events).toContainEqual(expect.objectContaining({stage:'provider-http',httpStatus:status,googleCode:status,googleStatus:'INVALID_ARGUMENT'}))
  expect(await readFile(join(dir,'record.jsonl'),'utf8')).not.toContain(secret);expect(p.send).toHaveBeenCalledTimes(1)
 })
 it.each(['malformed','oversized','arbitrary'])('bounds private error capture: %s',async kind=>{
  const body=kind==='malformed'?secret:kind==='oversized'?secret.repeat(1000):JSON.stringify({error:{status:secret,code:secret,message:secret}})
  const p=setup(vi.fn(async()=>new Response(body,{status:403})));await p.handler(request());const state=await p.diagnostics.status()
  expect(state?.events).toContainEqual(expect.objectContaining({stage:'provider-http',httpStatus:403}));expect(await readFile(join(dir,'record.jsonl'),'utf8')).not.toContain(secret)
 })
 it('preserves an allowlisted per-image Google code even with HTTP 200',async()=>{
  const p=setup(vi.fn(async()=>Response.json({responses:[{error:{code:7,status:'PERMISSION_DENIED',message:secret}}]})))
  await p.handler(request());const state=await p.diagnostics.status()
  expect(state?.state).toBe('failed');expect(state?.events).toContainEqual(expect.objectContaining({stage:'provider-http',httpStatus:200,googleCode:7,googleStatus:'PERMISSION_DENIED'}))
  expect(await readFile(join(dir,'record.jsonl'),'utf8')).not.toContain(secret)
 })
 it.each(['normalize','parse'])('distinguishes %s failure',async mode=>{
  const doc=fictionalShortOcr();doc.words=doc.words.filter(w=>w.text!=='כמות')
  const p=setup(vi.fn(async()=>Response.json(mode==='normalize'?{secret}:visionResponse(doc))))
  await p.handler(request());const stages=(await p.diagnostics.status())!.events.map(e=>e.stage)
  expect(stages).toContain('normalization-start');expect(stages.includes('parsing-start')).toBe(mode==='parse');expect(stages.at(-1)).toBe('failure')
 })
 it.each(['disconnect','timeout'])('records %s interruption and rejects late completion',async mode=>{
  let finish!:(r:Response)=>void;const p=setup(vi.fn(()=>new Promise(resolve=>{finish=resolve}))),c=new AbortController()
  const pending=createVisionLocalHandler(p.ports,40)(request(c.signal));await vi.waitFor(()=>expect(p.send).toHaveBeenCalledTimes(1),{interval:1,timeout:1000})
  if(mode==='disconnect')c.abort();expect((await pending).status).toBe(408)
  const before=await readFile(join(dir,'record.jsonl'),'utf8');expect((await p.diagnostics.status())?.state).toBe('interrupted')
  finish(Response.json(visionResponse(fictionalShortOcr())));await new Promise(resolve=>setTimeout(resolve,10));expect(await readFile(join(dir,'record.jsonl'),'utf8')).toBe(before)
 })
 it('concurrent submissions produce one durable record and dispatch',async()=>{
  const p=setup();expect((await Promise.all([p.handler(request()),p.handler(request())])).map(r=>r.status).sort()).toEqual([200,409]);expect(p.send).toHaveBeenCalledTimes(1)
 })
 it('fails closed if initial or pre-dispatch diagnostic persistence fails',async()=>{
  const p=setup();p.ports.diagnostics.start=async()=>{throw new Error(secret)};expect((await p.handler(request())).status).toBe(422);expect(p.auth).not.toHaveBeenCalled();expect(p.send).not.toHaveBeenCalled()
  const send=vi.fn();await expect(createVisionTransport(async()=>secret,send)(image(),new AbortController().signal,async stage=>{if(stage==='dispatch-initiated')throw new Error('diagnostics-unavailable')})).rejects.toThrow();expect(send).not.toHaveBeenCalled()
 })
 it('inspects incomplete or legacy consumed records without inventing completion; rejects foreign origins',async()=>{
  const p=setup();await p.ports.reserve();const session=await p.diagnostics.start();await session.emit('authentication-start')
  const get=()=>new Request('http://127.0.0.1:3000/api/receipt-ocr',{headers:{host:'127.0.0.1:3000','sec-fetch-site':'same-origin','x-spendscape-local-vision':'1','x-spendscape-vision-status':'1'}})
  expect(await (await p.handler(get())).json()).toMatchObject({code:'attempt-status',consumed:true,attempt:{state:'incomplete'}})
  const foreign=get();foreign.headers.set('origin','https://example.com');expect((await p.handler(foreign)).status).toBe(503)
  expect(await visionAttemptRecord(join(dir,'absent.jsonl')).status()).toBeNull()
 })
 it('rejects unsafe or oversized persisted data and exact metadata allowlists exclude secrets',async()=>{
  expect(safeAttemptEvent('provider-http',100,{httpStatus:403,googleCode:403,googleStatus:secret,message:secret,field:secret})).toEqual({stage:'provider-http',elapsedMs:100,httpStatus:403,googleCode:403})
  expect(safeAttemptEvent('provider-http',100,{httpStatus:418,googleCode:99})).toEqual({stage:'provider-http',elapsedMs:100,httpStatus:418})
  await writeFile(join(dir,'record.jsonl'),secret.repeat(1000));await expect(visionAttemptRecord(join(dir,'record.jsonl')).status()).rejects.toThrow('diagnostics-unavailable')
 })
})
