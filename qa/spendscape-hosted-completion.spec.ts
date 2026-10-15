import {test,expect,type Page} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {nativeFixture} from './main-integration-fixtures'
import {fictionalStructured} from '../src/features/receipt-image/structured-image-contract'
const out=process.env.SPENDSCAPE_HOSTED_QA_OUT!
async function login(p:Page,he=false){
 await p.route(/generativelanguage|geoapify|prices\.shufersal|pricesprodpublic/,()=>{throw Error('provider-forbidden')})
 await p.goto('/');await p.getByLabel('Access code / קוד גישה').fill('1'.repeat(64));await p.getByRole('button',{name:'Open Spendscape / כניסה'}).click();await expect(p.locator('main')).toHaveAttribute('data-local-state','ready')
 if(he)await p.getByRole('button',{name:'Switch to Hebrew'}).click()
}
async function disk(p:Page){return p.evaluate(()=>new Promise<any>(resolve=>{const r=indexedDB.open('spendscape-local-purchases',1);r.onsuccess=()=>{const d=r.result,t=d.transaction('state'),q=t.objectStore('state').get('current');t.oncomplete=()=>{d.close();resolve(q.result)}}}))}
for(const he of [false,true])test(`protected mocked receipt save and isolated backup/restore ${he}`,async({page,browser})=>{
 await page.setViewportSize({width:he?390:360,height:844});let calls=0
 await page.route('**/api/receipt-capture-session',r=>{if(r.request().method()==='GET')return r.fulfill({json:{code:'local-capture-ready',mode:'native',session:{used:calls,maxRequests:2,state:'available'}}});calls++;return r.fulfill({json:{code:'direct-observations',observations:fictionalStructured('one')}})})
 await login(page,he);await page.getByTestId('capture-open-mobile').click();await page.getByTestId('capture-sources-open').click();await page.getByTestId('capture-source-receipt-image').click()
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=64;return c.toDataURL('image/png').split(',')[1]})
 await page.getByTestId('receipt-upload-input').setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('capture-review')).toBeVisible()
 await page.getByTestId('receipt-timezone').selectOption('UTC');await page.getByTestId('receipt-confirm-time').click()
 if(!await page.getByTestId('review-merchantCategory').isVisible())await page.getByTestId('review-new-merchant').click()
 await page.getByTestId('review-merchantCategory').selectOption('unknown');await page.getByTestId('review-payment').selectOption('unknown');await page.getByTestId('review-category').selectOption('unknown');await page.getByTestId('review-save-unresolved').click()
 await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('capture-success')).toBeVisible()
 const saved=await disk(page);expect(saved.records).toHaveLength(1);expect(saved.records[0].purchase.originalAmount).toBe(12.4);expect(saved.records[0].purchase.items[0].lineTotal).toBe(12.5);expect(saved.records[0].purchase.placeId).toBeNull();expect(saved.directory.places).toHaveLength(0);expect(calls).toBe(1)
 await page.reload();await expect(page.locator('main')).toHaveAttribute('data-local-state','ready');expect(await disk(page)).toEqual(saved);await expect(page.locator('main')).toHaveAttribute('data-pin-count','0')
 await page.getByTestId('local-privacy').click();const downloading=page.waitForEvent('download');await page.getByTestId('backup-export').click();const download=await downloading,file=out+`/fictional-${he}.json`;await download.saveAs(file);const backup=await readFile(file)
 const target=await browser.newContext({baseURL:'http://127.0.0.1:3206',viewport:{width:he?390:360,height:844}}),p=await target.newPage();await login(p,he);await p.getByTestId('local-privacy').click();await p.getByTestId('backup-file').setInputFiles({name:'fictional.json',mimeType:'application/json',buffer:backup});await expect(p.getByTestId('backup-preview')).toBeVisible();expect(await disk(p)).toBeUndefined();await p.getByTestId('backup-confirm').check();await p.getByTestId('backup-restore').click();await expect(p.getByTestId('backup-success')).toBeVisible();expect((await disk(p)).records).toEqual(saved.records)
 await p.reload();await expect(p.locator('main')).toHaveAttribute('data-local-state','ready');expect((await disk(p)).records).toEqual(saved.records);await expect(p.locator('main')).toHaveAttribute('data-pin-count','0');expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await target.close()
})
for(const he of [false,true])test(`protected fresh city matching, expiry, unchanged purchase and pin ${he}`,async({page})=>{
 await page.setViewportSize({width:he?390:360,height:844});await page.clock.install({time:new Date('2026-10-15T20:30:00Z')});await login(page,he)
 await page.evaluate(v=>new Promise<void>(resolve=>{const r=indexedDB.open('spendscape-local-purchases',1);r.onsuccess=()=>{const d=r.result,t=d.transaction('state','readwrite');t.objectStore('state').put(v,'current');t.oncomplete=()=>{d.close();resolve()}}}),nativeFixture);await page.reload();await expect(page.locator('main')).toHaveAttribute('data-local-state','ready')
 await page.locator('nav[aria-label="Mobile primary"]').getByRole('button',{name:he?'רכישות':'Purchases',exact:true}).click();await page.getByTestId('purchase-session_purchase_receipt_01').click();await page.getByTestId('purchase-nearby-prices').click();await page.getByTestId('city-price-city').selectOption('petah-tikva');const panel=page.getByTestId('nearby-prices-review');await expect(panel).toContainText('2026-10-15T10:16:28.000Z');await expect(panel).toContainText('PriceFull')
 const data=JSON.parse(await readFile('src/features/nearby-prices/city-snapshot.json','utf8')),id=nativeFixture.records[0].purchase.items[0].id
 await page.getByTestId('nearby-match-'+id).selectOption(data.snapshot.products[0].id);await expect(page.getByTestId('nearby-subtotal-shufersal-104')).toHaveCount(0);await page.getByTestId('nearby-confirm-'+id).check();for(const s of ['104','285'])await expect(page.getByTestId('nearby-subtotal-shufersal-'+s)).toBeVisible();expect(await disk(page)).toEqual(nativeFixture);await expect(page.locator('main')).toHaveAttribute('data-pin-count','1')
 await page.clock.setSystemTime(new Date('2026-10-16T20:30:00Z'));await page.clock.fastForward(31000);await expect(panel).toContainText(he?'פגו':'expired');await expect(page.getByTestId('nearby-subtotal-shufersal-104')).toHaveCount(0);expect(await disk(page)).toEqual(nativeFixture);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
