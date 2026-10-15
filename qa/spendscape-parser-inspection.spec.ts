import {test,expect,type Page} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {inspectParser} from '../src/features/receipt-image/parser-inspection'
import {fictionalShortOcr} from '../src/features/receipt-image/vision-fixtures'
const out=process.env.SPENDSCAPE_INSPECTION_QA_DIR
const qaRoot=process.env.SPENDSCAPE_INSPECTION_QA_ROOT
if(!out||!qaRoot||!out.startsWith(join(process.cwd(),'artifacts')+'/')||!qaRoot.startsWith(join(process.cwd(),'artifacts','vision-diagnostics-qa')+'/'))throw Error('ISOLATED_QA_REQUIRED')
const fixture=()=>{const d=fictionalShortOcr();d.words.push({text:'Fictional unassigned row',x:10,y:320,width:180,height:20});return inspectParser(d).inspection}
const headers={'x-spendscape-local-vision':'1','x-spendscape-vision-status':'1'}
async function open(page:Page,he=false){await page.goto('/?receiptVisionLocal=1');await expect(page.locator('main')).toHaveAttribute('data-local-state','ready');if(he)await page.getByRole('button',{name:'Switch to Hebrew'}).click();await page.getByTestId((page.viewportSize()?.width??1280)<761?'capture-open-mobile':'capture-open-desktop').click();await page.getByTestId('capture-sources-open').click();await page.getByTestId('capture-source-receipt-image').click();await expect(page.getByTestId('parser-inspection-opt-in')).toBeVisible();await page.getByTestId('parser-inspection-opt-in').check();await photo(page)}
async function photo(page:Page){await page.getByTestId('receipt-upload-input').setInputFiles(join(out!,'synthetic.png'));await expect(page.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','ready')}
async function inspect(page:Page){await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('parser-inspection-reason')).toHaveText('item-row-unassigned');await expect(page.getByTestId('parser-inspection')).toContainText('Fictional unassigned row');await expect(page.getByTestId('parser-inspection')).toContainText('REJECTED');await expect(page.getByTestId('receipt-observations')).toHaveCount(0);await expect(page.getByTestId('receipt-image-preview')).toHaveCount(0)}
async function baseline(page:Page){await expect.poll(()=>page.evaluate(()=>(window as any).__SPENDSCAPE_QA__)).toMatchObject({combinedPurchaseCount:42,canonicalPins:12,mapInstanceCount:1,mapConstructionCount:1})}
async function mock(page:Page){await page.route('**/api/receipt-ocr',r=>r.fulfill({status:r.request().method()==='GET'?200:422,json:r.request().method()==='GET'?{code:'local-vision-ready',inspectionAvailable:true}:{code:'layout-unsupported',inspection:fixture()}}))}
test('fictional server exposes transient rejection only once and journals no receipt content',async({page,request})=>{
 await page.goto('/?receiptVisionLocal=1');const before=await page.evaluate(async headers=>(await fetch('/api/receipt-ocr',{headers})).json(),headers);expect(before).toMatchObject({mode:'fictional-qa',consumed:false});
 await open(page);await inspect(page);await baseline(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 const after=await page.evaluate(async headers=>(await fetch('/api/receipt-ocr',{headers})).json(),headers);expect(after).toMatchObject({consumed:true,attempt:{state:'failed'}})
 const journal=await readFile(join(qaRoot!,'attempt-one.lifecycle.jsonl'),'utf8');expect(journal).not.toContain('Fictional unassigned row');expect(journal).not.toContain('מוצר');expect(journal).not.toContain('FICTIONAL_TOKEN')
 const blocked=await request.post('/api/receipt-ocr',{headers:{...headers,origin:'http://127.0.0.1:3000','x-spendscape-parser-inspection':'1','content-type':'image/png'},data:await readFile(join(out!,'synthetic.png'))});expect(blocked.status()).toBe(409);expect(await readFile(join(qaRoot!,'attempt-one.lifecycle.jsonl'),'utf8')).toBe(journal)
 await page.getByTestId('parser-inspection-close').click();await expect(page.getByTestId('parser-inspection')).toHaveCount(0)
})
for(const he of [false,true])test(`temporary cleanup, expiry and storage isolation ${he?'he':'en'}`,async({page})=>{
 await page.setViewportSize({width:he?360:1280,height:he?640:844});await mock(page);await open(page,he);await inspect(page);await baseline(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(await page.evaluate(()=>[location.href,...Object.values(localStorage),...Object.values(sessionStorage)].join(' '))).not.toContain('Fictional unassigned row')
 expect(await page.evaluate(async()=>{
   const names=await indexedDB.databases();
   for(const {name} of names){if(!name)continue;const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('storage-inspection-failed'))});
    try{for(const store of Array.from(db.objectStoreNames)){const values=await new Promise<unknown[]>((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('storage-inspection-failed'))});if(JSON.stringify(values).includes('Fictional unassigned row'))return false}}finally{db.close()}}
   return true
 })).toBe(true)
 await page.getByTestId('receipt-image-discard').click();await expect(page.getByTestId('parser-inspection')).toHaveCount(0)
 await photo(page);await inspect(page);await photo(page);await expect(page.getByTestId('parser-inspection')).toHaveCount(0)
 await page.clock.install();await inspect(page);await page.clock.fastForward(120_001);await expect(page.getByTestId('parser-inspection')).toHaveCount(0)
 await photo(page);await inspect(page);await page.keyboard.press('Escape');await expect(page.getByTestId('parser-inspection')).toHaveCount(0);await page.getByTestId(he?'capture-open-mobile':'capture-open-desktop').click();await expect(page.getByTestId('parser-inspection')).toHaveCount(0);await baseline(page)
})
test('cancel rejects late mocked inspection and unmount does not revive it',async({page})=>{
 let release!:()=>Promise<void>;await page.route('**/api/receipt-ocr',r=>{if(r.request().method()==='GET')return r.fulfill({json:{code:'local-vision-ready',inspectionAvailable:true}});return new Promise<void>(resolve=>{release=async()=>{await r.fulfill({status:422,json:{code:'layout-unsupported',inspection:fixture()}}).catch(()=>{});resolve()}})});await open(page);await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','reading');await expect.poll(()=>typeof release).toBe('function');await page.getByTestId('receipt-image-discard').click();await release();await expect(page.getByTestId('parser-inspection')).toHaveCount(0);await baseline(page)
})

// Fictional visibility control: exercise both event orderings without real OCR
// or recording receipt content. Foregrounding must not revive a cancelled run.
for(const he of [false,true])for(const returnVisible of [false,true])test(`background cancels late inspection ${he?'he':'en'} ${returnVisible?'foregrounded':'hidden'}`,async({page})=>{
 let release!:()=>Promise<void>
 await page.setViewportSize({width:he?360:1280,height:he?640:844})
 await page.route('**/api/receipt-ocr',r=>{if(r.request().method()==='GET')return r.fulfill({json:{code:'local-vision-ready',inspectionAvailable:true}});return new Promise<void>(resolve=>{release=async()=>{await r.fulfill({status:422,json:{code:'layout-unsupported',inspection:fixture()}}).catch(()=>{});resolve()}})})
 await open(page,he);await page.getByTestId('receipt-image-read').click();await expect.poll(()=>typeof release).toBe('function')
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))})
 await expect(page.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','idle');await expect(page.getByTestId('receipt-image-preview')).toHaveCount(0)
 if(returnVisible)await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))})
 await release();await expect(page.getByTestId('parser-inspection')).toHaveCount(0);await expect(page.getByTestId('receipt-observations')).toHaveCount(0);await baseline(page)
})
test('background clears completed inspection and foreground cannot restore it',async({page})=>{
 await mock(page);await open(page);await inspect(page)
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))})
 await expect(page.getByTestId('parser-inspection')).toHaveCount(0)
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))})
 await expect(page.getByTestId('parser-inspection')).toHaveCount(0);await baseline(page)
})
