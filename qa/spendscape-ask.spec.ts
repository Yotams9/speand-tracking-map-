import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-slice-1d5')
const focusArtifactDir = path.join(artifactDir, 'focus-restoration')

interface AskEvidence {
  ready: boolean
  locale: 'en' | 'he'
  reducedMotion: boolean
  autoSpin: boolean
  mode: 'pins' | 'heatmap'
  surface: 'globe' | 'purchases' | 'stats'
  selectedPlaceId: string | null
  selectedPurchaseId: string | null
  askOpen: boolean
  askUndoAvailable: boolean
  askLastSummary: string | null
  mapInstanceCount: number
  mapConstructionCount: number
  canonicalPins: number
  combinedPurchaseCount: number
  sessionPurchaseCount: number
  pendingInboxCount: number
  visiblePurchaseCount: number
  visiblePinFeatures: number
  query: {
    search: string
    category: string
    currency: string
    channel: string
    dateRange: string
    timelineMonth: string | null
  }
  camera: { center: [number, number]; zoom: number; bearing: number; pitch: number } | null
  performance: { lastCameraAction: string | null; lastCameraMs: number | null }
}

async function waitForExperience(page: Page) {
  await page.waitForFunction(() => (
    window as typeof window & { __SPENDSCAPE_QA__?: AskEvidence }
  ).__SPENDSCAPE_QA__?.ready === true, undefined, { timeout: 25_000 })
  await page.waitForTimeout(300)
  await expect(page.locator('nextjs-portal')).toHaveCount(0)
}

async function evidence(page: Page): Promise<AskEvidence> {
  return page.evaluate(() => structuredClone((
    window as typeof window & { __SPENDSCAPE_QA__?: AskEvidence }
  ).__SPENDSCAPE_QA__!))
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function openDesktopAsk(page: Page) {
  await page.getByTestId('ask-open-desktop').click()
  await expect(page.getByTestId('ask-panel')).toBeVisible()
  await expect(page.getByTestId('ask-input')).toBeFocused()
}

async function runCommand(page: Page, command: string) {
  await page.getByTestId('ask-input').fill(command)
  await page.getByTestId('ask-run').click()
}

async function dismissFeedback(page: Page) {
  const feedback = page.getByTestId('ask-feedback')
  if (await feedback.isVisible().catch(() => false)) await feedback.getByRole('button', { name: 'Dismiss status' }).click()
}

function reversibleState(value: AskEvidence) {
  return {
    surface: value.surface,
    selectedPlaceId: value.selectedPlaceId,
    selectedPurchaseId: value.selectedPurchaseId,
    query: value.query,
    mode: value.mode,
    canonicalPins: value.canonicalPins,
    combinedPurchaseCount: value.combinedPurchaseCount,
    sessionPurchaseCount: value.sessionPurchaseCount,
    pendingInboxCount: value.pendingInboxCount,
    mapInstanceCount: value.mapInstanceCount,
    mapConstructionCount: value.mapConstructionCount,
  }
}

async function checkMobileNavOrder(page: Page, rtl: boolean) {
  const buttons = page.locator('nav[aria-label="Mobile primary"] > button')
  const positions = await buttons.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().x))
  expect(positions.every((x, index) => index === 0 || (rtl ? x < positions[index - 1] : x > positions[index - 1]))).toBe(true)
  await buttons.nth(0).focus()
  for (let index = 1; index < 4; index += 1) {
    await page.keyboard.press('Tab')
    await expect(buttons.nth(index)).toBeFocused()
  }
  await page.keyboard.press('Shift+Tab')
  await expect(buttons.nth(2)).toBeFocused()
}

test.beforeAll(async () => {
  await mkdir(artifactDir, { recursive: true })
  await mkdir(path.join(artifactDir, 'video'), { recursive: true })
  await mkdir(focusArtifactDir, { recursive: true })
})

async function expectAvailableFocus(page: Page, target: Locator) {
  await expect(target).toBeFocused()
  // Wait across rendering frames so a competing/stale restoration cannot pass briefly.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect(target).toBeFocused()
  await expect(target).toBeVisible()
  await expect(target).toBeEnabled()
  expect(await target.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return element.isConnected && !element.closest('[inert], [hidden], [aria-hidden="true"], [aria-disabled="true"]') &&
      rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
  })).toBe(true)
}

async function dismissAsk(page: Page, method: 'escape' | 'back' | 'close' | 'scrim', touch: boolean) {
  if (method === 'escape') await page.keyboard.press('Escape')
  if (method === 'back') await page.goBack()
  if (method === 'close') {
    const close = page.getByTestId('ask-panel').locator('header button')
    if (touch) await close.tap()
    else await close.click()
  }
  if (method === 'scrim') {
    const scrim = page.getByTestId('ask-layer').locator(':scope > button')
    // The upper-left point is outside both the desktop panel and mobile bottom sheet.
    if (touch) await scrim.tap({ position: { x: 2, y: 2 } })
    else await scrim.click({ position: { x: 2, y: 2 } })
  }
  await expect(page.getByTestId('ask-panel')).toBeHidden()
}

for (const configuration of [
  { width: 360, height: 640, locale: 'en', reducedMotion: 'no-preference' },
  { width: 390, height: 844, locale: 'en', reducedMotion: 'reduce' },
  { width: 430, height: 932, locale: 'he', reducedMotion: 'reduce' },
  { width: 390, height: 844, locale: 'he', reducedMotion: 'no-preference' },
] as const) {
  test(`mobile Ask dismissal restores visible Tools focus ${configuration.width}x${configuration.height} ${configuration.locale} ${configuration.reducedMotion}`, async ({ browser }) => {
    const { width, height, locale, reducedMotion } = configuration
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark', hasTouch: true, reducedMotion })
    const page = await context.newPage()
    const errors = collectErrors(page)
    await page.goto('/')
    await waitForExperience(page)
    if (locale === 'he') await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
    const tools = page.getByRole('button', { name: locale === 'he' ? 'כלי גלובוס' : 'Globe tools', exact: true })
    const baseline = reversibleState(await evidence(page))
    const originalLocation = await page.evaluate(() => ({ hash: location.hash, state: history.state }))
    const originalHistoryLength = await page.evaluate(() => history.length)
    const originalCanvas = await page.getByTestId('map-canvas').locator('canvas').elementHandle()
    expect(originalCanvas).not.toBeNull()
    let stoppedCamera: AskEvidence['camera'] | undefined
    // Two real cycles of every dismissal path also guard stale restoration work.
    for (let cycle = 0; cycle < 2; cycle += 1) {
      for (const method of ['escape', 'back', 'close', 'scrim'] as const) {
        await tools.focus()
        await page.keyboard.press('Enter')
        const originalTrigger = page.getByTestId('ask-open-mobile')
        await originalTrigger.focus()
        await page.keyboard.press('Enter')
        await expect(page.getByTestId('ask-input')).toBeFocused()
        expect(await page.evaluate(() => history.length)).toBe(originalHistoryLength + 1)
        await expect(originalTrigger).toHaveCount(0)
        if (!stoppedCamera) stoppedCamera = (await evidence(page)).camera
        await dismissAsk(page, method, true)
        await expectAvailableFocus(page, tools)
        await expect(tools).toHaveAttribute('aria-expanded', 'false')
        await expect(originalTrigger).toHaveCount(0) // no overlay re-opened just for focus
        expect(await page.evaluate(() => ({ hash: location.hash, state: history.state }))).toEqual(originalLocation)
        expect(await page.evaluate(() => history.length)).toBe(originalHistoryLength + 1)
        expect(reversibleState(await evidence(page))).toEqual(baseline)
        expect(await originalCanvas!.evaluate((canvas) => canvas.isConnected)).toBe(true)
        expect((await evidence(page)).camera).toEqual(stoppedCamera)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        if (cycle === 0 && (method === 'escape' || method === 'back')) {
          expect(await tools.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
          await expect(tools).toHaveCSS('outline-style', 'solid')
          await page.screenshot({ path: path.join(focusArtifactDir, `${width}x${height}-${locale}-${method}-restored.png`), fullPage: true })
        }
        await page.keyboard.press('Tab')
        await expect(page.locator('nav[aria-label="Mobile primary"] > button').first()).toBeFocused()
        await page.keyboard.press('Shift+Tab')
        await expect(tools).toBeFocused()
        await page.keyboard.press('Shift+Tab')
        await expect(page.locator('[aria-label="Primary globe actions"] > button').first()).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(tools).toBeFocused()
      }
    }
    expect(errors).toEqual([])
    await context.close()
  })
}

test('desktop Ask dismissal restores its original visible trigger for all paths and repeated cycles', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForExperience(page)
  const trigger = page.getByTestId('ask-open-desktop')
  const baseline = reversibleState(await evidence(page))
  const originalCanvas = await page.getByTestId('map-canvas').locator('canvas').elementHandle()
  expect(originalCanvas).not.toBeNull()
  for (let cycle = 0; cycle < 2; cycle += 1) {
    for (const method of ['escape', 'back', 'close', 'scrim'] as const) {
      await trigger.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('ask-input')).toBeFocused()
      await dismissAsk(page, method, false)
      await expectAvailableFocus(page, trigger)
      expect(reversibleState(await evidence(page))).toEqual(baseline)
      expect(await originalCanvas!.evaluate((canvas) => canvas.isConnected)).toBe(true)
      if (cycle === 0 && method === 'escape') {
        expect(await trigger.evaluate((element) => element.matches(':focus-visible'))).toBe(true)
        await page.screenshot({ path: path.join(focusArtifactDir, '1280x800-en-escape-restored.png'), fullPage: true })
      }
      await page.keyboard.press('Shift+Tab')
      await expect(page.getByTestId('timeline-open')).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(trigger).toBeFocused()
    }
  }
  expect(errors).toEqual([])
  await context.close()
})

test('Ask commands retain destination focus and Undo without running trigger restoration', async ({ browser }) => {
  for (const mobile of [true, false]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, colorScheme: 'dark', hasTouch: mobile, reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = collectErrors(page)
    await page.goto('/')
    await waitForExperience(page)
    const baseline = reversibleState(await evidence(page))
    for (const command of ['Open analytics categories', 'Open purchase purchase_shuk_01', 'Open purchases', 'Show groceries']) {
      if (mobile) {
        await page.getByRole('button', { name: 'Globe tools', exact: true }).tap()
        await page.getByTestId('ask-open-mobile').tap()
      } else await openDesktopAsk(page)
      await expect(page.getByTestId('ask-input')).toBeFocused()
      await runCommand(page, command)
      await expect(page.getByTestId('ask-panel')).toBeHidden()
      const target = command === 'Open analytics categories'
        ? page.locator('[data-analytics-view="categories"]')
        : command.startsWith('Open purchase purchase_')
          ? page.getByTestId('purchase-detail').getByRole('button', { name: 'Back to history' })
          : command === 'Open purchases'
            ? page.getByTestId('purchases-panel').getByRole('button', { name: 'Close purchase history' })
            : page.getByTestId('ask-undo')
      // Analytics can be taller than the viewport; assert its focus and visible section
      // separately from the fully in-viewport destination controls.
      if (command === 'Open analytics categories') {
        await expect(target).toBeFocused()
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
        await expect(target).toBeFocused()
        await expect(target).toBeVisible()
      } else await expectAvailableFocus(page, target)
      await page.getByTestId('ask-undo').click()
      await expect.poll(async () => reversibleState(await evidence(page))).toEqual(baseline)
      await dismissFeedback(page)
    }
    expect(errors).toEqual([])
    await context.close()
  }
})

test('desktop Ask Spendscape executes only safe typed actions with preview, ambiguity, Undo, and restoration', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
    locale: 'en-GB',
    recordVideo: { dir: path.join(artifactDir, 'video'), size: { width: 1280, height: 800 } },
  })
  const page = await context.newPage()
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForExperience(page)
  const baseline = await evidence(page)
  expect(baseline).toMatchObject({ mapInstanceCount: 1, askOpen: false, askUndoAvailable: false })

  await openDesktopAsk(page)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-ask-open-1280x800.png'), fullPage: true })
  const askPanel = page.getByTestId('ask-panel')
  const closeAsk = askPanel.getByRole('button', { name: 'Close Ask Spendscape' })
  await closeAsk.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(askPanel.getByRole('button', { name: 'Fit visible purchases' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(closeAsk).toBeFocused()
  await page.getByTestId('ask-input').focus()
  await runCommand(page, 'Fly to Shuk Express Bograshov')
  await expect(page.getByTestId('ask-panel')).toBeHidden()
  await expect(page.getByTestId('ask-feedback')).toBeVisible()
  await expect.poll(async () => (await evidence(page)).selectedPlaceId).toBe('place_shuk_bograshov')
  expect((await evidence(page)).mapInstanceCount).toBe(1)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-single-action-applied-1280x800.png'), fullPage: true })
  await page.getByTestId('ask-undo').click()
  await expect.poll(async () => (await evidence(page)).selectedPlaceId).toBe(baseline.selectedPlaceId)
  expect((await evidence(page)).askUndoAvailable).toBe(false)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-single-action-undone-1280x800.png'), fullPage: true })
  await dismissFeedback(page)

  await openDesktopAsk(page)
  const beforePreview = await evidence(page)
  await runCommand(page, 'Show my purchases in Tel Aviv')
  await expect(page.getByTestId('ask-plan-preview')).toBeVisible()
  await expect(page.getByTestId('ask-plan-preview').locator('li')).toHaveCount(2)
  expect(reversibleState(await evidence(page))).toEqual(reversibleState(beforePreview))
  await page.screenshot({ path: path.join(artifactDir, 'desktop-multi-action-preview-1280x800.png'), fullPage: true })
  await page.getByTestId('ask-apply-plan').click()
  await expect.poll(async () => (await evidence(page)).query.search).toBe('Tel Aviv')
  await expect.poll(async () => (await evidence(page)).visiblePinFeatures).toBe(2)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-multi-action-applied-1280x800.png'), fullPage: true })
  await page.getByTestId('ask-undo').click()
  await expect.poll(async () => (await evidence(page)).query.search).toBe(baseline.query.search)
  await dismissFeedback(page)

  await openDesktopAsk(page)
  await runCommand(page, 'Fly to market')
  const ambiguous = page.getByTestId('ask-ambiguous')
  await expect(ambiguous).toBeVisible()
  await expect(ambiguous.getByRole('option')).toHaveCount(2)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-ambiguous-choice-1280x800.png'), fullPage: true })
  await ambiguous.getByRole('option', { name: /Rimon Market/ }).click()
  await expect.poll(async () => (await evidence(page)).selectedPlaceId).toBe('place_rimon_park')
  await page.getByTestId('ask-undo').click()
  await dismissFeedback(page)

  await openDesktopAsk(page)
  const invalidBaseline = await evidence(page)
  await runCommand(page, 'Fly to Atlantis')
  await expect(page.getByTestId('ask-invalid')).toBeVisible()
  expect(await evidence(page)).toMatchObject({
    surface: invalidBaseline.surface,
    selectedPlaceId: invalidBaseline.selectedPlaceId,
    selectedPurchaseId: invalidBaseline.selectedPurchaseId,
    query: invalidBaseline.query,
    camera: invalidBaseline.camera,
  })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('ask-open-desktop')).toBeFocused()

  await openDesktopAsk(page)
  const unsupportedBaseline = await evidence(page)
  await runCommand(page, 'Delete my latest purchase')
  await expect(page.getByTestId('ask-unsupported')).toBeVisible()
  expect(await evidence(page)).toMatchObject({
    surface: unsupportedBaseline.surface,
    selectedPlaceId: unsupportedBaseline.selectedPlaceId,
    selectedPurchaseId: unsupportedBaseline.selectedPurchaseId,
    query: unsupportedBaseline.query,
    camera: unsupportedBaseline.camera,
  })
  await page.screenshot({ path: path.join(artifactDir, 'desktop-unsupported-rejected-1280x800.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('ask-open-desktop')).toBeFocused()

  await openDesktopAsk(page)
  await runCommand(page, 'Open analytics categories')
  await expect(page.getByTestId('analytics-panel')).toBeVisible()
  await expect(page.locator('[data-analytics-view="categories"]')).toBeFocused()
  expect((await evidence(page)).surface).toBe('stats')
  expect((await evidence(page)).mapInstanceCount).toBe(1)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-analytics-action-1280x800.png'), fullPage: true })
  expect(errors).toEqual([])
  await context.close()
})

test('mobile nav order and secondary Ask sheet remain coherent in English, Hebrew, and reduced motion', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    locale: 'en-GB',
    hasTouch: true,
    reducedMotion: 'reduce',
    recordVideo: { dir: path.join(artifactDir, 'video'), size: { width: 390, height: 844 } },
  })
  const page = await context.newPage()
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForExperience(page)

  const mobileNav = page.locator('nav[aria-label="Mobile primary"]')
  await expect(mobileNav.locator(':scope > button')).toHaveCount(4)
  expect(await mobileNav.locator(':scope > button > span').allTextContents()).toEqual(['Globe', 'Capture', 'Purchases', 'Stats'])
  const navBoxes = await mobileNav.locator(':scope > button').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().width))
  expect(Math.max(...navBoxes) - Math.min(...navBoxes)).toBeLessThanOrEqual(1)
  await checkMobileNavOrder(page, false)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-nav-order-390x844.png'), fullPage: true })

  await page.getByRole('button', { name: 'Globe tools' }).click()
  await expect(page.getByTestId('ask-open-mobile')).toBeVisible()
  await page.getByTestId('ask-open-mobile').click()
  await expect(page.getByTestId('ask-panel')).toBeVisible()
  await expect(page.getByTestId('ask-input')).toBeFocused()
  await page.screenshot({ path: path.join(artifactDir, 'mobile-ask-open-390x844.png'), fullPage: true })
  await runCommand(page, 'Reset globe')
  await expect(page.getByTestId('ask-feedback')).toBeVisible()
  const afterReset = await evidence(page)
  expect(afterReset).toMatchObject({ reducedMotion: true, autoSpin: false, mapInstanceCount: 1 })
  await page.getByTestId('ask-undo').click()
  await dismissFeedback(page)

  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(await mobileNav.locator(':scope > button > span').allTextContents()).toEqual(['גלובוס', 'קליטה', 'רכישות', 'נתונים'])
  await checkMobileNavOrder(page, true)
  await page.getByRole('button', { name: 'כלי גלובוס' }).click()
  await page.getByTestId('ask-open-mobile').click()
  await runCommand(page, 'הצג רכישות בתל אביב')
  await expect(page.getByTestId('ask-plan-preview')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'mobile-ask-rtl-plan-390x844.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('ask-panel')).toBeHidden()
  await expect(page.getByRole('button', { name: 'כלי גלובוס' })).toBeFocused()
  expect(errors).toEqual([])
  await context.close()
})

test('runtime-approved action families preserve the full reversible snapshot and canonical graph', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = collectErrors(page)
  const requestOrigins = new Set<string>()
  page.on('request', (request) => requestOrigins.add(new URL(request.url()).origin))
  await page.goto('/')
  await waitForExperience(page)
  const initial = await evidence(page)
  await page.getByRole('button', { name: 'Heatmap', exact: true }).click()
  for (const command of ['Show groceries', 'Show ILS', 'Show physical', 'Timeline 2026-08', 'Search Shuk']) {
    await openDesktopAsk(page)
    await runCommand(page, command)
    await expect(page.getByTestId('ask-feedback')).toBeVisible()
    await dismissFeedback(page)
  }
  await openDesktopAsk(page)
  await runCommand(page, 'Fly to Shuk Express Bograshov')
  await expect.poll(async () => (await evidence(page)).selectedPlaceId).toBe('place_shuk_bograshov')
  await dismissFeedback(page)
  const selected = await evidence(page)
  expect(selected.query).toEqual({ search: 'Shuk', category: 'groceries', currency: 'ILS', channel: 'physical', dateRange: 'all', timelineMonth: '2026-08' })
  expect(selected.mode).toBe('heatmap')

  await openDesktopAsk(page)
  await runCommand(page, 'Show my purchases in London')
  await expect(page.getByTestId('ask-plan-preview')).toBeVisible()
  expect(reversibleState(await evidence(page))).toEqual(reversibleState(selected))
  await page.getByTestId('ask-apply-plan').click()
  await expect.poll(async () => (await evidence(page)).query.search).toBe('London')
  await page.getByTestId('ask-undo').click()
  await expect.poll(async () => reversibleState(await evidence(page))).toEqual(reversibleState(selected))
  await expect.poll(async () => (await evidence(page)).camera?.zoom).toBeCloseTo(selected.camera!.zoom, 5)
  const restoredCamera = (await evidence(page)).camera!
  expect(restoredCamera.center[0]).toBeCloseTo(selected.camera!.center[0], 5)
  expect(restoredCamera.center[1]).toBeCloseTo(selected.camera!.center[1], 5)
  expect(restoredCamera.bearing).toBeCloseTo(selected.camera!.bearing, 5)
  expect(restoredCamera.pitch).toBeCloseTo(selected.camera!.pitch, 5)
  await dismissFeedback(page)

  await openDesktopAsk(page)
  await runCommand(page, 'Clear filters')
  await expect.poll(async () => (await evidence(page)).query).toEqual(initial.query)
  await page.getByTestId('ask-undo').click()
  await expect.poll(async () => reversibleState(await evidence(page))).toEqual(reversibleState(selected))
  await dismissFeedback(page)

  for (const command of ['Open purchases', 'Open purchase purchase_shuk_01', 'Fit visible purchases']) {
    await openDesktopAsk(page)
    await runCommand(page, command)
    if (command === 'Open purchases') await expect(page.getByTestId('purchases-panel')).toBeVisible()
    if (command.startsWith('Open purchase purchase')) await expect(page.getByTestId('purchase-detail')).toBeVisible()
    if (command === 'Fit visible purchases') expect((await evidence(page)).performance.lastCameraAction).toBe('ask-map.fitVisiblePurchases')
    await page.getByTestId('ask-undo').click()
    await expect.poll(async () => reversibleState(await evidence(page))).toEqual(reversibleState(selected))
    await dismissFeedback(page)
  }

  await openDesktopAsk(page)
  await page.goBack()
  await expect(page.getByTestId('ask-panel')).toBeHidden()
  await expect(page.getByTestId('ask-open-desktop')).toBeFocused()
  expect(reversibleState(await evidence(page))).toEqual(reversibleState(selected))
  expect((await evidence(page)).autoSpin).toBe(false)
  expect((await evidence(page)).canonicalPins).toBe(initial.canonicalPins)
  expect((await evidence(page)).combinedPurchaseCount).toBe(initial.combinedPurchaseCount)
  expect([...requestOrigins].filter((origin) => !['http://127.0.0.1:3000', 'https://tiles.openfreemap.org'].includes(origin))).toEqual([])
  expect(errors).toEqual([])
  await context.close()
})

test('Ask remains bounded during map failure and recovers without remounting product state', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' })
  const page = await context.newPage()
  const errors = collectErrors(page)
  await page.goto('/?mapFailure=1')
  await expect(page.getByTestId('map-failure')).toBeVisible({ timeout: 10_000 })
  await openDesktopAsk(page)
  await runCommand(page, 'Fly to Tel Aviv')
  await expect(page.getByTestId('ask-feedback')).toContainText('map is unavailable')
  expect(await page.evaluate(() => ({
    hash: window.location.hash,
    askOpen: Boolean((window.history.state as { askOpen?: boolean } | null)?.askOpen),
  }))).toEqual({ hash: '#globe', askOpen: false })
  await page.screenshot({ path: path.join(artifactDir, 'desktop-ask-map-failure-1280x800.png'), fullPage: true })
  await page.getByTestId('map-failure').getByRole('button', { name: 'Retry map' }).click()
  await waitForExperience(page)
  await dismissFeedback(page)
  await openDesktopAsk(page)
  await runCommand(page, 'Fly to Tel Aviv')
  await expect.poll(async () => (await evidence(page)).performance.lastCameraAction).toContain('ask-map.flyToRegion')
  expect((await evidence(page)).mapInstanceCount).toBe(1)
  expect(errors).toEqual([])
  await context.close()
})

test('Ask sheet avoids overflow at the bounded narrow and large mobile viewports', async ({ browser }) => {
  for (const viewport of [{ width: 360, height: 640 }, { width: 430, height: 932 }]) {
    const context = await browser.newContext({ viewport, colorScheme: 'dark', locale: 'en-GB', hasTouch: true })
    const page = await context.newPage()
    await page.goto('/')
    await waitForExperience(page)
    await page.getByRole('button', { name: 'Globe tools' }).click()
    await page.getByTestId('ask-open-mobile').click()
    await expect(page.getByTestId('ask-panel')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: path.join(artifactDir, `mobile-ask-open-${viewport.width}x${viewport.height}.png`), fullPage: true })
    await context.close()
  }
})

test('large desktop keeps Ask secondary to the globe without covering accepted controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'en-GB' })
  const page = await context.newPage()
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForExperience(page)
  await openDesktopAsk(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const panel = await page.getByTestId('ask-panel').boundingBox()
  const globeControls = await page.getByTestId('globe-tools').boundingBox()
  expect(panel).not.toBeNull()
  expect(globeControls).not.toBeNull()
  expect(panel!.y + panel!.height).toBeLessThan(globeControls!.y)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-ask-open-1440x900.png'), fullPage: true })
  expect(errors).toEqual([])
  await context.close()
})
