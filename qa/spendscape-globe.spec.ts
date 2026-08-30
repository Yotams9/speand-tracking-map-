import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-slice-1d1', 'globe-regression')

interface CameraEvidence {
  center: [number, number]
  zoom: number
  bearing: number
  pitch: number
}

interface PerformanceEvidence {
  samples: number
  medianFrameMs: number
  p95FrameMs: number
  loadMs: number | null
  lastCameraAction: string | null
  lastCameraMs: number | null
}

interface GlobeQaEvidence {
  ready: boolean
  locale: 'en' | 'he'
  reducedMotion: boolean
  autoSpin: boolean
  mode: 'pins' | 'heatmap'
  selectedPlaceId: string | null
  visiblePinFeatures: number
  canonicalPins: number
  physicalPurchases: number
  onlineExcluded: number
  unresolvedExcluded: number
  recurringPlacePurchases: number
  recurringPlacePins: number
  sourcePresent: boolean
  sourceLoaded: boolean
  canonicalGeoJsonFeatures: number
  sourceDatasetFeatures: number
  sourceUpdates: number
  rendererQueryFeatures: number
  rendererQueryClusters: number
  rendererQueryPlaces: number
  rendererQueryUniquePlaces: number
  rendererRepresentedPlaces: number
  renderedClusters: number
  renderedPins: number
  renderedSelectionHalos: number
  renderedHeatFeatures: number
  camera: CameraEvidence
  performance: PerformanceEvidence
}

interface QaActions {
  firstRenderedPoint: (layerId: 'cluster' | 'pin') => [number, number] | null
}

async function waitForGlobe(page: Page) {
  await page.waitForFunction(() => {
    const qa = (window as typeof window & { __SPENDSCAPE_QA__?: GlobeQaEvidence }).__SPENDSCAPE_QA__
    return qa?.ready === true
  }, undefined, { timeout: 20_000 })
  await expect(page.locator('main[data-map-ready="true"]')).toBeVisible()
  await page.waitForTimeout(450)
}

async function qaEvidence(page: Page): Promise<GlobeQaEvidence> {
  return page.evaluate(() => {
    const qa = (window as typeof window & { __SPENDSCAPE_QA__?: GlobeQaEvidence }).__SPENDSCAPE_QA__
    if (!qa) throw new Error('Spendscape QA evidence is unavailable')
    return structuredClone(qa)
  })
}

async function firstRenderedPoint(page: Page, layerId: 'cluster' | 'pin') {
  return page.evaluate((requestedLayer) => {
    const actions = (window as typeof window & { __SPENDSCAPE_QA_ACTIONS__?: QaActions }).__SPENDSCAPE_QA_ACTIONS__
    return actions?.firstRenderedPoint(requestedLayer) ?? null
  }, layerId)
}

async function runAndWaitForCamera(page: Page, actionName: string, action: () => Promise<void>) {
  const before = await qaEvidence(page)
  await action()
  await page.waitForFunction(([expected, previousDuration]) => {
    const qa = (window as typeof window & { __SPENDSCAPE_QA__?: GlobeQaEvidence }).__SPENDSCAPE_QA__
    return qa?.performance.lastCameraAction === expected
      && qa.performance.lastCameraMs !== previousDuration
  }, [actionName, before.performance.lastCameraMs], { timeout: 12_000 })
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

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function dragPointer(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(350)
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

test('records desktop globe behavior, interruption, renderer, source, and persistence evidence', async ({ browser }) => {
  const viewport = { width: 1440, height: 900 }
  const context = await createContext(browser, viewport, { recordVideo: true })
  const page = await context.newPage()
  const errors = collectErrors(page)

  await page.goto('/')
  await waitForGlobe(page)
  await expect.poll(async () => (await qaEvidence(page)).renderedClusters).toBeGreaterThan(0)

  const baseline = await qaEvidence(page)
  expect(baseline.canonicalPins).toBe(12)
  expect(baseline.canonicalGeoJsonFeatures).toBe(12)
  expect(baseline.sourceDatasetFeatures).toBe(12)
  expect(baseline.physicalPurchases).toBe(39)
  expect(baseline.recurringPlacePurchases).toBe(14)
  expect(baseline.recurringPlacePins).toBe(1)
  expect(baseline.onlineExcluded).toBe(2)
  expect(baseline.unresolvedExcluded).toBe(1)
  expect(baseline.sourcePresent).toBe(true)
  expect(baseline.sourceLoaded).toBe(true)

  const rotationStart = baseline.camera.center[0]
  await page.waitForTimeout(3_800)
  expect(Math.abs((await qaEvidence(page)).camera.center[0] - rotationStart)).toBeGreaterThan(1.5)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-globe.png'), fullPage: true })

  const canvas = page.getByRole('application', { name: 'Interactive globe of synthetic purchase places' })
  const canvasBox = await canvas.boundingBox()
  if (!canvasBox) throw new Error('Globe canvas has no desktop bounds')

  const beforeDrag = await qaEvidence(page)
  await dragPointer(
    page,
    { x: canvasBox.x + canvasBox.width * 0.5, y: canvasBox.y + canvasBox.height * 0.52 },
    { x: canvasBox.x + canvasBox.width * 0.62, y: canvasBox.y + canvasBox.height * 0.56 },
  )
  const afterDrag = await qaEvidence(page)
  expect(afterDrag.autoSpin).toBe(false)
  expect(Math.abs(afterDrag.camera.center[0] - beforeDrag.camera.center[0])).toBeGreaterThan(2)

  const zoomBeforeWheel = afterDrag.camera.zoom
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.52, canvasBox.y + canvasBox.height * 0.5)
  await page.mouse.wheel(0, -520)
  await page.waitForTimeout(650)
  expect((await qaEvidence(page)).camera.zoom).toBeGreaterThan(zoomBeforeWheel)

  await runAndWaitForCamera(page, 'reset-globe', async () => {
    await page.getByRole('button', { name: 'Reset globe' }).click()
  })
  await expect.poll(async () => (await qaEvidence(page)).renderedClusters).toBeGreaterThan(0)
  const clusterPoint = await firstRenderedPoint(page, 'cluster')
  if (!clusterPoint) throw new Error('No renderer cluster point was available for expansion')
  await runAndWaitForCamera(page, 'cluster-expansion', async () => {
    await page.mouse.click(clusterPoint[0], clusterPoint[1])
  })
  await page.screenshot({ path: path.join(artifactDir, 'desktop-cluster-expanded.png'), fullPage: true })

  await runAndWaitForCamera(page, 'reset-globe', async () => {
    await page.getByRole('button', { name: 'Reset globe' }).click()
  })
  await page.getByRole('button', { name: 'Fly to latest' }).click()
  await page.waitForTimeout(90)
  await dragPointer(
    page,
    { x: canvasBox.x + canvasBox.width * 0.52, y: canvasBox.y + canvasBox.height * 0.5 },
    { x: canvasBox.x + canvasBox.width * 0.6, y: canvasBox.y + canvasBox.height * 0.53 },
  )
  const interruptedFly = await qaEvidence(page)
  expect(interruptedFly.autoSpin).toBe(false)
  expect(interruptedFly.camera.zoom).toBeLessThan(7.2)
  await page.getByRole('button', { name: 'Close place details' }).click()

  await runAndWaitForCamera(page, 'fly-to-place', async () => {
    await page.getByRole('button', { name: 'Fly to latest' }).click()
  })
  await expect(page.getByTestId('place-panel')).toContainText('14')
  await expect.poll(async () => (await qaEvidence(page)).renderedSelectionHalos).toBeGreaterThan(0)
  expect((await qaEvidence(page)).selectedPlaceId).toBe('place_shuk_bograshov')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-pin-selected.png'), fullPage: true })

  await page.getByRole('button', { name: 'Close place details' }).click()
  await expect.poll(async () => (await qaEvidence(page)).selectedPlaceId).toBeNull()
  await expect.poll(async () => (await qaEvidence(page)).renderedSelectionHalos).toBe(0)

  const pinPoint = await firstRenderedPoint(page, 'pin')
  if (!pinPoint) throw new Error('No renderer pin point was available for selection')
  await page.mouse.move(pinPoint[0], pinPoint[1])
  await expect(page.locator('.maplibregl-popup')).toBeVisible()
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.48, canvasBox.y + canvasBox.height * 0.84)
  await expect(page.locator('.maplibregl-popup')).toBeHidden()
  await page.mouse.click(pinPoint[0], pinPoint[1])
  await expect.poll(async () => (await qaEvidence(page)).selectedPlaceId).not.toBeNull()
  await page.mouse.click(canvasBox.x + canvasBox.width * 0.48, canvasBox.y + canvasBox.height * 0.84)
  await expect.poll(async () => (await qaEvidence(page)).selectedPlaceId).toBeNull()
  await expect.poll(async () => (await qaEvidence(page)).renderedSelectionHalos).toBe(0)

  await page.getByRole('button', { name: 'Heatmap', exact: true }).click()
  await expect.poll(async () => (await qaEvidence(page)).mode).toBe('heatmap')
  await expect.poll(async () => (await qaEvidence(page)).renderedHeatFeatures).toBeGreaterThan(0)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-heatmap.png'), fullPage: true })
  await page.getByRole('button', { name: 'Pins', exact: true }).click()

  const updatesBeforeFilter = (await qaEvidence(page)).sourceUpdates
  const search = page.getByRole('searchbox', { name: 'Search places or cities' })
  await search.fill('Tel Aviv')
  await expect.poll(async () => (await qaEvidence(page)).sourceDatasetFeatures).toBe(2)
  await search.fill('')
  await expect.poll(async () => (await qaEvidence(page)).sourceDatasetFeatures).toBe(12)
  expect((await qaEvidence(page)).sourceUpdates).toBeGreaterThan(updatesBeforeFilter)

  await runAndWaitForCamera(page, 'fit-bounds', async () => {
    await page.getByRole('button', { name: 'Fit purchases' }).click()
  })
  await runAndWaitForCamera(page, 'reset-globe', async () => {
    await page.getByRole('button', { name: 'Reset globe' }).click()
  })
  await runAndWaitForCamera(page, 'fly-to-place', async () => {
    await page.getByRole('button', { name: 'Fly to latest' }).click()
  })

  const storedCamera = await page.evaluate(() => JSON.parse(
    sessionStorage.getItem('spendscape.phase1.globe-camera') ?? 'null',
  ) as CameraEvidence | null)
  expect(storedCamera).not.toBeNull()
  await page.reload()
  await waitForGlobe(page)
  await canvas.click({ position: { x: canvasBox.width * 0.5, y: canvasBox.height * 0.5 }, force: true })
  const restoredCamera = (await qaEvidence(page)).camera
  expect(Math.abs(restoredCamera.center[0] - storedCamera!.center[0])).toBeLessThan(3)
  expect(Math.abs(restoredCamera.center[1] - storedCamera!.center[1])).toBeLessThan(3)
  expect(Math.abs(restoredCamera.zoom - storedCamera!.zoom)).toBeLessThan(0.25)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-camera-restored.png'), fullPage: true })

  const finalEvidence = await qaEvidence(page)
  expect(errors).toEqual([])
  await writeFile(path.join(artifactDir, 'canonical-source-evidence.json'), JSON.stringify({
    measuredAt: new Date().toISOString(),
    invariant: 'The canonical unclustered GeoJSON contains one feature per confirmed physical place.',
    canonicalGeoJsonFeatures: finalEvidence.canonicalGeoJsonFeatures,
    canonicalPins: finalEvidence.canonicalPins,
    physicalPurchases: finalEvidence.physicalPurchases,
    recurringPlacePurchases: finalEvidence.recurringPlacePurchases,
    recurringPlacePins: finalEvidence.recurringPlacePins,
    onlineExcluded: finalEvidence.onlineExcluded,
    unresolvedExcluded: finalEvidence.unresolvedExcluded,
    rendererDiagnostic: {
      queryFeatures: finalEvidence.rendererQueryFeatures,
      queryClusters: finalEvidence.rendererQueryClusters,
      queryPlaces: finalEvidence.rendererQueryPlaces,
      queryUniquePlaces: finalEvidence.rendererQueryUniquePlaces,
      representedPlaces: finalEvidence.rendererRepresentedPlaces,
    },
    priorSourceFeatures13Explanation: 'The prior sourceFeatures value came from MapLibre querySourceFeatures() on a clustered renderer source. That query can return cluster-generated and tile/query features, so it was not the underlying GeoJSON feature count. The canonical input length is independently asserted as 12.',
  }, null, 2))

  await saveVideo(context, page, 'desktop-interactions.webm')
})

test('records mobile touch, disclosure, RTL, keyboard, empty, loading, failure, and reduced-motion evidence', async ({ browser }) => {
  const mobileViewport = { width: 390, height: 844 }
  const mobileContext = await createContext(browser, mobileViewport, { recordVideo: true, hasTouch: true })
  const mobilePage = await mobileContext.newPage()
  const mobileErrors = collectErrors(mobilePage)
  await mobilePage.goto('/')
  await waitForGlobe(mobilePage)
  await mobilePage.waitForTimeout(1_500)
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-globe.png'), fullPage: true })

  const canvas = mobilePage.getByRole('application', { name: 'Interactive globe of synthetic purchase places' })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Globe canvas has no mobile bounds')
  const beforeTouch = await qaEvidence(mobilePage)
  const cdp = await mobileContext.newCDPSession(mobilePage)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width * 0.5, y: box.y + box.height * 0.46 }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: box.x + box.width * 0.67, y: box.y + box.height * 0.5 }],
  })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobilePage.waitForTimeout(500)
  const afterTouch = await qaEvidence(mobilePage)
  expect(afterTouch.autoSpin).toBe(false)
  expect(Math.abs(afterTouch.camera.center[0] - beforeTouch.camera.center[0])).toBeGreaterThan(2)

  await mobilePage.getByRole('button', { name: 'Globe tools' }).click()
  await expect(mobilePage.getByTestId('globe-tools')).toBeVisible()
  await expect(mobilePage.getByRole('button', { name: 'Fit purchases' })).toBeVisible()
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-tools.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: 'Heatmap', exact: true }).click()
  await expect.poll(async () => (await qaEvidence(mobilePage)).mode).toBe('heatmap')
  await mobilePage.getByRole('button', { name: 'Pins', exact: true }).click()
  await mobilePage.getByRole('button', { name: 'Close globe tools' }).last().click()

  await runAndWaitForCamera(mobilePage, 'fly-to-place', async () => {
    await mobilePage.getByRole('button', { name: 'Fly to latest' }).last().click()
  })
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-pin-selected.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: 'Close place details' }).click()
  await expect.poll(async () => (await qaEvidence(mobilePage)).renderedSelectionHalos).toBe(0)

  await mobilePage.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await expect(mobilePage.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect.poll(async () => (await qaEvidence(mobilePage)).locale).toBe('he')
  expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-rtl.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: 'מעבר לאנגלית' }).click()

  await canvas.focus()
  await expect(canvas).toBeFocused()
  await canvas.press('ArrowRight')
  expect((await qaEvidence(mobilePage)).autoSpin).toBe(false)

  const search = mobilePage.getByRole('searchbox', { name: 'Search places or cities' })
  await search.fill('place-that-does-not-exist')
  await expect(mobilePage.getByTestId('map-empty')).toBeVisible()
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-empty.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: 'Clear filters' }).click()
  await expect.poll(async () => (await qaEvidence(mobilePage)).sourceDatasetFeatures).toBe(12)
  expect(mobileErrors).toEqual([])
  await saveVideo(mobileContext, mobilePage, 'mobile-touch-interactions.webm')

  const smallContext = await createContext(browser, { width: 360, height: 640 })
  const smallPage = await smallContext.newPage()
  await smallPage.goto('/')
  await waitForGlobe(smallPage)
  expect(await smallPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await smallPage.screenshot({ path: path.join(artifactDir, 'mobile-small-360x640.png'), fullPage: true })
  await smallContext.close()

  const largeContext = await createContext(browser, { width: 430, height: 932 })
  const largePage = await largeContext.newPage()
  await largePage.goto('/')
  await waitForGlobe(largePage)
  expect(await largePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await largePage.screenshot({ path: path.join(artifactDir, 'mobile-large-430x932.png'), fullPage: true })
  await largeContext.close()

  const loadingContext = await createContext(browser, mobileViewport)
  const loadingPage = await loadingContext.newPage()
  await loadingPage.goto('/?loading=1', { waitUntil: 'domcontentloaded' })
  await expect(loadingPage.getByTestId('map-loading')).toBeVisible()
  await loadingPage.screenshot({ path: path.join(artifactDir, 'mobile-loading.png'), fullPage: true })
  await waitForGlobe(loadingPage)
  await loadingContext.close()

  const failureContext = await createContext(browser, mobileViewport)
  const failurePage = await failureContext.newPage()
  await failurePage.goto('/?mapFailure=1')
  await expect(failurePage.getByTestId('map-failure')).toBeVisible()
  await failurePage.screenshot({ path: path.join(artifactDir, 'mobile-map-failure.png'), fullPage: true })
  await failurePage.getByRole('button', { name: 'Retry map' }).click()
  await waitForGlobe(failurePage)
  await failureContext.close()

  const motionContext = await createContext(browser, { width: 1440, height: 900 }, { reducedMotion: 'reduce' })
  const motionPage = await motionContext.newPage()
  await motionPage.goto('/')
  await waitForGlobe(motionPage)
  const motionEvidence = await qaEvidence(motionPage)
  expect(motionEvidence.reducedMotion).toBe(true)
  expect(motionEvidence.autoSpin).toBe(false)
  await expect(motionPage.getByRole('button', { name: 'Resume orbit' })).toBeDisabled()
  await runAndWaitForCamera(motionPage, 'reset-globe', async () => {
    await motionPage.getByRole('button', { name: 'Reset globe' }).click()
  })
  expect((await qaEvidence(motionPage)).performance.lastCameraMs).toBeLessThan(250)
  await motionPage.screenshot({ path: path.join(artifactDir, 'desktop-reduced-motion.png'), fullPage: true })
  await motionContext.close()
})
