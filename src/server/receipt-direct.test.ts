import {afterEach,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules()})
async function capability(){const {handleReceiptDirect}=await import('./receipt-direct');return handleReceiptDirect(new Request('http://127.0.0.1:3120/api/receipt-direct',{headers:{'sec-fetch-site':'same-origin','x-spendscape-local-gemini':'1'}}))}
it.each(['default','free-only','hosted','ci','invalid-qa'])('native mode %s is disabled without all independent gates',async mode=>{
 vi.stubGlobal('fetch',()=>{throw new Error('offline-network-forbidden')})
 for(const key of ['SPENDSCAPE_DIRECT_IMAGE_QA','SPENDSCAPE_DIRECT_IMAGE_LOCAL','SPENDSCAPE_DIRECT_IMAGE_FREE_CONFIRMED','SPENDSCAPE_DIRECT_IMAGE_QUOTA_CONFIRMED','VERCEL','CI'])vi.stubEnv(key,'')
 vi.stubEnv('GEMINI_API_KEY','SYNTHETIC_SECRET_NEVER_READ')
 if(mode!=='default'){vi.stubEnv('SPENDSCAPE_DIRECT_IMAGE_LOCAL','1');vi.stubEnv('SPENDSCAPE_DIRECT_IMAGE_FREE_CONFIRMED','1');vi.stubEnv('SPENDSCAPE_DIRECT_IMAGE_PROJECT','fictional-project')}
 if(mode==='hosted'||mode==='ci'){vi.stubEnv('SPENDSCAPE_DIRECT_IMAGE_QUOTA_CONFIRMED','1');vi.stubEnv(mode==='hosted'?'VERCEL':'CI','1')}
 if(mode==='invalid-qa'){vi.stubEnv('SPENDSCAPE_DIRECT_IMAGE_QA','1');vi.stubEnv('SPENDSCAPE_DIRECT_IMAGE_QA_RUN','../bad')}
 const r=await capability();expect(r.status).toBe(503);expect(await r.json()).toEqual({code:'ocr-unavailable'})
})
it('fictional capability is explicitly labelled, isolated, and performs no transport',async()=>{
 vi.stubGlobal('fetch',()=>{throw new Error('offline-network-forbidden')});vi.stubEnv('SPENDSCAPE_DIRECT_IMAGE_QA','1');vi.stubEnv('SPENDSCAPE_DIRECT_IMAGE_QA_RUN','offline-capability-test');vi.stubEnv('VERCEL','');vi.stubEnv('CI','')
 const r=await capability();expect(await r.json()).toMatchObject({code:'local-gemini-ready',mode:'fictional-qa',attempts:[{attempt:1,consumed:false},{attempt:2,consumed:false}]})
})
