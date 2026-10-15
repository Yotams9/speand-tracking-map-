import { test, expect, type Page } from '@playwright/test'
import { legacyFixture, nativeFixture } from './main-integration-fixtures'

async function ready(page: Page) { await expect(page.locator('main')).toHaveAttribute('data-local-state','ready') }
async function disk(page: Page) {
  return page.evaluate(() => new Promise<any>(resolve => {
    const r=indexedDB.open('spendscape-local-purchases',1)
    r.onsuccess=()=>{const d=r.result,t=d.transaction('state'),q=t.objectStore('state').get('current');t.oncomplete=()=>{d.close();resolve(q.result)}}
  }))
}
async function begin(page: Page, he=false) {
  await page.route(/geoapify|generativelanguage|vision\.googleapis|groq|prices\.shufersal|pricesprodpublic/i,()=>{throw Error('provider-forbidden')})
  await page.goto('/'); await ready(page)
  if(he) await page.getByRole('button',{name:'Switch to Hebrew'}).click()
}
async function barcode(page: Page) {
  await page.getByTestId('capture-open-mobile').click()
  await page.getByTestId('barcode-manual-open').click()
  await page.getByTestId('barcode-input').fill('5060639129102')
  await page.getByTestId('barcode-submit').click()
  await page.getByTestId('barcode-review-purchase').click()
  await page.getByTestId('review-channel').selectOption('physical')
  const response=await page.request.get('/api/catalog/stores')
  return (await response.json()).stores.find((s:any)=>s.location)
}
async function gpsMock(page: Page, mode: 'success'|'denied'|'missing'|'deferred'|'distant') {
  await page.addInitScript(mode => {
    const w=window as any; w.gpsReads=0
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:mode==='missing'?undefined:{getCurrentPosition(success:any,error:any,options:any){
      w.gpsReads++; w.gpsOptions=options; w.gpsSuccess=success
      if(mode==='denied') error({code:1,message:'synthetic denial'})
      else if(mode==='success'||mode==='distant') success({coords:mode==='distant'?{longitude:0,latitude:0}:w.gpsPoint})
    }}})
  },mode)
}
for (const he of [false,true]) {
  test(`catalog clear restores independent fields and removes derived facts ${he}`,async({page})=>{
    await begin(page,he); const s=await barcode(page)
    await page.getByTestId('catalog-store-select').selectOption(s.id)
    await page.getByTestId('review-place-confirmed').check()
    await page.getByTestId('catalog-store-select').selectOption('')
    await expect(page.getByTestId('review-place-address')).toHaveCount(0)
    await expect(page.getByTestId('review-place-longitude')).toHaveCount(0)
    await expect(page.getByTestId('review-merchantName')).toHaveCount(0)
    await page.getByTestId('review-new-merchant').click()
    await page.getByTestId('review-merchantName').fill('Independent synthetic merchant')
    await page.getByTestId('review-place-address').fill('Independent synthetic address')
    await page.getByTestId('review-place-longitude').fill('1')
    await page.getByTestId('review-place-latitude').fill('2')
    await page.getByTestId('catalog-store-select').selectOption(s.id)
    await page.getByTestId('catalog-store-select').selectOption('')
    await expect(page.getByTestId('review-merchantName')).toHaveValue('Independent synthetic merchant')
    await expect(page.getByTestId('review-place-address')).toHaveValue('Independent synthetic address')
    await expect(page.getByTestId('review-place-longitude')).toHaveValue('1')
    await expect(page.getByTestId('review-place-latitude')).toHaveValue('2')
    expect(await disk(page)).toBeUndefined()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  })
  test(`GPS nearest is explicit, suggestion-only, then confirmed save/reload ${he}`,async({page},info)=>{
    await gpsMock(page,'success'); await begin(page,he); const s=await barcode(page)
    await page.evaluate(point=>{(window as any).gpsPoint=point},{longitude:s.location.lon,latitude:s.location.lat})
    expect(await page.evaluate(()=>(window as any).gpsReads)).toBe(0)
    await page.getByTestId('review-nearest').click()
    expect(await page.evaluate(()=>(window as any).gpsReads)).toBe(1)
    expect(await page.evaluate(()=>(window as any).gpsOptions)).toEqual({enableHighAccuracy:false,maximumAge:0,timeout:10000})
    await expect(page.getByTestId('review-nearest-use')).toBeVisible()
    await expect(page.getByTestId('review-merchantName')).toHaveCount(0)
    await page.getByTestId('review-nearest-use').click()
    await expect(page.getByTestId('review-place-confirmed')).not.toBeChecked()
    await expect(page.getByTestId('review-price-0')).toHaveValue('')
    await expect(page.getByTestId('review-amount')).toHaveValue('')
    await page.screenshot({path:info.outputPath(he?'gps-he.png':'gps-en.png'),fullPage:true})
    await page.getByTestId('review-merchantCategory').selectOption('unknown')
    await page.getByTestId('review-date').fill('2026-10-15T10:00')
    await page.getByTestId('review-currency').selectOption('ILS')
    await page.getByTestId('review-payment').selectOption('unknown')
    await page.getByTestId('review-category').selectOption('unknown')
    await page.getByTestId('review-quantity-0').fill('2')
    await page.getByTestId('review-price-0').fill('5.00')
    await page.getByTestId('review-amount').fill('10.00')
    await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('review-place-confirmed')).toHaveAttribute('aria-invalid','true')
    expect(await disk(page)).toBeUndefined()
    await page.getByTestId('review-place-confirmed').check()
    await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('capture-success')).toBeVisible()
    const saved=await disk(page)
    expect(saved.records).toHaveLength(1); expect(saved.records[0].purchase.originalAmount).toBe(10)
    expect(saved.directory.places).toHaveLength(1)
    await page.reload(); await ready(page); expect(await disk(page)).toEqual(saved)
    await expect(page.locator('main')).toHaveAttribute('data-pin-count','1')
    await expect(page.locator('main')).toHaveAttribute('data-map-ready','true')
    await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(1)
  })
}
for(const mode of ['denied','missing','distant'] as const) test(`GPS ${mode} preserves draft and unresolved alternatives`,async({page})=>{
 await gpsMock(page,mode); await begin(page); await barcode(page)
 await page.getByTestId('review-nearest').click()
 await expect(page.getByTestId('review-nearest-status')).toContainText(mode==='distant'?'No known':'Location unavailable')
 await expect(page.getByTestId('review-nearest-use')).toHaveCount(0)
 await page.getByTestId('review-channel').selectOption('unknown')
 await expect(page.getByTestId('review-place-longitude')).toHaveCount(0)
 expect(await disk(page)).toBeUndefined()
})
test('current GPS point needs confirmation; stale GPS after edits or close cannot overwrite',async({page},info)=>{
 await gpsMock(page,'deferred'); await begin(page); await barcode(page)
 await page.getByTestId('review-new-merchant').click()
 await page.getByTestId('review-place-address').fill('Independent synthetic address')
 await page.getByTestId('review-locate').click()
 await expect(page.getByTestId('review-locate')).toBeDisabled()
 expect(await page.evaluate(()=>(window as any).gpsReads)).toBe(1)
 await page.evaluate(()=>(window as any).gpsSuccess({coords:{longitude:1,latitude:2}}))
 await expect(page.getByTestId('review-place-longitude')).toHaveValue('1')
 await expect(page.getByTestId('review-place-latitude')).toHaveValue('2')
 await expect(page.getByTestId('review-place-address')).toHaveValue('Independent synthetic address')
 await expect(page.getByTestId('review-place-confirmed')).not.toBeChecked()
 await page.getByTestId('review-locate').scrollIntoViewIfNeeded()
 await page.screenshot({path:info.outputPath('gps-current-en.png'),fullPage:true})
 await page.getByTestId('review-place-confirmed').check()
 await page.getByTestId('review-locate').click()
 await page.getByTestId('review-place-longitude').fill('3')
 await page.evaluate(()=>(window as any).gpsSuccess({coords:{longitude:9,latitude:9}}))
 await expect(page.getByTestId('review-place-longitude')).toHaveValue('3')
 await expect(page.getByTestId('review-place-confirmed')).not.toBeChecked()
 await page.getByTestId('review-locate').click()
 await page.getByTestId('capture-dialog').getByRole('button',{name:'Close Capture',exact:true}).click()
 await page.evaluate(()=>(window as any).gpsSuccess({coords:{longitude:9,latitude:9}}))
 await expect(page.getByTestId('capture-review')).toHaveCount(0)
 expect(await disk(page)).toBeUndefined()
})
test('GPS timeout clears pending state and ignores a late callback',async({page})=>{
 await gpsMock(page,'deferred'); await begin(page); await barcode(page)
 await page.clock.install(); await page.getByTestId('review-nearest').click()
 await page.clock.fastForward(10001)
 await expect(page.getByTestId('review-nearest-status')).toContainText('Location unavailable')
 await expect(page.getByTestId('review-nearest')).toBeEnabled()
 await page.evaluate(()=>(window as any).gpsSuccess({coords:{longitude:1,latitude:2}}))
 await expect(page.getByTestId('review-nearest-use')).toHaveCount(0)
 expect(await page.evaluate(()=>(window as any).gpsReads)).toBe(1)
})
test('valid weighted legacy record hydrates unchanged and repeat loading does not duplicate',async({page})=>{
 await begin(page)
 const legacy=structuredClone(legacyFixture),p=legacy.records[0].purchase
 p.items=[{...p.items[0],quantity:0.58,unit:'kg',unitPrice:0.25,lineTotal:0.15}];p.originalAmount=0.15
 await page.evaluate(value=>localStorage.setItem('spendscape.device-purchases.v1',JSON.stringify(value)),legacy)
 for(let i=0;i<2;i++){
  await page.reload();await ready(page)
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('spendscape.device-purchases.v1')!))).toEqual(legacy)
  expect(await disk(page)).toBeUndefined()
  await page.locator('nav[aria-label="Mobile primary"]').getByRole('button',{name:'Purchases',exact:true}).click()
  await expect(page.getByTestId('purchase-legacy_main:'+nativeFixture.records[0].purchase.id)).toBeVisible()
  await expect(page.locator('[data-testid^="purchase-legacy_main:"]')).toHaveCount(1)
 }
})
