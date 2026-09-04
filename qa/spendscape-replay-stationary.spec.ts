import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { deriveReplayEvents } from '../src/features/replay/life-replay-domain'
import { globePurchases } from '../src/data/spendscape-globe'

test.use({ viewport: { width: 1280, height: 800 } })

async function ready(page: Page) {
  await expect(page.locator('main')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 })
  await expect(page.locator('nextjs-portal')).toHaveCount(0)
}
async function qa(page: Page) {
  return page.evaluate(() => structuredClone((window as any).__SPENDSCAPE_QA__))
}
async function open(page: Page, mobile = false, he = false) {
  if (mobile) {
    await page.getByRole('button', { name: he ? 'כלי גלובוס' : 'Globe tools', exact: true }).click()
    await page.getByTestId('globe-tools').getByRole('button', { name: he ? 'ציר זמן' : 'Timeline', exact: true }).click()
  } else await page.getByTestId('timeline-open').click()
  await page.getByTestId('replay-open').click()
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'paused')
}
async function seek(page: Page, index: number) {
  const slider = page.getByTestId('replay-scrub')
  await slider.focus()
  await slider.press('Home')
  const advanceKey = await slider.evaluate((node) => getComputedStyle(node).direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight')
  for (let cursor = 0; cursor < index; cursor += 1) await slider.press(advanceKey)
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-index', String(index))
}
async function screenshot(page: Page, info: TestInfo, name: string) {
  const eventDetails = page.getByTestId('replay-event-details')
  if (await eventDetails.count()) {
    await eventDetails.evaluate(async (node) => {
      await Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
    })
  }
  await expect(page.locator('nextjs-portal')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const file = info.outputPath(`${name}.png`)
  await page.screenshot({ path: file })
  await info.attach(name, { path: file, contentType: 'image/png' })
}
function stableRenderer(value: any) {
  return {
    camera: value.camera,
    mapInstanceCount: value.mapInstanceCount,
    mapConstructionCount: value.mapConstructionCount,
    sourceUpdates: value.sourceUpdates,
    sourceDatasetFeatures: value.sourceDatasetFeatures,
    canonicalGeoJsonFeatures: value.canonicalGeoJsonFeatures,
    layerOrder: value.mapStyle.layerOrder,
  }
}

test('three automatic purchase-detail advances issue zero camera commands and do not rebuild the map', async ({ page }, info) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await page.goto('/')
  await ready(page)
  await open(page)
  const player = page.getByTestId('replay-player')
  await page.evaluate(() => { (window as any).__stationaryReplayCanvas = document.querySelector('canvas') })
  const baseline = await qa(page)
  await screenshot(page, info, 'desktop-detail-0-stationary')
  await player.locator('summary').click()
  await page.getByTestId('replay-speed').selectOption('2')
  await player.locator('summary').click()
  await page.evaluate(() => {
    const samples: number[] = []
    let previous = performance.now()
    const until = previous + 7_000
    const frame = (now: number) => {
      const elapsed = now - previous
      if (elapsed > 0 && elapsed < 100) samples.push(elapsed)
      previous = now
      if (now < until) requestAnimationFrame(frame)
    }
    ;(window as any).__stationaryReplayFrames = samples
    requestAnimationFrame(frame)
  })
  await page.getByTestId('replay-play').click()
  for (const index of [1, 2, 3]) {
    await expect(player).toHaveAttribute('data-index', String(index), { timeout: 3500 })
    const current = await qa(page)
    expect(stableRenderer(current)).toEqual(stableRenderer(baseline))
    expect(current.replayAutomaticCameraCommands).toBe(0)
    expect(current.replayExplicitCameraCommands).toBe(0)
    expect(await page.evaluate(() => (window as any).__stationaryReplayCanvas === document.querySelector('canvas')
      && document.querySelector('canvas')?.isConnected)).toBe(true)
    await screenshot(page, info, `desktop-detail-${index}-stationary`)
  }
  await page.getByTestId('replay-play').click()
  const frames = await page.evaluate(() => (window as any).__stationaryReplayFrames as number[])
  const sorted = [...frames].sort((a, b) => a - b)
  const frameEvidence = {
    samples: frames.length,
    medianMs: sorted[Math.floor(sorted.length * 0.5)] ?? null,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? null,
    mapFrameEvidenceBefore: baseline.performance,
    mapFrameEvidenceAfter: (await qa(page)).performance,
  }
  console.log(`[replay-frame-evidence] ${JSON.stringify(frameEvidence)}`)
  await info.attach('browser-frame-sample', { body: JSON.stringify(frameEvidence), contentType: 'application/json' })
  expect((await qa(page)).replayEventPresentations).toBeGreaterThanOrEqual(4)
  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('Previous, Next, scrub, dates, online, unresolved and completion are details-only', async ({ page }, info) => {
  await page.goto('/')
  await ready(page)
  await open(page)
  const baseline = await qa(page)
  const events = deriveReplayEvents(globePurchases)
  await page.getByTestId('replay-next').click()
  await page.getByTestId('replay-previous').click()
  await seek(page, 4)
  const details = page.getByTestId('replay-player').locator('details')
  await details.locator('summary').click()
  await page.getByTestId('replay-from').fill('2026-08-01')
  await page.getByTestId('replay-through').fill('2026-08-31')
  await details.getByRole('button', { name: 'Apply dates' }).click()
  const august = deriveReplayEvents(globePurchases, { start: '2026-08-01', end: '2026-08-31' })
  const online = august.findIndex((purchase) => purchase.channel === 'online')
  const unresolved = august.findIndex((purchase) => purchase.resolution === 'unresolved')
  const nested = august.findIndex((purchase) => purchase.items.length > 0)
  await seek(page, nested)
  await expect(page.getByTestId('replay-event-details')).toContainText('receipt items')
  await expect(page.getByTestId('replay-event-details')).toContainText('Card payment')
  await seek(page, online)
  await expect(page.getByTestId('replay-event-details')).toContainText('Online purchase')
  await expect(page.getByTestId('replay-show-place')).toHaveCount(0)
  await screenshot(page, info, 'desktop-online-stationary')
  await seek(page, unresolved)
  await expect(page.getByTestId('replay-event-details')).toContainText('Unresolved location')
  await expect(page.getByTestId('replay-event-details')).toContainText('Manual input')
  await expect(page.getByTestId('replay-show-place')).toHaveCount(0)
  await screenshot(page, info, 'desktop-unresolved-stationary')

  const eventsByDay = new Map<string, typeof events>()
  for (const event of events) {
    const day = event.timestamp.slice(0, 10)
    eventsByDay.set(day, [...(eventsByDay.get(day) ?? []), event])
  }
  const singleDay = [...eventsByDay].find(([, dayEvents]) => dayEvents.length === 1)?.[0]
  expect(singleDay).toBeTruthy()
  await page.getByTestId('replay-from').fill(singleDay!)
  await page.getByTestId('replay-through').fill(singleDay!)
  await details.getByRole('button', { name: 'Apply dates' }).click()
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-index', '0')
  await page.getByTestId('replay-speed').selectOption('2')
  await page.getByTestId('replay-play').click()
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'complete', { timeout: 3000 })
  await screenshot(page, info, 'desktop-single-event-complete-stationary')

  const current = await qa(page)
  expect(stableRenderer(current)).toEqual(stableRenderer(baseline))
  expect(current.replayAutomaticCameraCommands).toBe(0)
  expect(current.replayExplicitCameraCommands).toBe(0)
  expect(events.length).toBe(globePurchases.length)
})

test('Show place is the sole Replay camera action, pauses, flies once and entry camera still restores', async ({ page }, info) => {
  await page.goto('/')
  await ready(page)
  await open(page)
  const baseline = await qa(page)
  const sourceUpdates = baseline.sourceUpdates
  await page.getByTestId('replay-play').click()
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'playing')
  await page.getByTestId('replay-show-place').click()
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'paused')
  await expect.poll(async () => (await qa(page)).camera?.zoom).toBe(15.2)
  const shown = await qa(page)
  expect(shown.replayAutomaticCameraCommands).toBe(0)
  expect(shown.replayExplicitCameraCommands).toBe(1)
  expect(shown.sourceUpdates).toBe(sourceUpdates)
  expect(shown.mapConstructionCount).toBe(baseline.mapConstructionCount)
  await screenshot(page, info, 'desktop-explicit-show-place-once')
  await page.waitForTimeout(2500)
  await expect(page.getByTestId('replay-player')).toHaveAttribute('data-status', 'paused')
  expect((await qa(page)).replayExplicitCameraCommands).toBe(1)
  await page.getByTestId('replay-close').click()
  await expect(page.getByTestId('replay-player')).toHaveCount(0)
  expect((await qa(page)).camera).toEqual(baseline.camera)
})

for (const config of [
  { width: 360, height: 640, he: false, reduced: false, kind: 'physical' },
  { width: 390, height: 844, he: false, reduced: false, kind: 'online' },
  { width: 430, height: 932, he: true, reduced: true, kind: 'unresolved' },
] as const) {
  test(`details-first mobile ${config.width} ${config.kind} ${config.he ? 'RTL' : 'LTR'}`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport: config, hasTouch: true, colorScheme: 'dark', reducedMotion: config.reduced ? 'reduce' : 'no-preference' })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:3000/')
    await ready(page)
    if (config.he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
    await open(page, true, config.he)
    const baseline = await qa(page)
    const events = deriveReplayEvents(globePurchases)
    const index = config.kind === 'physical' ? 0 : events.findIndex((purchase) => config.kind === 'online'
      ? purchase.channel === 'online' : purchase.resolution === 'unresolved')
    await seek(page, index)
    if (config.kind === 'physical') await expect(page.getByTestId('replay-show-place')).toBeEnabled()
    else await expect(page.getByTestId('replay-show-place')).toHaveCount(0)
    if (config.reduced) {
      const animationName = await page.getByTestId('replay-event-details').evaluate((node) => getComputedStyle(node).animationName)
      expect(animationName).toBe('none')
    }
    expect(stableRenderer(await qa(page))).toEqual(stableRenderer(baseline))
    await screenshot(page, info, `mobile-${config.width}-${config.kind}${config.he ? '-rtl' : ''}`)
    const player = page.getByTestId('replay-player')
    const bounds = await player.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(config.width)
    expect(await player.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
    const nav = page.locator('nav[aria-label="Mobile primary"] > button')
    expect(await nav.count()).toBe(4)
    expect(await nav.allTextContents()).toEqual(config.he ? ['גלובוס', 'קליטה', 'רכישות', 'נתונים'] : ['Globe', 'Capture', 'Purchases', 'Stats'])
    await context.close()
  })
}
