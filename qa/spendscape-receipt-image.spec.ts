import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fictionalOcr } from '../src/features/receipt-image/ocr-fixtures'
import { parseOcrReceipt } from '../src/features/receipt-image/ocr-parser'
const out = 'artifacts/spendscape-receipt-image-qa'
const metrics = (p: Page) => p.evaluate(() => (window as any).__SPENDSCAPE_QA__)
async function ready(p: Page) { await expect(p.locator('main')).toHaveAttribute('data-local-state','ready'); await p.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready) }
async function open(p: Page, qa = true, he = false) {
  await p.goto(qa ? '/?receiptImageQa=1' : '/'); await ready(p)
  if(he) await p.getByRole('button',{name:'Switch to Hebrew'}).click()
  await p.getByTestId((p.viewportSize()?.width ?? 1280)<761 ? 'capture-open-mobile':'capture-open-desktop').click()
  await p.getByTestId('capture-sources-open').click(); await p.getByTestId('capture-source-receipt-image').click()
  await expect(p.getByTestId('receipt-image-intake')).toBeVisible()
}
async function image(p: Page, fixture: 'one'|'fifteen'='one', qa = true) {
  const encoded = await p.evaluate(() => {
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=1000
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,800,1000);ctx.fillStyle='#111';ctx.font='26px sans-serif'
    ctx.fillText('FICTIONAL QA RECEIPT — NOT REAL OCR',30,60)
    for(let i=0;i<15;i++)ctx.fillText(`פריט בדוי Demo ${i+1} · 1 · 2.00`,30,120+i*45)
    const encoded=canvas.toDataURL('image/png').split(',')[1];canvas.width=canvas.height=0;return encoded
  })
  if(qa) { await expect(p.getByTestId('receipt-image-fixture')).toBeVisible(); await p.getByTestId('receipt-image-fixture').selectOption(fixture); await expect(p.getByTestId('receipt-image-fixture')).toHaveValue(fixture) }
  await p.getByTestId('receipt-upload-input').setInputFiles({name:'fictional-private-marker.png',mimeType:'image/png',buffer:Buffer.from(encoded,'base64')})
  await expect(p.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','ready')
  await expect(p.getByTestId('receipt-image-read')).toBeFocused()
  await expect(p.getByTestId('receipt-image-read')).toBeInViewport({ratio:1})
}
async function context(p: Page) {
  await p.getByTestId('review-channel').selectOption('physical');await p.getByTestId('review-placeId').selectOption('place_shuk_bograshov')
  await p.getByTestId('review-payment').selectOption('cash');await p.getByTestId('review-category').selectOption('groceries')
  await p.getByTestId('receipt-timezone').selectOption('Asia/Jerusalem');await p.getByTestId('receipt-confirm-time').click()
}
async function count(p: Page,n:number) { await expect.poll(async()=>(await metrics(p)).combinedPurchaseCount).toBe(n);expect(await metrics(p)).toMatchObject({canonicalPins:12,mapInstanceCount:1,mapConstructionCount:1}) }
async function stored(p: Page) { return p.evaluate(()=>new Promise<any>(resolve=>{const r=indexedDB.open('spendscape-local-purchases',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('state'),q=tx.objectStore('state').get('current');tx.oncomplete=()=>{db.close();resolve(q.result)}}})) }
test.beforeAll(async()=>{await mkdir(out,{recursive:true})})
for(const [width,height,he,fixture] of [[360,640,false,'one'],[360,640,true,'fifteen'],[390,844,true,'one'],[430,932,false,'fifteen'],[1280,844,false,'fifteen']] as const) {
  test(`mock image to corrected explicit review save reload ${width} ${he?'he':'en'}`,async({page})=>{
    await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'})
    const posts:string[]=[],errors:string[]=[],logs:string[]=[],forbidden:string[]=[]
    page.on('request',r=>{if(r.method()==='POST')posts.push(r.postData() ?? '');if(/vision.googleapis|gemini|groq|tesseract|traineddata/.test(r.url()))forbidden.push('forbidden')})
    page.on('pageerror',()=>errors.push('pageerror'));page.on('console',m=>logs.push(m.text()))
    await open(page,true,he);await count(page,42);await image(page,fixture)
    await expect(page.getByTestId('receipt-image-qa')).toContainText(he?'בדיקה מקומית בלבד':'Local QA only')
    await page.screenshot({path:`${out}/preview-${width}-${he?'he':'en'}.png`})
    await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-observations')).toBeVisible();await count(page,42)
    await expect(page.getByTestId('review-printedAmount-0')).toHaveValue(fixture==='one'?'12.50':'6.00');await expect(page.getByTestId('review-quantity-0')).toHaveValue('2')
    if(fixture==='fifteen'){await expect(page.getByTestId('review-discount-0')).toHaveValue('0.50');await expect(page.getByTestId('review-unit-1')).toHaveValue('kg')}
    await context(page);await page.getByTestId('review-printedAmount-0').fill('0.01');await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('review-printedAmount-0')).toBeFocused();await expect(page.locator('#review-error-printedAmount-0')).toBeInViewport({ratio:1});await count(page,42)
    await page.screenshot({path:`${out}/correction-${width}-${he?'he':'en'}.png`})
    await page.getByTestId('review-printedAmount-0').fill(fixture==='one'?'12.50':'6.00')
    await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('capture-success')).toBeVisible();await count(page,43)
    const d=await stored(page);expect(d.version).toBe(3);expect(d.records[0].purchase.items).toHaveLength(fixture==='one'?1:15)
    expect(d.records[0].purchase.originalAmount).toBe(fixture==='one'?12.50:41);expect(JSON.stringify(d)).not.toMatch(/blob:|base64|fictional-private-marker|observations|vatRate/)
    if(fixture==='fifteen')expect(d.records[0].purchase.items[0]).toMatchObject({unitPrice:3.25,discountMinor:50,lineTotal:6})
    expect(await page.evaluate(()=>JSON.stringify([...Object.values(sessionStorage),history.state,location.href]))).not.toMatch(/blob:|fictional-private-marker|Fictional Demo Market/)
    expect(posts).toEqual([JSON.stringify({fixture})]);expect(forbidden).toEqual([]);expect(errors).toEqual([]);expect(logs.join(' ')).not.toMatch(/fictional-private-marker|Fictional Demo Market|base64/)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.reload();await ready(page);await count(page,43);expect(await stored(page)).toEqual(d)
  })
}
test('ordinary image selection is honestly unavailable and sends no image or OCR request',async({page})=>{
  const posts:string[]=[];page.on('request',r=>{if(r.method()==='POST')posts.push(r.url())})
  await open(page,false);await expect(page.getByTestId('receipt-image-qa')).toHaveCount(0);await image(page,'one',false)
  await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-image-status')).toContainText('recognition is unavailable')
  await expect(page.getByTestId('receipt-image-preview')).toHaveCount(0);await count(page,42);expect(posts).toEqual([]);expect(await stored(page)).toBeUndefined()
})
test('invalid format/oversized image has accessible feedback and cannot enter review',async({page})=>{
  await open(page);for(const [buffer,mimeType,expected] of [[Buffer.from('<svg>synthetic</svg>'),'image/svg+xml','JPEG or PNG'],[Buffer.alloc(4*1024*1024+1),'image/png','4 MB']] as const){await page.getByTestId('receipt-upload-input').setInputFiles({name:'fictional.png',mimeType,buffer});await expect(page.getByTestId('receipt-image-status')).toContainText(expected);await expect(page.getByTestId('receipt-image-preview')).toHaveCount(0);await expect(page.getByTestId('receipt-image-read')).toBeDisabled();await count(page,42)}
})
for(const exit of ['back','escape','close'] as const) test(`late mock after ${exit} cannot create draft; all previews revoked`,async({page})=>{
  await page.addInitScript(()=>{const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);(window as any).__imageCounts={made:0,released:0};URL.createObjectURL=(b)=>{(window as any).__imageCounts.made++;return create(b)};URL.revokeObjectURL=(u)=>{(window as any).__imageCounts.released++;revoke(u)}})
  let release!: ()=>Promise<void>;await page.route('**/api/receipt-ocr',route=>new Promise<void>(resolve=>{release=async()=>{await route.fulfill({json:{code:'synthetic-qa',...parseOcrReceipt(fictionalOcr('one'))}}).catch(()=>{});resolve()}}))
  await open(page);await image(page);await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','reading')
  if(exit==='back')await page.goBack();else if(exit==='escape')await page.keyboard.press('Escape');else await page.getByRole('button',{name:'Close Capture'}).last().click()
  await expect(page.getByTestId('receipt-image-intake')).toHaveCount(0);await release();await count(page,42);await expect(page.getByTestId('receipt-observations')).toHaveCount(0)
  expect(await page.evaluate(()=>(window as any).__imageCounts)).toEqual({made:1,released:1})
})
test('replacement rejects old result, duplicate confirmation and Undo use existing durable boundary',async({page})=>{
  let release!: ()=>Promise<void>;let n=0;await page.route('**/api/receipt-ocr',async route=>{n++;if(n===1)await new Promise<void>(resolve=>{release=async()=>{await route.fulfill({json:{code:'synthetic-qa',...parseOcrReceipt(fictionalOcr('one'))}}).catch(()=>{});resolve()}});else await route.continue()})
  await open(page);await image(page);await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','reading');await image(page,'fifteen');await release();await expect(page.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','ready');await expect(page.getByTestId('receipt-observations')).toHaveCount(0)
  await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-observations')).toBeVisible();await context(page);await page.getByTestId('capture-review').evaluate((f:HTMLFormElement)=>{f.requestSubmit();f.requestSubmit()});await expect(page.getByTestId('capture-success')).toBeVisible();await count(page,43)
  await page.getByTestId('capture-undo').click();await count(page,42);expect((await stored(page)).records).toEqual([])
  await page.getByTestId('capture-source-receipt-image').click();await image(page,'fifteen');await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-observations')).toBeVisible();await context(page);await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('capture-success')).toBeVisible();await count(page,43)
  const previousPurchase=(await stored(page)).records[0].purchase
  await page.getByTestId('capture-done').click();await page.getByTestId('capture-open-desktop').click();await page.getByTestId('capture-sources-open').click(); await page.getByTestId('capture-source-receipt-image').click();await image(page,'fifteen');await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-observations')).toBeVisible();await context(page)
  expect(Number(await page.getByTestId('review-amount').inputValue())).toBe(previousPurchase.originalAmount)
  expect(await page.getByTestId('review-date').inputValue()).toBe('2026-10-03T09:15')
  for(let i=0;i<previousPurchase.items.length;i++){
    const line=previousPurchase.items[i]
    expect(await page.getByTestId(`review-name-${i}`).inputValue()).toBe(line.label.en)
    expect(Number(await page.getByTestId(`review-quantity-${i}`).inputValue())).toBe(line.quantity)
    expect(Number(await page.getByTestId(`review-price-${i}`).inputValue())).toBe(line.unitPrice)
    expect(await page.getByTestId(`review-unit-${i}`).inputValue()).toBe(line.unit)
    expect(Math.round(Number(await page.getByTestId(`review-discount-${i}`).inputValue())*100)).toBe(line.discountMinor ?? 0)
  }
  await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('review-save-separate')).toBeVisible();await count(page,43)
})
test('timeout and malformed server responses discard media without automatic retry',async({page})=>{
  let calls=0;await page.route('**/api/receipt-ocr',async route=>{calls++;await route.fulfill({json:{code:'synthetic-qa',observations:{private:'synthetic-secret'}}})})
  await open(page);await image(page);await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-image-status')).toContainText('No reliable draft');await count(page,42);expect(calls).toBe(1)
  await page.unroute('**/api/receipt-ocr');let release!:()=>Promise<void>;await page.route('**/api/receipt-ocr',route=>new Promise<void>(resolve=>{calls++;release=async()=>{await route.fulfill({json:{code:'synthetic-qa',...parseOcrReceipt(fictionalOcr('one'))}}).catch(()=>{});resolve()}}))
  await image(page);await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.getByTestId('receipt-image-read').click();await expect(page.getByTestId('receipt-image-intake')).toHaveAttribute('data-phase','reading');await page.clock.runFor(15_000);await expect(page.getByTestId('receipt-image-status')).toContainText('timed out');await release();await count(page,42);expect(calls).toBe(2);await expect(page.getByTestId('receipt-observations')).toHaveCount(0)
})
test('receipt intake stops the sole barcode stream and never requests a second stream',async({page})=>{
  await page.addInitScript(()=>{
    const state={calls:[] as MediaStreamConstraints[],tracks:[] as MediaStreamTrack[]};(window as any).__receiptCamera=state
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async(constraints:MediaStreamConstraints)=>{
      state.calls.push(constraints);const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;canvas.getContext('2d')!.fillRect(0,0,640,480);const stream=canvas.captureStream(1);state.tracks.push(...stream.getTracks());return stream
    }}})
  })
  await page.goto('/?receiptImageQa=1');await ready(page);await page.getByTestId('capture-open-desktop').click()
  expect(await page.evaluate(()=>(window as any).__receiptCamera.calls)).toEqual([])
  await page.getByTestId('capture-camera-toggle').click();await expect(page.getByTestId('capture-scanner')).toHaveAttribute('data-camera-state','live')
  await page.getByTestId('capture-sources-open').click(); await page.getByTestId('capture-source-receipt-image').click();await expect(page.getByTestId('receipt-photo-input')).toHaveAttribute('capture','environment')
  await image(page);await page.getByTestId('receipt-image-discard').click()
  const camera=await page.evaluate(()=>({calls:(window as any).__receiptCamera.calls,tracks:(window as any).__receiptCamera.tracks.map((t:MediaStreamTrack)=>t.readyState)}))
  expect(camera.calls).toHaveLength(1);expect(camera.calls[0].audio).toBe(false);expect(camera.tracks.every((s:string)=>s==='ended')).toBe(true);await count(page,42)
})

for (const he of [false, true]) test(`bilingual labels and unresolved repeated total require explicit correction ${he ? 'he' : 'en'}`, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const doc = fictionalOcr('one')
  const original = doc.words.find(w => w.text === 'קוואקר בדוי Oats')!
  doc.words.splice(doc.words.indexOf(original), 1,
    { text: 'לחם', x: 130, y: 250, width: 24, height: 20 },
    { text: 'בדוי', x: 70, y: 250, width: 32, height: 20 })
  doc.words.push(
    { text: 'Total:', x: 30, y: 355, width: 100, height: 20 },
    { text: '9.99', x: 160, y: 355, width: 32, height: 20 },
    { text: '99.99', x: 250, y: 355, width: 40, height: 20 })
  const result = parseOcrReceipt(doc)
  expect(result.observations.lines[0].name).toBe('לחם בדוי')
  expect(result.observations.finalAmount).toBeNull()
  await page.route('**/api/receipt-ocr', route => route.fulfill({ json: { code: 'synthetic-qa', ...result } }))
  await open(page, true, he); await image(page)
  await page.getByTestId('receipt-image-read').click()
  await expect(page.getByTestId('receipt-observations')).toBeVisible()
  await expect(page.getByTestId('review-name-0')).toHaveValue('לחם בדוי')
  await expect(page.getByTestId('review-amount')).toHaveValue('')
  await context(page); await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('review-amount')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByTestId('review-amount')).toBeFocused()
  await expect(page.locator('#review-error-amount')).toBeInViewport({ ratio: 1 })
  await count(page, 42); expect(await stored(page)).toBeUndefined()
  await page.screenshot({ path: `${out}/header-unresolved-360-${he ? 'he' : 'en'}.png` })
  await page.getByTestId('review-amount').fill('12.50') // Explicit fictional user correction, never a parser repair.
  await page.getByTestId('review-name-0').fill('Reviewed fictional bread')
  const originalDetails = page.getByTestId('receipt-observations').locator('details')
  await originalDetails.locator('summary').click()
  await expect(originalDetails.locator('ol li').first()).toContainText('לחם בדוי')
  await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible(); await count(page, 43)
  expect((await stored(page)).records[0].purchase.items[0].label.en).toBe('Reviewed fictional bread')
  await page.getByTestId('capture-undo').click(); await count(page, 42)
})
