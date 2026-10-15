import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReceiptObservations } from '../src/features/capture/receipt-review-adapter'

const out = process.env.SPENDSCAPE_UNKNOWN_QA_OUT!
test.skip(!out, 'Requires a fresh isolated synthetic production app')
// Fictional values, not provider output or an extraction prompt. Independent
// product sum 60.45 and payable 60.50 exercise both directions of a difference.
const fixture = (): ReceiptObservations => ({ merchantName: 'חנות בדויה Cedar', address: 'רחוב דמיוני 8',
  date: '29/02/2024', time: '09:07', currency: 'ש״ח', finalAmount: '60.50',
  lines: [
    { name: 'לחם בדוי Bread', quantity: '1', unit: null, unitPrice: '10.00', lineAmount: '10.00' },
    { name: 'מוצר בדוי Cookies', quantity: '1', unit: null, unitPrice: '20.00', lineAmount: '20.00' },
    { name: 'חלב בדוי Milk', quantity: '2', unit: null, unitPrice: '7.50', lineAmount: '15.00' },
    { name: 'מעדן בדוי Yogurt', quantity: '1', unit: null, unitPrice: '8.45', lineAmount: '8.45' },
    { name: 'מוצר בדוי Dessert', quantity: '2', unit: null, unitPrice: '3.50', lineAmount: '7.00' },
  ] })
async function count(page: Page, n: number) {
  await expect.poll(() => page.evaluate(() => (window as any).__SPENDSCAPE_QA__)).toMatchObject({ combinedPurchaseCount: n, canonicalPins: 12, mapInstanceCount: 1, mapConstructionCount: 1 })
}
async function ready(page: Page) { await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready'); await page.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready) }
async function open(page: Page) {
  await page.getByTestId((page.viewportSize()?.width ?? 1280) < 761 ? 'capture-open-mobile' : 'capture-open-desktop').click()
  await page.getByTestId('capture-sources-open').click(); await page.getByTestId('capture-source-receipt-image').click()
}
async function image(page: Page) {
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 400
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 300, 400)
    ctx.fillStyle = '#111'; ctx.fillText('FICTIONAL OFFLINE QA', 20, 40)
    const value = c.toDataURL('image/png').split(',')[1]; c.width = c.height = 0; return value
  })
  await page.getByTestId('receipt-upload-input').setInputFiles({ name: 'fictional-prefill.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByTestId('receipt-image-read')).toBeEnabled(); await page.getByTestId('receipt-image-read').click()
  await expect(page.getByTestId('capture-review')).toBeVisible()
}
async function stored(page: Page) {
  return page.evaluate(() => new Promise<any>(resolve => {
    const r = indexedDB.open('spendscape-local-purchases', 1)
    r.onsuccess = () => { const db = r.result, t = db.transaction('state'), q = t.objectStore('state').get('current'); t.oncomplete = () => { db.close(); resolve(q.result) } }
  }))
}
async function setup(page: Page, he: boolean, o: ReceiptObservations) {
  // A provider call is forbidden; intercept before the local candidate handler.
  await page.route('**/api/receipt-structured', async route => {
    if (route.request().method() === 'GET') await route.continue()
    else await route.fulfill({ json: { code: 'direct-observations', observations: o } })
  })
  await page.route(/https:\/\/.*(?:generativelanguage|vision\.googleapis|groq)/, route => { throw new Error('provider-forbidden:' + route.request().method()) })
  await page.goto('/?receiptStructuredLocal=1'); await ready(page); if (he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await open(page); await image(page); await count(page, 42)
}
test.beforeAll(async () => { await mkdir(out, { recursive: true }) })
async function complete(page: Page, merchantId?: string) {
  if (merchantId) await page.getByTestId('review-merchantId').selectOption(merchantId)
  else { await page.getByTestId('review-new-merchant').click(); await page.getByTestId('review-merchantCategory').selectOption('unknown') }
  await page.getByTestId('review-payment').selectOption('unknown'); await page.getByTestId('review-category').selectOption('unknown')
  await page.getByTestId('receipt-timezone').selectOption('UTC'); await page.getByTestId('receipt-confirm-time').click()
  for (let i = 0; i < 5; i++) await page.getByTestId(`review-unit-${i}`).selectOption('item')
}

for(const he of [false,true]) test(`explicit unknown context save, Undo, Purchases, reload and duplicates ${he?'he':'en'}`,async({page})=>{
  await page.setViewportSize({width:he?390:360,height:844});await page.emulateMedia({reducedMotion:'reduce'});const o=fixture();await setup(page,he,o)
  const blockers=page.getByTestId('receipt-save-blockers');await expect(blockers).toContainText(he?'אפשר לסמן אמצעי תשלום וקטגוריות במפורש כלא ידועים':'Payment and categories can explicitly be marked unknown');await expect(blockers.locator('[data-blocker-field="payment"]')).toBeVisible()
  await complete(page);await expect(blockers.locator('li')).toHaveCount(0)
  await expect(page.getByTestId('receipt-context-summary')).toContainText(he?'לא ידוע':'Unknown')
  await page.getByTestId('receipt-context-summary').scrollIntoViewIfNeeded();await page.screenshot({path:join(out,`unknown-review-${he?'he':'en'}.png`)})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByTestId('review-printedAmount-0').fill('9.99');await page.getByTestId('capture-confirm').click();await count(page,42);await expect(blockers.locator('[data-blocker-field="printedAmount-0"]')).toBeVisible()
  await page.getByTestId('review-printedAmount-0').fill('10.00');await page.getByTestId('capture-confirm').click();await count(page,43)
  await page.getByTestId('capture-undo').click();await count(page,42);expect((await stored(page)).records).toEqual([])
  await page.getByTestId('capture-source-receipt-image').click();await image(page);await complete(page);await page.getByTestId('capture-confirm').click();await count(page,43)
  const saved=await stored(page),p=saved.records[0].purchase;expect(saved.version).toBe(4);expect(p).toMatchObject({paymentMode:'unknown',category:'unknown',channel:'unknown',placeId:null,originalAmount:60.50});expect(saved.directory.merchants[0].category).toBe('unknown');expect(saved.directory.places).toEqual([])
  expect(p.items).toHaveLength(5);expect(p.items.reduce((n:number,i:any)=>n+i.quantity,0)).toBe(7);expect(p.items.reduce((n:number,i:any)=>n+Math.round(i.lineTotal*100),0)).toBe(6045)
  for(let i=0;i<5;i++)expect(p.items[i]).toMatchObject({quantity:Number(o.lines[i].quantity),unitPrice:Number(o.lines[i].unitPrice),lineTotal:Number(o.lines[i].lineAmount)})
  expect(JSON.stringify(saved)).not.toMatch(/observations|base64|blob:|Fictional.*png/)
  await page.reload();await ready(page);await count(page,43);expect(await stored(page)).toEqual(saved)
  await page.locator('nav[aria-label="Mobile primary"]').getByRole('button',{name:he?'נתונים':'Stats',exact:true}).click()
  await expect(page.getByTestId('analytics-category-unknown')).toContainText(he?'לא ידוע':'Unknown')
  await expect(page.getByTestId('analytics-category-unknown')).toContainText('60.50')
  await page.getByTestId('analytics-category-unknown').click();await expect(page.getByTestId('analytics-count')).toHaveText('1')
  await expect.poll(()=>page.evaluate(()=>(window as any).__SPENDSCAPE_QA__.query.category)).toBe('unknown')
  await page.getByTestId('analytics-view-purchases').click();await page.getByTestId(`purchase-${p.id}`).click();await expect(page.getByTestId('purchase-detail')).toContainText(he?'לא ידוע':'Unknown');await page.screenshot({path:join(out,`unknown-detail-${he?'he':'en'}.png`)})
  await page.reload();await ready(page);await open(page);await image(page);await complete(page,p.merchantId);await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('review-save-separate')).toBeVisible();await count(page,43)
})

test('v3 hydration stays read-only; the next explicit save writes v4 atomically',async({page})=>{
  await page.setViewportSize({width:360,height:844});await setup(page,false,fixture());await complete(page)
  await page.getByTestId('review-payment').selectOption('cash');await page.getByTestId('review-category').selectOption('groceries');await page.getByTestId('review-merchantCategory').selectOption('groceries')
  await page.getByTestId('capture-confirm').click();await count(page,43);const legacy=await stored(page);legacy.version=3
  await page.evaluate(value=>new Promise<void>(resolve=>{const r=indexedDB.open('spendscape-local-purchases',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('state','readwrite');t.objectStore('state').put(value,'current');t.oncomplete=()=>{db.close();resolve()}}}),legacy)
  await page.reload();await ready(page);await count(page,43);expect(await stored(page)).toEqual(legacy)
  await open(page);await image(page);await complete(page,legacy.records[0].purchase.merchantId)
  // Even a successful put must not commit the migration if its transaction aborts.
  await page.evaluate(()=>{
    const put=IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){const r=put.apply(this,args);r.addEventListener('success',()=>this.transaction.abort());return r}
    ;(window as any).__restorePut=()=>{IDBObjectStore.prototype.put=put}
  })
  await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('capture-review').getByRole('status').last()).toContainText('Not saved')
  await count(page,43);expect(await stored(page)).toEqual(legacy)
  await page.evaluate(()=>(window as any).__restorePut())
  await page.getByTestId('capture-confirm').click();await count(page,44)
  const next=await stored(page);expect(next.version).toBe(4);expect(next.revision).toBe(legacy.revision+1);expect(next.records[0]).toEqual(legacy.records[0]);expect(next.directory).toEqual(legacy.directory);expect(next.records[1].purchase.paymentMode).toBe('unknown');expect(next.records[1].purchase.category).toBe('unknown')
  await page.reload();await ready(page);await count(page,44);expect(await stored(page)).toEqual(next)
})
