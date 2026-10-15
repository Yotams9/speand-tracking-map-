import {test,expect,type Page} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {createFixtureSpendscapeRepository} from '../src/data/spendscape-repository'
import {blankReview,emptySessionLedger,saveReviewedPurchase} from '../src/features/capture/session-purchase-domain'
import {composeDirectory} from '../src/features/local-purchases/local-directory'
import {emptyLocalPurchases} from '../src/features/local-purchases/local-purchase-store'
const out=process.env.SPENDSCAPE_ADDRESS_QA_OUT!
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
async function save(p:Page){await p.getByTestId('location-confirmed').check();await p.getByTestId('location-save').click();await expect(p.getByTestId('location-form')).toHaveCount(0);await expect(p.getByTestId('purchase-show-place')).toBeVisible()}
const metrics=(p:Page)=>p.evaluate(()=>(window as any).__SPENDSCAPE_QA__)
async function counts(p:Page,pins=13){await expect.poll(async()=> (await metrics(p)).canonicalPins).toBe(pins);expect((await metrics(p)).combinedPurchaseCount).toBe(44);expect((await metrics(p)).mapConstructionCount).toBe(1);expect((await metrics(p)).mapInstanceCount).toBe(1)}
const immutable=(p:any)=>{const{placeId:_,channel:__,resolution:___,...rest}=p;return rest}
const candidate=(precision='building',match='full')=>({address:'Fictional street 12',city:'Fictional city',country:'Fictional country',longitude:34.7500000049488,latitude:32.10000000672003,provenance:{provider:'geoapify',precision,match,pointAdjusted:false}})
async function submit(p:Page){await p.getByTestId('address-search-consent').check();await p.getByTestId('address-search-submit').click()}
async function backFromPreview(p:Page,he=false){await p.getByRole('button',{name:he?'חזרה ללא בחירת נקודה':'Back without choosing a point',exact:true}).click()}
test.beforeAll(async()=>{data=await createFixtureSpendscapeRepository().loadSnapshot();await mkdir(out,{recursive:true})})
function sessionMock(p:Page,maximum=2,expiresAt=Date.now()+300000,outcome='results'){
 let posts=0,status='available';const ids:string[]=[]
 const ready=p.route('**/api/address-search',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{status,mode:'native-session',session:{remaining:Math.max(0,maximum-posts),expiresAt}}})
  posts++;ids.push(route.request().headers()['x-spendscape-address-submission']);status=outcome==='results'?(posts>=maximum?'limit-reached':'available'):'session-stopped'
  return route.fulfill({json:outcome==='results'?{status:'results',candidates:[candidate()]}:{status:outcome}})
 });return {ready,get posts(){return posts},ids}
}
for(const [width,he] of [[360,false],[390,true],[430,false],[1280,false]] as const)test(`operational repeated explicit searches; preview, confirmed save/reload and one pin ${width}`,async({page})=>{
 await page.setViewportSize({width:width===1280?390:width,height:844});const m=sessionMock(page);await m.ready;await setup(page,he);const before=await stored(page);await edit(page);await fields(page);await page.setViewportSize({width,height:844});await expect(page.getByTestId('address-session-status')).toContainText('2');expect(m.posts).toBe(0);await expect(page.getByTestId('address-search-submit')).toBeDisabled();await submit(page);await expect(page.getByTestId('address-candidate-0')).toBeVisible();await expect(page.getByTestId('address-session-status')).toContainText('1');expect(await stored(page)).toEqual(before)
 await page.getByTestId('location-address').fill('Fictional reviewed correction');await expect(page.getByTestId('address-search-consent')).not.toBeChecked();expect(m.posts).toBe(1);await submit(page);await expect(page.getByTestId('address-search-disabled')).toContainText(he?'מכסת':'limit');await expect(page.getByTestId('address-candidate-0')).toBeVisible();expect(m.posts).toBe(2);expect(m.ids.every(s=>/^[a-f0-9]{32}$/.test(s))).toBe(true);expect(new Set(m.ids).size).toBe(2)
 await page.screenshot({path:join(out,`operational-limit-${width}.png`)});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByTestId('address-candidate-0').click();await expect(page.getByTestId('location-map-picker')).toBeVisible();expect(await stored(page)).toEqual(before);await backFromPreview(page,he);await expect(page.getByTestId('location-confirmed')).not.toBeChecked();await save(page);const saved=await stored(page);expect(immutable(saved.records[0].purchase)).toEqual(immutable(before.records[0].purchase));await counts(page);await page.reload();await ready(page);expect(await stored(page)).toEqual(saved);await counts(page)
})
test('expiry is visible without dispatch; errors stop instead of retrying',async({page})=>{
 await page.setViewportSize({width:390,height:844});const m=sessionMock(page,2,Date.now()+2000);await m.ready;await setup(page);const before=await stored(page);await edit(page);await fields(page);await expect(page.getByTestId('address-search-disabled')).toContainText('expired');expect(m.posts).toBe(0);expect(await stored(page)).toEqual(before)
 await page.getByTestId('location-cancel').click();await page.unroute('**/api/address-search');const failed=sessionMock(page,2,Date.now()+300000,'quota');await failed.ready;await edit(page);await fields(page);await submit(page);await expect(page.getByTestId('address-search-error')).toContainText('quota');await expect(page.getByTestId('address-search-disabled')).toContainText('stopped');expect(failed.posts).toBe(1);expect(await stored(page)).toEqual(before)
})
