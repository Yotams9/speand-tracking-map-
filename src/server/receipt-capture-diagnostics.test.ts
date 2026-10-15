import {afterEach,it,expect,vi} from 'vitest'
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
vi.mock('server-only',()=>({}))
import {createCaptureHandler} from './receipt-capture'
import {captureSession,captureContractHash,CAPTURE_SESSION_MS} from './receipt-capture-session'
import {visionAttemptRecord} from './vision-attempt-record'
import {fictionalStructured,structuredEnvelope,structuredRequest} from '../features/receipt-image/structured-image-contract'
import {createStructuredTransport} from '../features/receipt-image/structured-image-transport'
import {captureTransport} from './receipt-capture'
const roots:string[]=[],id='e'.repeat(32),now=Date.parse('2026-10-12T10:00:00Z'),secret='SYNTHETIC_CREDENTIAL_CONTENT_78294'
const env={SPENDSCAPE_RECEIPT_CAPTURE:'native',SPENDSCAPE_RECEIPT_SESSION:id,SPENDSCAPE_RECEIPT_PROJECT:'spendscape-receipt-benchmark',SPENDSCAPE_RECEIPT_PROJECT_NUMBER:'376401338717',SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256:createHash('sha256').update(secret).digest('hex'),SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED:'1',GEMINI_API_KEY:secret}
function image(){const b=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.writeUInt32BE(13,8);b.write('IHDR',12);b.writeUInt32BE(64,16);b.writeUInt32BE(64,20);return b}
function request(){return new Request('http://127.0.0.1:3193/api/receipt-capture-session',{method:'POST',headers:{host:'127.0.0.1:3193',origin:'http://127.0.0.1:3193','x-spendscape-local-gemini':'1','content-type':'image/png'},body:image()})}
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true})})
it('successful pilot and operational request are byte-for-byte identical with mocked transport',async()=>{
 const bytes=image(),hash=createHash('sha256').update(JSON.stringify(structuredRequest('image/png',bytes.toString('base64')))).digest('hex'),sent:RequestInit[]=[],urls:unknown[]=[];const send:typeof fetch=async(url,options)=>{urls.push(url);sent.push(options!);return Response.json(structuredEnvelope(fictionalStructured('one')))};const emit=async()=>{};const signal=new AbortController().signal
 await createStructuredTransport(()=>secret,send,hash)(bytes,'image/png',signal,emit);await captureTransport(()=>secret,send)(bytes,'image/png',signal,emit);expect(urls[0]).toBe(urls[1]);expect(sent[0]).toEqual(sent[1]);expect(sent[0].body).toBe(sent[1].body)
})
it.each([
 [{candidates:[],promptFeedback:{blockReason:'SAFETY',message:secret}},'candidate-blocked'],
 [{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:secret}]}}]},'truncated'],
 [{candidates:[{finishReason:'STOP',content:{parts:[{text:secret}]}}]},'invalid-json'],
 [structuredEnvelope({...fictionalStructured('one'),extra:secret}),'observation-contract'],
])('persists actual category after failure/restart and refuses unused second allowance',async(raw,category)=>{
 const root=await mkdtemp(join(tmpdir(),'capture-diag-'));roots.push(root);const s=captureSession(root,id,()=>now);await s.initialize({version:1,model:'gemini-3.8-flash',contractHash:captureContractHash,maxRequests:2,ceilingMicroUsd:100000,createdAt:now,expiresAt:now+CAPTURE_SESSION_MS});const send=vi.fn(async()=>Response.json(raw));const h=createCaptureHandler(env,send,root,1000,()=>now);const result=await h(request());expect(result.status).toBe(422);expect(await result.json()).toMatchObject({code:'ocr-invalid',httpStatus:200,receiptFailure:{category}})
 const file=join(root,'artifacts/receipt-capture-sessions',id,'request-1.jsonl'),journal=await readFile(file,'utf8');expect(journal).not.toContain(secret);expect((await visionAttemptRecord(file).status())?.events.at(-1)?.receiptFailure?.category).toBe(category);expect((await captureSession(root,id,()=>now+60001).status()).state).toBe('stopped');expect((await createCaptureHandler(env,send,root,1000,()=>now+60001)(request())).status).toBe(409);expect(send).toHaveBeenCalledTimes(1);expect(await readFile(file,'utf8')).toBe(journal)
 await writeFile(file,journal.replace('"category":','"private":'+JSON.stringify(secret)+',"category":'));await expect(visionAttemptRecord(file).status()).rejects.toThrow('diagnostics-unavailable')
})
