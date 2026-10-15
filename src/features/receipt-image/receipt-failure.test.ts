import {describe,it,expect,vi} from 'vitest'
import {captureResponse,boundedCaptureJson} from './structured-capture-response'
import {ReceiptDecodeFailure,validReceiptFailure,reviewFailure,receiptFailureFrom} from './receipt-failure'
import {fictionalStructured,structuredEnvelope,structuredResponse} from './structured-image-contract'
import * as adapter from '../capture/receipt-review-adapter'
import {receiptToReviewDraft,prepareReceiptReview} from '../capture/receipt-review-adapter'
import {createFixtureSpendscapeRepository} from '../../data/spendscape-repository'
import {safeAttemptEvent} from './vision-attempt'
const secret='SYNTHETIC_PRIVATE_TOKEN_RECEIPT_782.94'
function detail(raw:unknown){try{captureResponse(raw);throw Error('unexpected-success')}catch(e){expect((e as Error).message).toBe('ocr-invalid');const d=receiptFailureFrom(e)!;expect(validReceiptFailure(d)).toBe(true);expect(JSON.stringify(d)).not.toContain(secret);return d}}
const envelope=(parts:unknown[],finishReason='STOP')=>({candidates:[{finishReason,content:{parts}}]})
describe('actual operational decoding predicates, content-free projection',()=>{
 it.each([null,{},[],{candidates:[]},{promptFeedback:{blockReason:'SAFETY',message:secret}},{candidates:[null]},{candidates:[{},{}]}].map(raw=>[raw]))('distinguishes unavailable/blocked candidates and response structure',raw=>{
  const d=detail(raw);expect(['response-structure','candidate-missing','candidate-blocked']).toContain(d.category)
 })
 it('records exact allowlisted finish reasons and never finishes partial output',()=>{
  for(const finish of ['MAX_TOKENS','SAFETY','RECITATION','STOP_BUT_PRIVATE_'+secret]){const d=detail(envelope([{text:JSON.stringify(fictionalStructured('one'))}],finish));expect(d).toMatchObject({category:finish==='MAX_TOKENS'?'truncated':'provider-finish',finishReason:finish.startsWith('STOP_BUT')?'UNKNOWN':finish})}
 })
 it('does not confuse an unknown provider block reason with a known reason',()=>expect(detail({promptFeedback:{blockReason:secret},candidates:[]})).toMatchObject({category:'candidate-blocked',blockReason:'UNKNOWN'}))
 it.each([[{text:secret}],[{text:'```json\n{}\n```'}],[{text:'{"lines":'}],[{text:'{}'},{text:'{}'}]].map(parts=>[parts]))('invalid output JSON is not repaired',parts=>expect(detail(envelope(parts))).toMatchObject({category:'invalid-json',path:'output.json'}))
 it.each([[{functionCall:{name:secret}}],[{text:'x',thought:'false'}],[{text:'x',thoughtSignature:2}],[null],Array.from({length:17},()=>({text:''})),[{thought:true,text:secret}]].map(parts=>[parts]))('rejects unsupported/empty part structure',parts=>expect(['response-structure','candidate-missing']).toContain(detail(envelope(parts)).category))
 it('bounds aggregate UTF8 bytes and projects only capped counts',()=>expect(detail(envelope([{text:'א'.repeat(32001)}]))).toMatchObject({category:'response-structure',limitExceeded:true,partCount:1}))
 it.each(['one','fifteen'] as const)('demonstrates and narrowly corrects supported multipart %s JSON without changing facts',kind=>{
  const o=fictionalStructured(kind),text=JSON.stringify(o),cuts=[0,Math.floor(text.length/3),Math.floor(text.length*2/3),text.length];const parts=cuts.slice(0,-1).map((from,i)=>({text:text.slice(from,cuts[i+1]),thoughtSignature:secret}));parts.splice(1,0,{text:secret,thought:true} as any)
  const raw=envelope(parts);expect(()=>structuredResponse(raw)).toThrow('ocr-invalid');expect(captureResponse(raw)).toEqual(o);expect(receiptToReviewDraft(captureResponse(raw)).observations).toEqual(o);expect(JSON.stringify(captureResponse(raw))).not.toContain(secret)
 })
 it('unchanged single-part acceptance, unresolved facts and strict money/identity rejection',()=>{
  const o=fictionalStructured('one');expect(captureResponse(structuredEnvelope(o))).toEqual(structuredResponse(structuredEnvelope(o)));o.currency=o.date=o.time=null;o.lines[0].unit=o.lines[0].unitPrice=null;expect(captureResponse(structuredEnvelope(o))).toEqual(o)
  for(const value of ['1e3','-4','1.234',secret]){o.lines[0].unitPrice=value;expect(detail(structuredEnvelope(o))).toMatchObject({category:'observation-contract',path:'observations'})}
  expect(detail(structuredEnvelope({...fictionalStructured('one'),extra:secret})).category).toBe('observation-contract')
  const b=fictionalStructured('one');b.lines[0].barcode={original:'4006381333932',format:'EAN13'};expect(detail(structuredEnvelope(b)).category).toBe('observation-contract')
 })
 it('separates expected review requirements and arithmetic errors from extraction failure',async()=>{
  const context=await createFixtureSpendscapeRepository().loadSnapshot(),d=receiptToReviewDraft(captureResponse(structuredEnvelope(fictionalStructured('one'))));let r=prepareReceiptReview(d,context);expect(r.ready).toBe(false);expect(!r.ready&&reviewFailure(r.errors)).toMatchObject({category:'review-validation',path:'review'})
  Object.assign(d.review,{merchantId:context.merchants[0].id,channel:'unknown',payment:'unknown',category:'unknown',date:'2026-10-04T07:20'});d.review.lines[0].printedAmount='12.49';r=prepareReceiptReview(d,context);expect(!r.ready&&reviewFailure(r.errors)).toMatchObject({fieldPaths:['lines.printedAmount']});d.review.lines[0].printedAmount='12.50';expect(prepareReceiptReview(d,context).ready).toBe(true);expect(d.observations.finalAmount).toBe('12.40');expect(d.observations.lines[0].lineAmount).toBe('12.50');expect(reviewFailure({})).toBeUndefined()
 })
 it('strict allowlists exclude values, arbitrary paths, getters, sparse arrays and oversized counts',()=>{
  const valid={version:1,category:'invalid-json',path:'output.json'};expect(validReceiptFailure(valid)).toBe(true)
  for(const v of [{...valid,category:'truncated'},{...valid,message:secret},{...valid,path:secret},{...valid,finishReason:secret},{...valid,partCount:17},{...valid,fieldPaths:[secret]},{...valid,fieldPaths:['date',...Array(8).fill('currency')]},{...valid,fieldPaths:Array(1)}])expect(validReceiptFailure(v)).toBe(false)
  const getter={...valid};Object.defineProperty(getter,'path',{get(){throw Error(secret)}});expect(validReceiptFailure(getter)).toBe(false)
  const event=safeAttemptEvent('failure',10,{code:'ocr-invalid',receiptFailure:valid,raw:secret});expect(event).toMatchObject({receiptFailure:valid});expect(JSON.stringify(event)).not.toContain(secret);expect(safeAttemptEvent('provider-http',10,{receiptFailure:valid})).not.toHaveProperty('receiptFailure')
 })
 it('draft construction exceptions have a separate fixed category',()=>{const spy=vi.spyOn(adapter,'receiptToReviewDraft').mockImplementation(()=>{throw Error(secret)});try{expect(detail(structuredEnvelope(fictionalStructured('one')))).toMatchObject({category:'review-contract',path:'review'})}finally{spy.mockRestore()}})
 it('a failing response stream cannot leak its arbitrary error message',async()=>{const response=new Response(new ReadableStream({start(controller){controller.error(Error(secret))}}));await expect(boundedCaptureJson(response,new AbortController().signal)).rejects.toMatchObject({message:'ocr-invalid',receiptFailure:{category:'response-structure',path:'response'}})})
 it('only a trusted local error class carries diagnostics',()=>{expect(receiptFailureFrom({message:'ocr-invalid',receiptFailure:{version:1,category:'invalid-json',path:'output.json'}})).toBeUndefined();expect(receiptFailureFrom(new ReceiptDecodeFailure({category:'review-contract',path:'review'}))).toMatchObject({category:'review-contract'})})
 it('outer response JSON/UTF8/body bounds are distinct and do not leak parse messages',async()=>{
  const signal=new AbortController().signal
  for(const [response,category] of [[new Response(secret),'invalid-json'],[new Response(new Uint8Array([255])),'response-structure'],[new Response('x'.repeat(128001)),'response-structure']] as const){try{await boundedCaptureJson(response,signal);throw Error('unexpected')}catch(e){expect((e as Error).message).toBe('ocr-invalid');expect(receiptFailureFrom(e)?.category).toBe(category);expect(JSON.stringify(receiptFailureFrom(e))).not.toContain(secret)}}
 })
})
