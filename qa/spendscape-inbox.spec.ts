import { expect, test, type Browser, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-slice-1d4')

interface InboxEvidence {
  ready: boolean
  locale: 'en' | 'he'
  reducedMotion: boolean
  autoSpin: boolean
  surface: 'globe' | 'purchases' | 'stats'
  selectedPlaceId: string | null
  selectedPurchaseId: string | null
  inboxOpen: boolean
  inboxCaseId: string | null
  pendingInboxCount: number
  inboxDecisionStatus: 'resolved' | 'deferred' | null
  inboxResolvedPlaceId: string | null
  combinedPurchaseCount: number
  mapInstanceCount: number
  visiblePurchaseCount: number
  visibleBaseTotalIls: number
  sourceDatasetFeatures: number
  physicalPurchases: number
  unresolvedExcluded: number
  recurringPlacePurchases: number
  recurringPlacePins: number
  query: {
    search: string
    category: string
    currency: string
    channel: string
    dateRange: string
    timelineMonth: string | null
  }
  camera: { center: [number, number]; zoom: number; bearing: number; pitch: number } | null
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
  options: { reducedMotion?: 'reduce' | 'no-preference'; hasTouch?: boolean } = {},
) {
  return browser.newContext({
    viewport,
    colorScheme: 'dark',
    locale: 'en-GB',
    reducedMotion: options.reducedMotion ?? 'no-preference',
    hasTouch: options.hasTouch ?? false,
  })
}

async function waitForExperience(page: Page) {
  await page.waitForFunction(() => {
    const value = (window as typeof window & { __SPENDSCAPE_QA__?: InboxEvidence }).__SPENDSCAPE_QA__
    return value?.ready === true
  }, undefined, { timeout: 20_000 })
  await page.waitForTimeout(350)
}

async function evidence(page: Page): Promise<InboxEvidence> {
  return page.evaluate(() => {
    const value = (window as typeof window & { __SPENDSCAPE_QA__?: InboxEvidence }).__SPENDSCAPE_QA__
    if (!value) throw new Error('Spendscape Smart Inbox evidence is unavailable')
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

async function openInbox(page: Page) {
  await page.getByTestId('smart-inbox-open').click()
  await expect(page.getByTestId('smart-inbox-layer')).toBeVisible()
}

async function choose(page: Page, value: string) {
  const choice = page.locator(`label:has(input[name="smart-inbox-choice"][value="${value}"])`)
  await choice.click()
  await expect(choice).toHaveAttribute('data-selected', 'true')
}

test.beforeAll(async () => {
  await mkdir(artifactDir, { recursive: true })
})

test('desktop Smart Inbox resolves one canonical case, synchronizes every surface, and undoes cleanly', async ({ browser }) => {
  const context = await createContext(browser, { width: 1280, height: 800 })
  const page = await context.newPage()
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForExperience(page)

  const baseline = await evidence(page)
  expect(baseline).toMatchObject({
    pendingInboxCount: 1,
    inboxDecisionStatus: null,
    combinedPurchaseCount: 42,
    sourceDatasetFeatures: 12,
    mapInstanceCount: 1,
  })
  expect(baseline.analytics).toMatchObject({ purchaseCount: 42, physicalCount: 39, onlineCount: 2, unresolvedCount: 1 })
  await expect(page.getByTestId('smart-inbox-open')).toContainText('1')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-pin-count-before.png'), fullPage: true })

  await page.getByRole('button', { name: 'Purchases', exact: true }).first().click()
  await page.getByTestId('purchase-purchase_unresolved_01').click()
  await expect(page.getByTestId('purchase-detail')).toContainText('Unresolved · no map pin')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-contextual-review-entry.png'), fullPage: true })
  await page.getByTestId('review-match').click()
  await expect(page.getByTestId('smart-inbox-layer')).toBeVisible()
  await expect(page.getByTestId('smart-inbox-confirm')).toBeDisabled()
  await page.goBack()
  await expect(page.getByTestId('smart-inbox-layer')).toBeHidden()
  await expect(page.getByTestId('purchase-detail')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Globe', exact: true }).first().click()

  const inboxButton = page.getByTestId('smart-inbox-open')
  await inboxButton.focus()
  await inboxButton.press('Enter')
  await expect(page.getByTestId('smart-inbox-layer')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close Smart Inbox' }).last()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('smart-inbox-layer')).toBeHidden()
  await expect(inboxButton).toBeFocused()
  await openInbox(page)
  await page.goBack()
  await expect(page.getByTestId('smart-inbox-layer')).toBeHidden()

  await openInbox(page)
  await expect(page.getByText('No candidate is preselected or recommended.')).toBeVisible()
  await expect(page.locator('input[name="smart-inbox-choice"]')).toHaveCount(3)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-inbox-pending.png'), fullPage: true })
  await choose(page, 'place_shuk_bograshov')
  await expect(page.getByTestId('smart-inbox-confirm')).toHaveText('Confirm place')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-candidate-selected.png'), fullPage: true })
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-confirmation-review.png'), fullPage: true })
  await page.getByTestId('smart-inbox-confirm').click()
  await expect(page.getByTestId('smart-inbox-complete')).toBeVisible()
  await expect(page.getByTestId('smart-inbox-open')).not.toContainText('1')
  await expect.poll(async () => (await evidence(page)).inboxDecisionStatus).toBe('resolved')

  const resolved = await evidence(page)
  expect(resolved.pendingInboxCount).toBe(0)
  expect(resolved.inboxResolvedPlaceId).toBe('place_shuk_bograshov')
  expect(resolved.sourceDatasetFeatures).toBe(12)
  expect(resolved.mapInstanceCount).toBe(1)
  expect(resolved.physicalPurchases).toBe(40)
  expect(resolved.unresolvedExcluded).toBe(0)
  expect(resolved.recurringPlacePurchases).toBe(15)
  expect(resolved.recurringPlacePins).toBe(1)
  await expect(page.locator('main')).toHaveAttribute('data-pin-count', '12')
  await expect(page.locator('main')).toHaveAttribute('data-unresolved-excluded', '0')
  expect(resolved.analytics).toMatchObject({
    purchaseCount: 42,
    totalBaseAmountIls: baseline.analytics.totalBaseAmountIls,
    averageBaseAmountIls: baseline.analytics.averageBaseAmountIls,
    physicalCount: 40,
    onlineCount: 2,
    unresolvedCount: 0,
  })
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-resolved-up-to-date.png'), fullPage: true })
  await writeFile(path.join(artifactDir, 'desktop-before-after-evidence.json'), JSON.stringify({ baseline, resolved }, null, 2))

  await page.getByRole('button', { name: 'View purchase' }).click()
  await expect(page.getByTestId('purchase-detail')).toContainText('Shuk Express')
  await expect(page.getByTestId('purchase-detail')).toContainText('Confirmed')
  await expect.poll(async () => (await evidence(page)).selectedPurchaseId).toBe('purchase_unresolved_01')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-purchase-resolved.png'), fullPage: true })
  await page.getByRole('button', { name: 'Analytics', exact: true }).first().click()
  await expect(page.getByTestId('analytics-panel')).toBeVisible()
  await expect.poll(async () => (await evidence(page)).analytics.physicalCount).toBe(40)
  await page.getByRole('button', { name: 'Globe', exact: true }).first().click()
  await openInbox(page)
  await page.getByRole('button', { name: 'Show place' }).click()
  await expect.poll(async () => (await evidence(page)).selectedPlaceId).toBe('place_shuk_bograshov')
  expect((await evidence(page)).sourceDatasetFeatures).toBe(12)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-pin-count-after.png'), fullPage: true })

  await openInbox(page)
  await page.getByTestId('smart-inbox-undo').click()
  await expect(page.getByTestId('smart-inbox-confirm')).toBeDisabled()
  const undone = await evidence(page)
  expect(undone).toMatchObject({ pendingInboxCount: 1, inboxDecisionStatus: null, sourceDatasetFeatures: 12, mapInstanceCount: 1 })
  expect(undone.analytics).toEqual(baseline.analytics)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-undo-pending-restored.png'), fullPage: true })

  await choose(page, 'defer')
  await page.getByTestId('smart-inbox-confirm').click()
  await expect(page.getByTestId('smart-inbox-complete')).toContainText('The purchase stays unresolved and creates no pin.')
  const deferred = await evidence(page)
  expect(deferred).toMatchObject({ pendingInboxCount: 0, inboxDecisionStatus: 'deferred', inboxResolvedPlaceId: null, sourceDatasetFeatures: 12 })
  expect(deferred.analytics).toEqual(baseline.analytics)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-none-not-sure.png'), fullPage: true })
  await page.getByTestId('smart-inbox-undo').click()
  await expect.poll(async () => (await evidence(page)).pendingInboxCount).toBe(1)

  await page.reload()
  await waitForExperience(page)
  const reloaded = await evidence(page)
  expect(reloaded).toMatchObject({ pendingInboxCount: 1, inboxDecisionStatus: null, inboxOpen: false, sourceDatasetFeatures: 12 })
  expect(reloaded.analytics).toEqual(baseline.analytics)
  expect(errors).toEqual([])
  await context.close()
})

test('mobile touch layouts, RTL, reduced motion, and completed states remain coherent', async ({ browser }) => {
  const viewports = [
    { width: 360, height: 640, name: 'mobile-360x640' },
    { width: 390, height: 844, name: 'mobile-390x844' },
    { width: 430, height: 932, name: 'mobile-430x932' },
  ]

  for (const viewport of viewports) {
    const context = await createContext(browser, viewport, { hasTouch: true })
    const page = await context.newPage()
    const errors = collectErrors(page)
    await page.goto('/')
    await waitForExperience(page)
    await expect(page.locator('nav[aria-label="Mobile primary"] > button')).toHaveCount(4)
    if (viewport.width === 430) {
      await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    }
    await openInbox(page)
    await expect(page.getByTestId('smart-inbox-layer')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    if (viewport.width === 360) {
      await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-pending.png`), fullPage: true })
      await choose(page, 'place_shuk_bograshov')
      await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-selected-review.png`), fullPage: true })
    } else if (viewport.width === 390) {
      await choose(page, 'defer')
      await page.getByTestId('smart-inbox-confirm').tap()
      await expect(page.getByTestId('smart-inbox-complete')).toBeVisible()
      await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-none-complete.png`), fullPage: true })
      await page.getByTestId('smart-inbox-undo').tap()
      await expect.poll(async () => (await evidence(page)).pendingInboxCount).toBe(1)
    } else {
      await expect(page.getByText('אף מועמד אינו מסומן מראש או מומלץ.')).toBeVisible()
      await choose(page, 'place_nomi_dizengoff')
      await page.screenshot({ path: path.join(artifactDir, `${viewport.name}-hebrew-rtl-selected.png`), fullPage: true })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    expect(errors).toEqual([])
    await context.close()
  }

  const reducedContext = await createContext(browser, { width: 1440, height: 900 }, { reducedMotion: 'reduce' })
  const reducedPage = await reducedContext.newPage()
  const reducedErrors = collectErrors(reducedPage)
  await reducedPage.goto('/')
  await waitForExperience(reducedPage)
  expect((await evidence(reducedPage)).reducedMotion).toBe(true)
  expect((await evidence(reducedPage)).autoSpin).toBe(false)
  await openInbox(reducedPage)
  await reducedPage.screenshot({ path: path.join(artifactDir, 'desktop-1440x900-reduced-motion.png'), fullPage: true })
  expect(reducedErrors).toEqual([])
  await reducedContext.close()
})

test('keyboard focus surrounds every candidate without changing native radio behavior', async ({ browser }) => {
  const context = await createContext(browser, { width: 1280, height: 800 })
  const page = await context.newPage()
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForExperience(page)

  const inboxButton = page.getByTestId('smart-inbox-open')
  await inboxButton.focus()
  await inboxButton.press('Enter')
  const closeButton = page.getByRole('button', { name: 'Close Smart Inbox' }).last()
  await expect(closeButton).toBeFocused()

  const choices = page.locator('label:has(input[name="smart-inbox-choice"])')
  const radios = page.locator('input[name="smart-inbox-choice"]')
  const focusVisual = async (index: number, selected: boolean) => {
    const choice = choices.nth(index)
    const radio = radios.nth(index)
    await expect(radio).toBeFocused()
    await expect(choice).toHaveAttribute('data-selected', selected ? 'true' : 'false')
    const result = await choice.evaluate((element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      const dialog = element.closest('[role="dialog"]')?.getBoundingClientRect()
      const scrollport = element.closest('fieldset')?.parentElement?.getBoundingClientRect()
      const footer = element.closest('fieldset')?.parentElement?.querySelector('footer')?.getBoundingClientRect()
      const visibleBottom = Math.min(scrollport?.bottom ?? Number.POSITIVE_INFINITY, footer?.top ?? Number.POSITIVE_INFINITY)
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outlineOffset: Number.parseFloat(style.outlineOffset),
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        insideDialog: dialog
          ? rect.left >= dialog.left && rect.right <= dialog.right
          : false,
        fullyVisible: scrollport
          ? rect.top >= scrollport.top && rect.bottom <= visibleBottom
          : false,
      }
    })
    expect(result.outlineStyle).toBe('solid')
    expect(result.outlineWidth).toBeGreaterThanOrEqual(2)
    expect(result.outlineOffset).toBeLessThan(0)
    expect(result.boxShadow).not.toBe('none')
    expect(result.insideDialog).toBe(true)
    expect(result.fullyVisible).toBe(true)
    return result
  }

  await page.keyboard.press('Tab')
  const unselectedVisual = await focusVisual(0, false)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-keyboard-focus-unselected.png'), fullPage: true })

  await page.keyboard.press('Space')
  const selectedVisual = await focusVisual(0, true)
  expect(selectedVisual.backgroundImage).not.toBe(unselectedVisual.backgroundImage)
  await expect(page.getByTestId('smart-inbox-confirm')).toBeEnabled()
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-keyboard-focus-selected.png'), fullPage: true })

  await page.keyboard.press('ArrowDown')
  await focusVisual(1, true)
  await page.keyboard.press('ArrowDown')
  await focusVisual(2, true)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-1280-keyboard-focus-none.png'), fullPage: true })

  await page.keyboard.press('Shift+Tab')
  await expect(closeButton).toBeFocused()
  await page.keyboard.press('Tab')
  await focusVisual(2, true)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('smart-inbox-layer')).toBeHidden()
  expect(errors).toEqual([])
  await context.close()

  const mobileViewports = [
    { width: 360, height: 640, name: 'mobile-360x640', locale: 'en' as const, reducedMotion: 'no-preference' as const },
    { width: 390, height: 844, name: 'mobile-390x844', locale: 'en' as const, reducedMotion: 'reduce' as const },
    { width: 430, height: 932, name: 'mobile-430x932', locale: 'he' as const, reducedMotion: 'no-preference' as const },
  ]

  for (const viewport of mobileViewports) {
    const mobileContext = await createContext(browser, viewport, {
      hasTouch: true,
      reducedMotion: viewport.reducedMotion,
    })
    const mobilePage = await mobileContext.newPage()
    const mobileErrors = collectErrors(mobilePage)
    await mobilePage.goto('/')
    await waitForExperience(mobilePage)
    if (viewport.locale === 'he') {
      await mobilePage.getByRole('button', { name: 'Switch to Hebrew' }).click()
      await expect(mobilePage.locator('html')).toHaveAttribute('dir', 'rtl')
    }
    if (viewport.reducedMotion === 'reduce') {
      expect((await evidence(mobilePage)).reducedMotion).toBe(true)
      expect((await evidence(mobilePage)).autoSpin).toBe(false)
    }

    await openInbox(mobilePage)
    await mobilePage.keyboard.press('Tab')
    const firstRadio = mobilePage.locator('input[name="smart-inbox-choice"]').first()
    const firstChoice = mobilePage.locator('label:has(input[name="smart-inbox-choice"])').first()
    await expect(firstRadio).toBeFocused()
    const focusBox = await firstChoice.evaluate((element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      const dialog = element.closest('[role="dialog"]')?.getBoundingClientRect()
      const scrollport = element.closest('fieldset')?.parentElement?.getBoundingClientRect()
      const footer = element.closest('fieldset')?.parentElement?.querySelector('footer')?.getBoundingClientRect()
      const visibleBottom = Math.min(scrollport?.bottom ?? Number.POSITIVE_INFINITY, footer?.top ?? Number.POSITIVE_INFINITY)
      return {
        outlineWidth: Number.parseFloat(style.outlineWidth),
        outlineOffset: Number.parseFloat(style.outlineOffset),
        insideDialog: dialog
          ? rect.left >= dialog.left && rect.right <= dialog.right
          : false,
        fullyVisible: scrollport
          ? rect.top >= scrollport.top && rect.bottom <= visibleBottom
          : false,
      }
    })
    expect(focusBox.outlineWidth).toBeGreaterThanOrEqual(2)
    expect(focusBox.outlineOffset).toBeLessThan(0)
    expect(focusBox.insideDialog).toBe(true)
    expect(focusBox.fullyVisible).toBe(true)
    expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await mobilePage.screenshot({
      path: path.join(
        artifactDir,
        viewport.locale === 'he'
          ? `${viewport.name}-hebrew-rtl-keyboard-focus.png`
          : `${viewport.name}-keyboard-focus.png`,
      ),
      fullPage: true,
    })
    await mobilePage.keyboard.press('Space')
    await expect(firstChoice).toHaveAttribute('data-selected', 'true')
    expect(mobileErrors).toEqual([])
    await mobileContext.close()
  }
})

test('Inbox remains available during loading and map-failure recovery without remounting state', async ({ browser }) => {
  const context = await createContext(browser, { width: 390, height: 844 }, { hasTouch: true })
  const page = await context.newPage()
  await page.goto('/?loading=1', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('map-loading')).toBeVisible()
  await openInbox(page)
  await expect(page.getByText('Which place should own this purchase?')).toBeVisible()
  await page.keyboard.press('Escape')
  await waitForExperience(page)
  expect((await evidence(page)).pendingInboxCount).toBe(1)

  await page.goto('/?mapFailure=1')
  await expect(page.getByTestId('map-failure')).toBeVisible()
  await openInbox(page)
  await expect(page.getByTestId('smart-inbox-layer')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Retry map' }).click()
  await waitForExperience(page)
  expect((await evidence(page)).pendingInboxCount).toBe(1)
  await context.close()
})
