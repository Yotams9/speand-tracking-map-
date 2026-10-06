import {it,expect,vi,afterEach,beforeEach} from 'vitest'
import {inspectParser,validateParserInspection} from './parser-inspection'
import {fictionalShortOcr,visionResponse} from './vision-fixtures'
import {fictionalOcr} from './ocr-fixtures'
import {parseVisionReceipt} from './short-receipt-parser'
import {createVisionLocalHandler} from './vision-local-boundary'
import {safeAttemptEvent} from './vision-attempt'
const marker='FICTIONAL_PRIVATE_MARKER'
const bad=()=>{const d=fictionalShortOcr();d.words.push({text:marker,x:10,y:320,width:190,height:20});return d}
beforeEach(()=>vi.stubGlobal('fetch',()=>{throw Error('OFFLINE_NETWORK_GUARD')}))
afterEach(()=>vi.unstubAllGlobals())
it('actual parser trace survives rejection and marks only the rejected row',()=>{
 const d=bad(),before=structuredClone(d),result=inspectParser(d);expect(result.inspection.reason).toBe('item-row-unassigned');expect(result.parsed).toBeUndefined();expect(validateParserInspection(result.inspection)).toBe(true);expect(d).toEqual(before)
 expect(result.inspection.rows.filter(r=>r.rejected)).toHaveLength(1)
 expect(result.inspection.rows.find(r=>r.rejected)?.words.map(i=>d.words[i].text)).toEqual([marker]);expect(result.inspection.rows.map(r=>r.kind)).toEqual(expect.arrayContaining(['header','item','numeric-details','summary','unassigned']))
})
it.each(['short','labelled'])('trace does not change successful %s parsing or financial facts',kind=>{
 const d=kind==='short'?fictionalShortOcr(15):fictionalOcr('fifteen');const result=inspectParser(d);expect(result.parsed).toEqual(parseVisionReceipt(d));expect(result.inspection.reason).toBeNull();expect(validateParserInspection(result.inspection)).toBe(true)
})
it('wrapped text uses parser continuation classification',()=>{const d=fictionalShortOcr();d.words.push({text:'Wrapped',x:500,y:285,width:60,height:5});const r=inspectParser(d);expect(r.inspection.rows.some(row=>row.kind==='continuation')).toBe(true)})
it.each(['reason','kind','index','extra','geometry','sparse'])('rejects malformed transient %s payload',kind=>{
 const r=structuredClone(inspectParser(bad()).inspection) as any;
 if(kind==='reason')r.reason=marker;if(kind==='kind')r.rows[0].kind=marker;if(kind==='index')r.rows[0].words[0]=9999;if(kind==='extra')r.secret=marker;if(kind==='geometry')r.document.words[0].x=-1;if(kind==='sparse')delete r.rows[0];expect(validateParserInspection(r)).toBe(false)
})
const png=()=>{const b=new Uint8Array(33);b.set([137,80,78,71,13,10,26,10]);b.set([73,72,68,82],12);new DataView(b.buffer).setUint32(8,13);new DataView(b.buffer).setUint32(16,64);new DataView(b.buffer).setUint32(20,64);return b}
const request=(inspection=true,origin='http://127.0.0.1:3000')=>new Request('http://127.0.0.1:3000/api/receipt-ocr',{method:'POST',headers:{host:'127.0.0.1:3000',origin,'content-type':'image/png','x-spendscape-local-vision':'1',...(inspection?{'x-spendscape-parser-inspection':'1'}:{})},body:png()})
function setup(enabled=true,good=false){let consumed=false;const events:unknown[]=[];const recognize=vi.fn(async()=>visionResponse(good?fictionalShortOcr():bad()));const ports={enabled:true,inspectionEnabled:enabled,approvedHash:'a'.repeat(64),hash:()=> 'a'.repeat(64),consumed:async()=>consumed,reserve:async()=>{if(consumed)throw Error('attempt-consumed');consumed=true},recognize,diagnostics:{start:async()=>({emit:async(stage:any,m:any)=>{events.push(safeAttemptEvent(stage,1,m))}}),status:async()=>null}};return {ports,events,recognize}}
it('opt-in failure exposes transient inspection only; durable events contain no receipt content',async()=>{
 const p=setup(),handler=createVisionLocalHandler(p.ports),res=await handler(request());expect(res.status).toBe(422);const body=await res.json();expect(validateParserInspection(body.inspection)).toBe(true);expect(body).not.toHaveProperty('observations');expect(JSON.stringify(p.events)).not.toContain(marker);expect(p.events).toContainEqual({stage:'failure',elapsedMs:1,code:'layout-unsupported',layoutReason:'item-row-unassigned'});expect(res.headers.get('cache-control')).toBe('no-store');expect((await handler(request())).status).toBe(409);expect(p.recognize).toHaveBeenCalledTimes(1)
})
it.each([[false,true],[true,false]])('server=%s user=%s keeps content disabled',async(server,user)=>{const p=setup(server),body=await(await createVisionLocalHandler(p.ports)(request(user))).text();expect(body).not.toContain(marker);expect(body).not.toContain('inspection')})
it('foreign origin cannot inspect or dispatch',async()=>{const p=setup();expect((await createVisionLocalHandler(p.ports)(request(true,'https://example.com'))).status).toBe(503);expect(p.recognize).not.toHaveBeenCalled()})
it('successful inspection is isolated from observations/save output',async()=>{const p=setup(true,true),body=await(await createVisionLocalHandler(p.ports)(request())).json();expect(body.code).toBe('parser-inspection');expect(body).not.toHaveProperty('observations');expect(validateParserInspection(body.inspection)).toBe(true)})

it('disabled/hosted boundary cannot expose inspection or reserve a request',async()=>{const p=setup();p.ports.enabled=false;expect((await createVisionLocalHandler(p.ports)(request())).status).toBe(503);expect(p.recognize).not.toHaveBeenCalled();expect(await p.ports.consumed()).toBe(false)})

it('associated leading amount is numeric detail, never a standalone item or skipped row',()=>{const d=fictionalShortOcr();d.words.find(w=>w.y===260&&w.x===60)!.y=240;const r=inspectParser(d);const row=r.inspection.rows.find(row=>row.words.some(i=>d.words[i].y===240))!;expect(row.kind).toBe('numeric-details');expect(row.rejected).toBe(false);expect(r.inspection.rows.filter(row=>row.kind==='item')).toHaveLength(1);expect(r.parsed).toEqual(parseVisionReceipt(d))})
it('unsupported leading ownership marks only the actual rejected prefix',()=>{const d=fictionalShortOcr();d.words.find(w=>w.y===260&&w.x===60)!.y=240;d.words.push({text:'Header',x:500,y:255,width:50,height:5});const r=inspectParser(d);expect(r.inspection.reason).toBe('item-row-unassigned');const rejected=r.inspection.rows.filter(row=>row.rejected);expect(rejected).toHaveLength(1);expect(rejected[0].words.every(i=>d.words[i].y===240)).toBe(true);expect(r.inspection.rows.filter(row=>row.kind==='item')).toHaveLength(0)})
