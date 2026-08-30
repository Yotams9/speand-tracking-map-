import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-slice-1d1')

interface ExperienceEvidence {
  ready: boolean
  locale: 'en' | 'he'
  reducedMotion: boolean
  surface: 'globe' | 'purchases' | 'stats'
  selectedPlaceId: string | null
  selectedPurchaseId: string | null
  visiblePurchaseCount: number
  visibleBaseTotalIls: number
  sourceDatasetFeatures: number
  renderedSelectionHalos: number
  query: {
    search: string
    category: string
    currency: string
    channel: string
    dateRange: string
    timelineMonth: string | null
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
    const evidence = (window as typeof window & { __SPENDSCAPE_QA__?: ExperienceEvidence }).__SPENDSCAPE_QA__
    return evidence?.ready === true
  }, undefined, { timeout: 20_000 })
  await page.waitForTimeout(400)
}

async function evidence(page: Page): Promise<ExperienceEvidence> {
  return page.evaluate(() => {
    const value = (window as typeof window & { __SPENDSCAPE_QA__?: ExperienceEvidence }).__SPENDSCAPE_QA__
    if (!value) throw new Error('Spendscape experience evidence is unavailable')
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

test('desktop history, search, filters, timeline, selection, back, escape, and reload stay synchronized', async ({ browser }) => {
  const context = await createContext(browser, { width: 1440, height: 900 }, { recordVideo: true })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForExperience(page)
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(42)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-globe.png'), fullPage: true })

  await page.getByRole('button', { name: 'Purchases', exact: true }).first().click()
  await expect(page.getByTestId('purchases-panel')).toBeVisible()
  await expect.poll(async () => (await evidence(page)).surface).toBe('purchases')
  await expect(page.getByTestId('derived-summary')).toContainText('42')
  await page.waitForTimeout(320)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-purchases.png'), fullPage: true })

  await page.getByTestId('history-search').fill('sourdough')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(1)
  expect((await evidence(page)).sourceDatasetFeatures).toBe(1)
  await page.getByTestId('purchase-purchase_shuk_01').click()
  await expect(page.getByTestId('purchase-detail')).toBeVisible()
  await expect(page.getByTestId('purchase-detail')).toContainText('Olive sourdough')
  await expect.poll(async () => (await evidence(page)).selectedPlaceId).toBe('place_shuk_bograshov')
  await expect.poll(async () => (await evidence(page)).renderedSelectionHalos).toBeGreaterThan(0)
  await page.waitForTimeout(320)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-nested-receipt.png'), fullPage: true })

  await page.goBack()
  await expect(page.getByTestId('purchases-panel')).toBeVisible()
  await expect.poll(async () => (await evidence(page)).selectedPurchaseId).toBeNull()
  await page.getByTestId('history-search').fill('')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(42)

  await page.getByTestId('history-filters').click()
  await page.getByTestId('channel-filter').selectOption('online')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(2)
  expect((await evidence(page)).sourceDatasetFeatures).toBe(0)
  await page.getByTestId('filters-sheet').getByRole('button', { name: 'Close filters' }).click()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-online-history.png'), fullPage: true })
  await page.getByTestId('purchase-purchase_online_01').click()
  await expect(page.getByTestId('purchase-detail')).toContainText('Online · no map pin')
  expect((await evidence(page)).selectedPlaceId).toBeNull()
  await page.goBack()

  await page.getByTestId('history-filters').click()
  await page.getByTestId('channel-filter').selectOption('cash-manual')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(2)
  await page.getByTestId('filters-sheet').getByRole('button', { name: 'Close filters' }).click()
  await expect(page.locator('[data-purchase-kind="cash-manual"]')).toHaveCount(1)
  await expect(page.locator('[data-purchase-kind="unresolved"]')).toHaveCount(1)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-cash-manual.png'), fullPage: true })

  await page.getByTestId('history-reset').click()
  await page.getByTestId('history-timeline').click()
  await page.getByTestId('timeline-range').fill('1')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(10)
  expect((await evidence(page)).query.timelineMonth).toBe('2026-08')
  expect((await evidence(page)).sourceDatasetFeatures).toBe(3)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-timeline.png'), fullPage: true })
  await page.getByTestId('timeline-sheet').getByRole('button', { name: 'Close timeline' }).click()

  await page.getByTestId('history-reset').click()
  await page.getByTestId('history-search').fill('Tokyo')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(2)
  await page.getByTestId('purchase-purchase_kumo_01').click()
  await expect(page.getByTestId('purchase-detail')).toContainText('¥6,800')
  await expect(page.getByTestId('purchase-detail')).toContainText('Fixed synthetic demo rate')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-multi-currency.png'), fullPage: true })
  await page.getByRole('button', { name: 'View place' }).click()
  await expect(page.getByTestId('place-panel')).toContainText('Kumo Objects')
  await expect.poll(async () => (await evidence(page)).surface).toBe('globe')
  await page.reload()
  await waitForExperience(page)
  expect((await evidence(page)).query.search).toBe('Tokyo')
  expect((await evidence(page)).selectedPlaceId).toBe('place_kumo_shibuya')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-reload-restored.png'), fullPage: true })

  await page.getByRole('button', { name: 'Purchases', exact: true }).first().click()
  await page.getByTestId('history-search').fill('')
  await page.getByTestId('purchase-purchase_shuk_01').click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('purchase-detail')).toBeHidden()
  await page.getByTestId('history-filters').click()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('filters-sheet')).toBeHidden()

  await page.getByTestId('history-search').fill('no-synthetic-purchase')
  await expect(page.getByTestId('purchases-empty')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-purchases-empty.png'), fullPage: true })
  await page.getByTestId('purchases-empty').getByRole('button', { name: 'Reset query' }).click()
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(42)

  await page.locator('nav[aria-label="Primary"]').getByRole('button', { name: /Analytics/ }).click()
  await expect(page.getByTestId('stats-placeholder')).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-stats-placeholder.png'), fullPage: true })
  await page.locator('nav[aria-label="Primary"]').getByRole('button', { name: 'Globe', exact: true }).click()

  expect(errors).toEqual([])
  await writeFile(path.join(artifactDir, 'desktop-sync-evidence.json'), JSON.stringify(await evidence(page), null, 2))
  await saveVideo(context, page, 'desktop-globe-purchases-sync.webm')
})

test('mobile sheets, touch-size navigation, RTL, reload, empty, and recovery stay coherent', async ({ browser }) => {
  const context = await createContext(browser, { width: 390, height: 844 }, { recordVideo: true, hasTouch: true })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForExperience(page)
  await page.locator('nav[aria-label="Mobile primary"]').getByRole('button', { name: 'Purchases' }).click()
  await expect(page.getByTestId('purchases-panel')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.waitForTimeout(320)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-purchases.png'), fullPage: true })

  await page.getByTestId('purchase-purchase_shuk_01').click()
  await expect(page.getByTestId('purchase-detail')).toContainText('Receipt items')
  await page.waitForTimeout(320)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-nested-receipt.png'), fullPage: true })
  await page.keyboard.press('Escape')

  await page.getByTestId('history-filters').click()
  await page.getByTestId('currency-filter').selectOption('JPY')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(2)
  await page.getByTestId('filters-sheet').getByRole('button', { name: 'Close filters' }).click()
  await expect(page.getByTestId('derived-summary')).toContainText('2')

  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-purchases-rtl.png'), fullPage: true })

  await page.reload()
  await waitForExperience(page)
  expect((await evidence(page)).locale).toBe('he')
  expect((await evidence(page)).query.currency).toBe('JPY')
  expect((await evidence(page)).surface).toBe('purchases')

  await page.getByTestId('history-reset').click()
  await page.getByTestId('history-search').fill('אין רכישה כזאת')
  await expect(page.getByTestId('purchases-empty')).toBeVisible()
  await page.getByTestId('purchases-empty').getByRole('button', { name: 'איפוס שאילתה' }).click()
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(42)
  await page.locator('nav[aria-label="Mobile primary"]').getByRole('button', { name: 'גלובוס' }).click()
  await expect.poll(async () => (await evidence(page)).surface).toBe('globe')
  await page.screenshot({ path: path.join(artifactDir, 'mobile-globe-restored.png'), fullPage: true })

  expect(errors).toEqual([])
  await saveVideo(context, page, 'mobile-globe-purchases-sync.webm')

  const smallContext = await createContext(browser, { width: 360, height: 640 })
  const smallPage = await smallContext.newPage()
  await smallPage.goto('/')
  await waitForExperience(smallPage)
  await smallPage.locator('nav[aria-label="Mobile primary"]').getByRole('button', { name: 'Purchases' }).click()
  expect(await smallPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await smallPage.waitForTimeout(320)
  await smallPage.screenshot({ path: path.join(artifactDir, 'mobile-small-purchases-360x640.png'), fullPage: true })
  await smallContext.close()
})
