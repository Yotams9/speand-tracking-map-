import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {mkdtemp,readFile,rm,readdir,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DIRECT_MODEL,DIRECT_PROMPT,DIRECT_SCHEMA,directRequest,directResponse,fictionalDirect,fictionalDirectResponse} from './direct-image-contract'
import {boundedDirectJson,createDirectTransport} from './direct-image-transport'
import {createDirectHandler,directLocal} from './direct-image-boundary'
import {directPilot,DIRECT_IMAGES} from '../../server/direct-image-pilot'
import {receiptToReviewDraft,prepareReceiptReview,validateReceiptObservations} from '../capture/receipt-review-adapter'
import {createFixtureSpendscapeRepository} from '../../data/spendscape-repository'
const data=await createFixtureSpendscapeRepository().loadSnapshot()
const roots:string[]=[]
beforeEach(()=>vi.stubGlobal('fetch',()=>{throw new Error('offline-network-forbidden')}))
afterEach(async()=>{vi.unstubAllGlobals();for(const r of roots.splice(0))await rm(r,{recursive:true,force:true})})
async function setup(){const root=await mkdtemp(join(tmpdir(),'direct-image-test-'));roots.push(root);return {root,pilot:directPilot(root,0)}}
function png(){const b=new Uint8Array(33);b.set([137,80,78,71,13,10,26,10]);const d=new DataView(b.buffer);d.setUint32(8,13);d.setUint32(12,0x49484452);d.setUint32(16,32);d.setUint32(20,32);return b}
function request(signal?:AbortSignal,extra:Record<string,string>={}){return new Request('http://127.0.0.1:3120/api/receipt-direct',{method:'POST',headers:{origin:'http://127.0.0.1:3120','content-type':'image/png','x-spendscape-local-gemini':'1',...extra},body:png(),signal})}
const completed=()=>{const d=receiptToReviewDraft(fictionalDirect('fifteen'));Object.assign(d.review,{merchantId:data.merchants[0].id,channel:'unknown',date:'2026-10-03T06:15',payment:'cash',category:'groceries'});return d}
describe('direct proposed observations and unchanged save boundary',()=>{
 it('freezes a minimal inline-image generateContent request without truth or tools',()=>{
  const r=directRequest('image/png','SYNTHETIC_IMAGE');expect(Object.keys(r)).toEqual(['contents','generationConfig']);expect(r.contents[0].parts[1]).toEqual({inlineData:{mimeType:'image/png',data:'SYNTHETIC_IMAGE'}})
  expect(r.generationConfig).toEqual({maxOutputTokens:8192,responseFormat:{text:{mimeType:'APPLICATION_JSON',schema:DIRECT_SCHEMA}}})
  expect(DIRECT_MODEL).toBe('gemini-3.8-flash');expect(DIRECT_PROMPT).not.toMatch(/12\.50|41\.00|ground.?truth|Oats/)
 })
 it.each(['one','fifteen'] as const)('retains every %s row, language, printed code, discount and numeric spelling',kind=>{
  const o=directResponse(fictionalDirectResponse(kind));expect(o).toEqual(fictionalDirect(kind));const draft=receiptToReviewDraft(o);expect(draft.observations).toEqual(o);expect(draft.barcodes.every(v=>v===null)).toBe(true);expect(draft.review.merchantId).toBe('');expect(draft.review.date).toBe('');expect(prepareReceiptReview(draft,data).ready).toBe(false)
 })
 it('optional fields do not block explicit contextual review; printed codes never enter save projection',()=>{
  const d=completed(),result=prepareReceiptReview(d,data);expect(result.ready).toBe(true);if(result.ready)expect(JSON.stringify(result.input)).not.toMatch(/printedIdentifier|observations|vat|barcode/)
 })
 it.each(['currency','date','time','finalAmount','merchantName'] as const)('missing %s stays null/blank rather than inferred',key=>{const o=fictionalDirect('one');o[key]=null;expect(directResponse({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(o)}]}}]} )[key]).toBeNull();expect(prepareReceiptReview(receiptToReviewDraft(o),data).ready).toBe(false)})
 it.each(['quantity','unit','unitPrice','lineAmount','name'] as const)('missing line %s requires review',key=>{const o=fictionalDirect('one');o.lines[0][key]=null;const d=receiptToReviewDraft(directResponse({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(o)}]}}]}));expect(prepareReceiptReview(d,data).ready).toBe(false)})
 it.each(['-1.00','99.00','bad',''])('invalid/excessive/unresolved discount %s remains blocking',discount=>{const d=completed();d.review.lines[0].discount=discount;expect(prepareReceiptReview(d,data).ready).toBe(false)})
 it('line mismatch blocks; a reviewed payable difference preserves both amounts without allocation',()=>{
  const d=completed();d.review.lines[0].printedAmount='0.01';const r=prepareReceiptReview(d,data)
  expect(r.ready).toBe(false);if(!r.ready)expect(r.errors['printedAmount-0']).toBe('arithmetic')
  expect(d.observations.lines[0].lineAmount).toBe('6.00')
  const other=completed(),observations=structuredClone(other.observations),lines=structuredClone(other.review.lines)
  other.review.amount='40.00'
  expect(prepareReceiptReview(other,data)).toMatchObject({ready:true,input:{amount:'40.00'}})
  expect(other.observations).toEqual(observations);expect(other.review.lines).toEqual(lines)
 })
 it.each(['MAX_TOKENS','SAFETY','RECITATION','OTHER'])('rejects incomplete/refused %s',finishReason=>expect(()=>directResponse({candidates:[{finishReason,content:{parts:[{text:JSON.stringify(fictionalDirect('one'))}]}}]})).toThrow('ocr-invalid'))
 it.each([null,{},{candidates:[]},{candidates:[{},{}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'bad'}]}}]}])('rejects malformed provider envelope %j',raw=>expect(()=>directResponse(raw)).toThrow('ocr-invalid'))
 it('rejects extra payloads, arbitrary identifiers and numeric coercion',()=>{for(const raw of [{...fictionalDirect('one'),secret:'SECRET'}, {...fictionalDirect('one'),lines:[{...fictionalDirect('one').lines[0],barcode:null}]},{...fictionalDirect('one'),finalAmount:12.5}])expect(()=>directResponse({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(raw)}]}}]})).toThrow('ocr-invalid');expect(validateReceiptObservations({...fictionalDirect('one'),lines:[{...fictionalDirect('one').lines[0],printedIdentifier:{candidates:['DEMO-A','DEMO-B']}}]})).toBe(true)})
})
describe('transport privacy and bounded diagnostics',()=>{
 it('uses one fixed endpoint, header credential, no redirects or retries',async()=>{
  const events:unknown[]=[];let calls=0
  const run=createDirectTransport(()=> 'SYNTHETIC_SECRET_CREDENTIAL',async(url,init)=>{calls++;expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');expect(init?.redirect).toBe('error');expect(url).not.toContain('SYNTHETIC_SECRET');return Response.json(fictionalDirectResponse('one'))})
  expect(directResponse(await run(png(),'image/png',new AbortController().signal,async(s,m)=>{events.push({s,m})}))).toEqual(fictionalDirect('one'));expect(calls).toBe(1);expect(JSON.stringify(events)).not.toMatch(/SYNTHETIC_SECRET|DEMO-ITEM|מכולת/)
 })
 it.each([400,401,403,429,500,503])('HTTP %i keeps only status/allowlisted Google code',async status=>{
  const {pilot}=await setup();const run=createDirectTransport(()=> 'SYNTHETIC_SECRET_CREDENTIAL',async()=>Response.json({error:{code:status,status:'INVALID_ARGUMENT',message:'SYNTHETIC_SECRET RECEIPT 99.99',details:[{reason:'private'}]}},{status}))
  const handler=createDirectHandler({enabled:true,fictionalQa:false,hash:()=>DIRECT_IMAGES[0],slot:async h=>pilot.slot(h),status:pilot.status,recognize:(b,m,s,e)=>run(b,m,s,e)})
  const r=await handler(request());expect(await r.json()).toMatchObject({code:'recognition-failed',httpStatus:status,googleStatus:'INVALID_ARGUMENT'});expect(JSON.stringify(await pilot.status())).not.toMatch(/SECRET|99\.99|private|message/);await expect(pilot.slot(DIRECT_IMAGES[1])!.reserve()).rejects.toThrow('pilot-stopped')
 })
 it.each(['malformed','oversized'])('HTTP error %s body retains status without content',async kind=>{const events:unknown[]=[];const run=createDirectTransport(()=> 'SYNTHETIC_SECRET_CREDENTIAL',async()=>new Response(kind==='malformed'?'bad-secret':'S'.repeat(128001),{status:400}));await expect(run(png(),'image/png',new AbortController().signal,async(s,m)=>{events.push({s,m})})).rejects.toThrow('recognition-failed');expect(events).toContainEqual({s:'provider-http',m:{httpStatus:400}});expect(JSON.stringify(events)).not.toContain('secret')})
 it('bounds successful response size and rejects malformed JSON',async()=>{for(const body of ['bad', 'a'.repeat(128001)])await expect(boundedDirectJson(new Response(body),new AbortController().signal)).rejects.toThrow()})
 it('authentication failure makes zero dispatches',async()=>{let calls=0;const run=createDirectTransport(()=>'',async()=>{calls++;throw new Error('private')});await expect(run(png(),'image/png',new AbortController().signal,async()=>{})).rejects.toThrow('authentication-failed');expect(calls).toBe(0)})
})
describe('exclusive two-image pilot, lifecycle and interruption',()=>{
 it('native spacing waits at least 60 seconds after durable completion across restart, without early reservation',async()=>{
  const {root}=await setup();let clock=Date.now();const create=()=>directPilot(root,60_000,()=>clock)
  const one=create().slot(DIRECT_IMAGES[0])!;await one.reserve();const record=await one.diagnostics.start();await record.emit('review-response-complete')
  const path=join(root,'receipt-1','lifecycle.jsonl'),before=await readFile(path),at=(await stat(path)).mtimeMs
  for(const offset of [-1,0,59_999]){
   clock=at+offset;const restarted=create();let called=0
   const handler=createDirectHandler({enabled:true,fictionalQa:false,hash:()=>DIRECT_IMAGES[1],slot:async h=>restarted.slot(h),status:restarted.status,recognize:async()=>{called++;return fictionalDirectResponse('fifteen')}})
   const response=await handler(request());expect(response.status).toBe(409);expect(await response.json()).toEqual({code:'pilot-wait'});expect(called).toBe(0)
   expect((await restarted.status())[1].consumed).toBe(false);expect(await readdir(root)).toEqual(['receipt-1'])
  }
  expect(await readFile(path)).toEqual(before);clock=at+60_000
  const two=create().slot(DIRECT_IMAGES[1])!;const concurrent=await Promise.allSettled([two.reserve(),two.reserve()]);expect(concurrent.filter(r=>r.status==='fulfilled')).toHaveLength(1)
  await expect(create().slot(DIRECT_IMAGES[1])!.reserve()).rejects.toThrow('attempt-consumed')
 })
 it('supports Next loopback URL normalization while retaining exact browser origin and port checks',()=>{expect(directLocal(new Request('http://localhost:3120/api/receipt-direct',{method:'POST',headers:{host:'127.0.0.1:3120',origin:'http://127.0.0.1:3120','x-spendscape-local-gemini':'1'}}))).toBe(true)})
 it('two ordered permanent slots; concurrency, rerun and restart cannot add a third request',async()=>{
  const {root,pilot}=await setup(),one=pilot.slot(DIRECT_IMAGES[0])!,two=pilot.slot(DIRECT_IMAGES[1])!
  await expect(two.reserve()).rejects.toThrow('pilot-stopped');const results=await Promise.allSettled([one.reserve(),one.reserve()]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
  await expect(directPilot(root).slot(DIRECT_IMAGES[1])!.reserve()).rejects.toThrow('pilot-stopped')
  const record=await one.diagnostics.start();await record.emit('review-response-complete');await two.reserve();await two.diagnostics.start()
  for(const slot of [one,two])await expect(slot.reserve()).rejects.toThrow('attempt-consumed');expect((await directPilot(root).status()).every(s=>s.consumed)).toBe(true)
  expect(pilot.slot('unknown')).toBeNull();expect(await readdir(root)).toEqual(['receipt-1','receipt-2']);expect(await readFile(join(root,'receipt-1','reservation.json'),'utf8')).toContain('generateContent')
 })
 it('disabled, unapproved, cross-origin and forwarded requests never reserve or recognize',async()=>{
  const {pilot}=await setup();let calls=0;const p={enabled:true,fictionalQa:false,hash:()=> 'wrong',slot:async(h:string)=>pilot.slot(h),status:pilot.status,recognize:async()=>{calls++;return fictionalDirectResponse('one')}}
  const h=createDirectHandler(p);expect((await h(request())).status).toBe(422);for(const [key,value] of [['origin','https://evil.example'],['x-forwarded-for','203.0.113.1'],['x-forwarded-host','evil.example'],['host','localhost:3120']])expect(directLocal(request(undefined,{[key]:value}))).toBe(false)
  expect((await createDirectHandler({...p,enabled:false})(request())).status).toBe(503);expect(calls).toBe(0);expect((await pilot.status()).every(v=>!v.consumed)).toBe(true)
 })
 it('record creation failure is terminal before any transport',async()=>{let called=0;const h=createDirectHandler({enabled:true,fictionalQa:false,hash:()=>DIRECT_IMAGES[0],slot:async()=>({consumed:async()=>false,reserve:async()=>{},diagnostics:{start:async()=>{throw new Error('secret')},status:async()=>null}}),status:async()=>null,recognize:async()=>{called++;return fictionalDirectResponse('one')}});expect(await(await h(request())).json()).toMatchObject({code:'diagnostics-unavailable'});expect(called).toBe(0)})
 it.each(['abort','timeout'])('%s rejects a late response and preserves interruption after restart',async kind=>{
  const {root,pilot}=await setup();let resolve!:(v:unknown)=>void,started!:()=>void;const ready=new Promise<void>(r=>{started=r}),controller=new AbortController()
  const handler=createDirectHandler({enabled:true,fictionalQa:false,hash:()=>DIRECT_IMAGES[0],slot:async h=>pilot.slot(h),status:pilot.status,recognize:async(_b,_m,_s,emit)=>{await emit('dispatch-initiated');started();return new Promise(r=>{resolve=r})}},kind==='timeout'?30:45000)
  const pending=handler(request(controller.signal));await ready;if(kind==='abort')controller.abort();const r=await pending;expect((await r.json()).code).toBe('cancelled');resolve(fictionalDirectResponse('one'));await Promise.resolve();const status=await directPilot(root).status();expect(status[0].record?.state).toBe('interrupted');expect(status[0].record?.events.some(e=>e.stage==='review-response-complete')).toBe(false);await expect(pilot.slot(DIRECT_IMAGES[1])!.reserve()).rejects.toThrow('pilot-stopped')
 })
 it('malformed output fails safely after HTTP 200, with no review or content persistence',async()=>{const {pilot}=await setup();const h=createDirectHandler({enabled:true,fictionalQa:false,hash:()=>DIRECT_IMAGES[0],slot:async s=>pilot.slot(s),status:pilot.status,recognize:async(_b,_m,_s,e)=>{await e('provider-http',{httpStatus:200});return {candidates:[{finishReason:'STOP',content:{parts:[{text:'SECRET'}]}}]}}});expect(await(await h(request())).json()).toMatchObject({code:'ocr-invalid',httpStatus:200});const status=await pilot.status();expect(status[0].record?.state).toBe('failed');expect(JSON.stringify(status)).not.toContain('SECRET')})
 it('successful direct draft is memory-only and never normalizes geometry',async()=>{const {pilot}=await setup();const h=createDirectHandler({enabled:true,fictionalQa:false,hash:()=>DIRECT_IMAGES[0],slot:async s=>pilot.slot(s),status:pilot.status,recognize:async(_b,_m,_s,e)=>{await e('provider-http',{httpStatus:200});return fictionalDirectResponse('one')}});const r=await h(request());expect(r.headers.get('cache-control')).toBe('no-store');expect(await r.json()).toEqual({code:'direct-observations',observations:fictionalDirect('one')});const s=await pilot.status();expect(s[0].record?.state).toBe('complete');expect(s[0].record?.events.some(e=>e.stage.startsWith('normalization'))).toBe(false);expect(JSON.stringify(s)).not.toMatch(/DEMO-ITEM|Oats|12\.50/)
 })
})
