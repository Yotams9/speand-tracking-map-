import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReceiptObservations } from '../src/features/capture/receipt-review-adapter'

const out = process.env.SPENDSCAPE_PREFILL_QA_OUT!
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
  else { await page.getByTestId('review-new-merchant').click(); await page.getByTestId('review-merchantCategory').selectOption('groceries') }
  await page.getByTestId('review-payment').selectOption('cash'); await page.getByTestId('review-category').selectOption('groceries')
  await page.getByTestId('receipt-timezone').selectOption('UTC'); await page.getByTestId('receipt-confirm-time').click()
  for (let i = 0; i < 5; i++) await page.getByTestId(`review-unit-${i}`).selectOption('item')
}
for (const [width, height, he] of [[360,640,false],[390,844,true],[430,932,true],[1280,844,false]] as const) test(`prefill, actionable blockers, unpinned save/reload and duplicates ${width} ${he ? 'he' : 'en'}`, async ({page}) => {
  await page.setViewportSize({width,height}); await page.emulateMedia({reducedMotion:'reduce'}); const o=fixture()
  await setup(page,he,o)
  await expect(page.getByTestId('review-date')).toHaveValue('2024-02-29T09:07'); await expect(page.getByTestId('review-currency')).toHaveValue('ILS')
  await expect(page.getByTestId('review-channel')).toHaveValue('unknown'); await expect(page.getByTestId('review-amount')).toHaveValue('60.50')
  const summary=page.getByTestId('receipt-context-summary'), blockers=page.getByTestId('receipt-save-blockers')
  await expect(summary).toContainText(o.merchantName as string); await expect(summary).toContainText(o.address as string); await expect(summary).toContainText('2024-02-29 09:07')
  await expect(summary).not.toContainText('Choose…'); await expect(summary).not.toContainText('בחירה…')
  for(let i=0;i<5;i++) { await expect(page.getByTestId(`review-name-${i}`)).toHaveValue(o.lines[i].name as string); await expect(page.getByTestId(`review-quantity-${i}`)).toHaveValue(o.lines[i].quantity as string); await expect(page.getByTestId(`review-price-${i}`)).toHaveValue(o.lines[i].unitPrice as string); await expect(page.getByTestId(`review-printedAmount-${i}`)).toHaveValue(o.lines[i].lineAmount as string); await expect(page.getByTestId(`review-unit-${i}`)).toHaveValue('') }
  await expect(blockers.locator('li')).toHaveCount(9)
  for(const f of ['payment','category','date','merchantId','unit-0']) await expect(blockers.locator(`[data-blocker-field="${f}"]`)).toBeVisible()
  for(const f of ['currency','amount','placeId','channel','quantity-0','lines']) await expect(blockers.locator(`[data-blocker-field="${f}"]`)).toHaveCount(0)
  await blockers.scrollIntoViewIfNeeded(); await page.screenshot({path:join(out,`blockers-${width}.png`)})
  await page.getByTestId('receipt-address-review').fill('כתובת בדויה שתוקנה 12')
  await expect(summary).toContainText('כתובת בדויה שתוקנה 12'); await expect(page.getByTestId('receipt-observations').locator(':scope > p').nth(1)).toContainText(o.address as string)
  await page.getByTestId('review-new-merchant').click(); await expect(page.getByTestId('review-merchantName')).toHaveValue(o.merchantName as string)
  await expect(page.getByTestId('review-merchantCategory')).toHaveValue(''); await expect(blockers.locator('[data-blocker-field="merchantCategory"]')).toBeVisible()
  await page.getByTestId('review-merchantName').fill('בית עסק בדוי מתוקן'); await page.getByTestId('review-merchantCategory').selectOption('groceries')
  await page.getByTestId('review-channel').selectOption('physical'); await page.getByTestId('review-create-place').click()
  await expect(page.getByTestId('review-place-address')).toHaveValue('כתובת בדויה שתוקנה 12'); await expect(page.getByTestId('review-place-longitude')).toHaveValue('')
  await page.getByTestId('review-channel').selectOption('unknown'); await expect(page.getByTestId('review-merchantName')).toHaveValue('בית עסק בדוי מתוקן'); await expect(page.getByTestId('review-merchantCategory')).toHaveValue('groceries')
  await expect(blockers.locator('[data-blocker-field^="place-"]')).toHaveCount(0)
  await page.getByTestId('review-payment').selectOption('cash'); await page.getByTestId('review-category').selectOption('groceries'); await page.getByTestId('receipt-timezone').selectOption('UTC'); await page.getByTestId('receipt-confirm-time').click()
  for(let i=0;i<5;i++) await page.getByTestId(`review-unit-${i}`).selectOption('item')
  await expect(blockers.locator('li')).toHaveCount(0)
  await page.getByTestId('review-printedAmount-0').fill('9.99'); await expect(blockers.locator('[data-blocker-field="printedAmount-0"]')).toBeVisible()
  await page.getByTestId('capture-confirm').click(); await count(page,42); await expect(page.getByTestId('review-printedAmount-0')).toBeFocused()
  await page.getByTestId('review-printedAmount-0').fill('10.00'); await page.getByTestId('receipt-context-summary').scrollIntoViewIfNeeded(); await page.screenshot({path:join(out,`summary-${width}.png`)})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('capture-success')).toBeVisible(); await count(page,43)
  const saved=await stored(page), p=saved.records[0].purchase
  expect(p.originalAmount).toBe(60.50); expect(p.items.reduce((n:number,i:any)=>n+Math.round(i.lineTotal*100),0)).toBe(6045); expect(p.items).toHaveLength(5); expect(p.items.reduce((n:number,i:any)=>n+i.quantity,0)).toBe(7)
  expect(p.placeId).toBeNull(); expect(p.channel).toBe('unknown'); expect(saved.directory.places).toEqual([]); expect(saved.directory.merchants[0].name.en).toBe('בית עסק בדוי מתוקן')
  expect(JSON.stringify(saved)).not.toMatch(/observations|כתובת בדויה שתוקנה|fictional-prefill|blob:|base64/)
  await page.reload(); await ready(page); await count(page,43); expect(await stored(page)).toEqual(saved)
  await open(page); await image(page); await complete(page,p.merchantId); await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('review-save-separate')).toBeVisible(); await count(page,43)
})
for(const he of [false,true]) test(`complete only missing date/time, explicit new merchant and Undo ${he ? 'he' : 'en'}`, async ({page})=>{
  await page.setViewportSize({width:360,height:640}); await page.emulateMedia({reducedMotion:'reduce'}); const o=fixture()
  if(he) o.date=null; else o.time=null
  await setup(page,he,o); await expect(page.getByTestId('review-date')).toHaveValue('')
  await expect(page.getByTestId('receipt-date-part')).toHaveValue(he?'':'2024-02-29'); await expect(page.getByTestId('receipt-time-part')).toHaveValue(he?'09:07':'')
  if(he) await page.getByTestId('receipt-date-part').fill('2024-02-29'); else await page.getByTestId('receipt-time-part').fill('09:07')
  await expect(page.getByTestId('review-date')).toHaveValue('2024-02-29T09:07'); await expect(page.getByTestId('receipt-timezone')).toHaveValue('')
  await page.getByTestId('receipt-observations').scrollIntoViewIfNeeded(); await page.screenshot({path:join(out,`partial-${he?'he':'en'}.png`)})
  await complete(page); await expect(page.getByTestId('receipt-save-blockers').locator('li')).toHaveCount(0)
  await page.getByTestId('capture-confirm').click(); await count(page,43); expect((await stored(page)).directory.merchants).toHaveLength(1)
  await page.getByTestId('capture-undo').click(); await count(page,42); const d=await stored(page); expect(d.records).toEqual([]); expect(d.directory).toEqual({merchants:[],places:[]})
})
