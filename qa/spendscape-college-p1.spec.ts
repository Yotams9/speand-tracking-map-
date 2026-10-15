import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const dbName = 'spendscape-local-purchases'
const qa = (p: Page) => p.evaluate(() => (window as any).__SPENDSCAPE_QA__)
async function ready(p: Page) {
  await expect(p.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await p.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready)
}
async function receipt(p: Page, mobile = false) {
  await p.getByTestId(mobile ? 'capture-open-mobile' : 'capture-open-desktop').click()
  await p.getByTestId('capture-scan').click()
  await expect(p.getByTestId('capture-confirm')).toBeVisible()
}
async function save(p: Page) { await p.getByTestId('capture-confirm').click(); await expect(p.getByTestId('capture-success')).toBeVisible() }
async function stored(p: Page) { return p.evaluate(async name => {
  return await new Promise<any>((resolve, reject) => { const r = indexedDB.open(name, 1); r.onerror = () => reject('open'); r.onsuccess = () => { const db = r.result, tx = db.transaction('state'), q = tx.objectStore('state').get('current'); tx.oncomplete = () => { db.close(); resolve(q.result) } } })
}, dbName) }
async function erase(p: Page) {
  if (await p.getByTestId('capture-done').isVisible()) await p.getByTestId('capture-done').click()
  await p.getByTestId('local-privacy').click()
  await p.getByTestId('local-erase').click()
  await Promise.all([p.waitForEvent('load'), p.getByTestId('local-erase-confirm').click()])
  await ready(p)
  await expect.poll(async () => (await qa(p)).combinedPurchaseCount).toBe(42)
}
for (const [width, height, he] of [[1280,844,false],[360,640,true],[390,844,false],[430,932,true]] as const) {
  test(`persist receipt, expired Undo, reload, privacy and erase ${width}`, async ({page,context}) => {
    await mkdir('artifacts/spendscape-college-p1', { recursive: true })
    await page.setViewportSize({width,height}); await page.emulateMedia({reducedMotion:'reduce'})
    const errors: string[] = [], writes: string[] = []
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (!['GET','HEAD'].includes(r.method())) writes.push(r.method()) })
    await page.goto('/'); await ready(page)
    if (he) await page.getByRole('button',{name:'Switch to Hebrew'}).click()
    await receipt(page,width<761)
    await page.clock.install(); await page.clock.pauseAt(new Date(Date.now()+1000))
    await save(page)
    await page.clock.runFor(7999); await expect(page.getByTestId('capture-undo')).toBeVisible(); await expect(page.getByTestId('nearby-demo')).toHaveCount(0)
    await page.clock.runFor(1); await expect(page.getByTestId('capture-undo')).toHaveCount(0); await expect(page.getByTestId('nearby-demo')).toBeVisible()
    expect((await stored(page)).records).toHaveLength(1)
    await page.clock.resume(); await page.reload(); await ready(page)
    expect(await qa(page)).toMatchObject({combinedPurchaseCount:43,canonicalPins:12,mapConstructionCount:1,mapInstanceCount:1,analytics:{totalBaseAmountIls:6864.28}})
    await expect(page.getByTestId('session-undo')).toHaveCount(0)
    await expect(page.getByTestId('nearby-demo')).toHaveCount(0)
    await page.getByTestId('local-privacy').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.screenshot({path:`artifacts/spendscape-college-p1/privacy-${width}.png`})
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0)
    const other = await context.newPage(); await other.goto('/'); await ready(other)
    expect((await qa(other)).combinedPurchaseCount).toBe(43); await other.close()
    await erase(page)
    const d = await stored(page); expect(d.records).toEqual([]); expect(d.decisions).toEqual([]); expect(d.revision).toBeGreaterThan(0)
    expect(errors).toEqual([]); expect(writes).toEqual([])
  })
}
test('Undo is durable and reloading during its window never grants a new window', async ({page}) => {
  await page.goto('/'); await ready(page); await receipt(page); await save(page)
  await page.getByTestId('capture-undo').click()
  await expect.poll(async()=> (await stored(page)).records.length).toBe(0)
  await page.reload(); await ready(page); expect((await qa(page)).combinedPurchaseCount).toBe(42)
  await receipt(page); await save(page); await page.reload(); await ready(page)
  expect((await qa(page)).combinedPurchaseCount).toBe(43); await expect(page.getByTestId('session-undo')).toHaveCount(0)
})
test('failed write retains draft and previous durable state; explicit retry succeeds once', async ({page}) => {
  await page.goto('/'); await ready(page); await receipt(page)
  await page.evaluate(() => { (window as any).__originalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(){ throw new DOMException('quota','QuotaExceededError') } })
  await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toHaveCount(0)
  await expect(page.getByTestId('capture-review')).toContainText('Not saved')
  expect((await qa(page)).combinedPurchaseCount).toBe(42); expect(await stored(page)).toBeUndefined()
  await page.evaluate(() => { IDBObjectStore.prototype.put = (window as any).__originalPut })
  await page.getByTestId('capture-confirm').dblclick()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  expect((await stored(page)).records).toHaveLength(1)
})
test('corrupt or future data is not overwritten; only confirmed erase restores baseline', async ({page}) => {
  await page.goto('/'); await ready(page)
  await page.evaluate(async name => { await new Promise<void>(resolve => { const r=indexedDB.open(name,1); r.onsuccess=()=>{const db=r.result, tx=db.transaction('state','readwrite');tx.objectStore('state').put({version:999,private:'fixture-test'},'current');tx.oncomplete=()=>{db.close();resolve()} } }) },dbName)
  await page.reload(); await expect(page.locator('main')).toHaveAttribute('data-local-state','invalid')
  expect(await stored(page)).toEqual({version:999,private:'fixture-test'})
  await page.getByTestId('local-erase').click(); await page.getByRole('button',{name:'Cancel',exact:true}).click()
  expect(await stored(page)).toEqual({version:999,private:'fixture-test'})
  await page.getByTestId('local-erase').click(); await Promise.all([page.waitForEvent('load'), page.getByTestId('local-erase-confirm').click()]); await ready(page)
  expect((await stored(page)).records).toEqual([])
})
test('stale tab cannot overwrite another save even without BroadcastChannel', async ({page,context}) => {
  await context.addInitScript(() => { Object.defineProperty(window,'BroadcastChannel',{value:undefined}) })
  await page.goto('/'); await ready(page)
  const other=await context.newPage();await other.goto('/');await ready(other)
  await receipt(page);await receipt(other);await save(page)
  await other.getByTestId('capture-confirm').click()
  await expect(other.locator('main')).toHaveAttribute('data-local-state','conflict')
  expect((await stored(page)).records).toHaveLength(1)
  await other.reload();await ready(other);expect((await qa(other)).combinedPurchaseCount).toBe(43)
  await erase(page)
  await other.getByTestId('capture-open-desktop').click();await other.getByTestId('capture-scan').click();await other.getByTestId('capture-confirm').click()
  await other.getByTestId('review-save-separate').click()
  await expect(other.locator('main')).toHaveAttribute('data-local-state','conflict')
  expect((await stored(page)).records).toEqual([])
})
test('unavailable IndexedDB blocks saving with a visible fixed error', async ({page})=>{
  await page.addInitScript(()=>{ Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('blocked','SecurityError')}}) })
  await page.goto('/');await expect(page.locator('main')).toHaveAttribute('data-local-state','unavailable')
  await expect(page.getByRole('dialog')).toContainText('Local storage is unavailable')
  await expect(page.locator('main')).toHaveAttribute('inert','')
})
test('Inbox confirm and Undo survive reload without changing totals or adding a pin', async ({page})=>{
  await page.goto('/');await ready(page)
  await page.getByTestId('smart-inbox-open').click()
  await page.locator('label:has(input[name="smart-inbox-choice"])').first().click()
  await page.getByTestId('smart-inbox-confirm').click()
  await expect.poll(async()=> (await stored(page))?.decisions.length).toBe(1)
  await page.reload();await ready(page)
  expect(await qa(page)).toMatchObject({pendingInboxCount:0,canonicalPins:12,analytics:{totalBaseAmountIls:6777.38}})
  await page.getByTestId('smart-inbox-open').click()
  await page.getByTestId('smart-inbox-undo').click()
  await expect.poll(async()=> (await stored(page)).decisions.length).toBe(0)
  await page.reload();await ready(page);expect((await qa(page)).pendingInboxCount).toBe(1)
})
test('foreign online purchase survives page closure; unknown barcode remains user reviewed and privacy safe', async ({page,context})=>{
  const writes:string[]=[], logs:string[]=[]
  page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method())})
  page.on('console',m=>logs.push(m.text()))
  await page.goto('/');await ready(page)
  await page.getByTestId('capture-open-desktop').click()
  await page.getByTestId('barcode-manual-open').click();await page.getByTestId('barcode-input').fill('4006381333931');await page.getByTestId('barcode-submit').click()
  await page.getByTestId('barcode-product-name').fill('P1 private synthetic item')
  await page.getByTestId('barcode-review-purchase').click()
  await page.getByTestId('review-channel').selectOption('online');await page.getByTestId('review-merchantId').selectOption('merchant_serein')
  await page.getByTestId('review-date').fill('2026-09-24T14:35');await page.getByTestId('review-currency').selectOption('USD')
  await page.getByTestId('review-payment').selectOption('cash');await page.getByTestId('review-category').selectOption('retail')
  await page.getByTestId('review-amount').fill('25.00');await page.getByTestId('review-quantity-0').fill('2');await page.getByTestId('review-price-0').fill('12.50');await page.getByTestId('review-baseAmount').fill('87.43')
  await save(page)
  const d=await stored(page);expect(d.records[0]).toMatchObject({synthetic:false,purchase:{placeId:null,originalCurrency:'USD',fx:{reportedBaseAmountIls:87.43,source:'user-reported-conversion'}}})
  expect(Object.keys(d).sort()).toEqual(['decisions','directory','nextSequence','records','revision','version'])
  expect(JSON.stringify(await context.storageState())).not.toContain('P1 private')
  expect(await page.evaluate(()=> JSON.stringify([history.state,location.href,{...sessionStorage}]))).not.toContain('P1 private')
  expect(logs.join(' ')).not.toContain('P1 private');expect(writes).toEqual([])
  await page.close();const reopened=await context.newPage();await reopened.goto('/');await ready(reopened)
  expect(await qa(reopened)).toMatchObject({combinedPurchaseCount:43,canonicalPins:12,analytics:{totalBaseAmountIls:6864.81}})
  await expect(reopened.getByTestId('session-undo')).toHaveCount(0)
})
test('transaction abort after put request never reports a successful save',async({page})=>{
  await page.goto('/');await ready(page);await receipt(page)
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>){const r=original.apply(this,args);r.addEventListener('success',()=>this.transaction.abort());return r}})
  await page.getByTestId('capture-confirm').click();await expect(page.getByTestId('capture-review')).toContainText('Not saved')
  expect(await stored(page)).toBeUndefined();expect((await qa(page)).combinedPurchaseCount).toBe(42)
})

async function manualReview(p: Page, amount = '25.00') {
  await p.getByTestId((p.viewportSize()?.width ?? 1280)<761?'capture-open-mobile':'capture-open-desktop').click()
  await p.getByTestId('capture-camera-manual').click()
  for (const [field,value] of Object.entries({channel:'unknown',merchantId:'merchant_unresolved',currency:'ILS',payment:'cash',category:'retail'})) await p.getByTestId('review-'+field).selectOption(value)
  await p.getByTestId('review-date').fill('2026-09-24T14:35')
  await p.getByTestId('review-amount').fill(amount)
  await p.getByTestId('manual-review').click()
}
for (const he of [false,true]) {
  test(`capacity rejection retains the draft and usable existing history ${he?'he':'en'}`,async({page})=>{
    if(he)await page.setViewportSize({width:360,height:640})
    await page.goto('/');await ready(page);await manualReview(page);await save(page)
    await page.evaluate(async name=>new Promise<void>(resolve=>{
      const r=indexedDB.open(name,1)
      r.onsuccess=()=>{
        const db=r.result,tx=db.transaction('state','readwrite'),s=tx.objectStore('state'),q=s.get('current')
        q.onsuccess=()=>{
          const d=q.result,template=JSON.stringify(d.records[0])
          d.records=Array.from({length:1000},(_,i)=>JSON.parse(template.replaceAll('session_purchase_manual_01','session_purchase_manual_'+String(i+1).padStart(2,'0')).replaceAll('session_evidence_manual_01','session_evidence_manual_'+String(i+1).padStart(2,'0'))))
          d.nextSequence=1001;d.revision++;s.put(d,'current')
        }
        tx.oncomplete=()=>{db.close();resolve()}
      }
    }),dbName)
    await page.reload();await ready(page)
    const before=await stored(page)
    if(he)await page.getByRole('button',{name:'Switch to Hebrew'}).click()
    await manualReview(page,'26.00');await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('capture-review')).toContainText(he?'מגבלת הרכישות המקומיות':'local purchase limit')
    await expect(page.locator('main')).toHaveAttribute('data-local-state','ready')
    await expect(page.locator('main')).not.toHaveAttribute('inert','')
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await expect(page.getByTestId('review-amount')).toHaveValue('26.00')
    await expect(page.getByTestId('capture-review').getByRole('status')).toBeInViewport()
    await page.getByTestId('capture-confirm').click({trial:true})
    expect(await stored(page)).toEqual(before)
    expect((await qa(page)).combinedPurchaseCount).toBe(1042)
    await page.screenshot({path:`artifacts/spendscape-college-p1/capacity-${he?'he':'en'}.png`})
    await page.keyboard.press('Escape')
    await page.getByTestId('local-privacy').click()
    await expect(page.getByRole('dialog',{name:he?'נתונים במכשיר ופרטיות':'On-device data & privacy'})).toBeVisible()
    await page.keyboard.press('Escape')
    await page.reload();await ready(page)
    expect((await qa(page)).combinedPurchaseCount).toBe(1042)
    expect(await stored(page)).toEqual(before)
  })
}
for (const mode of ['back','exit','back-forward','exit-reenter'] as const) {
  test(`late durable save preserves newer navigation: ${mode}`,async({page})=>{
    await page.goto('/');await ready(page);await manualReview(page)
    await page.evaluate(()=>{
      const original=indexedDB.open.bind(indexedDB)
      indexedDB.open=((...args:Parameters<IDBFactory['open']>)=>{
        const r=original(...args)
        Object.defineProperty(r,'onsuccess',{set(callback:(event:Event)=>void){
          r.addEventListener('success',event=>{
            ;(window as any).__releaseSave=()=>{indexedDB.open=original;callback.call(r,event)}
          })
        }})
        return r
      }) as IDBFactory['open']
    })
    await page.getByTestId('capture-confirm').click()
    await expect(page.locator('main')).toHaveAttribute('inert','')
    await page.waitForFunction(()=>typeof (window as any).__releaseSave==='function')
    if(mode.startsWith('exit')){
      await page.evaluate(()=>history.go(-3))
      await expect(page.getByTestId('capture-dialog')).toHaveCount(0)
      if(mode==='exit-reenter'){
        await page.goForward()
        await expect(page.getByTestId('capture-scanner')).toBeVisible()
      }
    }else{
      await page.goBack();await expect(page.getByTestId('capture-manual')).toBeVisible()
      if(mode==='back-forward'){await page.goForward();await expect(page.getByTestId('capture-review')).toBeVisible()}
    }
    const before=await page.evaluate(()=>({history:history.state,step:(window as any).__SPENDSCAPE_QA__.captureStep,url:location.href}))
    await page.evaluate(()=>(window as any).__releaseSave())
    await expect(page.locator('main')).not.toHaveAttribute('inert','')
    await expect.poll(async()=>(await qa(page)).combinedPurchaseCount).toBe(43)
    expect(await page.evaluate(()=>({history:history.state,step:(window as any).__SPENDSCAPE_QA__.captureStep,url:location.href}))).toEqual(before)
    await expect(page.getByTestId('capture-success')).toHaveCount(0)
    if(mode==='back' || mode==='back-forward'){
      if(mode==='back')await page.getByTestId('manual-review').click()
      await page.getByTestId('capture-confirm').click()
      await expect(page.getByTestId('capture-review')).toContainText('This confirmation has already been used')
    }
    expect((await stored(page)).records).toHaveLength(1)
    expect(await qa(page)).toMatchObject({canonicalPins:12,mapConstructionCount:1,mapInstanceCount:1})
    await page.reload();await ready(page)
    expect((await qa(page)).combinedPurchaseCount).toBe(43)
    expect((await stored(page)).records).toHaveLength(1)
  })
}
