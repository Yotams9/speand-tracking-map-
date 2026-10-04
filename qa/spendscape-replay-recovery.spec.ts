import { expect, test, type Page, type TestInfo } from '@playwright/test'

test.use({ viewport: { width: 1280, height: 800 } })

async function ready(page: Page) {
  await expect(page.locator('main')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 })
  await expect(page.locator('nextjs-portal')).toHaveCount(0)
}
async function qa(page: Page) {
  return page.evaluate(() => structuredClone((window as any).__SPENDSCAPE_QA__))
}
async function historyState(page: Page) {
  return page.evaluate(() => ({ length: history.length, hash: location.hash, state: history.state }))
}
function routerMetadata(state: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(state).filter(([key]) => key.startsWith('__')))
}
async function open(page: Page, mobile = false, he = false) {
  if (mobile) {
    await page.getByRole('button', { name: he ? 'כלי גלובוס' : 'Globe tools', exact: true }).click()
    await page.getByTestId('globe-tools').getByRole('button', { name: he ? 'ציר זמן' : 'Timeline', exact: true }).click()
  } else await page.getByTestId('timeline-open').click()
  await page.getByTestId('replay-open').click()
}
async function installContextProbe(page: Page) {
  const supported = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    const gl = canvas.getContext('webgl2')
    const extension = gl?.getExtension('WEBGL_lose_context')
    if (!gl || !extension) return false
    const probe = { canvas, gl, extension, lostEvents: 0, restoredEvents: 0 }
    canvas.addEventListener('webglcontextlost', () => { probe.lostEvents += 1 })
    canvas.addEventListener('webglcontextrestored', () => { probe.restoredEvents += 1 })
    ;(window as any).__replayContextProbe = probe
    return true
  })
  test.skip(!supported, 'WEBGL_lose_context unavailable: actual context loss/restoration UNVERIFIED')
}
async function lose(page: Page) {
  await page.evaluate(() => (window as any).__replayContextProbe.extension.loseContext())
  await expect.poll(() => page.evaluate(() => (window as any).__replayContextProbe.gl.isContextLost())).toBe(true)
  await expect(page.locator('main')).toHaveAttribute('data-renderer-health', 'lost')
  await expect(page.locator('main')).toHaveAttribute('data-map-ready', 'false')
}
async function restore(page: Page) {
  await page.evaluate(() => (window as any).__replayContextProbe.extension.restoreContext())
  await ready(page)
  await expect(page.locator('main')).toHaveAttribute('data-renderer-health', 'ready')
  expect(await page.evaluate(() => {
    const probe = (window as any).__replayContextProbe
    return probe.canvas === document.querySelector('canvas') && !probe.gl.isContextLost()
  })).toBe(true)
}
async function capture(page: Page, info: TestInfo, name: string) {
  await expect(page.locator('nextjs-portal')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const file = info.outputPath(`${name}.png`)
  await page.screenshot({ path: file })
  await info.attach(name, { path: file, contentType: 'image/png' })
}

for (const config of [
  { width: 1280, height: 800, he: false, reduce: false },
  { width: 360, height: 640, he: false, reduce: false },
  { width: 430, height: 932, he: true, reduce: true },
]) {
  test(`real renderer loss, manual history and repeated paused recovery ${config.width} ${config.he ? 'HE' : 'EN'}`, async ({ browser }, info) => {
    const mobile = config.width < 760
    const context = await browser.newContext({ viewport: config, hasTouch: mobile, colorScheme: 'dark', reducedMotion: config.reduce ? 'reduce' : 'no-preference' })
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('http://127.0.0.1:3000/')
    await ready(page)
    if (config.he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
    await installContextProbe(page)
    await open(page, mobile, config.he)
    const player = page.getByTestId('replay-player')
    const before = await qa(page)
    for (let cycle = 0; cycle < 2; cycle += 1) {
      await page.getByTestId('replay-play').click()
      await expect(player).toHaveAttribute('data-status', 'playing')
      const index = Number(await player.getAttribute('data-index'))
      await lose(page)
      await expect(player).toHaveAttribute('data-status', 'paused')
      await expect(page.getByTestId('replay-play')).toBeDisabled()
      await expect(page.getByTestId('replay-show-place')).toBeDisabled()
      await expect(player).toContainText(config.he ? 'המפה אינה זמינה' : 'Map unavailable')
      await page.waitForTimeout(4500) // Deliberately cross the existing 1x 4-second tick deadline.
      await expect(player).toHaveAttribute('data-index', String(index))
      expect((await qa(page)).ready).toBe(false)
      await page.getByTestId('replay-next').click()
      await expect(player).toHaveAttribute('data-index', String(index + 1))
      await page.getByTestId('replay-previous').click()
      await expect(player).toHaveAttribute('data-index', String(index))
      if (!cycle) await capture(page, info, 'renderer-unavailable-manual-history')
      const updates = (await qa(page)).sourceUpdates
      await restore(page)
      await expect(player).toHaveAttribute('data-status', 'paused')
      await expect(page.getByTestId('replay-play')).toBeEnabled()
      await page.waitForTimeout(4500)
      await expect(player).toHaveAttribute('data-index', String(index))
      await expect(player).toHaveAttribute('data-status', 'paused')
      expect((await qa(page)).sourceUpdates).toBe(updates + 1)
      if (!cycle) await capture(page, info, 'renderer-recovered-still-paused')
    }
    const recovered = await qa(page)
    for (const key of ['mapInstanceCount', 'mapConstructionCount', 'query', 'canonicalPins', 'onlineExcluded', 'unresolvedExcluded', 'sessionPurchaseCount', 'pendingInboxCount', 'askUndoAvailable']) {
      expect(recovered[key], key).toEqual(before[key])
    }
    expect(await page.evaluate(() => {
      const p = (window as any).__replayContextProbe
      return [p.lostEvents, p.restoredEvents]
    })).toEqual([2, 2])
    await page.getByTestId('replay-play').click()
    await expect(player).toHaveAttribute('data-index', '1', { timeout: 7000 })
    await page.getByTestId('replay-play').click()
    await page.getByTestId('replay-close').click()
    await expect(player).toHaveCount(0)
    expect(errors).toEqual([])
    await context.close()
  })
}

for (const destination of ['close', 'capture', 'ask'] as const) {
  test(`exit during actual context loss: ${destination} preserves entry and destination focus after restoration`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await ready(page)
    await page.getByRole('button', { name: 'Heatmap', exact: true }).click()
    await page.getByRole('combobox', { name: 'Jump to a place' }).selectOption('place_shuk_bograshov')
    await installContextProbe(page)
    await page.getByTestId('timeline-open').click()
    const before = await qa(page)
    await page.getByTestId('replay-open').click()
    await page.getByTestId('replay-play').click()
    await lose(page)
    if (destination === 'close') await page.getByTestId('replay-close').click()
    else await page.getByTestId(destination === 'capture' ? 'capture-open-desktop' : 'ask-open-desktop').click()
    await expect(page.getByTestId('replay-player')).toHaveCount(0)
    const focus = destination === 'close' ? page.getByTestId('timeline-open')
      : destination === 'capture' ? page.getByTestId('capture-dialog') : page.getByTestId('ask-input')
    if (destination === 'capture') expect(await focus.evaluate((node) => node.contains(document.activeElement))).toBe(true)
    else await expect(focus).toBeFocused()
    if (destination === 'close') await expect(page.getByTestId('renderer-unavailable')).toBeVisible()
    await restore(page)
    await page.waitForTimeout(4500)
    if (destination === 'capture') expect(await focus.evaluate((node) => node.contains(document.activeElement))).toBe(true)
    else await expect(focus).toBeFocused()
    const after = await qa(page)
    for (const key of ['camera', 'query', 'selectedPlaceId', 'selectedPurchaseId', 'mode', 'surface', 'mapConstructionCount', 'sessionPurchaseCount', 'pendingInboxCount', 'askUndoAvailable']) expect(after[key], key).toEqual(before[key])
    expect(after.autoSpin).toBe(false)
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('spendscape.phase1.globe-camera')!))).toEqual(before.camera)
    await capture(page, info, `restored-navigation-${destination}`)
  })
}

for (const config of [{ width: 1280, height: 800, he: false }, { width: 390, height: 844, he: false }, { width: 430, height: 932, he: true }]) {
  test(`Replay Capture Back Forward has no duplicate origin ${config.width} ${config.he ? 'HE' : 'EN'}`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport: config, hasTouch: config.width < 760, colorScheme: 'dark', reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:3000/')
    await ready(page)
    if (config.he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
    const mobile = config.width < 760
    const nav = page.locator(`nav[aria-label="${mobile ? 'Mobile primary' : 'Primary'}"]`)
    await nav.getByRole('button', { name: config.he ? 'רכישות' : 'Purchases', exact: true }).click()
    const previous = await historyState(page)
    await nav.getByRole('button', { name: config.he ? 'גלובוס' : 'Globe', exact: true }).click()
    const origin = await historyState(page)
    await open(page, mobile, config.he)
    const replay = await historyState(page)
    await page.getByTestId('replay-play').click()
    await page.getByTestId(mobile ? 'capture-open-mobile' : 'capture-open-desktop').click()
    await expect(page.getByTestId('capture-dialog')).toBeVisible()
    expect(await page.getByTestId('capture-dialog').evaluate((node) => node.contains(document.activeElement))).toBe(true)
    const destination = await historyState(page)
    expect(destination.length).toBe(replay.length)
    expect(destination.length).toBe(origin.length + 1)
    expect(routerMetadata(destination.state)).toEqual(routerMetadata(origin.state))
    await page.goBack()
    await expect(page.getByTestId('capture-dialog')).toHaveCount(0)
    expect((await historyState(page)).state).toEqual(origin.state)
    await page.goBack()
    await expect(page.getByTestId('purchases-panel')).toBeVisible()
    expect((await historyState(page)).state).toEqual(previous.state)
    await page.goForward()
    await expect(page.locator('main')).toHaveAttribute('data-surface', 'globe')
    await page.goForward()
    await expect(page.getByTestId('capture-dialog')).toBeVisible()
    expect(await page.getByTestId('capture-dialog').evaluate((node) => node.contains(document.activeElement))).toBe(true)
    expect((await historyState(page)).state).toEqual(destination.state)
    expect((await qa(page)).mapConstructionCount).toBe(1)
    await capture(page, info, 'capture-forward-restored')
    await info.attach('history', { body: JSON.stringify({ previous, origin, replay, destination }), contentType: 'application/json' })
    await context.close()
  })
}

for (const destination of ['Purchases', 'Analytics', 'Ask'] as const) {
  test(`other Replay exit helper: ${destination} preserves state, history and focus`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await ready(page)
    await page.getByRole('button', { name: 'Heatmap', exact: true }).click()
    await page.getByTestId('timeline-open').click()
    const before = await qa(page)
    const origin = await historyState(page)
    await page.getByTestId('replay-open').click()
    await page.getByTestId('replay-play').click()
    if (destination === 'Ask') await page.getByTestId('ask-open-desktop').click()
    else await page.locator('nav[aria-label="Primary"]').getByRole('button', { name: destination, exact: true }).click()
    await expect(page.getByTestId('replay-player')).toHaveCount(0)
    const focus = destination === 'Ask' ? page.getByTestId('ask-input')
      : destination === 'Purchases' ? page.locator('nav[aria-label="Primary"]').getByRole('button', { name: destination, exact: true })
        : page.locator('nav[aria-label="Primary"]').getByRole('button', { name: destination, exact: true })
    await expect(focus).toBeFocused()
    await page.waitForTimeout(4500)
    await expect(focus).toBeFocused()
    const after = await qa(page)
    for (const key of ['query', 'camera', 'mode', 'sessionPurchaseCount', 'pendingInboxCount', 'askUndoAvailable', 'mapConstructionCount']) expect(after[key], key).toEqual(before[key])
    expect((await historyState(page)).length).toBe(origin.length + 1)
    await page.goBack()
    expect((await historyState(page)).state).toEqual(origin.state)
  })
}
