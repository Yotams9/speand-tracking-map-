import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-slice-1d3')

interface CaptureEvidence {
  ready: boolean
  locale: 'en' | 'he'
  reducedMotion: boolean
  surface: 'globe' | 'purchases' | 'stats'
  selectedPlaceId: string | null
  selectedPurchaseId: string | null
  captureOpen: boolean
  captureStep: string | null
  sessionPurchaseCount: number
  combinedPurchaseCount: number
  mapInstanceCount: number
  visiblePurchaseCount: number
  visiblePinFeatures: number
  sourceDatasetFeatures: number
  sourceUpdates: number
  camera: {
    center: [number, number]
    zoom: number
    bearing: number
    pitch: number
  } | null
  analytics: {
    purchaseCount: number
    totalBaseAmountIls: number
    physicalCount: number
    onlineCount: number
    unresolvedCount: number
  }
}

async function createContext(
  browser: Browser,
  viewport: { width: number; height: number },
  options: { recordVideo?: boolean; reducedMotion?: 'reduce' | 'no-preference'; hasTouch?: boolean } = {},
) {
  return browser.newContext({
    viewport,
    colorScheme: 'dark',
    locale: 'en-GB',
    reducedMotion: options.reducedMotion ?? 'no-preference',
    hasTouch: options.hasTouch ?? false,
    recordVideo: options.recordVideo ? { dir: artifactDir, size: viewport } : undefined,
  })
}

async function waitForExperience(page: Page) {
  await page.waitForFunction(() => {
    const value = (window as typeof window & { __SPENDSCAPE_QA__?: CaptureEvidence }).__SPENDSCAPE_QA__
    return value?.ready === true
  }, undefined, { timeout: 20_000 })
  await page.waitForTimeout(350)
}

async function evidence(page: Page): Promise<CaptureEvidence> {
  return page.evaluate(() => {
    const value = (window as typeof window & { __SPENDSCAPE_QA__?: CaptureEvidence }).__SPENDSCAPE_QA__
    if (!value) throw new Error('Spendscape Capture evidence is unavailable')
    return structuredClone(value)
  })
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function saveVideo(context: BrowserContext, page: Page, filename: string) {
  const video = page.video()
  await page.close()
  await context.close()
  if (!video) throw new Error(`Playwright did not attach ${filename}`)
  await video.saveAs(path.join(artifactDir, filename))
  await video.delete()
}

async function openSources(page: Page, mobile = false) {
  await page.getByTestId(mobile ? 'capture-open-mobile' : 'capture-open-desktop').click()
  await expect(page.getByTestId('capture-scanner')).toBeVisible()
  await page.getByTestId('capture-sources-open').click()
  await expect(page.getByTestId('capture-sources')).toBeVisible()
}

async function hideDevelopmentChrome(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
}

async function collapseMapAttribution(page: Page) {
  const attribution = page.locator('.maplibregl-ctrl-attrib')
  if (await attribution.count() === 0) return
  const box = await attribution.boundingBox()
  if (box && box.width > 40) {
    await attribution.locator('.maplibregl-ctrl-attrib-button').click()
    await page.mouse.click(20, 200)
  }
}

async function mobileNavMetrics(page: Page) {
  return page.locator('nav[aria-label="Mobile primary"]').evaluate((nav) => {
    const buttons = [...nav.querySelectorAll('button')]
    const captureButton = nav.querySelector('[data-testid="capture-open-mobile"]') as HTMLElement
    const icons = [...nav.querySelectorAll('i')]
    const captureIcon = captureButton.querySelector('i') as HTMLElement
    const navRect = nav.getBoundingClientRect()
    const buttonRects = buttons.map((button) => button.getBoundingClientRect())
    const iconRects = icons.map((icon) => icon.getBoundingClientRect())
    const captureStyle = getComputedStyle(captureIcon)
    return {
      height: navRect.height,
      widths: buttonRects.map((rect) => rect.width),
      heights: buttonRects.map((rect) => rect.height),
      icons: iconRects.map((rect) => ({ width: rect.width, height: rect.height })),
      captureOffset: getComputedStyle(captureButton).marginBlockStart,
      captureIcon: {
        background: captureStyle.backgroundImage,
        borderWidth: captureStyle.borderWidth,
        borderRadius: captureStyle.borderRadius,
      },
      gap: getComputedStyle(captureButton).gap,
    }
  })
}

async function chooseAndReview(page: Page, source: string) {
  await page.getByTestId(`capture-source-${source}`).click()
  await expect(page.getByTestId('capture-processing')).toBeVisible()
  await expect(page.getByTestId('capture-review')).toBeVisible({ timeout: 5_000 })
}

test.beforeAll(async () => {
  await mkdir(artifactDir, { recursive: true })
})

test('desktop Capture preserves the globe, confirms physical and online demos, and synchronizes derived surfaces', async ({ browser }) => {
  const context = await createContext(browser, { width: 1440, height: 900 }, { recordVideo: true })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForExperience(page)
  const initial = await evidence(page)
  expect(initial).toMatchObject({
    combinedPurchaseCount: 42,
    sessionPurchaseCount: 0,
    visiblePinFeatures: 12,
    mapInstanceCount: 1,
  })
  await page.screenshot({ path: path.join(artifactDir, 'desktop-globe-add-purchase-1440x900.png'), fullPage: true })

  const addButton = page.getByTestId('capture-open-desktop')
  await addButton.focus()
  await addButton.click()
  await expect(page.getByTestId('capture-scanner')).toBeVisible()
  const cameraAtOpen = (await evidence(page)).camera
  expect((await evidence(page)).mapInstanceCount).toBe(1)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-scanner-opening-1440x900.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('capture-dialog')).toBeHidden()
  await expect(addButton).toBeFocused()
  const afterEscape = await evidence(page)
  expect(afterEscape.mapInstanceCount).toBe(1)
  expect(afterEscape.camera).toEqual(cameraAtOpen)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-returned-globe-unchanged-1440x900.png'), fullPage: true })

  await openSources(page)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-source-chooser-1440x900.png'), fullPage: true })
  await page.getByTestId('capture-source-receipt').click()
  await expect(page.getByTestId('capture-processing')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-receipt-processing-1440x900.png'), fullPage: true })
  await expect(page.getByTestId('capture-review')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('capture-review')).toContainText('Olive sourdough')
  await expect(page.getByTestId('capture-review')).toContainText('86.90')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-receipt-review-1440x900.png'), fullPage: true })
  await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  await expect.poll(async () => (await evidence(page)).sessionPurchaseCount).toBe(1)
  const physicalEvidence = await evidence(page)
  expect(physicalEvidence).toMatchObject({
    combinedPurchaseCount: 43,
    visiblePurchaseCount: 43,
    visiblePinFeatures: 12,
    sourceDatasetFeatures: 12,
    mapInstanceCount: 1,
  })
  await page.screenshot({ path: path.join(artifactDir, 'desktop-physical-success-1440x900.png'), fullPage: true })
  await page.getByRole('button', { name: 'Show on globe' }).click()
  await expect(page.getByTestId('capture-dialog')).toBeHidden()
  await expect(page.getByTestId('place-panel')).toContainText('15')
  await expect.poll(async () => (await evidence(page)).selectedPlaceId).toBe('place_shuk_bograshov')
  expect((await evidence(page)).mapInstanceCount).toBe(1)

  await page.getByRole('button', { name: 'Purchases', exact: true }).first().click()
  await expect(page.getByTestId('purchase-session_purchase_receipt_01')).toBeVisible()
  await expect(page.getByTestId('derived-summary')).toContainText('43')
  await page.getByRole('button', { name: 'Analytics', exact: true }).click()
  await expect(page.getByTestId('analytics-count')).toHaveText('43')
  expect((await evidence(page)).analytics.physicalCount).toBe(40)

  await openSources(page)
  await chooseAndReview(page, 'pdf')
  await expect(page.getByTestId('capture-review')).toContainText('Online purchase')
  await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  await expect.poll(async () => (await evidence(page)).sessionPurchaseCount).toBe(2)
  const onlineEvidence = await evidence(page)
  expect(onlineEvidence.combinedPurchaseCount).toBe(44)
  expect(onlineEvidence.visiblePinFeatures).toBe(12)
  expect(onlineEvidence.sourceDatasetFeatures).toBe(12)
  expect(onlineEvidence.analytics.onlineCount).toBe(3)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-online-success-zero-pin-1440x900.png'), fullPage: true })
  await page.getByTestId('capture-view-purchase').click()
  await expect(page.getByTestId('purchase-detail')).toContainText('€75.00')
  await expect(page.getByTestId('purchase-detail')).toContainText('Online · no map pin')
  expect((await evidence(page)).selectedPlaceId).toBeNull()

  await page.reload()
  await waitForExperience(page)
  const reloaded = await evidence(page)
  expect(reloaded.sessionPurchaseCount).toBe(0)
  expect(reloaded.combinedPurchaseCount).toBe(42)
  expect(reloaded.captureOpen).toBe(false)
  expect(reloaded.selectedPurchaseId).toBeNull()

  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await page.getByTestId('capture-open-desktop').click()
  await expect(page.getByTestId('capture-scanner')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-capture-rtl-1440x900.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'מעבר לאנגלית' }).click()

  await openSources(page)
  await page.getByTestId('capture-source-manual').click()
  await expect(page.getByTestId('capture-manual')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-manual-cash-1440x900.png'), fullPage: true })
  await page.getByTestId('capture-dialog').getByRole('button', { name: 'Close Capture' }).click()
  await openSources(page)
  await page.getByTestId('capture-source-failure').click()
  await expect(page.getByTestId('capture-failure')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-simulated-failure-1440x900.png'), fullPage: true })
  await page.getByTestId('capture-dialog').getByRole('button', { name: 'Close Capture' }).click()
  expect(errors).toEqual([])

  await writeFile(path.join(artifactDir, 'desktop-capture-evidence.json'), JSON.stringify({ initial, afterEscape, physicalEvidence, onlineEvidence, reloaded }, null, 2))
  await saveVideo(context, page, 'desktop-capture-physical-online.webm')
})

test('Capture browser history, barcode boundary, Gmail explanation, manual validation, failure retry, and unresolved zero-pin behavior work', async ({ browser }) => {
  const context = await createContext(browser, { width: 360, height: 640 }, { hasTouch: true })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForExperience(page)
  await page.getByTestId('capture-open-mobile').click()
  await expect(page.getByTestId('capture-scanner')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'mobile-small-scanner-360x640.png'), fullPage: true })
  await page.getByTestId('capture-sources-open').click()
  await expect(page.getByTestId('capture-sources')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'mobile-small-sources-360x640.png'), fullPage: true })
  await page.getByTestId('capture-source-gmail').click()
  await expect(page.getByTestId('capture-gmail')).toContainText('No email is accessed')
  await page.goBack()
  await expect(page.getByTestId('capture-sources')).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId('capture-scanner')).toBeVisible()
  await page.goBack()
  await expect(page.getByTestId('capture-dialog')).toBeHidden()

  await openSources(page, true)
  await chooseAndReview(page, 'barcode')
  await expect(page.getByTestId('product-proof-boundary')).toContainText('not proof')
  await expect(page.getByTestId('capture-confirm')).toBeDisabled()
  await page.getByTestId('product-place').selectOption('place_shuk_bograshov')
  await page.getByTestId('product-amount').fill('12.9')
  await expect(page.getByTestId('capture-confirm')).toBeEnabled()
  await expect(page.getByTestId('capture-review')).toContainText('No image or photo value is retained')
  await page.getByTestId('capture-dialog').getByRole('button', { name: 'Close Capture' }).click()

  await openSources(page, true)
  await page.getByTestId('capture-source-manual').click()
  await expect(page.getByTestId('capture-manual')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'mobile-small-manual-360x640.png'), fullPage: true })
  await page.getByTestId('manual-channel').selectOption('unknown')
  await page.getByTestId('manual-amount').fill('0')
  await page.getByTestId('manual-review').click()
  await expect(page.locator('#manual-amount-error')).toContainText('positive amount')
  await page.getByTestId('manual-amount').fill('41')
  await page.getByTestId('manual-review').click()
  await expect(page.getByTestId('capture-review')).toContainText('no map pin')
  await page.getByTestId('capture-confirm').click()
  await expect.poll(async () => (await evidence(page)).sessionPurchaseCount).toBe(1)
  expect((await evidence(page)).visiblePinFeatures).toBe(12)
  expect((await evidence(page)).analytics.unresolvedCount).toBe(2)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-small-unresolved-success-360x640.png'), fullPage: true })
  await page.getByRole('button', { name: 'Done' }).click()

  await openSources(page, true)
  await page.getByTestId('capture-source-failure').click()
  await expect(page.getByTestId('capture-failure')).toHaveAttribute('role', 'alert')
  await page.screenshot({ path: path.join(artifactDir, 'mobile-small-failure-360x640.png'), fullPage: true })
  await page.getByTestId('capture-retry').click()
  await expect(page.getByTestId('capture-processing')).toBeVisible()
  await expect(page.getByTestId('capture-review')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('capture-review')).toContainText('Shuk Express')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
  await context.close()
})

test('mobile primary story is touch-safe at 390x844 and keeps one MapLibre instance', async ({ browser }) => {
  const context = await createContext(browser, { width: 390, height: 844 }, { recordVideo: true, hasTouch: true })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForExperience(page)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-capture-entry-390x844.png'), fullPage: true })
  const captureButtonBox = await page.getByTestId('capture-open-mobile').boundingBox()
  expect(captureButtonBox?.height).toBeGreaterThanOrEqual(48)
  await page.getByTestId('capture-open-mobile').click()
  await expect(page.getByTestId('capture-scanner')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'mobile-scanner-opening-390x844.png'), fullPage: true })
  await page.getByTestId('capture-scan').click()
  await expect(page.getByTestId('capture-review')).toBeVisible({ timeout: 5_000 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-receipt-review-390x844.png'), fullPage: true })
  await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'mobile-receipt-success-390x844.png'), fullPage: true })
  expect((await evidence(page)).mapInstanceCount).toBe(1)
  await page.getByTestId('capture-view-purchase').click()
  await expect(page.getByTestId('purchase-detail')).toContainText('Olive sourdough')
  expect((await evidence(page)).mapInstanceCount).toBe(1)

  await page.keyboard.press('Escape')
  const cameraBeforeProduct = (await evidence(page)).camera
  await openSources(page, true)
  await chooseAndReview(page, 'barcode')
  await page.screenshot({ path: path.join(artifactDir, 'mobile-barcode-context-390x844.png'), fullPage: true })
  await page.getByTestId('capture-dialog').getByRole('button', { name: 'Close Capture' }).click()
  expect((await evidence(page)).camera).toEqual(cameraBeforeProduct)
  await openSources(page, true)
  await chooseAndReview(page, 'pdf')
  await page.screenshot({ path: path.join(artifactDir, 'mobile-online-pdf-review-390x844.png'), fullPage: true })
  await page.getByTestId('capture-dialog').getByRole('button', { name: 'Close Capture' }).click()
  expect(errors).toEqual([])
  await saveVideo(context, page, 'mobile-capture-receipt-390x844.webm')
})

test('large-phone Hebrew RTL and reduced motion keep Capture readable and still', async ({ browser }) => {
  const context = await createContext(browser, { width: 430, height: 932 }, { hasTouch: true, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForExperience(page)
  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByTestId('capture-open-mobile').click()
  await expect(page.getByTestId('capture-dialog')).toContainText('אין גישה למצלמה')
  await expect(page.getByTestId('capture-layer')).toHaveAttribute('data-reduced-motion', 'true')
  const scanAnimation = await page.locator('[class*="scanLine"]').evaluate((element) => getComputedStyle(element).animationName)
  expect(scanAnimation).toBe('none')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-large-capture-rtl-reduced-430x932.png'), fullPage: true })
  await page.getByTestId('capture-scan').click()
  await expect(page.getByTestId('capture-review')).toBeVisible({ timeout: 5_000 })
  await page.screenshot({ path: path.join(artifactDir, 'mobile-large-review-rtl-430x932.png'), fullPage: true })
  await page.getByTestId('capture-dialog').getByRole('button', { name: 'סגירת Capture' }).click()
  await page.getByTestId('capture-open-mobile').click()
  await expect(page.getByTestId('capture-scanner')).toBeVisible()
  await page.getByTestId('capture-sources-open').click()
  await page.getByTestId('capture-source-manual').click()
  await expect(page.getByTestId('capture-manual')).toContainText('הוספה מהירה')
  await page.screenshot({ path: path.join(artifactDir, 'mobile-large-manual-rtl-430x932.png'), fullPage: true })
  expect(errors).toEqual([])
  await context.close()
})

test('mobile bottom navigation is balanced, touch-safe, safe-area aware, and clear of product surfaces', async ({ browser }) => {
  const context = await createContext(browser, { width: 390, height: 844 }, { hasTouch: true })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForExperience(page)
  await hideDevelopmentChrome(page)
  await collapseMapAttribution(page)

  const metrics = await mobileNavMetrics(page)
  expect(metrics.height).toBe(86)
  expect(metrics.icons).toEqual(Array(4).fill({ width: 24, height: 24 }))
  expect(metrics.captureOffset).toBe('0px')
  expect(metrics.captureIcon).toEqual({ background: 'none', borderWidth: '0px', borderRadius: '0px' })
  expect(metrics.gap).toBe('6px')
  expect(metrics.heights.every((height) => height >= 64)).toBe(true)
  expect(Math.max(...metrics.widths) - Math.min(...metrics.widths)).toBeLessThanOrEqual(1)
  await expect(page.locator('nav[aria-label="Mobile primary"] button[aria-current="page"]')).toHaveCount(1)
  await expect(page.getByTestId('capture-open-mobile')).toHaveAttribute('aria-pressed', 'false')
  const mapActionGap = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Mobile primary"]')!.getBoundingClientRect()
    const actions = document.querySelector('[aria-label="Primary globe actions"]')!.getBoundingClientRect()
    return Math.round(nav.top - actions.bottom)
  })
  expect(mapActionGap).toBeGreaterThanOrEqual(12)
  expect(mapActionGap).toBeLessThanOrEqual(16)
  const mapControlsClear = await page.evaluate(() => {
    const navTop = document.querySelector('nav[aria-label="Mobile primary"]')!.getBoundingClientRect().top
    return [...document.querySelectorAll('.maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right')]
      .map((control) => control.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .every((rect) => rect.bottom <= navTop - 12)
  })
  expect(mapControlsClear).toBe(true)
  expect(await page.locator('.maplibregl-ctrl-attrib').boundingBox()).toMatchObject({ width: 24, height: 24 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-globe-390x844.png'), fullPage: true })
  await page.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-globe-controls-390x844.png'), fullPage: true })

  const mobileNav = page.locator('nav[aria-label="Mobile primary"]')
  await mobileNav.getByRole('button', { name: 'Purchases' }).click()
  await expect(page.getByTestId('purchases-panel')).toBeVisible()
  await page.waitForTimeout(320)
  const purchasesClear = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Mobile primary"]')!.getBoundingClientRect()
    const panel = document.querySelector('[data-testid="purchases-panel"]')!.getBoundingClientRect()
    return panel.bottom <= nav.top + 1
  })
  expect(purchasesClear).toBe(true)
  await page.locator('[class*="purchaseList"]').evaluate((list) => { list.scrollTop = list.scrollHeight })
  await page.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-purchases-bottom-390x844.png'), fullPage: true })

  await mobileNav.getByRole('button', { name: 'Stats' }).click()
  await expect(page.getByTestId('analytics-panel')).toBeVisible()
  await page.waitForTimeout(320)
  const statsClear = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Mobile primary"]')!.getBoundingClientRect()
    const panel = document.querySelector('[data-testid="analytics-panel"]')!.getBoundingClientRect()
    return panel.bottom <= nav.top + 1
  })
  expect(statsClear).toBe(true)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-stats-390x844.png'), fullPage: true })

  await mobileNav.getByRole('button', { name: 'Globe' }).click()
  await page.locator('[aria-label="Primary globe actions"] button').first().click()
  await expect(page.getByTestId('place-panel')).toBeVisible()
  await page.waitForTimeout(320)
  const placeClear = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Mobile primary"]')!.getBoundingClientRect()
    const panel = document.querySelector('[data-testid="place-panel"]')!.getBoundingClientRect()
    return panel.bottom < nav.top
  })
  expect(placeClear).toBe(true)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-selected-place-390x844.png'), fullPage: true })
  await page.keyboard.press('Escape')

  await page.getByTestId('capture-open-mobile').click()
  await expect(page.getByTestId('capture-scanner')).toBeVisible()
  await expect(page.getByTestId('capture-open-mobile')).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(320)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-capture-open-390x844.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('capture-open-mobile')).toBeFocused()
  await expect(page.getByTestId('capture-open-mobile')).toHaveAttribute('aria-pressed', 'false')
  await page.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-capture-closed-390x844.png'), fullPage: true })

  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(Math.max(...(await mobileNavMetrics(page)).widths) - Math.min(...(await mobileNavMetrics(page)).widths)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-rtl-390x844.png'), fullPage: true })
  expect(errors).toEqual([])
  await context.close()

  const smallContext = await createContext(browser, { width: 360, height: 640 }, { hasTouch: true })
  const smallPage = await smallContext.newPage()
  const smallErrors = collectErrors(smallPage)
  await smallPage.goto('/')
  await waitForExperience(smallPage)
  await hideDevelopmentChrome(smallPage)
  await collapseMapAttribution(smallPage)
  expect((await mobileNavMetrics(smallPage)).height).toBe(86)
  expect(await smallPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await smallPage.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-globe-360x640.png'), fullPage: true })
  expect(smallErrors).toEqual([])
  await smallContext.close()

  const largeContext = await createContext(browser, { width: 430, height: 932 }, { hasTouch: true, reducedMotion: 'reduce' })
  const largePage = await largeContext.newPage()
  const largeErrors = collectErrors(largePage)
  await largePage.goto('/')
  await waitForExperience(largePage)
  await hideDevelopmentChrome(largePage)
  await collapseMapAttribution(largePage)
  expect((await mobileNavMetrics(largePage)).height).toBe(86)
  expect((await evidence(largePage)).reducedMotion).toBe(true)
  expect(await largePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await largePage.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-globe-reduced-430x932.png'), fullPage: true })
  expect(largeErrors).toEqual([])
  await largeContext.close()

  const safeAreaContext = await createContext(browser, { width: 390, height: 844 }, { hasTouch: true })
  const safeAreaPage = await safeAreaContext.newPage()
  const safeAreaErrors = collectErrors(safeAreaPage)
  await safeAreaPage.goto('/')
  await waitForExperience(safeAreaPage)
  await hideDevelopmentChrome(safeAreaPage)
  await collapseMapAttribution(safeAreaPage)
  await safeAreaPage.addStyleTag({ content: ':root { --safe-bottom: 24px !important; }' })
  expect((await mobileNavMetrics(safeAreaPage)).height).toBe(110)
  expect(await safeAreaPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await safeAreaPage.screenshot({ path: path.join(artifactDir, 'mobile-nav-uniform-safe-area-24px-390x844.png'), fullPage: true })
  expect(safeAreaErrors).toEqual([])
  await safeAreaContext.close()
})
