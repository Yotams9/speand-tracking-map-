import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { barcodeBits } from './fixtures/barcode-symbols'
const out = 'artifacts/spendscape-scanner-e'
type Qa = { ready: boolean; sessionPurchaseCount: number; combinedPurchaseCount: number; canonicalPins: number; mapInstanceCount: number; mapConstructionCount: number; selectedPurchaseId: string | null; analytics: { totalBaseAmountIls: number; onlineCount: number; unresolvedCount: number } }
const qa = (page: Page) => page.evaluate(() => (window as typeof window & { __SPENDSCAPE_QA__: Qa }).__SPENDSCAPE_QA__)
async function open(page: Page, width = 1280, he = false) {
  await page.goto('/'); await page.waitForFunction(() => (window as typeof window & { __SPENDSCAPE_QA__?: Qa }).__SPENDSCAPE_QA__?.ready)
  if (he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await page.getByTestId(width < 761 ? 'capture-open-mobile' : 'capture-open-desktop').click()
}
async function details(page: Page, channel = 'physical', currency = 'ILS', item = true) {
  await page.getByTestId('review-channel').selectOption(channel)
  if (channel === 'physical') await page.getByTestId('review-placeId').selectOption('place_shuk_bograshov')
  else await page.getByTestId('review-merchantId').selectOption(channel === 'unknown' ? 'merchant_unresolved' : 'merchant_serein')
  await page.getByTestId('review-date').fill('2026-09-12T14:35')
  await page.getByTestId('review-currency').selectOption(currency)
  await page.getByTestId('review-payment').selectOption('cash')
  await page.getByTestId('review-category').selectOption('retail')
  await page.getByTestId('review-amount').fill(currency === 'JPY' ? '100' : '25.00')
  if (item) {
    await page.getByTestId('review-quantity-0').fill('2')
    await page.getByTestId('review-price-0').fill(currency === 'JPY' ? '50' : '12.50')
  }
}
test.beforeAll(async () => { await mkdir(out, { recursive: true }) })
for (const [width, height, he] of [[360,640,false], [390,844,false], [430,932,true], [1280,800,false]] as const) {
  test(`demo candidate reviewed addition and Undo ${width} ${he ? 'he' : 'en'}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await open(page, width, he)
    const errors: number[] = []; page.on('pageerror', () => errors.push(1))
    await page.getByTestId('barcode-demo').click()
    await expect(page.getByTestId('barcode-demo')).toBeDisabled()
    await expect(page.getByTestId('barcode-demo-loaded')).toBeVisible()
    expect((await qa(page)).combinedPurchaseCount).toBe(42)
    await page.getByTestId('barcode-product-name').fill(he ? 'מוצר בדיקה סינתטי' : 'Synthetic review item')
    await page.getByTestId('barcode-review-purchase').click()
    await expect(page.getByTestId('review-name-0')).toHaveValue(he ? 'מוצר בדיקה סינתטי' : 'Synthetic review item')
    await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('review-channel')).toBeFocused()
    expect((await qa(page)).combinedPurchaseCount).toBe(42)
    await details(page)
    await page.getByTestId('review-amount').fill('1.00')
    await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('review-amount')).toHaveAttribute('aria-invalid', 'true')
    await page.getByTestId('review-amount').fill('25.00')
    await page.getByTestId('capture-review').locator('[class*=reviewScroll]').evaluate(e => e.scrollTop = 0)
    await page.screenshot({ animations: 'disabled', path: `${out}/review-${width}-${he ? 'he' : 'en'}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByTestId('capture-review').locator('[class*=reviewScroll]').evaluate(e => e.scrollTop = e.scrollHeight)
    await expect(page.getByTestId('capture-confirm')).toBeInViewport({ ratio: 1 })
    await page.screenshot({ animations: 'disabled', path: `${out}/summary-${width}-${he ? 'he' : 'en'}.png` })
    await page.getByTestId('capture-confirm').evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
    await expect(page.getByTestId('capture-success')).toBeVisible()
    await page.screenshot({ animations: 'disabled', path: `${out}/success-${width}-${he ? 'he' : 'en'}.png` })
    await page.getByTestId('capture-done').click({ trial: true })
    await page.screenshot({ animations: 'disabled', path: `${out}/success-actions-${width}-${he ? 'he' : 'en'}.png` })
    if (width < 761) expect((await page.getByTestId('capture-undo').boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect.poll(async () => (await qa(page)).sessionPurchaseCount).toBe(1)
    expect(await qa(page)).toMatchObject({ combinedPurchaseCount: 43, canonicalPins: 12, mapInstanceCount: 1, mapConstructionCount: 1, analytics: { totalBaseAmountIls: 6802.38 } })
    if (width === 360) {
      await page.getByTestId('capture-done').click()
      await page.getByTestId('capture-open-mobile').click()
      await page.getByTestId('barcode-demo').click()
      await page.getByTestId('barcode-reset').click({ trial: true })
      await page.screenshot({ animations: 'disabled', path: `${out}/candidate-after-addition-360.png` })
    }
    await page.getByTestId('capture-undo').click()
    await expect.poll(async () => (await qa(page)).combinedPurchaseCount).toBe(42)
    expect((await qa(page)).analytics.totalBaseAmountIls).toBe(6777.38)
    await page.goBack(); expect((await qa(page)).sessionPurchaseCount).toBe(0)
    expect(errors).toEqual([])
  })
}
test('manual unknown barcode requires name; foreign user amount and provenance survive detail, Undo and reload', async ({ page }) => {
  await open(page); await page.getByTestId('barcode-manual-open').click()
  await page.getByTestId('barcode-input').fill('4006381333931'); await page.getByTestId('barcode-submit').click()
  await expect(page.getByTestId('barcode-product-name')).toHaveValue('')
  await page.getByTestId('barcode-product-name').fill('Synthetic unknown product')
  await page.getByTestId('barcode-review-purchase').click(); await details(page, 'online', 'USD')
  await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('review-baseAmount')).toBeFocused()
  await page.getByTestId('review-baseAmount').fill('87.43'); await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  expect(await qa(page)).toMatchObject({ combinedPurchaseCount: 43, canonicalPins: 12, analytics: { totalBaseAmountIls: 6864.81, onlineCount: 3 } })
  await page.getByTestId('capture-view-purchase').click()
  await expect(page.getByTestId('purchase-detail')).toContainText('Reported by you')
  await expect(page.getByTestId('purchase-detail')).toContainText('not verified FX')
  await expect(page.getByTestId('purchase-detail')).toContainText('ILS amount reported by you')
  await expect(page.getByTestId('purchase-detail')).not.toContainText('Illustrative ILS conversion')
  await page.screenshot({ animations: 'disabled', path: `${out}/reported-purchase-undo.png` })
  await page.getByTestId('session-undo').click(); await expect.poll(async () => (await qa(page)).combinedPurchaseCount).toBe(42)
  await page.reload(); await expect.poll(async () => (await qa(page))?.combinedPurchaseCount).toBe(42)
})
test('manual cash unresolved saves only after review and repeated identical draft requires explicit separate purchase', async ({ page }) => {
  await open(page)
  for (let n = 0; n < 2; n++) {
    if (n) await page.getByTestId('capture-open-desktop').click()
    await page.getByTestId('capture-camera-manual').click(); await details(page, 'unknown', 'ILS', false)
    await page.getByTestId('manual-review').click(); await expect(page.getByTestId('capture-review')).toBeVisible()
    expect((await qa(page)).sessionPurchaseCount).toBe(n)
    await page.getByTestId('capture-confirm').click()
    if (n) { await expect(page.getByTestId('review-save-separate')).toBeVisible(); expect((await qa(page)).sessionPurchaseCount).toBe(1); await page.getByTestId('review-save-separate').click() }
    await expect(page.getByTestId('capture-success')).toBeVisible(); await page.keyboard.press('Escape')
  }
  expect(await qa(page)).toMatchObject({ combinedPurchaseCount: 44, canonicalPins: 12, analytics: { totalBaseAmountIls: 6827.38, unresolvedCount: 3 } })
  await page.getByTestId('session-undo').click(); await expect.poll(async () => (await qa(page)).sessionPurchaseCount).toBe(1)
  await expect(page.getByTestId('session-undo')).toHaveCount(0)
})
test('synthetic receipt review edits preserve arithmetic; cancellation and reload leave no additions', async ({ page }) => {
  await open(page); await page.getByTestId('capture-scan').click(); await expect(page.getByTestId('capture-review')).toBeVisible()
  await page.getByTestId('review-quantity-0').fill('2'); await page.getByTestId('capture-confirm').click()
  expect((await qa(page)).sessionPurchaseCount).toBe(0)
  await page.getByTestId('review-amount').fill('105.40'); await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  expect((await qa(page)).analytics.totalBaseAmountIls).toBe(6882.78)
  await page.keyboard.press('Escape'); await page.getByTestId('capture-open-desktop').click(); await page.getByTestId('capture-camera-manual').click()
  await details(page, 'online', 'JPY', false); await page.keyboard.press('Escape')
  expect((await qa(page)).sessionPurchaseCount).toBe(1)
  await page.reload(); await expect.poll(async () => (await qa(page))?.sessionPurchaseCount).toBe(0)
})
test('Undo countdown expires after eight seconds while preserving the session addition', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, 390)
  await page.getByTestId('capture-camera-manual').click()
  await details(page, 'unknown', 'ILS', false)
  await page.getByTestId('manual-review').click()
  await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  const undo = page.getByTestId('capture-undo')
  await expect(undo).toBeVisible()
  await expect(undo).toHaveAccessibleName(/Undo last addition, [1-8] seconds remaining/)
  await expect.poll(async () => (await qa(page)).sessionPurchaseCount).toBe(1)
  await expect(undo).toHaveCount(0, { timeout: 9_500 })
  expect(await qa(page)).toMatchObject({ sessionPurchaseCount: 1, combinedPurchaseCount: 43, mapInstanceCount: 1, mapConstructionCount: 1 })
  await page.getByTestId('capture-done').click()
  await expect(page.getByTestId('session-undo')).toHaveCount(0)
})
test('real pinned barcode reader from synthetic camera hands off once; no OCR, outgoing payload, storage or image retention', async ({ page, context }) => {
  const writes: number[] = [], ocr: number[] = [], errors: number[] = []
  page.on('request', request => { if (!['GET','HEAD'].includes(request.method())) writes.push(1); if (/tesseract|traineddata|scanner-d1/.test(request.url())) ocr.push(1) })
  page.on('pageerror', () => errors.push(1))
  await open(page)
  await page.evaluate(bits => {
    const probe = { calls: 0, stopped: 0, workers: 0, terminated: 0, storage: 0, exports: 0 }
    Object.assign(window, { scannerEProbe: probe })
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480
    const paint = () => { const ctx = canvas.getContext('2d')!; ctx.fillStyle='white';ctx.fillRect(0,0,640,480);ctx.fillStyle='black';const left=Math.round((640-bits.length*3)/2);[...bits].forEach((bit,i)=>{if(bit==='1')ctx.fillRect(left+i*3,160,3,160)}) }
    paint(); setInterval(paint,100)
    Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:()=>{probe.calls++;const stream=canvas.captureStream(10);stream.getTracks().forEach(t=>{const stop=t.stop.bind(t);t.stop=()=>{probe.stopped++;stop()}});return Promise.resolve(stream)}}})
    const Native=Worker; window.Worker=class extends Native { barcode: boolean;constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.barcode=options?.name==='spendscape-barcode';if(this.barcode)probe.workers++}terminate(){if(this.barcode)probe.terminated++;super.terminate()} }
    Storage.prototype.setItem=()=>{probe.storage++;throw Error('storage-forbidden')}
    HTMLCanvasElement.prototype.toDataURL=()=>{probe.exports++;throw Error('export-forbidden')}
    HTMLCanvasElement.prototype.toBlob=()=>{probe.exports++;throw Error('export-forbidden')}
  }, barcodeBits('2000000000015','EAN13'))
  await page.getByTestId('capture-camera-toggle').click(); await expect(page.getByTestId('barcode-product-name')).toHaveValue('Demo oats')
  expect((await qa(page)).sessionPurchaseCount).toBe(0)
  await page.getByTestId('barcode-review-purchase').click(); await details(page); await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as {scannerEProbe: unknown}).scannerEProbe)).toEqual({calls:1,stopped:1,workers:1,terminated:1,storage:0,exports:0})
  expect(writes).toEqual([]); expect(ocr).toEqual([]);expect(errors).toEqual([])
  expect(await context.storageState()).toEqual({cookies:[],origins:[]})
  expect(await qa(page)).toMatchObject({ combinedPurchaseCount:43, mapInstanceCount:1,mapConstructionCount:1 })
})

for (const he of [false, true]) {
  test(`demo USD requires user-reported ILS and purchase search remains ephemeral ${he ? 'he' : 'en'}`, async ({ page }) => {
    await open(page, 1280, he)
    const marker = 'Synthetic private review marker'
    const leaks: number[] = []
    page.on('request', r => { if (decodeURIComponent(r.url()).includes(marker) || r.postData()?.includes(marker)) leaks.push(1) })
    page.on('console', m => { if (m.text().includes(marker)) leaks.push(1) })
    await page.getByTestId('barcode-demo').click()
    await page.getByTestId('barcode-product-name').fill(marker)
    expect((await qa(page)).combinedPurchaseCount).toBe(42)
    await page.getByTestId('barcode-review-purchase').click()
    await expect(page.getByTestId('capture-review')).toHaveAttribute('data-identification-method', 'demo')
    await details(page, 'online', 'USD')
    await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('review-baseAmount')).toBeFocused()
    expect((await qa(page)).combinedPurchaseCount).toBe(42)
    await page.getByTestId('review-baseAmount').fill('87.43')
    await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('capture-success')).toBeVisible()
    expect((await qa(page)).analytics.totalBaseAmountIls).toBe(6864.81)
    await page.getByTestId('capture-view-purchase').click()
    await expect(page.getByTestId('purchase-detail')).toContainText(he ? 'דיווח שלך' : 'Reported by you')
    await expect(page.getByTestId('purchase-detail')).not.toContainText(he ? 'שער הדגמה' : 'Fixed synthetic demo rate')
    await page.getByTestId('purchase-detail').getByRole('button').first().click()
    await page.getByTestId('history-search').fill(marker)
    await page.getByTestId('history-filters').click()
    await page.getByTestId('currency-filter').selectOption('USD')
    await page.keyboard.press('Escape')
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('spendscape.phase1d1.experience-state')!).query.currency)).toBe('USD')
    expect(await page.evaluate(marker => Object.values(sessionStorage).some(v => v.includes(marker)), marker)).toBe(false)
    await page.getByTestId('session-undo').click()
    expect((await qa(page)).combinedPurchaseCount).toBe(42)
    expect(await page.evaluate(marker => Object.values(sessionStorage).some(v => v.includes(marker)), marker)).toBe(false)
    // A legacy persisted search is discarded rather than resurrected on reload.
    await page.evaluate(marker => {
      const key = 'spendscape.phase1d1.experience-state'
      const old = JSON.parse(sessionStorage.getItem(key)!)
      old.query.search = marker; sessionStorage.setItem(key, JSON.stringify(old))
    }, marker)
    await page.reload(); await page.waitForFunction(() => (window as typeof window & { __SPENDSCAPE_QA__?: Qa }).__SPENDSCAPE_QA__?.ready)
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('spendscape.phase1d1.experience-state')!).query)).toMatchObject({ search: '', currency: 'USD' })
    expect((await qa(page)).combinedPurchaseCount).toBe(42)
    expect(await page.evaluate(marker => Object.values(sessionStorage).some(v => v.includes(marker)), marker)).toBe(false)
    expect(decodeURIComponent(page.url())).not.toContain(marker)
    expect(leaks).toEqual([])
    expect((await qa(page)).mapConstructionCount).toBe(1)
  })
  for (const previous of ['demo', 'manual'] as const) {
    test(`${previous} clear then real decoder resets acquisition and requires reported FX ${he ? 'he' : 'en'}`, async ({ page }) => {
      await open(page, 1280, he)
      if (previous === 'demo') await page.getByTestId('barcode-demo').click()
      else {
        await page.getByTestId('barcode-manual-open').click()
        await page.getByTestId('barcode-input').fill('2000000000015')
        await page.getByTestId('barcode-submit').click()
      }
      await page.getByTestId('barcode-reset').click()
      await page.evaluate(bits => {
        const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480
        const paint = () => { const c = canvas.getContext('2d')!; c.fillStyle = 'white'; c.fillRect(0,0,640,480); c.fillStyle = 'black'; const left = Math.round((640-bits.length*3)/2); [...bits].forEach((b,i) => { if (b === '1') c.fillRect(left+i*3,160,3,160) }) }
        paint(); const timer = setInterval(paint,100)
        Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>{
          const stream=canvas.captureStream(10); stream.getTracks().forEach(t=>{const stop=t.stop.bind(t);t.stop=()=>{clearInterval(timer);stop()}});return Promise.resolve(stream)
        }}})
      }, barcodeBits('2999999999991','EAN13'))
      await page.getByTestId('capture-camera-toggle').click()
      await expect(page.getByTestId('barcode-original')).toHaveText('2999999999991')
      await page.getByTestId('barcode-product-name').fill('Synthetic decoded item')
      expect((await qa(page)).sessionPurchaseCount).toBe(0)
      await page.getByTestId('barcode-review-purchase').click()
      await expect(page.getByTestId('capture-review')).toHaveAttribute('data-identification-method', 'camera')
      await details(page, 'online', 'USD')
      await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('review-baseAmount')).toBeFocused()
      expect((await qa(page)).sessionPurchaseCount).toBe(0)
      await page.getByTestId('review-baseAmount').fill('87.43'); await page.getByTestId('capture-confirm').click()
      await expect(page.getByTestId('capture-success')).toBeVisible()
      expect(await qa(page)).toMatchObject({combinedPurchaseCount:43,canonicalPins:12,mapConstructionCount:1,analytics:{totalBaseAmountIls:6864.81}})
    })
  }
}

test('actual insecure HTTP origin supports manual saves, cancellation and repeated Capture mounts', async ({ context, page }) => {
  await context.route('http://spendscape-review.invalid/**', async route => {
    const requested = new URL(route.request().url())
    const response = await route.fetch({ url: `http://127.0.0.1:3000${requested.pathname}${requested.search}` })
    await route.fulfill({ response })
  })
  const errors: number[] = []; page.on('pageerror', () => errors.push(1))
  await page.goto('http://spendscape-review.invalid/')
  await page.waitForFunction(() => (window as typeof window & { __SPENDSCAPE_QA__?: Qa }).__SPENDSCAPE_QA__?.ready)
  expect(await page.evaluate(() => ({secure:isSecureContext,uuid:typeof crypto.randomUUID}))).toEqual({secure:false,uuid:'undefined'})
  for (let i=0;i<2;i++) {
    await page.getByTestId('capture-open-desktop').click()
    await page.getByTestId('capture-camera-manual').click()
    await details(page, 'unknown', 'ILS', false)
    await page.getByTestId('review-amount').fill(String(25+i))
    await page.getByTestId('manual-review').click()
    await page.getByTestId('capture-confirm').evaluate((button: HTMLButtonElement) => {button.click();button.click()})
    await expect(page.getByTestId('capture-success')).toBeVisible()
    expect((await qa(page)).sessionPurchaseCount).toBe(i+1)
    await page.getByTestId('capture-done').click()
  }
  await page.getByTestId('capture-open-desktop').click()
  await page.getByTestId('barcode-demo').click(); await page.getByTestId('barcode-review-purchase').click()
  await expect(page.getByTestId('capture-review')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByTestId('session-undo').click()
  expect((await qa(page)).sessionPurchaseCount).toBe(1)
  expect((await qa(page)).mapConstructionCount).toBe(1)
  expect(errors).toEqual([])
})

for (const he of [false, true]) {
  test(`Replay history keeps reviewed search in memory through Back Forward and reload ${he ? 'he' : 'en'}`, async ({ page }) => {
    const marker = 'Synthetic reviewed history sentinel'
    await page.addInitScript(marker => {
      const probe = { writes: [] as boolean[], traversals: [] as boolean[] }
      ;(window as any).__historyPrivacyProbe = probe
      for (const method of ['pushState', 'replaceState'] as const) {
        const original = history[method].bind(history)
        history[method] = (...args: Parameters<History[typeof method]>) => {
          probe.writes.push(JSON.stringify(args[0]).includes(marker))
          return original(...args)
        }
      }
      addEventListener('popstate', event => probe.traversals.push(JSON.stringify(event.state).includes(marker)))
    }, marker)
    await open(page, 1280, he)
    await page.getByTestId('barcode-demo').click()
    await page.getByTestId('barcode-product-name').fill(marker)
    await page.getByTestId('barcode-review-purchase').click()
    await details(page, 'online')
    await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('capture-success')).toBeVisible()
    await page.getByTestId('capture-view-purchase').click()
    await page.getByTestId('purchase-detail').getByRole('button').first().click()
    await page.getByTestId('history-search').fill(marker)
    await page.getByTestId('history-timeline').click()
    const before = await page.evaluate(() => {
      const q = (window as any).__SPENDSCAPE_QA__
      return { query: q.query, surface: q.surface, mode: q.mode, selectedPurchaseId: q.selectedPurchaseId, selectedPlaceId: q.selectedPlaceId }
    })
    await page.getByTestId('replay-open').click()
    await expect(page.getByTestId('replay-player')).toBeVisible()
    const key = await page.evaluate(() => history.state.replay)
    expect(Object.keys(key)).toEqual(['id'])
    expect(typeof key.id).toBe('string')
    await page.goBack()
    await expect(page.getByTestId('replay-player')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__SPENDSCAPE_QA__)).toMatchObject(before)
    await page.goForward()
    await expect(page.getByTestId('replay-player')).toBeVisible()
    expect(await page.evaluate(() => (window as any).__SPENDSCAPE_QA__.query.search)).toBe(marker)
    await page.goBack()
    await expect(page.getByTestId('replay-player')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__historyPrivacyProbe.writes.some(Boolean))).toBe(false)
    await page.reload()
    await page.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready)
    expect(await qa(page)).toMatchObject({ combinedPurchaseCount: 42, canonicalPins: 12, analytics: { totalBaseAmountIls: 6777.38 } })
    await page.goForward()
    await expect.poll(() => page.evaluate(() => (window as any).__historyPrivacyProbe.traversals.length)).toBeGreaterThan(0)
    await expect(page.getByTestId('replay-player')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__SPENDSCAPE_QA__.query.search)).toBe('')
    expect(await page.evaluate(marker => ({
      history: JSON.stringify(history.state).includes(marker),
      storage: Object.values(sessionStorage).some(v => v.includes(marker)),
      writes: (window as any).__historyPrivacyProbe.writes.some(Boolean),
      traversals: (window as any).__historyPrivacyProbe.traversals.some(Boolean),
    }), marker)).toEqual({ history: false, storage: false, writes: false, traversals: false })
    expect((await qa(page)).mapConstructionCount).toBe(1)
    expect(decodeURIComponent(page.url())).not.toContain(marker)
  })

  test(`legacy Replay history discards embedded search on reload and traversal ${he ? 'he' : 'en'}`, async ({ page }) => {
    await page.goto('/'); await page.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready)
    if (he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
    const marker = 'Synthetic legacy private search'
    const seed = async () => page.evaluate(marker => {
      const navigation = { marker: 'spendscape-1d1', surface: 'purchases', selectedPlaceId: null, selectedPurchaseId: null }
      const old = { ...navigation, surface: 'globe', replay: { id: 1, entry: { navigation, query: { search: marker } }, purchaseIds: [] } }
      history.pushState({ ...history.state, ...old }, '', '#replay')
    }, marker)
    await seed()
    await page.reload(); await page.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready)
    await expect(page.getByTestId('replay-player')).toHaveCount(0)
    expect(await page.evaluate(marker => JSON.stringify(history.state).includes(marker), marker)).toBe(false)
    expect(await page.evaluate(() => (window as any).__SPENDSCAPE_QA__.query.search)).toBe('')
    await seed(); await page.goBack(); await page.goForward()
    await expect.poll(() => page.evaluate(marker => JSON.stringify(history.state).includes(marker), marker)).toBe(false)
    await expect(page.getByTestId('replay-player')).toHaveCount(0)
    expect(await page.evaluate(() => (window as any).__SPENDSCAPE_QA__.query.search)).toBe('')
    expect(await qa(page)).toMatchObject({ combinedPurchaseCount: 42, canonicalPins: 12, mapConstructionCount: 1 })
  })
}

for (const [width, height, he, reducedMotion] of [[360, 640, false, 'no-preference'], [360, 640, true, 'reduce'], [390, 844, false, 'no-preference'], [1280, 844, true, 'reduce']] as const) {
  test(`shared Undo countdown survives navigation ${width} ${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ reducedMotion })
    await open(page, width, he)
    await page.getByTestId('capture-camera-manual').click()
    await details(page, 'unknown', 'ILS', false)
    await page.getByTestId('manual-review').click()
    await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') })
    await page.clock.pauseAt(new Date('2026-09-12T12:00:10Z'))
    await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('capture-success')).toBeVisible()
    await page.clock.runFor(4000)
    await expect(page.getByTestId('capture-undo')).toContainText(he ? '4 שנ׳' : '4s')
    await page.getByTestId('capture-done').click()
    const external = page.getByTestId('session-undo')
    await expect(external).toBeInViewport({ ratio: 1 })
    const status = page.locator('[class*=liveStatus]')
    await expect(status).toBeInViewport({ ratio: 1 })
    const undoBox = (await external.boundingBox())!
    const statusBox = (await status.boundingBox())!
    expect(undoBox.x + undoBox.width <= statusBox.x || statusBox.x + statusBox.width <= undoBox.x || undoBox.y + undoBox.height <= statusBox.y || statusBox.y + statusBox.height <= undoBox.y).toBe(true)
    await expect(external).toContainText(he ? '4 שנ׳' : '4s')
    await page.screenshot({ path: `artifacts/spendscape-timed-undo-review/fixed-external-${width}-${he ? 'he' : 'en'}.png` })
    await page.getByTestId(width < 761 ? 'capture-open-mobile' : 'capture-open-desktop').click()
    await expect(page.getByTestId('capture-undo')).toContainText(he ? '4 שנ׳' : '4s')
    await page.clock.runFor(3999)
    await expect(page.getByTestId('capture-undo')).toBeVisible()
    await page.clock.runFor(1)
    await expect(page.getByTestId('capture-undo')).toHaveCount(0)
    expect(await qa(page)).toMatchObject({ sessionPurchaseCount: 1, combinedPurchaseCount: 43, canonicalPins: 12, mapInstanceCount: 1, mapConstructionCount: 1 })
  })
}

test('a newer addition replaces the deadline; Undo and Reset dismiss it immediately', async ({ page }) => {
  await open(page)
  await page.clock.install({ time: new Date('2026-09-12T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-09-12T12:00:10Z'))
  const add = async (amount: string) => {
    await page.getByTestId('capture-camera-manual').click()
    await details(page, 'unknown', 'ILS', false)
    await page.getByTestId('review-amount').fill(amount)
    await page.getByTestId('manual-review').click()
    await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('capture-success')).toBeVisible()
  }
  await add('25.00')
  await page.clock.runFor(4000)
  await page.getByTestId('capture-done').click()
  await page.getByTestId('capture-open-desktop').click()
  await add('26.00')
  await expect(page.getByTestId('capture-undo')).toContainText('8s')
  await page.clock.runFor(4000)
  await expect(page.getByTestId('capture-undo')).toContainText('4s')
  await page.getByTestId('capture-undo').click()
  await expect(page.getByTestId('capture-undo')).toHaveCount(0)
  expect((await qa(page)).sessionPurchaseCount).toBe(1)
  await page.getByRole('button', { name: 'Reset demo additions' }).click()
  await add('27.00')
  await page.getByRole('button', { name: 'Reset demo additions' }).click()
  await expect(page.getByTestId('capture-undo')).toHaveCount(0)
  await page.clock.runFor(8000)
  expect((await qa(page)).combinedPurchaseCount).toBe(42)
})
