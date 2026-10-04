import { expect, test, type Browser, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-slice-1d3', 'search-layout')
const layoutPhase = process.env.SPENDSCAPE_LAYOUT_PHASE === 'before' ? 'before' : 'after'

interface SearchLayoutEvidence {
  ready: boolean
  locale: 'en' | 'he'
  reducedMotion: boolean
  surface: 'globe' | 'purchases' | 'stats'
  query: { search: string }
  selectedPlaceId: string | null
  selectedPurchaseId: string | null
  mapInstanceCount: number
  mapConstructionCount: number
  visiblePurchaseCount: number
  visiblePinFeatures: number
  camera: { center: [number, number]; zoom: number } | null
  performance: { lastCameraAction: string | null }
}

interface LayoutMetrics {
  viewport: { width: number; height: number }
  direction: string
  query: { top: number; bottom: number; left: number; right: number }
  panel: { top: number; bottom: number; left: number; right: number; height: number }
  controls: { top: number; bottom: number }
  scroll: { clientHeight: number; scrollHeight: number; overflowY: string }
  close: { top: number; bottom: number }
}

async function waitForExperience(page: Page) {
  await page.waitForFunction(() => (
    window as typeof window & { __SPENDSCAPE_QA__?: SearchLayoutEvidence }
  ).__SPENDSCAPE_QA__?.ready === true, undefined, { timeout: 20_000 })
  await page.waitForTimeout(450)
}

async function evidence(page: Page): Promise<SearchLayoutEvidence> {
  return page.evaluate(() => structuredClone((
    window as typeof window & { __SPENDSCAPE_QA__: SearchLayoutEvidence }
  ).__SPENDSCAPE_QA__))
}

async function newDesktop(browser: Browser, width = 1024, height = 768) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: 'dark',
    locale: 'en-GB',
  })
  const page = await context.newPage()
  await page.goto('/')
  await waitForExperience(page)
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  return { context, page }
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function layoutMetrics(page: Page): Promise<LayoutMetrics> {
  return page.evaluate(() => {
    const query = document.querySelector('[data-testid="query-dock"]')!.getBoundingClientRect()
    const panel = document.querySelector('[data-testid="place-panel"]')!.getBoundingClientRect()
    const controls = document.querySelector('[data-testid="globe-tools"]')!.getBoundingClientRect()
    const scroll = document.querySelector('[data-testid="place-panel-scroll"]') as HTMLElement
    const close = document.querySelector('[data-testid="place-panel"] button')!.getBoundingClientRect()
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      direction: document.documentElement.dir,
      query: { top: query.top, bottom: query.bottom, left: query.left, right: query.right },
      panel: { top: panel.top, bottom: panel.bottom, left: panel.left, right: panel.right, height: panel.height },
      controls: { top: controls.top, bottom: controls.bottom },
      scroll: {
        clientHeight: scroll.clientHeight,
        scrollHeight: scroll.scrollHeight,
        overflowY: getComputedStyle(scroll).overflowY,
      },
      close: { top: close.top, bottom: close.bottom },
    }
  })
}

function expectSafeDesktopLayout(metrics: LayoutMetrics) {
  expect(metrics.panel.top).toBeGreaterThanOrEqual(metrics.query.bottom + 12)
  expect(metrics.panel.top).toBeLessThanOrEqual(metrics.query.bottom + 18)
  expect(metrics.panel.bottom).toBeLessThanOrEqual(metrics.controls.top - 12)
  expect(metrics.scroll.overflowY).toBe('auto')
  expect(metrics.scroll.scrollHeight).toBeGreaterThan(metrics.scroll.clientHeight)
  expect(metrics.close.top).toBeGreaterThanOrEqual(metrics.panel.top)
  expect(metrics.close.bottom).toBeLessThanOrEqual(metrics.panel.bottom)
}

test.beforeAll(async () => {
  await mkdir(artifactDir, { recursive: true })
})

test('same selected place and camera provide before and after layout evidence', async ({ browser }) => {
  const { context, page } = await newDesktop(browser)
  await page.getByRole('combobox', { name: 'Jump to a place' }).selectOption('place_shuk_bograshov')
  await expect(page.getByTestId('place-panel')).toBeVisible()
  await expect.poll(async () => (await evidence(page)).selectedPlaceId).toBe('place_shuk_bograshov')
  await expect.poll(async () => (await evidence(page)).performance.lastCameraAction).toBe('fly-to-place')

  await page.screenshot({
    path: path.join(artifactDir, `${layoutPhase}-place-panel-shuk-1024x768.png`),
    fullPage: true,
  })

  const qa = await evidence(page)
  expect(qa.mapInstanceCount).toBe(1)
  expect(qa.camera?.zoom).toBeGreaterThan(14)
  if (layoutPhase === 'after') expectSafeDesktopLayout(await layoutMetrics(page))
  await context.close()
})

test('canonical desktop autocomplete supports city, place, keyboard, empty, escape, and online routing', async ({ browser }) => {
  test.skip(layoutPhase === 'before', 'Post-correction interaction coverage')
  const { context, page } = await newDesktop(browser, 1440, 900)
  const errors = collectErrors(page)
  const search = page.getByRole('combobox', { name: 'Search places or cities' })

  await search.fill('  Tel   Aviv ')
  const results = page.getByTestId('search-results')
  await expect(results).toBeVisible()
  const city = results.locator('[data-result-kind="city"]').filter({ hasText: 'Tel Aviv' })
  await expect(city).toContainText('2 places')
  await expect(city).toContainText('20 physical purchases')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-search-city-1440x900.png'), fullPage: true })
  await city.click()
  await expect.poll(async () => (await evidence(page)).performance.lastCameraAction).toBe('search-city-fit')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(20)
  expect(await evidence(page)).toMatchObject({ visiblePinFeatures: 2, mapInstanceCount: 1, mapConstructionCount: 1 })

  await search.fill('Shuk Express')
  await expect(results.locator('[data-result-kind="place"]')).toContainText('Bograshov · Tel Aviv · 14 visits')
  await search.press('ArrowDown')
  await search.press('Enter')
  await expect(page.getByTestId('place-panel')).toContainText('Shuk Express')
  await expect.poll(async () => (await evidence(page)).performance.lastCameraAction).toBe('fly-to-place')
  expect(await evidence(page)).toMatchObject({ selectedPlaceId: 'place_shuk_bograshov', mapInstanceCount: 1, mapConstructionCount: 1 })

  await search.focus()
  await expect(results).toBeVisible()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-search-place-selected-1440x900.png'), fullPage: true })
  await search.press('Escape')
  await expect(results).toBeHidden()
  await expect(page.getByTestId('place-panel')).toBeVisible()
  await expect(search).toBeFocused()
  await search.press('Escape')
  await expect(page.getByTestId('place-panel')).toBeHidden()
  await expect(search).toBeFocused()

  await search.fill('no canonical purchase anywhere')
  await expect(results).toContainText('No places or cities found in your purchases.')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-search-empty-1440x900.png'), fullPage: true })

  await search.fill('Serein Online')
  const online = results.locator('[data-result-kind="purchase"]').filter({ hasText: 'Serein Online' })
  await expect(online).toContainText('Online · no map pin')
  await online.click()
  await expect(page.getByTestId('purchase-detail')).toContainText('Online · no map pin')
  expect(await evidence(page)).toMatchObject({
    surface: 'purchases',
    selectedPlaceId: null,
    selectedPurchaseId: 'purchase_online_01',
    visiblePinFeatures: 0,
    mapInstanceCount: 1,
    mapConstructionCount: 1,
  })
  expect(errors).toEqual([])
  await context.close()
})

test('desktop panel uses measured dock boundaries across required viewports and RTL', async ({ browser }) => {
  test.skip(layoutPhase === 'before', 'Post-correction layout coverage')
  const records: LayoutMetrics[] = []
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    const { context, page } = await newDesktop(browser, viewport.width, viewport.height)
    const errors = collectErrors(page)
    const search = page.getByRole('combobox', { name: 'Search places or cities' })
    await search.fill('Shuk Express')
    await page.getByTestId('search-results').locator('[data-result-kind="place"]').click()
    await expect(page.getByTestId('place-panel')).toBeVisible()
    await expect.poll(async () => (await evidence(page)).performance.lastCameraAction).toBe('fly-to-place')

    await page.getByTestId('filters-open').click({ trial: true })
    await page.getByTestId('timeline-open').click({ trial: true })
    await search.focus()
    await expect(page.getByTestId('search-results')).toBeVisible()
    await page.getByTestId('search-results').locator('[data-result-kind="place"]').click({ trial: true })
    const ltr = await layoutMetrics(page)
    expectSafeDesktopLayout(ltr)
    records.push(ltr)
    await page.screenshot({
      path: path.join(artifactDir, `desktop-place-search-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    })

    if (viewport.width === 1280) {
      await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await page.getByRole('combobox', { name: 'חיפוש מקומות או ערים' }).focus()
      const rtl = await layoutMetrics(page)
      expectSafeDesktopLayout(rtl)
      expect(rtl.panel.left).toBeLessThan(rtl.query.right)
      records.push(rtl)
      await page.screenshot({ path: path.join(artifactDir, 'desktop-place-search-rtl-1280x800.png'), fullPage: true })
    }
    expect(errors).toEqual([])
    await context.close()
  }
  await writeFile(path.join(artifactDir, 'desktop-layout-measurements.json'), JSON.stringify(records, null, 2))
})

test('mobile Hebrew autocomplete is touch-usable, reduced-motion safe, and overflow-free', async ({ browser }) => {
  test.skip(layoutPhase === 'before', 'Post-correction mobile coverage')
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    locale: 'he-IL',
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForExperience(page)
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  const search = page.getByRole('combobox', { name: 'חיפוש מקומות או ערים' })
  await search.focus()
  await search.fill('תל אביב')
  const results = page.getByTestId('search-results')
  await expect(results).toBeVisible()
  await expect(results.locator('[data-result-kind="city"]')).toContainText('תל אביב')
  await expect(results.locator('[data-result-kind="city"]')).toContainText('2 מקומות · 20 רכישות פיזיות')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-search-rtl-reduced-390x844.png'), fullPage: true })

  await search.fill('שוק אקספרס')
  await results.locator('[data-result-kind="place"]').tap()
  await expect(page.getByTestId('place-panel')).toContainText('שוק אקספרס')
  await page.waitForTimeout(800)
  expect(await evidence(page)).toMatchObject({
    reducedMotion: true,
    selectedPlaceId: 'place_shuk_bograshov',
    mapInstanceCount: 1,
    mapConstructionCount: 1,
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: path.join(artifactDir, 'mobile-search-place-selected-rtl-390x844.png'), fullPage: true })
  expect(errors).toEqual([])
  await context.close()
})
