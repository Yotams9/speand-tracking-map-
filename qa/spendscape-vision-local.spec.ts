import {test,expect,type Page} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {fictionalShortOcr,visionResponse} from '../src/features/receipt-image/vision-fixtures'
import {normalizeVisionResponse} from '../src/features/receipt-image/vision-normalize'
import {parseVisionReceipt} from '../src/features/receipt-image/short-receipt-parser'
const out='artifacts/vision-local-capture-nppfrda3/browser'
const result=()=>({code:'vision-observations',...parseVisionReceipt(normalizeVisionResponse(visionResponse(fictionalShortOcr())))})
async function baseline(p:Page,n=42){await expect.poll(()=>p.evaluate(()=>(window as any).__SPENDSCAPE_QA__)).toMatchObject({combinedPurchaseCount:n,canonicalPins:12,mapInstanceCount:1,mapConstructionCount:1})}
async function open(p:Page,he=false){await p.goto('/?receiptVisionLocal=1');await expect(p.locator('main')).toHaveAttribute('data-local-state','ready');if(he)await p.getByRole('button',{name:'Switch to Hebrew'}).click();await p.getByTestId((p.viewportSize()?.width??1280)<761?'capture-open-mobile':'capture-open-desktop').click();await p.getByTestId('capture-sources-open').click();await p.getByTestId('capture-source-receipt-image').click()}
async function photo(p:Page){const encoded=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const v=c.toDataURL('image/png').split(',')[1];c.width=c.height=0;return v});await p.getByTestId('receipt-upload-input').setInputFiles({name:'fictional-image-private-marker.png',mimeType:'image/png',buffer:Buffer.from(encoded,'base64')});await expect(p.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','ready')}
async function mocked(p:Page){await p.route('**/api/receipt-ocr',route=>route.fulfill({json:route.request().method()==='GET'?{code:'local-vision-ready'}:result()}))}
test.beforeAll(async()=>{await mkdir(out,{recursive:true})})
for(const [width,height,he] of [[360,640,false],[360,640,true],[430,932,true],[1280,844,false]] as const)test(`fictional short layout requires explicit facts then durable save ${width} ${he?'he':'en'}`,async({page})=>{
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});await mocked(page);const errors:string[]=[];page.on('pageerror',()=>errors.push('pageerror'))
  await open(page,he);await expect(page.locator('#capture-description')).toContainText(he?'בדיקה מקומית אחת':'One local validation');await baseline(page);await photo(page)
  await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-observations')).toBeVisible();await baseline(page)
  await expect(page.getByTestId('review-name-0')).toHaveValue('מוצר בדוי');await expect(page.getByTestId('review-price-0')).toHaveValue('2.50');await expect(page.getByTestId('review-quantity-0')).toHaveValue('3');await expect(page.getByTestId('review-unit-0')).toHaveValue('');await expect(page.getByTestId('review-currency')).toHaveValue('');await expect(page.getByTestId('review-amount')).toHaveValue('7.50');await expect(page.getByTestId('receipt-image-preview')).toHaveCount(0)
  await page.screenshot({path:`${out}/draft-${width}-${he?'he':'en'}.png`})
  await page.getByTestId('capture-confirm').click();await baseline(page);await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible()
  await page.getByTestId('review-date').fill('2026-10-04T10:35');await page.getByTestId('receipt-timezone').selectOption('Asia/Jerusalem');await page.getByTestId('receipt-confirm-time').click();await page.getByTestId('review-currency').selectOption('ILS');await page.getByTestId('review-unit-0').selectOption('item');await page.getByTestId('review-channel').selectOption('unknown');await page.getByTestId('review-merchantId').selectOption('merchant_unresolved');await page.getByTestId('review-payment').selectOption('cash');await page.getByTestId('review-category').selectOption('groceries')
  await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('capture-success')).toBeVisible();await baseline(page,43)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
  await page.reload();await expect(page.locator('main')).toHaveAttribute('data-local-state','ready');await baseline(page,43)
})
test('live opt-in without server activation remains unavailable and does not send image',async({page})=>{let posts=0;page.on('request',r=>{if(r.url().includes('/api/receipt-ocr')&&r.method()==='POST')posts++});await open(page);await photo(page);await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-image-status')).toContainText('recognition is unavailable');await baseline(page);expect(posts).toBe(0)})
test('cancelled local job rejects late observations, timeout does not retry',async({page})=>{
  let release!:()=>Promise<void>,posts=0
  await page.route('**/api/receipt-ocr',route=>{if(route.request().method()==='GET')return route.fulfill({json:{code:'local-vision-ready'}});posts++;return new Promise<void>(resolve=>{release=async()=>{await route.fulfill({json:result()}).catch(()=>{});resolve()}})})
  await open(page);await expect(page.locator('#capture-description')).toContainText('One local validation');await photo(page);await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','reading');await page.getByTestId('receipt-image-discard').click();await release();await baseline(page);await expect(page.getByTestId('receipt-observations')).toHaveCount(0)
  await photo(page);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','reading');await page.clock.runFor(30_000);await expect(page.getByTestId('receipt-image-status')).toContainText('timed out');await release();await baseline(page);expect(posts).toBe(2)
})
