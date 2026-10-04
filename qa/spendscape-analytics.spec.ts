import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-slice-1d2')

interface AnalyticsEvidence {
  ready: boolean
  locale: 'en' | 'he'
  reducedMotion: boolean
  surface: 'globe' | 'purchases' | 'stats'
  selectedPlaceId: string | null
  visiblePurchaseCount: number
  visibleBaseTotalIls: number
  sourceDatasetFeatures: number
  camera: {
    center: [number, number]
    zoom: number
    bearing: number
    pitch: number
  } | null
  query: {
    search: string
    category: string
    currency: string
    channel: string
    dateRange: string
    timelineMonth: string | null
  }
  analytics: {
    purchaseCount: number
    totalBaseAmountIls: number
    averageBaseAmountIls: number
    physicalCount: number
    onlineCount: number
    unresolvedCount: number
    monthCount: number
    topPhysicalPlaceId: string | null
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
    const value = (window as typeof window & { __SPENDSCAPE_QA__?: AnalyticsEvidence }).__SPENDSCAPE_QA__
    return value?.ready === true
  }, undefined, { timeout: 20_000 })
  await page.waitForTimeout(350)
}

async function evidence(page: Page): Promise<AnalyticsEvidence> {
  return page.evaluate(() => {
    const value = (window as typeof window & { __SPENDSCAPE_QA__?: AnalyticsEvidence }).__SPENDSCAPE_QA__
    if (!value) throw new Error('Spendscape analytics evidence is unavailable')
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

test.beforeAll(async () => {
  await mkdir(artifactDir, { recursive: true })
})

test('desktop Analytics stays deterministic and synchronized with Globe, Purchases, filters, and Timeline', async ({ browser }) => {
  const context = await createContext(browser, { width: 1440, height: 900 }, { recordVideo: true })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForExperience(page)
  const startingCamera = (await evidence(page)).camera
  await page.locator('nav[aria-label="Primary"]').getByRole('button', { name: 'Analytics' }).click()
  await expect(page.getByTestId('analytics-panel')).toBeVisible()
  await expect.poll(async () => (await evidence(page)).surface).toBe('stats')

  const baseline = await evidence(page)
  expect(baseline.analytics).toEqual({
    purchaseCount: 42,
    totalBaseAmountIls: 6777.38,
    averageBaseAmountIls: 161.37,
    physicalCount: 39,
    onlineCount: 2,
    unresolvedCount: 1,
    monthCount: 9,
    topPhysicalPlaceId: 'place_shuk_bograshov',
  })
  await expect(page.getByTestId('analytics-total')).toContainText('6,777.38')
  await expect(page.getByTestId('analytics-count')).toHaveText('42')
  await expect(page.getByTestId('analytics-average')).toContainText('161.37')
  await expect(page.getByTestId('analytics-channel-physical')).toContainText('39')
  await expect(page.getByTestId('analytics-channel-online')).toContainText('2')
  await expect(page.getByTestId('analytics-channel-unresolved')).toContainText('1')
  await expect(page.getByTestId('analytics-place-place_shuk_bograshov')).toContainText('14 purchases')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.waitForTimeout(280)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-analytics-overview.png'), fullPage: true })
  await page.getByRole('heading', { name: 'Top physical places' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-analytics-places.png'), fullPage: true })
  await page.getByRole('heading', { name: 'Currency and source provenance' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-analytics-provenance.png'), fullPage: true })

  await page.getByTestId('analytics-category-retail').click()
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(8)
  expect((await evidence(page)).sourceDatasetFeatures).toBe(3)
  await expect(page.getByTestId('analytics-category-retail')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('analytics-view-purchases').click()
  await expect(page.getByTestId('purchases-panel')).toBeVisible()
  await expect(page.getByTestId('derived-summary')).toContainText('8')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-analytics-to-purchases.png'), fullPage: true })

  await page.locator('nav[aria-label="Primary"]').getByRole('button', { name: 'Analytics' }).click()
  const surfaceSwitchCamera = (await evidence(page)).camera
  expect(surfaceSwitchCamera).not.toBeNull()
  expect(startingCamera).not.toBeNull()
  expect(Math.abs(surfaceSwitchCamera!.zoom - startingCamera!.zoom)).toBeLessThan(0.25)
  await expect(page.getByTestId('analytics-category-retail')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('analytics-reset').click()
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(42)

  await page.getByTestId('analytics-filters').click()
  await page.getByTestId('currency-filter').selectOption('EUR')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(5)
  expect((await evidence(page)).sourceDatasetFeatures).toBe(2)
  await page.getByTestId('filters-sheet').getByRole('button', { name: 'Close filters' }).click()
  await expect(page.getByTestId('analytics-currency-EUR')).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-analytics-eur-filter.png'), fullPage: true })
  await page.getByTestId('analytics-reset').click()

  await page.getByTestId('analytics-month-2026-08').click()
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(10)
  expect((await evidence(page)).query.timelineMonth).toBe('2026-08')
  expect((await evidence(page)).sourceDatasetFeatures).toBe(3)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-analytics-august.png'), fullPage: true })
  await page.reload()
  await waitForExperience(page)
  expect((await evidence(page)).surface).toBe('stats')
  expect((await evidence(page)).query.timelineMonth).toBe('2026-08')
  await expect(page.getByTestId('analytics-month-2026-08')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'All months' }).click()
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(42)

  await page.getByTestId('analytics-search').fill('Tokyo')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(2)
  expect((await evidence(page)).analytics.topPhysicalPlaceId).toBe('place_kumo_shibuya')
  await page.getByTestId('analytics-place-place_kumo_shibuya').click()
  await expect(page.getByTestId('place-panel')).toContainText('Kumo Objects')
  await expect.poll(async () => (await evidence(page)).selectedPlaceId).toBe('place_kumo_shibuya')
  await page.goBack()
  await expect(page.getByTestId('analytics-panel')).toBeVisible()
  expect((await evidence(page)).query.search).toBe('Tokyo')

  await page.getByTestId('analytics-search').fill('no-synthetic-result')
  await expect(page.getByTestId('analytics-empty')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-analytics-empty.png'), fullPage: true })
  await page.getByTestId('analytics-empty').getByRole('button', { name: 'Reset shared view' }).click()
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(42)

  const groceries = page.getByTestId('analytics-category-groceries')
  await groceries.focus()
  await expect(groceries).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(groceries).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await evidence(page)).surface).toBe('globe')
  const endingCamera = (await evidence(page)).camera
  expect(endingCamera).not.toBeNull()
  expect(errors).toEqual([])

  await writeFile(path.join(artifactDir, 'desktop-analytics-evidence.json'), JSON.stringify({
    baseline,
    final: await evidence(page),
    cameraContinuity: { startingCamera, surfaceSwitchCamera, endingCamera },
  }, null, 2))
  await saveVideo(context, page, 'desktop-globe-analytics-purchases-sync.webm')
})

test('mobile Stats supports RTL, touch-sized controls, narrow layouts, and reduced motion', async ({ browser }) => {
  const context = await createContext(browser, { width: 390, height: 844 }, { recordVideo: true, hasTouch: true })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForExperience(page)
  await page.locator('nav[aria-label="Mobile primary"]').getByRole('button', { name: 'Stats' }).click()
  await expect(page.getByTestId('analytics-panel')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const tapTargets = await page.locator('[data-testid="analytics-panel"] button').evaluateAll((buttons) =>
    buttons.slice(0, 12).map((button) => {
      const rect = button.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }),
  )
  expect(tapTargets.every((target) => target.height >= 38 && target.width >= 38)).toBe(true)
  await page.waitForTimeout(280)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-stats-overview.png'), fullPage: true })

  await page.getByTestId('analytics-filters').click()
  await page.getByTestId('channel-filter').selectOption('online')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(2)
  await page.getByTestId('filters-sheet').getByRole('button', { name: 'Close filters' }).click()
  await expect(page.getByTestId('analytics-channel-online')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('analytics-reset').click()

  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect.poll(async () => (await evidence(page)).locale).toBe('he')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByTestId('analytics-panel')).toContainText('ההוצאות, כשהעולם עדיין מולך')
  await page.screenshot({ path: path.join(artifactDir, 'mobile-stats-rtl.png'), fullPage: true })
  await page.getByRole('heading', { name: 'מקור מטבע וראיות' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(artifactDir, 'mobile-stats-rtl-provenance.png'), fullPage: true })

  await page.getByTestId('analytics-category-retail').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('analytics-category-retail')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect.poll(async () => (await evidence(page)).surface).toBe('globe')
  expect(errors).toEqual([])
  await saveVideo(context, page, 'mobile-stats-rtl-sync.webm')

  const narrowContext = await createContext(browser, { width: 360, height: 640 })
  const narrowPage = await narrowContext.newPage()
  await narrowPage.goto('/')
  await waitForExperience(narrowPage)
  await narrowPage.locator('nav[aria-label="Mobile primary"]').getByRole('button', { name: 'Stats' }).click()
  expect(await narrowPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await narrowPage.waitForTimeout(280)
  await narrowPage.screenshot({ path: path.join(artifactDir, 'mobile-stats-360x640.png'), fullPage: true })
  await narrowContext.close()

  const motionContext = await createContext(browser, { width: 1440, height: 900 }, { reducedMotion: 'reduce' })
  const motionPage = await motionContext.newPage()
  await motionPage.goto('/')
  await waitForExperience(motionPage)
  await motionPage.locator('nav[aria-label="Primary"]').getByRole('button', { name: 'Analytics' }).click()
  expect((await evidence(motionPage)).reducedMotion).toBe(true)
  await expect(motionPage.getByTestId('analytics-panel')).toBeVisible()
  expect(await motionPage.getByTestId('analytics-panel').evaluate((panel) => getComputedStyle(panel).animationName)).toBe('none')
  await motionPage.screenshot({ path: path.join(artifactDir, 'desktop-analytics-reduced-motion.png'), fullPage: true })
  await motionContext.close()
})
