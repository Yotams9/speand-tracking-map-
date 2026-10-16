// Offline contract checks. All keys, images, observations and transports are fictional.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto')
const root=path.resolve(__dirname,'..'),ts=require(path.join(root,'node_modules/typescript')),load=Module._load
Module._load=function(id,...args){return id==='server-only'?{}:load.call(this,id,...args)}
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f)
const {createHostedReceiptHandler,createHostedAddressHandler}=require(root+'/src/server/hosted-demo.ts')
const {structuredEnvelope,fictionalStructured,structuredRequest}=require(root+'/src/features/receipt-image/structured-image-contract.ts')
const origin='https://fictional.example',key='fictional_gemini_key_123456',now=Date.parse('2026-10-16T08:00:00Z')
const env={VERCEL:'1',SPENDSCAPE_HOSTED_MODE:'presentation',SPENDSCAPE_API_USAGE_MODE:'continuous',SPENDSCAPE_DEMO_ORIGIN:origin,SPENDSCAPE_DEMO_START_AT:'2026-10-16T05:00:00Z',SPENDSCAPE_DEMO_EXPIRES_AT:'2026-10-16T07:00:00Z',SPENDSCAPE_RECEIPT_PROJECT:'spendscape-receipt-benchmark',SPENDSCAPE_RECEIPT_PROJECT_NUMBER:'376401338717',SPENDSCAPE_RECEIPT_PREPAY_CONFIRMED:'1',GEMINI_API_KEY:key,SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256:crypto.createHash('sha256').update(key).digest('hex'),GEOAPIFY_API_KEY:'fictional_geoapify_key_123456',SPENDSCAPE_ADDRESS_FREE_READY:'1'}
const png=Buffer.alloc(34);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(64,16);png.writeUInt32BE(64,20)
const noQuota=()=>{throw Error('historical quota must not be accessed')}
const request=(kind,body,extra={})=>new Request(origin+'/api/'+kind,{method:body===undefined?'GET':'POST',headers:{host:'fictional.example',...(body===undefined?{}:{origin,'content-type':kind==='address-search'?'application/json':'image/png'}),...extra},...(body===undefined?{}:{body})})
const address=JSON.stringify({address:'Fictional street 16, Fictional city, Israel',locale:'en'})
const addressResult=()=>Response.json({results:[{formatted:'Fictional street 16, Fictional city, Israel',city:'Fictional city',country:'Israel',lon:34.75,lat:32.1,result_type:'building',rank:{match_type:'full_match'},datasource:{sourcename:'openstreetmap'}}]})
test('continuous GET is available after historical expiry with no quota access or dispatch',async()=>{
 const send=async()=>{throw Error('dispatch forbidden on GET')}
 for(const [kind,make,code]of[['receipt-capture-session',createHostedReceiptHandler,'local-capture-ready'],['address-search',createHostedAddressHandler,'available']]){
  const r=await make(env,send,noQuota,()=>now)(request(kind));assert.equal(r.status,200);const body=await r.json();assert.equal(body.mode,'native-service');assert.equal(body.session,undefined);assert.equal(body.code??body.status,code)
 }
})
test('twelve explicit identical receipt reads have no app count, cooldown or duplicate cap; request remains identical',async()=>{
 let calls=0;const h=createHostedReceiptHandler(env,async(url,opt)=>{calls++;assert.deepEqual(JSON.parse(opt.body),structuredRequest('image/png',png.toString('base64')));assert.equal(opt.headers['x-goog-api-key'],key);return Response.json(structuredEnvelope(fictionalStructured('one')))},noQuota,()=>now)
 for(let i=0;i<12;i++){const r=await h(request('receipt-capture-session',png));assert.equal(r.status,200);const body=await r.json();assert.equal(body.code,'direct-observations');assert.ok(!JSON.stringify(body).includes(key))}assert.equal(calls,12)
})
test('twelve explicit identical address searches have no app cap and need no session identifier',async()=>{
 let calls=0;const h=createHostedAddressHandler(env,async(url)=>{calls++;assert.equal(url.searchParams.get('text'),'Fictional street 16, Fictional city, Israel');return addressResult()},noQuota,()=>now)
 for(let i=0;i<12;i++){const r=await h(request('address-search',address));assert.equal(r.status,200);assert.equal((await r.json()).status,'results')}assert.equal(calls,12)
})
test('a provider receipt rejection has no automatic retry and does not stop a later explicit read',async()=>{
 let calls=0;const h=createHostedReceiptHandler(env,async()=>++calls===1?Response.json({error:{code:429,status:'RESOURCE_EXHAUSTED'}},{status:429}):Response.json(structuredEnvelope(fictionalStructured('one'))),noQuota,()=>now)
 assert.equal((await h(request('receipt-capture-session',png))).status,422);assert.equal(calls,1);assert.equal((await h(request('receipt-capture-session',png))).status,200);assert.equal(calls,2)
})
test('a provider address rejection has no automatic retry and does not stop later explicit search',async()=>{
 let calls=0;const h=createHostedAddressHandler(env,async()=>++calls===1?Response.json({},{status:429}):addressResult(),noQuota,()=>now)
 assert.equal((await(await h(request('address-search',address))).json()).status,'quota');assert.equal(calls,1);assert.equal((await(await h(request('address-search',address))).json()).status,'results');assert.equal(calls,2)
})
test('wrong-origin requests are still rejected without dispatch',async()=>{
 for(const [kind,make,body]of[['receipt-capture-session',createHostedReceiptHandler,png],['address-search',createHostedAddressHandler,address]]){const h=make(env,async()=>{throw Error('dispatch forbidden')},noQuota,()=>now);assert.equal((await h(request(kind,body,{origin:'https://other.example'}))).status,503)}
})
test('unknown continuous mode never falls back to unmetered operation',async()=>{
 for(const [kind,make]of[['receipt-capture-session',createHostedReceiptHandler],['address-search',createHostedAddressHandler]])assert.equal((await make({...env,SPENDSCAPE_API_USAGE_MODE:'unknown'},fetch,noQuota,()=>now)(request(kind))).status,503)
})
test('continuous operation requires the configured hosted presentation origin',async()=>{
 for(const change of[{VERCEL:undefined},{SPENDSCAPE_HOSTED_MODE:'protected-demo'},{SPENDSCAPE_DEMO_ORIGIN:'http://fictional.example'}])assert.equal((await createHostedAddressHandler({...env,...change},fetch,noQuota,()=>now)(request('address-search'))).status,503)
})
test('credential verification remains required',async()=>{
 assert.equal((await createHostedReceiptHandler({...env,SPENDSCAPE_RECEIPT_VERIFIED_KEY_SHA256:'0'.repeat(64)},fetch,noQuota,()=>now)(request('receipt-capture-session'))).status,503)
 assert.equal((await createHostedAddressHandler({...env,GEOAPIFY_API_KEY:''},fetch,noQuota,()=>now)(request('address-search'))).status,503)
})
test('receipt image validation still rejects invalid content before dispatch',async()=>{
 const h=createHostedReceiptHandler(env,async()=>{throw Error('dispatch forbidden')},noQuota,()=>now)
 const r=await h(request('receipt-capture-session',Buffer.from('invalid')));assert.equal(r.status,422);assert.equal((await r.json()).code,'image-format')
})
test('address-only input validation still rejects unrelated content before dispatch',async()=>{
 const h=createHostedAddressHandler(env,async()=>{throw Error('dispatch forbidden')},noQuota,()=>now)
 assert.equal((await h(request('address-search',JSON.stringify({address:'Fictional',locale:'en',receipt:'not allowed'})))).status,400)
})
test('GET availability does not claim a saved pin or purchase',async()=>{
 const h=createHostedAddressHandler(env,fetch,noQuota,()=>now),r=await(await h(request('address-search'))).json();assert.deepEqual(r,{status:'available',mode:'native-service'})
})
