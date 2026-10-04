import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { barcodeBits } from './fixtures/barcode-symbols'

const output = 'artifacts/spendscape-scanner-b'
const wasmPath = '/vendor/zxing-wasm/3.1.3/zxing_reader.wasm'
type Probe = typeof window & { __barcodeQA: { calls: MediaStreamConstraints[]; tracks: MediaStreamTrack[]; workers: number; terminated: number; posts: number; invalids: number; stops: number; paint: (bits: string) => void; late: (() => void) | null }; __SPENDSCAPE_QA__: Record<string, unknown> }
async function mock(page: Page, bits = '', workerMode = 'real') {
  await page.addInitScript(({bits,workerMode}) => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480
    const ctx = canvas.getContext('2d')!
    const probe: Probe['__barcodeQA'] = {calls:[],tracks:[],workers:0,terminated:0,posts:0,invalids:0,stops:0,paint:()=>{},late:null}
    ;(window as Probe).__barcodeQA = probe
    let currentBits = bits
    probe.paint = (symbol) => {
      currentBits = symbol
      ctx.fillStyle='white'; ctx.fillRect(0,0,640,480)
      ctx.fillStyle='black'
      const width = symbol.length*3, left = Math.round((640-width)/2)
      for (let i=0;i<symbol.length;i++) if(symbol[i]==='1')ctx.fillRect(left+i*3,160,3,160)
    }
    probe.paint(bits)
    setInterval(()=>probe.paint(currentBits),100)
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:(constraints:MediaStreamConstraints)=>{
      probe.calls.push(constraints); const stream=canvas.captureStream(10)
      stream.getTracks().forEach(track=>{const stop=track.stop.bind(track);track.stop=()=>{probe.stops++;stop()}})
      probe.tracks.push(...stream.getTracks()); return Promise.resolve(stream)
    }}})
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      private barcode: boolean
      constructor(url: string | URL, options?: WorkerOptions) {
        const barcode = options?.name === 'spendscape-barcode'
        if(barcode && workerMode==='construction-error')throw Error('synthetic worker failure')
        super(url,options); this.barcode=barcode
        if(!barcode)return
        probe.workers++
        this.addEventListener('message',({data})=>{
          if(data.type==='result'&&data.results.some((r:{invalid:boolean})=>r.invalid))probe.invalids++
        })
      }
      override postMessage(message: unknown, transfer?: Transferable[]) {
        const msg=message as {type:string}
        if(this.barcode && msg.type==='frame')probe.posts++
        if(this.barcode && workerMode==='decode-error' && msg.type==='frame'){ queueMicrotask(()=>this.dispatchEvent(new ErrorEvent('error'))); return }
        if(this.barcode && (workerMode==='late'||(workerMode==='invalid-then-late'&&probe.invalids>0)) && msg.type==='frame') {
          const handler=this.onmessage
          probe.late=()=>handler?.call(this,new MessageEvent('message',{data:{type:'result',results:[{text:'2000000000015',format:'EAN13',invalid:false}]}}))
          return
        }
        super.postMessage(message,transfer??[])
      }
      override terminate(){ if(this.barcode)probe.terminated++; super.terminate() }
    }
  }, {bits,workerMode})
}
async function open(page: Page, width=1440, he=false) {
  await page.goto('/')
  await page.waitForFunction(()=>(window as Probe).__SPENDSCAPE_QA__?.ready)
  if(he)await page.getByRole('button',{name:'Switch to Hebrew'}).click()
  await page.getByTestId(width<760?'capture-open-mobile':'capture-open-desktop').click()
}
async function baseline(page: Page) {
  expect(await page.evaluate(()=>(window as Probe).__SPENDSCAPE_QA__)).toMatchObject({combinedPurchaseCount:42,canonicalPins:12,visiblePinFeatures:12,onlineExcluded:2,unresolvedExcluded:1,sessionPurchaseCount:0,mapInstanceCount:1,mapConstructionCount:1,analytics:{totalBaseAmountIls:6777.38}})
}
const metrics = (page: Page) => page.evaluate(()=>({calls:(window as Probe).__barcodeQA.calls,tracks:(window as Probe).__barcodeQA.tracks.map((t)=>t.readyState),workers:(window as Probe).__barcodeQA.workers,terminated:(window as Probe).__barcodeQA.terminated,posts:(window as Probe).__barcodeQA.posts,invalids:(window as Probe).__barcodeQA.invalids,stops:(window as Probe).__barcodeQA.stops}))
async function enter(page:Page,code:string,format:string){
  if(!await page.getByTestId('barcode-input').isVisible())await page.getByTestId('barcode-manual-open').click()
  await page.getByTestId('barcode-format').selectOption(format)
  await page.getByTestId('barcode-input').fill(code)
  await page.getByTestId('barcode-submit').click()
}
test.beforeAll(async()=>{await mkdir(output,{recursive:true})})

for(const [format,code,name] of [['EAN13','2000000000015','Demo oats'],['EAN8','20000011','Demo rice'],['UPCA','012345678905','Demo cocoa'],['UPCE','01234565','Demo mint gum']]) {
  test(`real worker decodes synthetic ${format}, releases media and never adds a purchase`,async({page})=>{
    await mock(page,barcodeBits(code,format)); await open(page)
    const before=await metrics(page); expect(before.calls).toHaveLength(0); expect(before.workers).toBe(0)
    const requests:string[]=[]; const writes:string[]=[]
    page.on('request',(r)=>{requests.push(r.url()); if(!['GET','HEAD'].includes(r.method()))writes.push(r.url())})
    await page.getByTestId('capture-camera-toggle').click()
    await expect(page.getByTestId('barcode-product-name')).toHaveValue(name)
    if(format!=='UPCA')await expect(page.getByTestId('barcode-original')).toHaveText(code)
    const done=await metrics(page)
    expect(done.calls).toEqual([{audio:false,video:{facingMode:{ideal:'environment'}}}])
    expect(done.workers).toBe(1); expect(done.terminated).toBe(1); expect(done.tracks).toEqual(['ended']); expect(done.posts).toBe(1)
    expect(requests.some((url)=>url.includes(wasmPath))).toBe(true)
    expect(requests.filter((url)=>/jsdelivr|unpkg|openfoodfacts|barcode.*provider/i.test(url))).toEqual([])
    expect(writes).toEqual([])
    await page.getByTestId('barcode-product-name').fill('Edited identification only')
    await baseline(page)
    await page.keyboard.press('Escape'); await expect(page.getByTestId('capture-open-desktop')).toBeFocused()
  })
}

for(const [width,height] of [[360,640],[390,844],[430,932],[1280,800],[1440,900]]){
  test(`barcode entry, review and camera at ${width}x${height}`,async({page})=>{
    const he=width===430
    await page.setViewportSize({width,height}); await page.emulateMedia({reducedMotion:'reduce'})
    await mock(page); await open(page,width,he)
    await page.screenshot({path:`${output}/idle-${width}.png`})
    await page.getByTestId('capture-camera-toggle').click()
    await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','ready')
    await expect(page.getByTestId('barcode-manual-open')).toBeInViewport({ratio:1})
    await page.screenshot({path:`${output}/ready-${width}.png`})
    await expect(page.getByTestId('capture-camera-toggle')).toBeInViewport({ratio:1})
    const guide=await page.getByTestId('barcode-target').boundingBox(), controls=await page.getByTestId('capture-camera-toggle').boundingBox()
    expect(guide!.y+guide!.height).toBeLessThan(controls!.y)
    await enter(page,'2000000000015','EAN13')
    await expect(page.getByTestId('barcode-product-name')).toHaveValue(he?'שיבולת שועל להדגמה':'Demo oats')
    await expect(page.getByTestId('barcode-result')).toBeFocused()
    await expect(page.locator('#capture-title')).toBeInViewport({ratio:1})
    await expect(page.getByTestId('barcode-reset')).toBeInViewport({ratio:1})
    await page.screenshot({path:`${output}/candidate-${width}.png`})
    if(he)await expect(page.locator('html')).toHaveAttribute('dir','rtl')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await enter(page,'2999999999991','EAN13')
    await expect(page.getByTestId('barcode-status')).toHaveText(he?'ברקוד לא מוכר':'Unknown barcode')
    await expect(page.getByTestId('barcode-product-name')).toHaveValue('')
    await page.screenshot({path:`${output}/unknown-${width}.png`})
    await enter(page,'2000000000014','EAN13')
    await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','invalid')
    await expect(page.getByTestId('barcode-result')).toBeHidden()
    await expect(page.getByTestId('barcode-input')).toBeFocused()
    await expect(page.getByTestId('barcode-input')).toHaveAttribute('aria-invalid','true')
    await page.screenshot({path:`${output}/invalid-${width}.png`})
    await page.getByTestId('barcode-demo').click()
    await expect(page.getByTestId('barcode-product-name')).toHaveValue(he?'שיבולת שועל להדגמה':'Demo oats')
    await page.getByTestId('barcode-reset').click(); await expect(page.getByTestId('barcode-result')).toBeHidden()
    await baseline(page)
  })
}

test('leading zeros and UPC/EAN collision are retained through manual correction',async({page})=>{
  await mock(page); await open(page)
  await enter(page,'012345678905','UPCA'); await expect(page.getByTestId('barcode-original')).toHaveText('012345678905')
  // Wait for successful manual review to close its form before opening it again.
  await expect(page.getByTestId('barcode-input')).toBeHidden()
  const normalized=await page.getByTestId('barcode-normalized').textContent()
  await enter(page,'0012345678905','EAN13'); await expect(page.getByTestId('barcode-normalized')).toHaveText(normalized!)
  await expect(page.getByTestId('barcode-original')).toHaveText('0012345678905')
  expect((await metrics(page)).workers).toBe(0); expect((await metrics(page)).calls).toHaveLength(0); await baseline(page)
})

for(const mode of ['wasm-error','wasm-corrupt','construction-error','decode-error']){
  test(`${mode} preserves manual entry and requires explicit retry`,async({page})=>{
    await mock(page,'',mode)
    if(mode.startsWith('wasm'))await page.route(`**${wasmPath}`,route=>route.fulfill({status:mode==='wasm-error'?503:200,body:'synthetic invalid wasm'}))
    await open(page); await page.getByTestId('capture-camera-toggle').click()
    await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state',mode==='decode-error'?'decode-error':'load-error')
    await page.screenshot({path:`${output}/${mode}.png`})
    await enter(page,'2000000000015','EAN13'); await expect(page.getByTestId('barcode-product-name')).toHaveValue('Demo oats')
    if(mode.startsWith('wasm')){
      await page.unroute(`**${wasmPath}`)
      await page.getByTestId('barcode-retry').click()
      await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','ready')
      await page.getByTestId('capture-camera-toggle').click()
    }
    await baseline(page)
  })
}

for(const action of ['close','escape','back','background','pagehide','stop','sources','manual','reset']){
  test(`pending decode invalidated on ${action}`,async({page})=>{
    await mock(page,'','late'); await open(page); await page.getByTestId('capture-camera-toggle').click()
    await expect.poll(async()=>(await metrics(page)).posts).toBe(1)
    if(action==='close')await page.getByTestId('capture-dialog').getByRole('button',{name:'Close Capture',exact:true}).click()
    if(action==='escape')await page.keyboard.press('Escape')
    if(action==='back')await page.goBack()
    if(action==='stop')await page.getByTestId('capture-camera-toggle').click()
    if(action==='sources')await page.getByTestId('capture-sources-open').click()
    if(action==='manual')await page.getByTestId('barcode-manual-open').click()
    if(action==='reset'){await page.getByTestId('barcode-demo').click();await page.getByTestId('barcode-reset').click()}
    if(action==='background')await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))})
    if(action==='pagehide')await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')))
    await page.evaluate(()=>(window as Probe).__barcodeQA.late?.())
    await expect(page.getByTestId('barcode-result')).toBeHidden()
    expect((await metrics(page)).terminated).toBe(1); expect((await metrics(page)).tracks).toEqual(['ended'])
    await baseline(page)
  })
}

test('loaded reader decodes offline, deduplicates repeated frames and releases every open/close cycle',async({page,context})=>{
  await mock(page); await open(page); await page.getByTestId('capture-camera-toggle').click()
  await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','ready')
  await context.setOffline(true)
  await page.evaluate(bits=>(window as Probe).__barcodeQA.paint(bits),barcodeBits('2000000000015','EAN13'))
  await expect(page.getByTestId('barcode-product-name')).toHaveValue('Demo oats')
  const first=await metrics(page); await page.waitForTimeout(1000)
  expect((await metrics(page)).posts).toBe(first.posts)
  await context.setOffline(false)
  for(let i=0;i<3;i++){
    await page.keyboard.press('Escape'); await page.getByTestId('capture-open-desktop').click()
    await expect(page.getByTestId('barcode-result')).toBeHidden()
    await page.getByTestId('capture-camera-toggle').click()
    await expect(page.getByTestId('barcode-product-name')).toHaveValue('Demo oats')
  }
  const done=await metrics(page); expect(done.calls).toHaveLength(4); expect(done.workers).toBe(4); expect(done.terminated).toBe(4); expect(done.tracks.every(s=>s==='ended')).toBe(true)
  await baseline(page)
})

test('no barcode is bounded and keyboard manual recovery works',async({page})=>{
  await mock(page); await open(page); await page.getByTestId('capture-camera-toggle').click()
  await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','empty',{timeout:20_000})
  expect((await metrics(page)).terminated).toBe(1)
  await page.getByTestId('barcode-manual-open').focus(); await page.keyboard.press('Enter')
  await expect(page.getByTestId('barcode-input')).toBeFocused()
  await page.keyboard.type('2000000000015'); await page.keyboard.press('Enter')
  await expect(page.getByTestId('barcode-result')).toBeFocused(); await baseline(page)
})

test('camera unknown stays unknown and repeated invalid frames exhaust the existing bound',async({page})=>{
  await mock(page,barcodeBits('2999999999991','EAN13')); await open(page)
  await page.getByTestId('capture-camera-toggle').click()
  await expect(page.getByTestId('barcode-status')).toHaveText('Unknown barcode')
  await expect(page.getByTestId('barcode-original')).toHaveText('2999999999991')
  await expect(page.getByTestId('barcode-product-name')).toHaveValue('')
  await page.evaluate(bits=>(window as Probe).__barcodeQA.paint(bits),barcodeBits('2000000000014','EAN13'))
  await page.getByTestId('barcode-retry').click()
  await expect.poll(async()=>(await metrics(page)).invalids).toBeGreaterThanOrEqual(2)
  await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','ready')
  await expect(page.getByTestId('capture-scanner')).toHaveAttribute('data-camera-state','live')
  await expect(page.getByTestId('barcode-result')).toBeHidden()
  await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','empty',{timeout:20_000})
  const done=await metrics(page)
  expect(done.invalids).toBe(20); expect(done.posts).toBe(21)
  expect(done.workers).toBe(2); expect(done.terminated).toBe(2); expect(done.stops).toBe(2)
  await page.waitForTimeout(600); expect((await metrics(page)).posts).toBe(done.posts)
  await expect(page.getByTestId('barcode-result')).toBeHidden(); await baseline(page)
})

test('privacy: no exports, object URLs, storage, logs or outgoing payload from scanning',async({page})=>{
  await mock(page,barcodeBits('2000000000014','EAN13')); await open(page)
  const requests:{url:string;method:string;body:boolean}[]=[]
  const logs:string[]=[]
  page.on('request',(r)=>requests.push({url:r.url(),method:r.method(),body:r.postData()!==null}))
  page.on('console',(m)=>logs.push(m.text()))
  page.on('pageerror',(e)=>logs.push(e.message))
  const storage=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))
  await page.evaluate(()=>{
    const forbidden=()=>{throw Error('Scanner exported or persisted pixels')}
    HTMLCanvasElement.prototype.toDataURL=forbidden
    HTMLCanvasElement.prototype.toBlob=forbidden
    URL.createObjectURL=forbidden
    Storage.prototype.setItem=forbidden
    indexedDB.open=forbidden
    caches.open=forbidden
    navigator.sendBeacon=forbidden
  })
  await page.getByTestId('capture-camera-toggle').click()
  await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','ready')
  const ready=await page.getByTestId('barcode-status').textContent()
  await expect.poll(async()=>(await metrics(page)).invalids).toBeGreaterThanOrEqual(2)
  await expect(page.getByTestId('barcode-status')).toHaveText(ready!)
  await expect(page.getByTestId('barcode-result')).toBeHidden()
  expect(await metrics(page)).toMatchObject({workers:1,terminated:0,stops:0,tracks:['live']})
  await page.evaluate(bits=>(window as Probe).__barcodeQA.paint(bits),barcodeBits('2000000000015','EAN13'))
  await expect(page.getByTestId('barcode-product-name')).toHaveValue('Demo oats')
  expect(await metrics(page)).toMatchObject({workers:1,terminated:1,stops:1,tracks:['ended']})
  expect((await metrics(page)).calls).toEqual([{audio:false,video:{facingMode:{ideal:'environment'}}}])
  await page.getByTestId('barcode-product-name').fill('Temporary corrected name')
  await page.getByTestId('barcode-reset').click()
  await expect(page.getByTestId('capture-camera-toggle')).toBeFocused()
  expect(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}))).toEqual(storage)
  expect(requests.filter((r)=>r.body||!['GET','HEAD'].includes(r.method))).toEqual([])
  expect(requests.filter((r)=>!r.url.startsWith('http://127.0.0.1:3000/')&&!r.url.startsWith('https://tiles.openfreemap.org/'))).toEqual([])
  expect(logs.filter((s)=>/200000000001[45]|Temporary corrected name|exported or persisted|ImageData|data:image/i.test(s))).toEqual([])
  await baseline(page)
})

test('cancelling after a real invalid frame rejects a late valid result',async({page})=>{
  await mock(page,barcodeBits('2000000000014','EAN13'),'invalid-then-late'); await open(page)
  await page.getByTestId('capture-camera-toggle').click()
  await expect.poll(async()=>(await metrics(page)).invalids).toBe(1)
  await page.waitForFunction(()=>Boolean((window as Probe).__barcodeQA.late))
  await page.getByTestId('capture-camera-toggle').click()
  await page.evaluate(()=>(window as Probe).__barcodeQA.late?.())
  await expect(page.getByTestId('barcode-result')).toBeHidden()
  await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','cancelled')
  expect(await metrics(page)).toMatchObject({workers:1,terminated:1,stops:1,posts:2,tracks:['ended']})
  await baseline(page)
})

test('closing while WASM is loading cannot reactivate or publish a result',async({page})=>{
  await mock(page,barcodeBits('2000000000015','EAN13'))
  let release:()=>void=()=>{}
  const gate=new Promise<void>((resolve)=>{release=resolve})
  await page.route(`**${wasmPath}`,async route=>{await gate;await route.continue().catch(()=>{})})
  await open(page); await page.getByTestId('capture-camera-toggle').click()
  await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','loading')
  await page.getByTestId('capture-dialog').getByRole('button',{name:'Close Capture',exact:true}).click()
  release()
  expect((await metrics(page)).terminated).toBe(1); expect((await metrics(page)).tracks).toEqual(['ended'])
  await page.getByTestId('capture-open-desktop').click()
  await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','idle')
  await expect(page.getByTestId('barcode-result')).toBeHidden(); await baseline(page)
})

test('existing demo-session reset disposes a pending scanner without changing the canonical baseline',async({page})=>{
  await mock(page,'','late'); await open(page)
  await page.getByTestId('capture-scan').click()
  await page.getByTestId('capture-confirm').click()
  await page.getByTestId('capture-dialog').getByRole('button',{name:'Done',exact:true}).click()
  await page.getByTestId('capture-open-desktop').click()
  await page.getByTestId('capture-camera-toggle').click()
  await expect.poll(async()=>(await metrics(page)).posts).toBe(1)
  await page.getByRole('button',{name:'Reset demo additions',exact:true}).click()
  await page.evaluate(()=>(window as Probe).__barcodeQA.late?.())
  await expect(page.getByTestId('capture-scanner')).toHaveAttribute('data-camera-state','idle')
  await expect(page.getByTestId('barcode-result')).toBeHidden()
  expect((await metrics(page)).terminated).toBe(1); expect((await metrics(page)).tracks).toEqual(['ended'])
  await baseline(page)
})

for (const interruption of ['mute','ended','video-error']) {
  test(`camera ${interruption} cancels reader status and releases its worker`,async({page})=>{
    await mock(page); await open(page); await page.getByTestId('capture-camera-toggle').click()
    await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','ready')
    await page.evaluate((event)=>{
      if(event==='video-error')document.querySelector('video')!.dispatchEvent(new Event('error'))
      else(window as Probe).__barcodeQA.tracks[0].dispatchEvent(new Event(event))
    },interruption)
    await expect(page.getByTestId('capture-barcode')).toHaveAttribute('data-decoder-state','cancelled')
    expect((await metrics(page)).terminated).toBe(1); expect((await metrics(page)).tracks).toEqual(['ended'])
    await baseline(page)
  })
}
