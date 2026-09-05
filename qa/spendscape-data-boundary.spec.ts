import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fixtureSpendscapeRepository } from '../src/data/spendscape-repository'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-phase-2a1')

interface BoundaryEvidence {
  ready: boolean
  repositoryAdapter: 'fixture' | 'backend'
  dataClassification: 'synthetic' | 'real'
  dataVersion: string
  combinedPurchaseCount: number
  visiblePurchaseCount: number
  visiblePinFeatures: number
  canonicalPins: number
  onlineExcluded: number
  unresolvedExcluded: number
  mapInstanceCount: number
  mapConstructionCount: number
  surface: 'globe' | 'purchases' | 'stats'
  analytics: { totalBaseAmountIls: number }
}

async function waitForBoundary(page: Page) {
  await page.waitForFunction(() => (
    window as typeof window & { __SPENDSCAPE_QA__?: BoundaryEvidence }
  ).__SPENDSCAPE_QA__?.ready === true, undefined, { timeout: 25_000 })
}

async function evidence(page: Page): Promise<BoundaryEvidence> {
  return page.evaluate(() => structuredClone((
    window as typeof window & { __SPENDSCAPE_QA__: BoundaryEvidence }
  ).__SPENDSCAPE_QA__))
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

test.beforeAll(async () => {
  await mkdir(artifactDir, { recursive: true })
})

test('fixture repository snapshot preserves canonical desktop behavior and map identity', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
    locale: 'en-GB',
  })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForBoundary(page)
  const root = page.locator('main')
  await expect(root).toHaveAttribute('data-repository-adapter', 'fixture')
  await expect(root).toHaveAttribute('data-data-classification', 'synthetic')
  await expect(root).toHaveAttribute('data-data-version', 'phase-1d4-v1')
  expect(await evidence(page)).toMatchObject({
    repositoryAdapter: 'fixture',
    dataClassification: 'synthetic',
    dataVersion: 'phase-1d4-v1',
    combinedPurchaseCount: 42,
    visiblePurchaseCount: 42,
    visiblePinFeatures: 12,
    canonicalPins: 12,
    onlineExcluded: 2,
    unresolvedExcluded: 1,
    mapInstanceCount: 1,
    mapConstructionCount: 1,
  })

  const map = await page.getByTestId('map-canvas').elementHandle()
  expect(map).not.toBeNull()
  await page.locator('nav[aria-label="Primary"]').getByRole('button', { name: 'Purchases', exact: true }).click()
  await expect(page.getByTestId('derived-summary')).toContainText('42')
  await expect.poll(async () => (await evidence(page)).surface).toBe('purchases')
  await page.getByTestId('history-filters').click()
  await page.getByTestId('channel-filter').selectOption('online')
  await expect.poll(async () => (await evidence(page)).visiblePurchaseCount).toBe(2)
  expect((await evidence(page)).visiblePinFeatures).toBe(0)
  await page.getByTestId('filters-sheet').getByRole('button', { name: 'Close filters' }).click()
  await page.locator('nav[aria-label="Primary"]').getByRole('button', { name: /Analytics/ }).click()
  await expect(page.getByTestId('analytics-panel')).toBeVisible()
  expect((await evidence(page)).mapInstanceCount).toBe(1)
  expect(await map!.evaluate((node) => node.isConnected)).toBe(true)

  await page.screenshot({ path: path.join(artifactDir, 'desktop-fixture-boundary.png'), fullPage: true, animations: 'disabled' })
  expect(errors).toEqual([])
  await context.close()
})

for (const locale of ['en', 'he'] as const) {
  test(`injected snapshot names reach Capture, Inbox, Ask and Replay in ${locale}`, async ({ browser }) => {
    const snapshot = await fixtureSpendscapeRepository.loadSnapshot()
    const merchantIds = ['merchant_unresolved', 'merchant_serein', 'merchant_shuk', 'merchant_orbit']
    const names = merchantIds.map((id) => {
      const merchant = snapshot.merchants.find((candidate) => candidate.id === id)!
      return { original: merchant.name[locale], injected: `${merchant.name[locale]} · snapshot` }
    })
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', colorScheme: 'dark',
    })
    const page = await context.newPage()
    const errors = collectErrors(page)
    // Override only display text in the local serialized snapshot response.
    // App bundles, canonical IDs, arithmetic, and stored fixtures are unchanged.
    await page.route('http://127.0.0.1:3000/', async (route) => {
      const response = await route.fetch()
      let body = await response.text()
      for (const { original, injected } of names) {
        expect(body).toContain(original)
        body = body.replaceAll(original, injected)
      }
      await route.fulfill({ response, body })
    })
    await page.goto('/')
    await waitForBoundary(page)
    if (locale === 'he') await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
    const initial = await evidence(page)
    expect(initial).toMatchObject({ combinedPurchaseCount: 42, canonicalPins: 12, visiblePinFeatures: 12 })
    const map = await page.getByTestId('map-canvas').elementHandle()

    await page.getByTestId('capture-open-desktop').click()
    await page.getByTestId('capture-sources-open').click()
    await page.getByTestId('capture-source-document').click()
    await expect(page.getByTestId('capture-review')).toContainText(names[1].injected)
    await page.getByTestId('capture-dialog').getByRole('button', {
      name: locale === 'en' ? 'Close Capture' : 'סגירת Capture', exact: true,
    }).click()
    await expect(page.getByTestId('capture-dialog')).toBeHidden()

    await page.getByTestId('smart-inbox-open').click()
    await expect(page.getByTestId('smart-inbox-layer')).toContainText(names[2].injected)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('smart-inbox-layer')).toBeHidden()

    await page.getByTestId('ask-open-desktop').click()
    await page.getByTestId('ask-input').fill(locale === 'en' ? 'Open latest purchase' : 'פתח את הרכישה האחרונה')
    await page.getByTestId('ask-run').click()
    await expect(page.locator('#purchase-title')).toHaveText(names[0].injected)
    await expect(page.getByTestId('ask-feedback')).toContainText(
      `${locale === 'en' ? 'Open latest purchase' : 'פתיחת הרכישה האחרונה'} · ${names[0].injected}`,
    )
    await page.screenshot({ path: path.join(artifactDir, `snapshot-ask-${locale}.png`), animations: 'disabled' })
    await page.getByTestId('ask-undo').click()

    await page.getByTestId('timeline-open').click()
    await page.getByTestId('replay-open').click()
    await expect(page.getByTestId('replay-player')).toContainText(names[3].injected)
    await expect(page.getByTestId('replay-player')).toHaveAttribute('data-count', '42')
    await page.getByTestId('replay-close').click()
    await expect(page.getByTestId('replay-player')).toBeHidden()

    expect(await evidence(page)).toMatchObject({
      combinedPurchaseCount: 42, canonicalPins: 12, visiblePinFeatures: 12,
      onlineExcluded: 2, unresolvedExcluded: 1, mapInstanceCount: 1, mapConstructionCount: 1,
      analytics: initial.analytics,
    })
    expect(await map!.evaluate((node) => node.isConnected)).toBe(true)
    expect(errors).toEqual([])
    await context.close()
  })
}

test('fixture repository snapshot preserves mobile navigation, RTL, and responsive layout', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    locale: 'en-GB',
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForBoundary(page)
  const mobileNav = page.locator('nav[aria-label="Mobile primary"]')
  await expect(mobileNav.locator(':scope > button')).toHaveCount(4)
  await expect(mobileNav.locator(':scope > button > span')).toHaveText([
    'Globe', 'Capture', 'Purchases', 'Stats',
  ])
  await mobileNav.getByRole('button', { name: 'Purchases' }).click()
  await expect(page.getByTestId('derived-summary')).toContainText('42')
  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await evidence(page)).toMatchObject({
    repositoryAdapter: 'fixture',
    dataClassification: 'synthetic',
    combinedPurchaseCount: 42,
    mapInstanceCount: 1,
    mapConstructionCount: 1,
  })

  await page.screenshot({ path: path.join(artifactDir, 'mobile-fixture-boundary-rtl.png'), fullPage: true })
  expect(errors).toEqual([])
  await context.close()
})
