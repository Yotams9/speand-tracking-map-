import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const out = 'artifacts/spendscape-college-p2c'
const dbName = 'spendscape-local-purchases'
const qa = (p: Page) => p.evaluate(() => (window as any).__SPENDSCAPE_QA__)
async function ready(p: Page) {
  await expect(p.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await p.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready)
}
async function receipt(p: Page) {
  await p.getByTestId((p.viewportSize()?.width ?? 1280) < 761 ? 'capture-open-mobile' : 'capture-open-desktop').click()
  await p.getByTestId('capture-scan').click()
  await expect(p.getByTestId('capture-confirm')).toBeVisible()
}
async function stored(p: Page) {
  return p.evaluate(async name => new Promise<any>((resolve, reject) => {
    const r = indexedDB.open(name, 1); r.onerror = () => reject('open')
    r.onsuccess = () => { const db = r.result, tx = db.transaction('state'), q = tx.objectStore('state').get('current'); tx.oncomplete = () => { db.close(); resolve(q.result) } }
  }), dbName)
}
async function seed(p: Page, data: unknown) {
  await p.evaluate(async ({name, data}) => new Promise<void>((resolve, reject) => {
    const r = indexedDB.open(name, 1); r.onerror = () => reject('open')
    r.onsuccess = () => { const db = r.result, tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(data, 'current'); tx.oncomplete = () => { db.close(); resolve() } }
  }), {name: dbName, data})
}
async function save(p: Page) { await p.getByTestId('capture-confirm').click(); await expect(p.getByTestId('capture-success')).toBeVisible() }
test.beforeAll(async () => { await mkdir(out, {recursive: true}) })
for (const [width, height, he] of [[360,640,false],[360,640,true],[390,844,true],[430,932,false],[1280,844,false]] as const) {
  test(`discount review, accessible error, net comparison and durable detail ${width} ${he ? 'he' : 'en'}`, async ({page}) => {
    await page.setViewportSize({width,height}); await page.emulateMedia({reducedMotion:'reduce'})
    const writes: string[] = [], forbidden: string[] = [], errors: string[] = []
    page.on('request', r => { if (!['GET','HEAD'].includes(r.method())) writes.push(r.method()); if (/tesseract|traineddata|gemini|generativelanguage|receipt-p2[ab]/i.test(r.url())) forbidden.push('unexpected-asset') })
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/'); await ready(page)
    if (he) await page.getByRole('button',{name:'Switch to Hebrew'}).click()
    expect(await qa(page)).toMatchObject({combinedPurchaseCount:42,canonicalPins:12,analytics:{totalBaseAmountIls:6777.38}})
    await receipt(page)
    const discount = page.getByTestId('review-discount-0')
    await discount.fill('18.51'); await page.getByTestId('capture-confirm').click()
    await expect(discount).toHaveAttribute('aria-invalid','true')
    await expect(page.getByTestId('review-net-0')).toContainText('—')
    expect((await qa(page)).combinedPurchaseCount).toBe(42)
    await discount.focus()
    await expect(discount).toBeFocused()
    expect(await discount.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none')
    await page.screenshot({path:`${out}/error-${width}-${he?'he':'en'}.png`})
    await discount.fill('2.50'); await page.getByTestId('review-amount').fill('84.40')
    await discount.focus(); await page.keyboard.press('Tab')
    await expect(page.getByTestId('review-net-0')).toContainText('16.00')
    await discount.scrollIntoViewIfNeeded()
    await page.screenshot({path:`${out}/discount-${width}-${he?'he':'en'}.png`})
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByTestId('capture-confirm')).toBeInViewport({ratio:1})
    if (width===360) {
      await page.setViewportSize({width,height:420}); await discount.focus()
      await expect(discount).toBeInViewport({ratio:1})
      await expect(page.getByTestId('capture-confirm')).toBeInViewport({ratio:1})
      await page.screenshot({path:`${out}/short-viewport-${he?'he':'en'}.png`})
      await page.setViewportSize({width,height})
    }
    await page.clock.install(); await page.clock.pauseAt(new Date(Date.now()+1000))
    await page.getByTestId('capture-confirm').dblclick(); await expect(page.getByTestId('capture-success')).toBeVisible()
    const d = await stored(page)
    expect(d.version).toBe(2); expect(d.records).toHaveLength(1)
    expect(d.records[0].purchase.items[0]).toMatchObject({unitPrice:18.5,discountMinor:250,lineTotal:16})
    expect(await qa(page)).toMatchObject({combinedPurchaseCount:43,canonicalPins:12,mapConstructionCount:1,mapInstanceCount:1,analytics:{totalBaseAmountIls:6861.78}})
    await page.clock.runFor(7999); await expect(page.getByTestId('capture-undo')).toBeVisible(); await expect(page.getByTestId('nearby-demo')).toHaveCount(0)
    await page.clock.runFor(1); await expect(page.getByTestId('capture-undo')).toHaveCount(0)
    await expect(page.getByTestId('nearby-demo')).toContainText('3.00')
    await page.clock.resume()
    await page.getByTestId('capture-view-purchase').click()
    await expect(page.getByTestId('purchase-detail')).toContainText(he ? 'הנחה' : 'Discount')
    await expect(page.getByTestId('purchase-detail')).toContainText('18.50')
    await expect(page.getByTestId('purchase-detail')).toContainText('16.00')
    await page.screenshot({path:`${out}/detail-${width}-${he?'he':'en'}.png`})
    await page.reload(); await ready(page)
    expect(await stored(page)).toEqual(d)
    expect((await qa(page)).analytics.totalBaseAmountIls).toBe(6861.78)
    await expect(page.getByTestId('session-undo')).toHaveCount(0)
    expect(writes).toEqual([]); expect(forbidden).toEqual([]); expect(errors).toEqual([])
  })
}
test('discounted Undo persists; zero discount is duplicate-equivalent and explicit override saves once', async ({page}) => {
  await page.goto('/'); await ready(page); await receipt(page)
  await page.getByTestId('review-discount-0').fill('2.50'); await page.getByTestId('review-amount').fill('84.40'); await save(page)
  await page.getByTestId('capture-undo').click()
  await expect.poll(async () => (await stored(page)).records.length).toBe(0)
  await page.reload(); await ready(page); expect((await qa(page)).combinedPurchaseCount).toBe(42)
  await receipt(page); await save(page); await page.getByTestId('capture-done').click()
  await receipt(page); await page.getByTestId('review-discount-0').fill('0')
  await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('review-save-separate')).toBeVisible()
  expect((await stored(page)).records).toHaveLength(1)
  await page.getByTestId('review-save-separate').dblclick(); await expect(page.getByTestId('capture-success')).toBeVisible()
  expect((await stored(page)).records).toHaveLength(2)
  await page.getByTestId('capture-undo').click(); await expect.poll(async () => (await stored(page)).records.length).toBe(1)
})
test('v1 hydration is read-only; explicit save upgrades envelope and preserves legacy purchase exactly', async ({page}) => {
  await page.goto('/'); await ready(page); await receipt(page); await save(page)
  const old = {...await stored(page),version:1}; await seed(page,old)
  await page.reload(); await ready(page)
  expect(await stored(page)).toEqual(old)
  expect((await qa(page)).analytics.totalBaseAmountIls).toBe(6864.28)
  await receipt(page); await page.getByTestId('review-discount-0').fill('1'); await page.getByTestId('review-amount').fill('85.90'); await save(page)
  const updated = await stored(page)
  expect(updated.version).toBe(2); expect(updated.revision).toBe(old.revision+1)
  expect(updated.records[0]).toEqual(old.records[0]); expect(updated.records).toHaveLength(2)
  await page.reload(); await ready(page); expect(await stored(page)).toEqual(updated)
})
test('25 reviewed receipt lines retain gross/discount/net and invalid net sum cannot save', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('/'); await ready(page); await receipt(page)
  for(let i=4;i<25;i++)await page.getByRole('button',{name:'Add receipt item',exact:true}).click()
  for(let i=0;i<25;i++) {
    await page.getByTestId(`review-name-${i}`).fill('P2C synthetic repeated item')
    await page.getByTestId(`review-quantity-${i}`).fill('2'); await page.getByTestId(`review-price-${i}`).fill('1')
    await page.getByTestId(`review-discount-${i}`).fill('0.10')
  }
  await page.getByTestId('review-amount').fill('47.51'); await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('review-amount')).toHaveAttribute('aria-invalid','true')
  expect(await stored(page)).toBeUndefined()
  await page.getByTestId('review-amount').fill('47.50')
  await page.getByTestId('review-discount-24').scrollIntoViewIfNeeded()
  await page.screenshot({path:`${out}/25-lines.png`})
  await save(page)
  const d=await stored(page); expect(d.records[0].purchase.items).toHaveLength(25)
  expect(d.records[0].purchase.items.every((l:any)=>l.unitPrice===1 && l.discountMinor===10 && l.lineTotal===1.9)).toBe(true)
  await page.reload(); await ready(page); expect(await stored(page)).toEqual(d)
  expect((await qa(page)).analytics.totalBaseAmountIls).toBe(6824.88)
})

test('failed migration write preserves v1; stale v1 tab cannot overwrite a successful v2 save', async ({page,context}) => {
  await context.addInitScript(() => { Object.defineProperty(window,'BroadcastChannel',{value:undefined}) })
  await page.goto('/'); await ready(page); await receipt(page); await save(page)
  const legacy = {...await stored(page), version:1}; await seed(page,legacy)
  await page.reload(); await ready(page)
  const other=await context.newPage(); await other.goto('/'); await ready(other)
  for(const p of [page,other]) {
    await receipt(p); await p.getByTestId('review-discount-0').fill('1'); await p.getByTestId('review-amount').fill('85.90')
  }
  await page.evaluate(() => { (window as any).__p2cPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(){ throw new DOMException('quota','QuotaExceededError') } })
  await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('capture-review')).toContainText('Not saved')
  expect(await stored(page)).toEqual(legacy)
  await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__p2cPut })
  await save(page); const migrated=await stored(page); expect(migrated.version).toBe(2)
  await other.getByTestId('capture-confirm').click()
  await expect(other.locator('main')).toHaveAttribute('data-local-state','conflict')
  expect(await stored(page)).toEqual(migrated); await other.close()
})

for (const [width, height, he] of [[360,640,false],[360,640,true],[1280,844,false],[1280,844,true]] as const) {
  test(`storage failure is visible without covering retry ${width} ${he ? 'he' : 'en'}`, async ({page}) => {
    await page.setViewportSize({width,height}); await page.emulateMedia({reducedMotion:'reduce'})
    await page.goto('/'); await ready(page)
    if(he) await page.getByRole('button',{name:'Switch to Hebrew'}).click()
    await receipt(page)
    await page.getByTestId('review-discount-0').fill('2.50')
    await page.getByTestId('review-amount').fill('84.40')
    const form=page.getByTestId('capture-review'), status=form.locator('p[role="status"]')
    const saveButton=page.getByTestId('capture-confirm')
    await page.evaluate(() => { (window as any).__p2cPut=IDBObjectStore.prototype.put; IDBObjectStore.prototype.put=function(){throw new DOMException('quota','QuotaExceededError')} })
    for(let attempt=0;attempt<2;attempt++) {
      await form.getByRole('heading').scrollIntoViewIfNeeded()
      if(attempt===0) await saveButton.click()
      else { await saveButton.focus(); await page.keyboard.press('Enter') }
      await expect(saveButton).toBeFocused()
      await expect(status).toContainText(he ? 'לא נשמר' : 'Not saved')
      // DOM presence alone missed the checkpoint defect. Check scroll clipping
      // and primary-action overlap, including repeated identical failures.
      await expect.poll(()=>status.evaluate(e=>{
        const r=e.getBoundingClientRect(),clip=e.parentElement!.getBoundingClientRect()
        return r.top>=clip.top && r.bottom<=clip.bottom && r.top>=0 && r.bottom<=innerHeight
      })).toBe(true)
      await expect(saveButton).toBeInViewport({ratio:1})
      const messageRect=await status.boundingBox(),buttonRect=await saveButton.boundingBox()
      expect(messageRect!.y+messageRect!.height).toBeLessThanOrEqual(buttonRect!.y)
      expect(await stored(page)).toBeUndefined()
      expect((await qa(page)).combinedPurchaseCount).toBe(42)
    }
    await page.screenshot({path:`artifacts/spendscape-college-p2c-correction/storage-${width}-${he?'he':'en'}.png`})
    await page.evaluate(()=>{IDBObjectStore.prototype.put=(window as any).__p2cPut})
    await save(page)
    const saved=await stored(page); expect(saved.records).toHaveLength(1)
    expect(saved.records[0].purchase.items[0]).toMatchObject({unitPrice:18.5,discountMinor:250,lineTotal:16})
    expect(await qa(page)).toMatchObject({combinedPurchaseCount:43,canonicalPins:12,mapConstructionCount:1,mapInstanceCount:1})
    await page.getByTestId('capture-undo').click()
    await expect.poll(async()=>(await stored(page)).records.length).toBe(0)
  })
}
