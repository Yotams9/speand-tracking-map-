import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { oneReceipt, fifteenReceipt } from './receipt-review-integration-mocks'
const out='artifacts/spendscape-local-directory'
const metrics=(p:Page)=>p.evaluate(()=>(window as any).__SPENDSCAPE_QA__)
async function ready(p:Page){await expect(p.locator('main')).toHaveAttribute('data-local-state','ready');await p.waitForFunction(()=>(window as any).__SPENDSCAPE_QA__?.ready)}
async function open(p:Page){await p.getByTestId((p.viewportSize()?.width??1280)<761?'capture-open-mobile':'capture-open-desktop').click();await p.waitForFunction(()=>typeof(window as any).__SPENDSCAPE_RECEIPT_REVIEW_QA__==='function')}
async function inject(p:Page,raw:unknown=oneReceipt){await p.evaluate(r=>(window as any).__SPENDSCAPE_RECEIPT_REVIEW_QA__(r),raw);await expect(p.getByTestId('receipt-observations')).toBeVisible()}
async function context(p:Page,channel='physical'){await p.getByTestId('review-channel').selectOption(channel);await p.getByTestId('review-payment').selectOption('cash');await p.getByTestId('review-category').selectOption('groceries');await p.getByTestId('receipt-timezone').selectOption('Asia/Jerusalem');await p.getByTestId('receipt-confirm-time').click()}
async function merchant(p:Page,name='Fictional בדויה'){await p.getByTestId('review-new-merchant').click();await p.getByTestId('review-merchantName').fill(name);await p.getByTestId('review-merchantCategory').selectOption('groceries')}
async function place(p:Page,branch='Fictional סניף',lon='34.75'){for(const [k,v] of Object.entries({branch,city:'Fictional עיר',country:'Fictional מדינה',address:`${branch} רחוב 12`,longitude:lon,latitude:'32.10'}))await p.getByTestId(`review-place-${k}`).fill(v);await p.getByTestId('review-place-confirmed').check()}
async function save(p:Page){await p.getByTestId('capture-confirm').click();await expect(p.getByTestId('capture-success')).toBeVisible()}
async function stored(p:Page){return p.evaluate(()=>new Promise<any>((resolve,reject)=>{const r=indexedDB.open('spendscape-local-purchases',1);r.onerror=()=>reject('open');r.onsuccess=()=>{const db=r.result,tx=db.transaction('state'),q=tx.objectStore('state').get('current');tx.oncomplete=()=>{db.close();resolve(q.result)}}}))}
async function overwrite(p:Page,d:unknown){await p.evaluate(d=>new Promise<void>(resolve=>{const r=indexedDB.open('spendscape-local-purchases',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('state','readwrite');tx.objectStore('state').put(d,'current');tx.oncomplete=()=>{db.close();resolve()}}}),d)}
async function counts(p:Page,purchases:number,pins:number){await expect.poll(async()=>{const q=await metrics(p);return[q.combinedPurchaseCount,q.canonicalPins,q.mapInstanceCount,q.mapConstructionCount]}).toEqual([purchases,pins,1,1])}
async function close(p:Page){await p.getByRole('button',{name:/Close Capture|סגירת Capture/}).last().click()}
test.beforeAll(async()=>{await mkdir(out,{recursive:true})})
for(const [width,height,he] of [[360,640,false],[360,640,true],[390,844,true],[430,932,false],[1280,844,false]] as const){
 test(`explicit local merchant and receipt place ${width} ${he?'he':'en'}`,async({page})=>{
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'})
  const writes:string[]=[],forbidden:string[]=[],errors:string[]=[]
  page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());if(/tesseract|traineddata|groq|gemini|vision.googleapis|\/api\/catalog|geocod/i.test(r.url()))forbidden.push('forbidden')});page.on('pageerror',()=>errors.push('pageerror'))
  await page.goto('/?receiptReviewQa=1');await ready(page);if(he)await page.getByRole('button',{name:'Switch to Hebrew'}).click();await counts(page,42,12)
  await open(page);const raw=structuredClone(width===1280?fifteenReceipt:oneReceipt);raw.lines[0].lineAmount='0.01';await inject(page,raw);await context(page);await merchant(page);await place(page)
  await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('review-printedAmount-0')).toHaveAttribute('aria-invalid','true');await expect(page.getByTestId('review-printedAmount-0')).toBeFocused();await counts(page,42,12)
  await page.getByTestId('review-printedAmount-0').fill(width===1280?'6.00':'12.50')
  await page.getByTestId('review-place-longitude').fill('181');await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('review-place-longitude')).toBeFocused();await expect(page.locator('#review-error-place-longitude')).toBeInViewport({ratio:1});await counts(page,42,12)
  await page.screenshot({path:`${out}/location-error-${width}-${he?'he':'en'}.png`})
  await page.getByTestId('review-place-longitude').fill('34.75');await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('review-place-confirmed')).toBeFocused();await expect(page.locator('#review-error-place-confirmed')).toBeInViewport({ratio:1})
  if(width===360){await page.setViewportSize({width,height:420});await expect(page.locator('#review-error-place-confirmed')).toBeInViewport({ratio:1});await expect(page.getByTestId('capture-confirm')).toBeInViewport({ratio:1});await page.screenshot({path:`${out}/keyboard-${he?'he':'en'}.png`});await page.setViewportSize({width,height})}
  await page.getByTestId('review-place-confirmed').check();await page.getByTestId('review-merchantName').focus();await expect(page.getByTestId('review-merchantName')).toBeInViewport({ratio:1});await page.screenshot({path:`${out}/review-${width}-${he?'he':'en'}.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByTestId('capture-review').evaluate((f:HTMLFormElement)=>{f.requestSubmit();f.requestSubmit()});await expect(page.getByTestId('capture-success')).toBeVisible();await counts(page,43,13)
  const d=await stored(page);expect(d.version).toBe(4);expect(d.directory.merchants).toHaveLength(1);expect(d.directory.places).toHaveLength(1);expect(d.directory.places[0]).toMatchObject({source:'user-confirmed',locationMethod:'manual-coordinates',coordinates:[34.75,32.1]});expect(d.records[0].purchase.merchantId).toBe('local_merchant_1');expect(d.records[0].purchase.timestamp).toBe('2026-10-03T06:15:00.000Z');expect(JSON.stringify(d)).not.toMatch(/observations|printedAmount|vatRate|timeZone|image/)
  await page.reload();await ready(page);await counts(page,43,13);expect(await stored(page)).toEqual(d);await expect(page.getByTestId('session-undo')).toHaveCount(0)
  const storage=await page.evaluate(()=>JSON.stringify({...sessionStorage})+JSON.stringify(history.state)+location.href);expect(storage).not.toMatch(/Fictional|בדויה|רחוב|local_place_/);expect(writes).toEqual([]);expect(forbidden).toEqual([]);expect(errors).toEqual([])
 })
}
test('reuse, duplicate override, shared-directory Undo, second branch and confirmed deletion',async({page})=>{
 await page.goto('/?receiptReviewQa=1');await ready(page);await open(page);await inject(page);await context(page);await merchant(page);await place(page);await save(page);await counts(page,43,13)
 await inject(page);await context(page);await page.getByTestId('review-placeId').selectOption('local_place_1');await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('review-save-separate')).toBeVisible();await counts(page,43,13);await page.getByTestId('review-save-separate').click();await expect(page.getByTestId('capture-success')).toBeVisible();await counts(page,44,13)
 await page.getByTestId('capture-undo').click();await counts(page,43,13);expect((await stored(page)).directory.places).toHaveLength(1)
 await inject(page);await context(page);await page.getByTestId('review-placeId').selectOption('local_place_1');await page.getByTestId('review-new-branch').click();await place(page,'Fictional second','34.80');await save(page);await counts(page,44,14);expect((await stored(page)).directory.merchants).toHaveLength(1)
 await page.getByTestId('capture-view-purchase').click();await page.getByTestId('local-purchase-delete').click();await counts(page,44,14);await page.getByTestId('local-purchase-delete-confirm').click();await counts(page,43,13)
 await page.reload();await ready(page);await counts(page,43,13);await open(page);await inject(page);await context(page);await page.getByTestId('review-placeId').selectOption('local_place_1');await page.getByTestId('review-new-branch').click();await place(page,'Fictional third','34.81');await save(page);const d=await stored(page);expect(d.directory.places[1].id).toBe('local_place_4')
 await page.getByTestId('capture-undo').click();await counts(page,43,13)
})
test('unresolved and online local merchants create no pins, cancellation creates no directory',async({page})=>{
 await page.goto('/?receiptReviewQa=1');await ready(page);await open(page);await inject(page);await context(page,'unknown');await merchant(page);await close(page);await counts(page,42,12);expect(await stored(page)).toBeUndefined()
 await open(page);await inject(page);await context(page,'online');await merchant(page);await save(page);await counts(page,43,12);expect((await stored(page)).directory.places).toEqual([]);expect((await stored(page)).directory.merchants[0]).not.toHaveProperty('onlineOnly')
 await inject(page);await context(page,'unknown');await merchant(page,'Fictional unresolved');await save(page);await counts(page,44,12);await page.getByTestId('capture-undo').click();await counts(page,43,12);expect((await stored(page)).directory.merchants).toHaveLength(1)
 await inject(page);await context(page);await page.getByTestId('review-branch-merchant').selectOption('local_merchant_1');await page.getByTestId('review-new-branch').click();await place(page);await save(page);await counts(page,44,13);await page.getByTestId('capture-undo').click();await counts(page,43,12);expect((await stored(page)).directory.merchants).toHaveLength(1)
})
test('atomic rollback and stale cross-tab revision cannot create directories',async({page,context:browser})=>{
 await page.goto('/?receiptReviewQa=1');await ready(page);const other=await browser.newPage();await other.goto('/?receiptReviewQa=1');await ready(other)
 await open(page);await inject(page);await context(page);await merchant(page);await place(page)
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){const r=put.apply(this,args);r.addEventListener('success',()=>this.transaction.abort());return r};(window as any).__restorePut=()=>{IDBObjectStore.prototype.put=put}})
 await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('capture-review').getByRole('status').last()).toContainText('Not saved');await counts(page,42,12);expect(await stored(page)).toBeUndefined();await page.evaluate(()=>(window as any).__restorePut());await save(page);await counts(page,43,13)
 await expect(other.getByRole('dialog')).toContainText('Data changed in another tab');expect((await stored(other)).directory.places).toHaveLength(1);await other.close()
})
test('legacy v1/v2 hydration never writes and explicit save migrates to v4',async({page})=>{
 await page.goto('/?receiptReviewQa=1');await ready(page);await open(page);await inject(page);await context(page,'unknown');await page.getByTestId('review-merchantId').selectOption('merchant_unresolved');await save(page)
 const modern=await stored(page),{directory:_directory,...legacy}=modern
 for(const version of [1,2]){const old={...legacy,version};await overwrite(page,old);await page.reload();await ready(page);expect(await stored(page)).toEqual(old);await counts(page,43,12)}
 await open(page);await inject(page);await context(page,'unknown');await merchant(page);await save(page);expect((await stored(page)).version).toBe(4);await counts(page,44,12)
 const corrupt=await stored(page);corrupt.directory.merchants[0].id='missing';await overwrite(page,corrupt);await page.reload();await expect(page.locator('main')).toHaveAttribute('data-local-state','invalid');expect(await stored(page)).toEqual(corrupt)
})
test('eight-second Undo expiry retains the purchase and its directory',async({page})=>{
 await page.goto('/?receiptReviewQa=1');await ready(page);await open(page);await inject(page);await context(page);await merchant(page);await place(page)
 await page.clock.install({time:new Date('2026-10-04T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-04T12:00:10Z'));await save(page);await expect(page.getByTestId('capture-undo')).toBeVisible();await page.clock.runFor(7999);await expect(page.getByTestId('capture-undo')).toBeVisible();await page.clock.runFor(1);await expect(page.getByTestId('capture-undo')).toHaveCount(0);await counts(page,43,13);expect((await stored(page)).directory.places).toHaveLength(1)
})

test('manual physical creation, composed search/Ask/Replay and final-reference deletion preserve the globe',async({page})=>{
 await page.goto('/?receiptReviewQa=1');await ready(page);await open(page);await page.getByTestId('capture-camera-manual').click();await page.getByTestId('review-channel').selectOption('physical');await merchant(page,'Fictional discovery');await place(page);await page.getByTestId('review-date').fill('2026-10-03T09:15');await page.getByTestId('review-currency').selectOption('ILS');await page.getByTestId('review-payment').selectOption('cash');await page.getByTestId('review-category').selectOption('groceries');await page.getByTestId('review-amount').fill('25')
 await page.getByTestId('manual-review').click();await counts(page,42,12);expect(await stored(page)).toBeUndefined();await save(page);await counts(page,43,13);expect((await metrics(page)).analytics.totalBaseAmountIls).toBe(6802.38)
 await page.getByTestId('capture-view-purchase').click();await expect(page.getByTestId('purchase-detail')).toContainText('Fictional discovery');const id=(await stored(page)).records[0].purchase.id
 await page.keyboard.press('Escape');await page.getByTestId('history-search').fill('Fictional discovery');await expect(page.getByTestId(`purchase-${id}`)).toBeVisible();expect((await metrics(page)).visiblePurchaseCount).toBe(1)
 await page.getByTestId('history-search').fill('');await page.locator('nav[aria-label="Primary"]').getByRole('button',{name:'Globe',exact:true}).click();await page.getByTestId('ask-open-desktop').click();await page.getByTestId('ask-input').fill('open latest purchase');await page.getByTestId('ask-run').click();await expect(page.getByTestId('ask-feedback')).toContainText('Fictional discovery');await expect(page.getByTestId('purchase-detail')).toContainText('Fictional discovery')
 await page.keyboard.press('Escape');await page.locator('nav[aria-label="Primary"]').getByRole('button',{name:'Globe',exact:true}).click();await page.getByTestId('timeline-open').click();await page.getByTestId('replay-open').click();await page.getByTestId('replay-scrub').focus();await page.keyboard.press('End');await expect(page.getByTestId('replay-event-details')).toContainText('Fictional discovery');await page.getByTestId('replay-close').click();await page.locator('nav[aria-label="Primary"]').getByRole('button',{name:'Purchases',exact:true}).click()
 await page.getByTestId(`purchase-${id}`).click();await page.getByTestId('local-purchase-delete').click();await page.getByRole('button',{name:'Cancel',exact:true}).last().click();await counts(page,43,13);await page.getByTestId('local-purchase-delete').click();await page.getByTestId('local-purchase-delete-confirm').click();await counts(page,42,12);expect((await stored(page)).directory).toEqual({merchants:[],places:[]});await page.reload();await ready(page);await counts(page,42,12)
})

test('fully discounted receipt line retains gross price, explicit discount and zero net across reload',async({page})=>{
 await page.goto('/?receiptReviewQa=1');await ready(page);await open(page);await inject(page,{...oneReceipt,finalAmount:'8.00',lines:[{name:'Fictional free item',quantity:'1',unit:'item',unitPrice:'10.00',discount:'10.00',lineAmount:'0.00'},{name:'Fictional paid item',quantity:'1',unit:'item',unitPrice:'10.00',discount:'2.00',lineAmount:'8.00'}]});await context(page);await merchant(page);await place(page);await save(page);await counts(page,43,13)
 const d=await stored(page);expect(d.records[0].purchase.items[0]).toMatchObject({unitPrice:10,discountMinor:1000,lineTotal:0});expect(d.records[0].purchase.items[1]).toMatchObject({unitPrice:10,discountMinor:200,lineTotal:8});await page.reload();await ready(page);expect(await stored(page)).toEqual(d);await counts(page,43,13)
})
