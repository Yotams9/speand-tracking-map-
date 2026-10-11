import {test,expect,type Page} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {createFixtureSpendscapeRepository} from '../src/data/spendscape-repository'
import {blankReview,emptySessionLedger,saveReviewedPurchase} from '../src/features/capture/session-purchase-domain'
import {composeDirectory} from '../src/features/local-purchases/local-directory'
import {emptyLocalPurchases} from '../src/features/local-purchases/local-purchase-store'
const out=process.env.SPENDSCAPE_LOCATION_QA_OUT!
test.skip(!out,'Fresh isolated output required')
let data: Awaited<ReturnType<ReturnType<typeof createFixtureSpendscapeRepository>['loadSnapshot']>>
function fixture(online=false) {
 const a=saveReviewedPurchase(emptySessionLedger(),'fictional', {...blankReview(),source:'receipt',channel:online?'online':'unknown',date:'2024-02-29T09:07',currency:'ILS',payment:'unknown',category:'unknown',amount:'8.05',lines:[{name:'מוצר בדוי חינם',quantity:'1',unit:'item',price:'10',discount:'10'},{name:'Fictional paid item',quantity:'2',unit:'item',price:'5',discount:'2'}],directoryIntent:{merchant:{name:'Fictional merchant בלבד',category:'unknown',separate:false}}},data,data.purchases).ledger
 const b=saveReviewedPurchase(a,'fictional-two',{...blankReview(),source:'manual',merchantId:a.records[0].purchase.merchantId,channel:'unknown',date:'2024-03-01T09:07',currency:'ILS',payment:'cash',category:'groceries',amount:'7'},composeDirectory(data,a.directory),data.purchases).ledger
 return {...emptyLocalPurchases(),directory:b.directory,records:b.records,nextSequence:b.nextSequence}
}
async function stored(p:Page){return p.evaluate(()=>new Promise<any>((resolve,reject)=>{const r=indexedDB.open('spendscape-local-purchases',1);r.onerror=()=>reject('open');r.onsuccess=()=>{const db=r.result,t=db.transaction('state'),q=t.objectStore('state').get('current');t.oncomplete=()=>{db.close();resolve(q.result)}}}))}
async function ready(p:Page){await expect(p.locator('main')).toHaveAttribute('data-local-state','ready');await expect(p.locator('main')).toHaveAttribute('data-map-ready','true')}
async function setup(p:Page,he=false,online=false){await p.emulateMedia({reducedMotion:'reduce'});await p.route(/generativelanguage|vision\.googleapis|groq|geocod/i,()=>{throw Error('provider-forbidden')});await p.goto('/');await ready(p);await p.evaluate(value=>new Promise<void>(resolve=>{const r=indexedDB.open('spendscape-local-purchases',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('state','readwrite');t.objectStore('state').put(value,'current');t.oncomplete=()=>{db.close();resolve()}}}),fixture(online));await p.reload();await ready(p);if(he)await p.getByRole('button',{name:'Switch to Hebrew'}).click();await p.locator('nav[aria-label="Mobile primary"]').getByRole('button',{name:he?'רכישות':'Purchases',exact:true}).click();await p.getByTestId('purchase-session_purchase_receipt_01').click()}
async function edit(p:Page){await p.getByTestId('purchase-resolve-location').click();await expect(p.getByTestId('location-form')).toBeVisible()}
async function fields(p:Page,branch='Fictional branch',address='Fictional street'){await p.getByTestId('location-kind').selectOption('branch');for(const [k,v] of Object.entries({branch,address,city:'Fictional city',country:'Fictional country'}))await p.getByTestId(`location-${k}`).fill(v)}
async function manual(p:Page,longitude='34.75'){await p.getByTestId('location-form').locator('summary').click();await p.getByTestId('location-longitude').fill(longitude);await p.getByTestId('location-latitude').fill('32.1')}
async function save(p:Page){await p.getByTestId('location-confirmed').check();await p.getByTestId('location-save').click();await expect(p.getByTestId('location-form')).toHaveCount(0);await expect(p.getByTestId('purchase-show-place')).toBeVisible()}
const metrics=(p:Page)=>p.evaluate(()=>(window as any).__SPENDSCAPE_QA__)
async function counts(p:Page,pins=13){await expect.poll(async()=> (await metrics(p)).canonicalPins).toBe(pins);expect((await metrics(p)).combinedPurchaseCount).toBe(44);expect((await metrics(p)).mapConstructionCount).toBe(1);expect((await metrics(p)).mapInstanceCount).toBe(1)}
const immutable=(p:any)=>{const{placeId:_,channel:__,resolution:___,...rest}=p;return rest}
test.beforeAll(async()=>{data=await createFixtureSpendscapeRepository().loadSnapshot();await mkdir(out,{recursive:true})})
for(const he of [false,true])test(`map point, cancellation, in-place persistence, Show place, pin selection and reload ${he?'he':'en'}`,async({page})=>{
 await page.setViewportSize({width:he?390:360,height:844});await setup(page,he);const initial=await stored(page);await counts(page,12);await edit(page);await fields(page);await page.getByTestId('location-cancel').click();expect(await stored(page)).toEqual(initial)
 await edit(page);await fields(page);await page.getByTestId('location-pick-map').click();await expect(page.getByTestId('location-map-picker')).toBeVisible();await expect(page.getByTestId('location-map-use')).toBeFocused();await page.getByTestId('location-map-in').click();await page.getByTestId('location-map-east').click();await page.getByTestId('location-map-use').click();await page.getByTestId('location-save').click();await expect(page.getByTestId('location-errors')).toBeVisible();expect(await stored(page)).toEqual(initial)
 await page.getByTestId('location-confirmed').check();await page.screenshot({path:join(out,`place-confirm-${he?'he':'en'}.png`)});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByTestId('location-form').evaluate((f:HTMLFormElement)=>{f.requestSubmit();f.requestSubmit()});await expect(page.getByTestId('purchase-show-place')).toBeVisible();await counts(page)
 const d=await stored(page);expect(d.records.map((r:any)=>r.purchase.id)).toEqual(initial.records.map((r:any)=>r.purchase.id));expect(immutable(d.records[0].purchase)).toEqual(immutable(initial.records[0].purchase));expect(d.records[0].evidence).toEqual(initial.records[0].evidence);expect(d.records[0].purchase.items[0]).toMatchObject({lineTotal:0,discountMinor:1000});expect(d.directory.places[0]).toMatchObject({source:'user-confirmed',locationMethod:'map-selection'});expect(d.records[1]).toEqual(initial.records[1]);expect(d.revision).toBe(1)
 await page.getByTestId('purchase-show-place').click();await expect.poll(async()=>(await metrics(page)).selectedPlaceId).toBe(d.directory.places[0].id);await expect(page.getByTestId('place-panel')).toBeVisible();await page.screenshot({path:join(out,`place-pin-${he?'he':'en'}.png`)})
 await expect.poll(()=>page.evaluate(id=>(window as any).__SPENDSCAPE_QA_ACTIONS__.renderedPlaceIdsAt(id),d.directory.places[0].id)).toEqual([d.directory.places[0].id])
 await page.keyboard.press('Escape');const point=await page.evaluate(()=>(window as any).__SPENDSCAPE_QA_ACTIONS__.firstRenderedPoint('pin'));expect(point).not.toBeNull();await page.getByTestId('map-canvas').click({position:{x:point[0],y:point[1]}});await expect.poll(async()=>(await metrics(page)).selectedPlaceId).toBe(d.directory.places[0].id)
 await page.reload();await ready(page);expect(await stored(page)).toEqual(d);await counts(page)
 // UI selection is intentionally transient for privacy. Verify the saved association instead.
 await page.locator('nav[aria-label="Mobile primary"]').getByRole('button',{name:he?'רכישות':'Purchases',exact:true}).click();await page.getByTestId('purchase-session_purchase_receipt_01').click();await expect(page.getByTestId('purchase-show-place')).toBeVisible();await page.getByTestId('purchase-show-place').click();await expect.poll(async()=>(await metrics(page)).selectedPlaceId).toBe(d.directory.places[0].id)
})
test('manual accessible alternative, duplicate branch, no-op reuse, shared place, repeated update and eight-second Undo',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await edit(page);await fields(page);await manual(page);await save(page);const first=await stored(page)
 await page.getByTestId('location-undo').click();await counts(page,12);const undone=await stored(page);expect(undone.records).toEqual(fixture().records);expect(undone.nextSequence).toBe(first.nextSequence)
 await edit(page);await fields(page);await manual(page);await save(page);const placed=await stored(page)
 await edit(page);await page.getByTestId('location-place').selectOption(placed.directory.places[0].id);await save(page);expect(await stored(page)).toEqual(placed)
 await edit(page);await fields(page);await manual(page);await page.getByTestId('location-confirmed').check();await page.getByTestId('location-save').click();await expect(page.getByTestId('location-errors')).toContainText('matching place');expect(await stored(page)).toEqual(placed);await page.getByTestId('location-cancel').click()
 await page.keyboard.press('Escape');await page.getByTestId('purchase-session_purchase_manual_02').click();await edit(page);await page.getByTestId('location-place').selectOption(placed.directory.places[0].id);await save(page);await counts(page);const shared=await stored(page);expect(shared.directory.places).toHaveLength(1);expect(shared.records[0].purchase.placeId).toBe(shared.records[1].purchase.placeId)
 await page.clock.install();await page.clock.pauseAt(new Date());await edit(page);await fields(page,'Fictional second','Other street');await manual(page,'34.8');await save(page);await counts(page,14);expect((await stored(page)).directory.places).toHaveLength(2);await page.clock.runFor(7999);await expect(page.getByTestId('location-undo')).toBeVisible();await page.clock.runFor(201);await expect(page.getByTestId('location-undo')).toHaveCount(0);await counts(page,14)
})
test('failed atomic update leaves purchase/directory unchanged and allows reviewed recovery',async({page})=>{
 await page.setViewportSize({width:360,height:844});await setup(page);await edit(page);await fields(page);await manual(page);const before=await stored(page)
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){const r=put.apply(this,args);r.addEventListener('success',()=>this.transaction.abort());return r};(window as any).__restorePut=()=>{IDBObjectStore.prototype.put=put}})
 await page.getByTestId('location-confirmed').check();await page.getByTestId('location-save').click();await expect(page.getByTestId('location-errors')).toContainText('not saved');expect(await stored(page)).toEqual(before);await counts(page,12);await page.evaluate(()=>(window as any).__restorePut());await save(page);await counts(page)
})
test('external revision conflict cannot overwrite confirmed location',async({page,context})=>{
 await page.setViewportSize({width:360,height:844});await setup(page);const other=await context.newPage();await other.setViewportSize({width:360,height:844});await other.goto('/');await ready(other);await other.locator('nav[aria-label="Mobile primary"]').getByRole('button',{name:'Purchases',exact:true}).click();await other.getByTestId('purchase-session_purchase_receipt_01').click();await edit(other);await fields(other);await manual(other);await save(other);const d=await stored(other)
 await expect(page.locator('main')).toHaveAttribute('data-local-state','conflict');expect(await stored(page)).toEqual(d);await other.close()
})
test('fixtures and online purchases cannot resolve physical places',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page,false,true);await expect(page.getByTestId('purchase-resolve-location')).toHaveCount(0);await counts(page,12);await page.keyboard.press('Escape');await page.getByTestId(`purchase-${data.purchases[0].id}`).click();await expect(page.getByTestId('purchase-resolve-location')).toHaveCount(0)
})
