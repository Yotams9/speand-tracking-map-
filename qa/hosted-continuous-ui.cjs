const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),ts=require(root+'/node_modules/typescript')
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f)
const {chromium,expect}=require(root+'/node_modules/@playwright/test'),{fictionalStructured}=require(root+'/src/features/receipt-image/structured-image-contract.ts'),{createFixtureSpendscapeRepository}=require(root+'/src/data/spendscape-repository.ts'),{blankReview,emptySessionLedger,saveReviewedPurchase}=require(root+'/src/features/capture/session-purchase-domain.ts'),{emptyLocalPurchases}=require(root+'/src/features/local-purchases/local-purchase-store.ts')
const base=process.env.SPENDSCAPE_CONTINUOUS_UI_BASE;if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base??''))throw Error('isolated-loopback-required')
const origin='https://continuous-fictional.example'
async function disk(p){return p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('spendscape-local-purchases',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('state'),q=t.objectStore('state').get('current');t.oncomplete=()=>{db.close();resolve(q.result)}}}))}
;(async()=>{let browser;try{
 const data=await createFixtureSpendscapeRepository().loadSnapshot()
 const saved=saveReviewedPurchase(emptySessionLedger(),'fictional-operation',{...blankReview(),source:'receipt',channel:'unknown',date:'2026-10-04T10:20',currency:'ILS',payment:'unknown',category:'unknown',amount:'12.5',lines:[{name:'Fictional product',quantity:'2',unit:'item',price:'6.25',discount:'0'}],directoryIntent:{merchant:{name:'Fictional merchant',category:'unknown',separate:false}}},data,data.purchases).ledger
 const state={...emptyLocalPurchases(),directory:saved.directory,records:saved.records,nextSequence:saved.nextSequence}
 browser=await chromium.launch({channel:'chrome',headless:true});let checks=0,totalPosts=0
 for(const he of[false,true]){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await context.newPage();await p.addInitScript(locale=>localStorage.setItem('spendscape.locale.v1',locale),he?'he':'en')
  let receipts=0,addresses=0;const queries=[]
  await p.route(origin+'/**',async r=>{const u=new URL(r.request().url())
   if(u.pathname==='/api/receipt-capture-session'){
    if(r.request().method()==='GET')return r.fulfill({json:{code:'local-capture-ready',mode:'native-service'}})
    receipts++;return r.fulfill(receipts===1?{status:422,json:{code:'recognition-failed'}}:{json:{code:'direct-observations',observations:fictionalStructured('one')}})
   }
   if(u.pathname==='/api/address-search'){
    if(r.request().method()==='GET')return r.fulfill({json:{status:'available',mode:'native-service'}})
    addresses++;queries.push(r.request().postDataJSON());return r.fulfill({json:{status:'results',candidates:[{address:'Fictional street 16',city:'Fictional city',country:'Israel',longitude:34.75,latitude:32.1,provenance:{provider:'geoapify',precision:'building',match:'full',pointAdjusted:false}}]}})
   }
   return r.fulfill({response:await r.fetch({url:base+u.pathname+u.search})})
  })
  await p.route(/generativelanguage|vision\.googleapis|api\.geoapify/i,r=>r.abort())
  for(let i=0;i<3;i++){
   await p.goto(origin);await expect(p.locator('main')).toHaveAttribute('data-local-state','ready');await p.getByTestId('home-empty-add').click();await p.getByTestId('capture-scan').click()
   await expect(p.getByTestId('receipt-session-budget')).toHaveCount(0)
   const bytes=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=64;return c.toDataURL('image/png').split(',')[1]})
   await p.getByTestId('receipt-upload-input').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')})
   await p.getByTestId('receipt-image-read').click()
   if(i===0){await expect(p.getByTestId('receipt-direct-error')).toContainText(he?'דבר לא נשמר':'Nothing was saved');assert.equal(receipts,1)}else await expect(p.getByTestId('capture-review')).toBeVisible()
  }
  assert.equal(receipts,3);checks++
  await p.goto(origin);await expect(p.locator('main')).toHaveAttribute('data-local-state','ready')
  await p.evaluate(value=>new Promise(resolve=>{const r=indexedDB.open('spendscape-local-purchases',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('state','readwrite');t.objectStore('state').put(value,'current');t.oncomplete=()=>{db.close();resolve()}}}),state)
  await p.reload();await expect(p.locator('main')).toHaveAttribute('data-local-state','ready');await p.locator('nav[aria-label="Mobile primary"]').getByRole('button',{name:he?'רכישות':'Purchases',exact:true}).click();await p.getByTestId('purchase-'+state.records[0].purchase.id).click();await p.getByTestId('purchase-resolve-location').click()
  await p.getByTestId('location-kind').selectOption('branch')
  for(const[k,v]of Object.entries({branch:'Fictional branch',address:'Fictional street 16',city:'Fictional city',country:'Israel'}))await p.getByTestId('location-'+k).fill(v)
  const before=await disk(p)
  await expect(p.getByTestId('address-session-status')).toHaveCount(0);await expect(p.getByTestId('address-search-disabled')).toHaveCount(0)
  await p.getByTestId('address-search-consent').check()
  for(let i=0;i<3;i++){await p.getByTestId('address-search-submit').click();await expect(p.getByTestId('address-candidate-0')).toBeVisible();assert.equal(addresses,i+1)}
  assert.deepEqual(queries,Array(3).fill({address:'Fictional street 16, Fictional city, Israel',locale:he?'he':'en'}));assert.deepEqual(await disk(p),before)
  await expect(p.locator('main')).toHaveAttribute('data-map-ready','true',{timeout:20000});await p.getByTestId('address-candidate-0').click();await expect(p.getByTestId('location-map-picker')).toBeVisible();await p.getByTestId('location-map-use').click();await p.getByTestId('location-confirmed').check();await p.getByTestId('location-save').click();await expect(p.getByTestId('location-form')).toHaveCount(0)
  const after=await disk(p);assert.equal(after.records.length,1);assert.equal(after.records[0].purchase.id,before.records[0].purchase.id);assert.equal(after.directory.places.length,1)
  await p.reload();await expect(p.locator('main')).toHaveAttribute('data-local-state','ready');assert.deepEqual(await disk(p),after)
  checks++;totalPosts+=receipts+addresses;await p.unrouteAll({behavior:'ignoreErrors'});await context.close()
 }
 console.log(JSON.stringify({status:'passed',browserChecks:checks,languages:['en','he'],mockedPosts:totalPosts,realProviderCalls:0,noAppQuotaOrExpiryShown:true,explicitRepeatedReadsAndSearches:true,failureDoesNotLatch:true,confirmedPinSaveReload:true,singlePurchasePreserved:true}))
}catch(e){console.log(JSON.stringify({status:'failed',message:e.message.slice(0,1800)}));process.exitCode=1}finally{await browser?.close()}})()
