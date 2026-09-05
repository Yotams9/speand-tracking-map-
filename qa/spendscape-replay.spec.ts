import { globePurchases, globePlaces, globeMerchants } from '../src/data/spendscape-fixtures'
import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { defaultPurchaseQuery, filterPurchases } from '../src/data/spendscape-globe'
import { deriveReplayEvents } from '../src/features/replay/life-replay-domain'

const artifacts = path.join(process.cwd(), 'artifacts/spendscape-slice-1d6')
test.beforeAll(async () => { await mkdir(artifacts, { recursive: true }) })
test.use({ viewport: { width: 1280, height: 800 } })

async function ready(page: Page) {
  await expect(page.locator('main')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 })
  await expect(page.locator('nextjs-portal')).toHaveCount(0)
}
async function evidence(page: Page) {
  return page.evaluate(() => structuredClone((window as any).__SPENDSCAPE_QA__))
}
function preserved(value: any) {
  return {
    query: value.query, selectedPlaceId: value.selectedPlaceId, selectedPurchaseId: value.selectedPurchaseId,
    mode: value.mode, surface: value.surface, sessionPurchaseCount: value.sessionPurchaseCount,
    combinedPurchaseCount: value.combinedPurchaseCount, pendingInboxCount: value.pendingInboxCount,
    askUndoAvailable: value.askUndoAvailable, askLastSummary: value.askLastSummary,
    mapInstanceCount: value.mapInstanceCount, mapConstructionCount: value.mapConstructionCount,
  }
}
async function open(page: Page, mobile = false, he = false) {
  if (mobile) {
    await page.getByRole('button', { name: he ? 'כלי גלובוס' : 'Globe tools', exact: true }).click()
    await page.getByTestId('globe-tools').getByRole('button', { name: he ? 'ציר זמן' : 'Timeline', exact: true }).click()
  } else await page.getByTestId('timeline-open').click()
  await page.getByTestId('replay-open').click()
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'paused')
}
async function screenshot(page: Page, name: string) {
  await expect(page.locator('nextjs-portal')).toHaveCount(0)
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) })
}
async function seek(page: Page, index: number) {
  const slider = page.getByTestId('replay-scrub')
  await slider.focus()
  await slider.press('Home')
  for (let i = 0; i < index; i++) await slider.press('ArrowRight')
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-index', String(index))
}
async function dates(page: Page, start: string, end: string, he = false) {
  const details = page.getByTestId('replay-player').locator('details')
  if (!await details.getAttribute('open').then((v) => v !== null)) await details.locator('summary').click()
  await page.getByTestId('replay-from').fill(start)
  await page.getByTestId('replay-through').fill(end)
  await details.getByRole('button', { name: he ? 'החלת תאריכים' : 'Apply dates' }).click()
}

test('desktop canonical story, committed scrub, speeds, map interruption, history and exact restoration', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await ready(page)
  await page.getByRole('button', { name: 'Heatmap', exact: true }).click()
  await page.getByTestId('timeline-open').click()
  const before = await evidence(page)
  const historyLength = await page.evaluate(() => history.length)
  await page.getByTestId('replay-open').click()
  const player = page.getByTestId('replay-player')
  await expect(player).toHaveAttribute('data-count', String(globePurchases.length))
  await expect(player).toHaveAttribute('data-purchase-id', deriveReplayEvents(globePurchases)[0].id)
  await expect(page.getByTestId('replay-play')).toBeFocused()
  expect((await evidence(page)).camera).toEqual(before.camera)
  expect(await page.evaluate(() => history.length)).toBe(historyLength + 1)
  await screenshot(page, 'desktop-1280-paused')
  await page.getByTestId('replay-play').click()
  await expect(player).toHaveAttribute('data-status', 'playing')
  await expect(player).toHaveAttribute('data-index', '1', { timeout: 7000 })
  await screenshot(page, 'desktop-1280-playing')
  await page.mouse.move(850, 280)
  await page.mouse.down()
  await page.mouse.move(930, 300, { steps: 8 })
  await page.mouse.up()
  await expect(player).toHaveAttribute('data-status', 'paused')
  await page.getByTestId('replay-play').click()
  await page.mouse.move(850, 280)
  await page.mouse.wheel(0, -100)
  await expect(player).toHaveAttribute('data-status', 'paused')
  await seek(page, 2)
  await expect(player).toHaveAttribute('data-status', 'paused')
  await player.locator('summary').click()
  await page.getByTestId('replay-speed').selectOption('2')
  await player.locator('summary').click()
  await page.getByTestId('replay-play').click()
  await expect(player).toHaveAttribute('data-index', '3', { timeout: 3500 })
  await page.getByTestId('replay-play').click()
  expect(await page.evaluate(() => history.length)).toBe(historyLength + 1)
  await page.goBack()
  await expect(player).toBeHidden()
  await expect(page.getByTestId('timeline-open')).toBeFocused()
  expect(preserved(await evidence(page))).toEqual(preserved(before))
  expect((await evidence(page)).camera).toEqual(before.camera)
  await page.goForward()
  await expect(player).toHaveAttribute('data-status', 'paused')
  await page.getByTestId('replay-close').click()
  await expect(page.getByTestId('timeline-open')).toBeFocused()
  expect((await evidence(page)).mapConstructionCount).toBe(1)
  expect(errors).toEqual([])
})

test('date narrowing, original currencies, unpinned events, completion, single and empty', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await open(page)
  const player = page.getByTestId('replay-player')
  await dates(page, '2026-08-01', '2026-08-31')
  const august = deriveReplayEvents(globePurchases, { start: '2026-08-01', end: '2026-08-31' })
  await expect(player).toHaveAttribute('data-count', String(august.length))
  await player.locator('summary').click()
  for (const purchase of august.filter((p) => p.channel !== 'physical' || p.resolution !== 'confirmed')) {
    const before = (await evidence(page)).camera
    await seek(page, august.indexOf(purchase))
    // Earlier seek steps may visit physical places. The current unpinned event must not move after it is shown.
    const atEvent = (await evidence(page)).camera
    await page.getByTestId('replay-play').click()
    await expect(player).toHaveAttribute('data-status', 'playing')
    await page.getByTestId('replay-play').click()
    expect((await evidence(page)).camera).toEqual(atEvent)
    await expect(page.getByTestId('replay-show-place')).toHaveCount(0)
    expect(before).not.toBeNull()
    await screenshot(page, `desktop-${purchase.channel}-${purchase.id}`)
  }
  const single = deriveReplayEvents(globePurchases).find((p) => globePurchases.filter((q) => q.timestamp.slice(0, 10) === p.timestamp.slice(0, 10)).length === 1)!
  await dates(page, single.timestamp.slice(0, 10), single.timestamp.slice(0, 10))
  await expect(player).toHaveAttribute('data-count', '1')
  await expect(page.getByTestId('replay-scrub')).toBeDisabled()
  await expect(page.getByTestId('replay-previous')).toBeDisabled()
  await expect(page.getByTestId('replay-next')).toBeDisabled()
  await player.locator('summary').click()
  await page.getByTestId('replay-play').click()
  await expect(player).toHaveAttribute('data-status', 'complete', { timeout: 6500 })
  await screenshot(page, 'desktop-single-complete')
  await page.getByTestId('replay-play').click()
  await expect(player).toHaveAttribute('data-status', 'playing')
  await dates(page, '2030-01-01', '2030-01-02')
  await expect(player).toHaveAttribute('data-count', '0')
  await expect(page.getByTestId('replay-play')).toBeDisabled()
  await screenshot(page, 'desktop-empty-dates')
})

for (const config of [
  { width: 360, height: 640, he: false, reduced: false },
  { width: 390, height: 844, he: false, reduced: true },
  { width: 430, height: 932, he: true, reduced: true },
]) {
  test(`mobile focus/history, touch and readable player ${config.width}x${config.height} RTL=${config.he}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, hasTouch: true,
      reducedMotion: config.reduced ? 'reduce' : 'no-preference', colorScheme: 'dark' })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/')
    await ready(page)
    if (config.he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
    const tools = page.getByRole('button', { name: config.he ? 'כלי גלובוס' : 'Globe tools', exact: true })
    const nav = page.locator('nav[aria-label="Mobile primary"] > button')
    const labels = await nav.allTextContents()
    const before = preserved(await evidence(page))
    for (const dismiss of ['escape', 'back', 'close'] as const) {
      await open(page, true, config.he)
      const player = page.getByTestId('replay-player')
      await expect(page.getByTestId('replay-play')).toBeFocused()
      const camera = (await evidence(page)).camera
      await page.getByTestId('replay-play').tap()
      await expect(player).toHaveAttribute('data-status', 'playing')
      if (config.reduced) {
        await expect(player).toHaveAttribute('data-index', '1', { timeout: 6500 })
        expect((await evidence(page)).camera).toEqual(camera)
      }
      // Derive a point in the exposed map above the details-first player. The
      // expanded canonical detail content intentionally changes the old fixed y.
      const mapTap = await player.evaluate((node) => {
        const playerTop = node.getBoundingClientRect().top
        const y = Math.floor((60 + playerTop) / 2)
        const x = Math.floor(window.innerWidth / 2)
        return { x, y, playerTop, tag: document.elementFromPoint(x, y)?.tagName }
      })
      expect(mapTap.playerTop - mapTap.y).toBeGreaterThan(20)
      expect(mapTap.tag).toBe('CANVAS')
      await page.touchscreen.tap(mapTap.x, mapTap.y)
      await expect(player).toHaveAttribute('data-status', 'paused')
      await screenshot(page, `mobile-${config.width}-${dismiss}-paused${config.he ? '-rtl' : ''}`)
      const geometry = await player.evaluate((node) => ({ left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right,
        scroll: node.scrollWidth, client: node.clientWidth, page: document.documentElement.scrollWidth, viewport: innerWidth }))
      expect(geometry.left).toBeGreaterThanOrEqual(0)
      expect(geometry.right).toBeLessThanOrEqual(config.width)
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1)
      expect(geometry.page).toBeLessThanOrEqual(geometry.viewport)
      if (dismiss === 'escape') await page.keyboard.press('Escape')
      else if (dismiss === 'back') await page.goBack()
      else await page.getByTestId('replay-close').click()
      await expect(player).toBeHidden()
      await expect(tools).toBeFocused()
      await expect(tools).toBeVisible()
      await expect(tools).toBeEnabled()
      await screenshot(page, `mobile-${config.width}-${dismiss}-restored-focus${config.he ? '-rtl' : ''}`)
      await page.keyboard.press('Tab')
      await expect(nav.nth(0)).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(tools).toBeFocused()
      expect(preserved(await evidence(page))).toEqual(before)
    }
    expect(await nav.allTextContents()).toEqual(labels)
    await nav.nth(0).focus()
    for (let i = 1; i < 4; i++) { await page.keyboard.press('Tab'); await expect(nav.nth(i)).toBeFocused() }
    expect(errors).toEqual([])
    await context.close()
  })
}

test('shared filters remain intact and reload discards temporary Replay camera and navigation', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.getByRole('button', { name: 'Food', exact: true }).first().click()
  await page.getByTestId('timeline-open').click()
  const before = await evidence(page)
  await page.getByTestId('replay-open').click()
  const food = filterPurchases({ ...defaultPurchaseQuery, category: 'food' }, globePurchases, globePlaces, globeMerchants)
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-count', String(food.length))
  await page.getByTestId('replay-show-place').click()
  await expect.poll(async () => (await evidence(page)).camera?.zoom).toBe(15.2)
  await page.reload()
  await ready(page)
  await expect(page.getByTestId('replay-player')).toHaveCount(0)
  expect(preserved(await evidence(page))).toEqual(preserved(before))
  expect((await evidence(page)).camera).toEqual(before.camera)
  expect(await page.evaluate(() => location.hash)).not.toBe('#replay')
})

test('map failure permits manual story reading without false camera success or autoplay recovery', async ({ page }) => {
  await page.goto('/?mapFailure=1')
  await expect(page.getByTestId('map-failure')).toBeVisible()
  await open(page)
  await expect(page.getByTestId('replay-play')).toBeDisabled()
  await page.getByTestId('replay-next').click()
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-index', '1')
  await screenshot(page, 'desktop-map-failure-story')
  await page.getByTestId('replay-player').getByRole('button', { name: 'Retry map' }).click()
  await expect(page.getByTestId('replay-close')).toBeFocused()
  await ready(page)
  await expect(page.getByTestId('replay-close')).toBeFocused()
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'paused')
  await page.getByTestId('replay-close').click()
})

test('Capture and Inbox composition plus Ask Undo survive Replay and intentional Ask destination focus', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.getByTestId('capture-open-desktop').click()
  await page.getByTestId('capture-sources-open').click()
  await page.getByTestId('capture-source-receipt').click()
  await expect(page.getByTestId('capture-review')).toBeVisible()
  await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  await page.getByRole('button', { name: 'Show on globe', exact: true }).click()
  await expect(page.getByTestId('capture-dialog')).toBeHidden()
  await page.getByTestId('smart-inbox-open').click()
  await page.locator('label:has(input[value="place_shuk_bograshov"])').click()
  await page.getByTestId('smart-inbox-confirm').click()
  await expect(page.getByTestId('smart-inbox-complete')).toBeVisible()
  await page.keyboard.press('Escape')
  const beforeAsk = await evidence(page)
  await page.getByTestId('ask-open-desktop').click()
  await page.getByTestId('ask-input').fill('fit purchases')
  await page.getByTestId('ask-run').click()
  await expect(page.getByTestId('ask-undo')).toBeVisible()
  await page.getByTestId('timeline-open').click()
  const before = await evidence(page)
  expect(before).toMatchObject({ sessionPurchaseCount: 1, pendingInboxCount: 0, askUndoAvailable: true, combinedPurchaseCount: 43 })
  await page.getByTestId('replay-open').click()
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-count', '43')
  await seek(page, 42)
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-purchase-id', 'session_purchase_receipt_01')
  await page.getByTestId('replay-close').click()
  await expect(page.getByTestId('replay-player')).toBeHidden()
  expect(preserved(await evidence(page))).toEqual(preserved(before))
  await expect(page.getByTestId('ask-undo')).toBeVisible()
  await page.getByTestId('ask-undo').click()
  // Ask's accepted easeTo round-trip can differ by ~1e-14. Preserve a strict
  // sub-millimetre coordinate tolerance, rather than require IEEE bit identity.
  await expect.poll(async () => {
    const camera = (await evidence(page)).camera
    return Math.max(...camera.center.map((value: number, index: number) => Math.abs(value - beforeAsk.camera.center[index])),
      ...['zoom', 'bearing', 'pitch'].map((key) => Math.abs(camera[key] - beforeAsk.camera[key])))
  }).toBeLessThan(1e-9)
  expect((await evidence(page)).query).toEqual(beforeAsk.query)
  expect((await evidence(page)).selectedPlaceId).toBe(beforeAsk.selectedPlaceId)
  expect((await evidence(page)).selectedPurchaseId).toBe(beforeAsk.selectedPurchaseId)
  expect((await evidence(page)).mode).toBe(beforeAsk.mode)
  await open(page)
  await page.getByTestId('ask-open-desktop').click()
  await expect(page.getByTestId('replay-player')).toBeHidden()
  await expect(page.getByTestId('ask-input')).toBeFocused()
  await page.getByTestId('ask-input').fill('open analytics categories')
  await page.getByTestId('ask-run').click()
  await expect(page.locator('[data-analytics-view="categories"]')).toBeFocused()
  expect((await evidence(page)).mapConstructionCount).toBe(1)
  expect((await evidence(page)).sessionPurchaseCount).toBe(1)
  expect((await evidence(page)).pendingInboxCount).toBe(0)
})

test('backgrounding cancels advancement and returning never auto-resumes; Replay adds no network APIs', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  // Instrument new application calls after map startup, not unchanged MapLibre tile transport.
  await page.evaluate(() => {
    (window as any).__replayCalls = []
    const original = window.fetch
    window.fetch = (...args) => { (window as any).__replayCalls.push(String(args[0])); return original(...args) }
  })
  await open(page)
  await page.getByTestId('replay-play').click()
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'playing')
  // Deterministic browser visibility-event simulation, not a claim of a physical OS background gesture.
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'paused')
  const index = await page.getByTestId('replay-player').getAttribute('data-index')
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(4500)
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-index', index!)
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'paused')
  expect(await page.evaluate(() => (window as any).__replayCalls)).toEqual([])
})

test('Replay restores Purchases and Stats origin focus and does not steal intentional destination focus', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  for (const origin of ['Purchases', 'Analytics']) {
    await page.getByRole('button', { name: origin, exact: true }).first().click()
    const timeline = page.getByTestId(origin === 'Purchases' ? 'history-timeline' : 'analytics-timeline')
    await timeline.click()
    const before = preserved(await evidence(page))
    await page.getByTestId('replay-open').click()
    await expect(page.getByTestId('replay-player')).toBeVisible()
    await page.getByTestId('replay-close').click()
    await expect(timeline).toBeFocused()
    expect(preserved(await evidence(page))).toEqual(before)
  }
  await page.getByTestId('analytics-timeline').click()
  await page.getByTestId('replay-open').click()
  await page.getByTestId('capture-open-desktop').click()
  await expect(page.getByTestId('replay-player')).toBeHidden()
  await expect(page.getByTestId('capture-dialog')).toBeVisible()
  expect(await page.getByTestId('capture-dialog').evaluate((node) => node.contains(document.activeElement))).toBe(true)
  expect((await evidence(page)).mapConstructionCount).toBe(1)
})

test('loading story, date editing and explicit reduced-motion Show place remain coherent on a small phone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, reducedMotion: 'reduce', colorScheme: 'dark' })
  const page = await context.newPage()
  await page.goto('/?loading=1')
  await expect(page.getByTestId('map-loading')).toBeVisible()
  await open(page, true)
  await expect(page.getByTestId('replay-play')).toBeDisabled()
  await screenshot(page, 'mobile-360-loading-story')
  await page.goto('/')
  await ready(page)
  await open(page, true)
  const before = (await evidence(page)).camera
  await page.getByTestId('replay-show-place').tap()
  expect((await evidence(page)).camera).not.toEqual(before)
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'paused')
  await expect.poll(async () => page.evaluate(() => (window as any).__SPENDSCAPE_QA_ACTIONS__?.firstRenderedPoint('pin'))).not.toBeNull()
  const pin = await page.evaluate(() => (window as any).__SPENDSCAPE_QA_ACTIONS__.firstRenderedPoint('pin'))
  const playerBounds = await page.getByTestId('replay-player').boundingBox()
  expect(pin[1]).toBeGreaterThan(75)
  expect(pin[1]).toBeLessThan(playerBounds!.y - 20)
  await screenshot(page, 'mobile-360-explicit-place-visible')
  await dates(page, '2026-08-01', '2026-08-31')
  await screenshot(page, 'mobile-360-dates')
  const toolsBounds = await page.getByRole('button', { name: 'Globe tools', exact: true }).boundingBox()
  const expandedBounds = await page.getByTestId('replay-player').boundingBox()
  expect(toolsBounds!.y + toolsBounds!.height + 6).toBeLessThanOrEqual(expandedBounds!.y)
  expect(await page.getByTestId('replay-player').evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
  await context.close()
})
