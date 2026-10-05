import { describe, expect, it, vi } from 'vitest'
import { createOcrHandler } from './ocr-boundary'
import { fictionalOcr } from './ocr-fixtures'
const req=(body:unknown={fixture:'one'}, url='http://127.0.0.1:3000/api/receipt-ocr',headers:Record<string,string>={})=>new Request(url,{method:'POST',headers:{origin:new URL(url).origin,'content-type':'application/json','x-spendscape-local-qa':'1',...headers},body:JSON.stringify(body)})
describe('disabled server OCR boundary',()=>{
  it('never executes OCR for ordinary or hosted requests even with a QA selector',async()=>{
    const mock=vi.fn(async()=>fictionalOcr('one'));expect((await createOcrHandler(false,mock)(req())).status).toBe(503);expect((await createOcrHandler(true,mock)(req({},'https://spendscape-college-demo.vercel.app/api/receipt-ocr'))).status).toBe(503);expect((await createOcrHandler(true,mock)(req(undefined,undefined,{'x-spendscape-local-qa':'0'}))).status).toBe(503);expect(mock).not.toHaveBeenCalled()
  })
  it.each([{fixture:'one',image:'synthetic-secret'},{fixture:'bad'}, {fixture:'one',receipt:'synthetic-secret'}])('rejects arbitrary payload %j without echoing it',async body=>{
    const mock=vi.fn(async()=>fictionalOcr('one')),res=await createOcrHandler(true,mock)(req(body));expect(res.status).toBe(400);expect(await res.text()).not.toContain('synthetic-secret');expect(mock).not.toHaveBeenCalled()
  })
  it('requires same-origin JSON and caps request bodies',async()=>{
    const mock=vi.fn(async()=>fictionalOcr('one')),run=createOcrHandler(true,mock);expect((await run(req(undefined,undefined,{origin:'https://example.invalid'}))).status).toBe(400);expect((await run(req({fixture:'one',padding:'x'.repeat(200)}))).status).toBe(400);expect(mock).not.toHaveBeenCalled()
  })
  it('checks the browser Host origin when Next uses an internal localhost request URL',async()=>{
    const res=await createOcrHandler(true,async()=>fictionalOcr('one'))(req(undefined,'http://localhost:3000/api/receipt-ocr',{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}));expect(res.status).toBe(200)
    expect((await createOcrHandler(true,async()=>fictionalOcr('one'))(req(undefined,'http://localhost:3000/api/receipt-ocr',{host:'example.invalid',origin:'http://example.invalid'}))).status).toBe(503)
  })
  it('mock path validates and parses all 15 rows with no native network/storage/logging',async()=>{
    const network=vi.fn(()=>{throw new Error('network forbidden')}),log=vi.spyOn(console,'log').mockImplementation(()=>{throw new Error('logging forbidden')});vi.stubGlobal('fetch',network)
    try{const res=await createOcrHandler(true,async()=>fictionalOcr('fifteen'))(req({fixture:'fifteen'}));expect(res.headers.get('cache-control')).toBe('no-store');expect(res.status).toBe(200);const result=await res.json();expect(result.code).toBe('synthetic-qa');expect(result.observations.lines).toHaveLength(15);expect(network).not.toHaveBeenCalled();expect(log).not.toHaveBeenCalled()}finally{vi.unstubAllGlobals();log.mockRestore()}
  })
  it('rejects malformed geometry without raw payload or automatic retry',async()=>{
    const mock=vi.fn(async()=>({secret:'synthetic-secret'})),res=await createOcrHandler(true,mock)(req());expect(res.status).toBe(422);expect(await res.text()).not.toContain('synthetic-secret');expect(mock).toHaveBeenCalledTimes(1)
  })
  it('bounds mock infrastructure timeout and never returns late output',async()=>{
    let done!: (v:unknown)=>void;const mock=vi.fn(()=>new Promise(r=>done=r));const res=await createOcrHandler(true,mock,20)(req());expect(res.status).toBe(408);expect(await res.json()).toEqual({code:'cancelled'});done(fictionalOcr('one'));expect(mock).toHaveBeenCalledTimes(1)
  })
})
