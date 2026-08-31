import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-globe-fidelity-correction')

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
  renderedPlaceLabels: number
  camera: CameraEvidence
  performance: PerformanceEvidence
  input: {
    scrollZoomEnabled: boolean
    cooperativeGesturesEnabled: boolean
    rtlPluginStatus: string
    wheelEvents: number
    smallDeltaWheelEvents: number
    lastWheelDeltaY: number | null
    lastWheelClientPoint: [number, number] | null
  }
  mapStyle: {
    name: string | null
    sourceUrl: string
    projection: string | null
    pinColor: string | null
    clusterColor: unknown
    heatmapColor: unknown
    layerOrder: {
      firstLibertySymbol: { id: string; index: number } | null
      building: number | null
      building3d: number | null
      heatmap: number | null
      clusterGlow: number | null
      cluster: number | null
      clusterCount: number | null
      pinGlow: number | null
      pinShadow: number | null
      pin: number | null
      selectionGlow: number | null
      selectionHalo: number | null
      label: number | null
    } | null
    pinOpacity: unknown
    pinStrokeColor: unknown
    pinRadius: unknown
    pinStrokeWidth: unknown
    pinPitchAlignment: unknown
    pinPitchScale: unknown
    selectionGlowOpacity: unknown
    selectionHaloColor: unknown
    selectionHaloStroke: unknown
    heatmapWeight: unknown
    heatmapIntensity: unknown
    heatmapRadius: unknown
    heatmapOpacity: unknown
    pinVisibility: unknown
    heatmapVisibility: unknown
    layerVisibility: Record<string, unknown>
  }
}

interface QaActions {
  firstRenderedPoint: (layerId: 'cluster' | 'pin') => [number, number] | null
  jumpTo: (center: [number, number], zoom: number, pitch?: number) => void
  unproject: (point: [number, number]) => [number, number]
  renderedPlaceIdsAt: (placeId: string) => string[]
  renderedBasemapLabels: () => Array<{
    name: string | null
    nameLatin: string | null
    nameNonLatin: string | null
    nameEnglish: string | null
    sourceLayer: string | null
  }>
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

async function jumpTo(page: Page, center: [number, number], zoom: number, pitch = 0) {
  await page.evaluate(({ requestedCenter, requestedZoom, requestedPitch }) => {
    const actions = (window as typeof window & { __SPENDSCAPE_QA_ACTIONS__?: QaActions }).__SPENDSCAPE_QA_ACTIONS__
    if (!actions) throw new Error('Spendscape QA actions are unavailable')
    actions.jumpTo(requestedCenter, requestedZoom, requestedPitch)
  }, { requestedCenter: center, requestedZoom: zoom, requestedPitch: pitch })
  await page.waitForTimeout(900)
}

async function renderedPlaceIdsAt(page: Page, placeId: string) {
  return page.evaluate((requestedPlaceId) => {
    const actions = (window as typeof window & { __SPENDSCAPE_QA_ACTIONS__?: QaActions }).__SPENDSCAPE_QA_ACTIONS__
    if (!actions) throw new Error('Spendscape QA actions are unavailable')
    return actions.renderedPlaceIdsAt(requestedPlaceId)
  }, placeId)
}

async function unproject(page: Page, point: [number, number]) {
  return page.evaluate((requestedPoint) => {
    const actions = (window as typeof window & { __SPENDSCAPE_QA_ACTIONS__?: QaActions }).__SPENDSCAPE_QA_ACTIONS__
    if (!actions) throw new Error('Spendscape QA actions are unavailable')
    return actions.unproject(requestedPoint)
  }, point)
}

async function renderedBasemapLabels(page: Page) {
  return page.evaluate(() => {
    const actions = (window as typeof window & { __SPENDSCAPE_QA_ACTIONS__?: QaActions }).__SPENDSCAPE_QA_ACTIONS__
    if (!actions) throw new Error('Spendscape QA actions are unavailable')
    return actions.renderedBasemapLabels()
  })
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

function assertLayerAndPaintContracts(evidence: GlobeQaEvidence) {
  const order = evidence.mapStyle.layerOrder
  expect(order).not.toBeNull()
  if (!order) return

  const highestBuilding = Math.max(order.building ?? -1, order.building3d ?? -1)
  const topLevelLayers = [
    order.heatmap,
    order.clusterGlow,
    order.cluster,
    order.clusterCount,
    order.pinGlow,
    order.pinShadow,
    order.pin,
    order.selectionGlow,
    order.selectionHalo,
    order.label,
  ]
  for (const index of topLevelLayers) {
    expect(index).not.toBeNull()
    expect(index!).toBeGreaterThan(highestBuilding)
  }
  expect(order.selectionGlow!).toBeLessThan(order.pin!)
  expect(order.pinShadow!).toBeLessThan(order.pin!)
  expect(order.pin!).toBeLessThan(order.selectionHalo!)
  expect(order.cluster!).toBeLessThan(order.clusterCount!)
  expect(order.label!).toBeGreaterThan(Math.max(...topLevelLayers.filter((index): index is number => index !== null && index !== order.label)))

  expect(evidence.mapStyle.pinOpacity).toBe(1)
  expect(evidence.mapStyle.pinColor).toBe('#256abf')
  expect(evidence.mapStyle.pinStrokeColor).toBe('#f7fbff')
  expect(evidence.mapStyle.pinPitchAlignment).toBe('viewport')
  expect(evidence.mapStyle.pinPitchScale).toBe('viewport')
  expect(JSON.stringify(evidence.mapStyle.pinRadius)).toContain('15.2')
  expect(JSON.stringify(evidence.mapStyle.pinRadius)).toContain('14')
  expect(JSON.stringify(evidence.mapStyle.pinStrokeWidth)).toContain('2.6')
  expect(evidence.mapStyle.selectionHaloColor).toBe('rgba(255,255,255,0)')
  expect(evidence.mapStyle.selectionHaloStroke).toBe('#ffffff')
  expect(Number(evidence.mapStyle.selectionGlowOpacity)).toBeGreaterThan(0)

  expect(evidence.mapStyle.heatmapOpacity).toBe(0.82)
  expect(evidence.mapStyle.heatmapIntensity).toEqual([
    'interpolate', ['linear'], ['zoom'], 2, 0.7, 12, 2.4, 16, 2.8,
  ])
  expect(evidence.mapStyle.heatmapRadius).toEqual([
    'interpolate', ['linear'], ['zoom'], 2, 8, 12, 42, 16, 58,
  ])
  expect(JSON.stringify(evidence.mapStyle.heatmapWeight)).toContain('sqrt')
  expect((evidence.mapStyle.heatmapColor as unknown[]).at(-1)).toBe('#0d366b')
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
  expect(baseline.input.scrollZoomEnabled).toBe(true)
  expect(baseline.input.cooperativeGesturesEnabled).toBe(false)
  expect(baseline.input.rtlPluginStatus).toBe('loaded')
  expect(baseline.mapStyle.name).toContain('Liberty')
  expect(baseline.mapStyle.sourceUrl).toBe('https://tiles.openfreemap.org/styles/liberty')
  expect(baseline.mapStyle.projection).toBe('globe')
  expect(baseline.mapStyle.pinColor).toBe('#256abf')
  assertLayerAndPaintContracts(baseline)
  expect(JSON.stringify(baseline.mapStyle.clusterColor)).not.toMatch(/#(?:8e66ff|d365ff|7652e5|aa4bd4)/i)
  expect(JSON.stringify(baseline.mapStyle.heatmapColor)).not.toMatch(/(?:183, 91, 255|255, 239, 201)/)

  const rotationStart = baseline.camera.center[0]
  await page.waitForTimeout(3_800)
  expect(Math.abs((await qaEvidence(page)).camera.center[0] - rotationStart)).toBeGreaterThan(1.5)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-liberty-world.png'), fullPage: true })

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

  const cursorPoint: [number, number] = [canvasBox.width * 0.68, canvasBox.height * 0.48]
  await page.mouse.move(canvasBox.x + cursorPoint[0], canvasBox.y + cursorPoint[1])
  const cursorAnchorBefore = await unproject(page, cursorPoint)
  const cameraBeforeSmallDelta = (await qaEvidence(page)).camera
  const zoomBeforeSmallDelta = cameraBeforeSmallDelta.zoom
  const smallDeltaEventsBefore = (await qaEvidence(page)).input.smallDeltaWheelEvents
  for (let index = 0; index < 24; index += 1) {
    await page.mouse.wheel(0, -1)
    await page.waitForTimeout(8)
  }
  await page.waitForTimeout(450)
  const afterSmallDelta = await qaEvidence(page)
  const cursorAnchorAfter = await unproject(page, cursorPoint)
  expect(afterSmallDelta.camera.zoom).toBeGreaterThan(zoomBeforeSmallDelta + 0.05)
  expect(afterSmallDelta.input.smallDeltaWheelEvents - smallDeltaEventsBefore).toBe(24)
  expect(Math.abs(afterSmallDelta.camera.center[0] - cameraBeforeSmallDelta.center[0])).toBeGreaterThan(0.05)
  const initialCursorDistance = Math.hypot(
    cursorAnchorBefore[0] - cameraBeforeSmallDelta.center[0],
    cursorAnchorBefore[1] - cameraBeforeSmallDelta.center[1],
  )
  const cursorAnchorDrift = Math.hypot(
    cursorAnchorAfter[0] - cursorAnchorBefore[0],
    cursorAnchorAfter[1] - cursorAnchorBefore[1],
  )
  expect(cursorAnchorDrift).toBeLessThan(initialCursorDistance * 0.5)

  const zoomBeforeWheel = afterSmallDelta.camera.zoom
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.52, canvasBox.y + canvasBox.height * 0.5)
  await page.mouse.wheel(0, -520)
  await page.waitForTimeout(650)
  expect((await qaEvidence(page)).camera.zoom).toBeGreaterThan(zoomBeforeWheel)

  const zoomBeforeOutsideWheel = (await qaEvidence(page)).camera.zoom
  const brandBox = await page.getByRole('button', { name: 'Spendscape' }).boundingBox()
  if (!brandBox) throw new Error('Brand control has no bounds')
  await page.mouse.move(brandBox.x + brandBox.width / 2, brandBox.y + brandBox.height / 2)
  await page.mouse.wheel(0, -240)
  await page.waitForTimeout(350)
  expect(Math.abs((await qaEvidence(page)).camera.zoom - zoomBeforeOutsideWheel)).toBeLessThan(0.01)

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
  expect(Math.abs(interruptedFly.camera.zoom - 15.2)).toBeGreaterThan(0.3)
  await page.waitForTimeout(900)
  const settledAfterPointerInterruption = await qaEvidence(page)
  expect(Math.abs(settledAfterPointerInterruption.camera.zoom - 15.2)).toBeGreaterThan(0.3)
  await page.waitForTimeout(600)
  const stableAfterPointerInterruption = await qaEvidence(page)
  expect(Math.abs(stableAfterPointerInterruption.camera.zoom - settledAfterPointerInterruption.camera.zoom)).toBeLessThan(0.05)
  expect(Math.abs(stableAfterPointerInterruption.camera.center[0] - settledAfterPointerInterruption.camera.center[0])).toBeLessThan(0.1)
  await page.getByRole('button', { name: 'Close place details' }).click()

  await runAndWaitForCamera(page, 'reset-globe', async () => {
    await page.getByRole('button', { name: 'Reset globe' }).click()
  })
  await page.getByRole('button', { name: 'Fly to latest' }).click()
  await page.waitForTimeout(80)
  const wheelEventsBeforeFlyInterruption = (await qaEvidence(page)).input.wheelEvents
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.62, canvasBox.y + canvasBox.height * 0.47)
  for (let index = 0; index < 6; index += 1) await page.mouse.wheel(0, -1)
  await page.waitForTimeout(450)
  const interruptedByTrackpad = await qaEvidence(page)
  expect(interruptedByTrackpad.input.wheelEvents - wheelEventsBeforeFlyInterruption).toBe(6)
  expect(Math.abs(interruptedByTrackpad.camera.zoom - 15.2)).toBeGreaterThan(0.3)
  await page.waitForTimeout(900)
  expect(Math.abs((await qaEvidence(page)).camera.zoom - interruptedByTrackpad.camera.zoom)).toBeLessThan(0.05)
  await page.getByRole('button', { name: 'Close place details' }).click()

  await runAndWaitForCamera(page, 'reset-globe', async () => {
    await page.getByRole('button', { name: 'Reset globe' }).click()
  })
  await page.getByRole('button', { name: 'Fly to latest' }).click()
  await page.waitForTimeout(80)
  await page.keyboard.press('Escape')
  const interruptedByEscape = await qaEvidence(page)
  expect(interruptedByEscape.selectedPlaceId).toBeNull()
  expect(Math.abs(interruptedByEscape.camera.zoom - 15.2)).toBeGreaterThan(0.3)
  await page.waitForTimeout(900)
  expect(Math.abs((await qaEvidence(page)).camera.zoom - interruptedByEscape.camera.zoom)).toBeLessThan(0.05)

  await runAndWaitForCamera(page, 'reset-globe', async () => {
    await page.getByRole('button', { name: 'Reset globe' }).click()
  })
  await page.getByRole('button', { name: 'Fly to latest' }).click()
  await page.waitForTimeout(80)
  await canvas.focus()
  await canvas.press('ArrowRight')
  await page.waitForTimeout(450)
  const interruptedByKeyboard = await qaEvidence(page)
  expect(Math.abs(interruptedByKeyboard.camera.zoom - 15.2)).toBeGreaterThan(0.3)
  await page.waitForTimeout(900)
  expect(Math.abs((await qaEvidence(page)).camera.zoom - interruptedByKeyboard.camera.zoom)).toBeLessThan(0.05)
  await page.getByRole('button', { name: 'Close place details' }).click()

  await runAndWaitForCamera(page, 'fly-to-place', async () => {
    await page.getByRole('button', { name: 'Fly to latest' }).click()
  })
  expect((await qaEvidence(page)).camera.zoom).toBeCloseTo(15.2, 1)
  await expect(page.getByTestId('place-panel')).toContainText('14')
  await expect.poll(async () => (await qaEvidence(page)).renderedSelectionHalos).toBeGreaterThan(0)
  expect((await qaEvidence(page)).selectedPlaceId).toBe('place_shuk_bograshov')
  expect(await renderedPlaceIdsAt(page, 'place_shuk_bograshov')).toContain('place_shuk_bograshov')
  await expect.poll(async () => (await qaEvidence(page)).renderedPlaceLabels).toBeGreaterThan(0)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-pin-selected.png'), fullPage: true })

  await page.getByRole('button', { name: 'Close place details' }).click()
  await expect.poll(async () => (await qaEvidence(page)).selectedPlaceId).toBeNull()
  await expect.poll(async () => (await qaEvidence(page)).renderedSelectionHalos).toBe(0)

  // The completed place flight centers the selected canonical pin. Using that known
  // renderer position avoids accidentally targeting another visible pin under UI chrome.
  const pinPoint: [number, number] = [
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2,
  ]
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
  const heatEvidence = await qaEvidence(page)
  expect(heatEvidence.mapStyle.heatmapVisibility).toBe('visible')
  expect(heatEvidence.mapStyle.pinVisibility).toBe('none')
  assertLayerAndPaintContracts(heatEvidence)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-heatmap.png'), fullPage: true })
  await page.getByRole('button', { name: 'Pins', exact: true }).click()
  await expect.poll(async () => (await qaEvidence(page)).mapStyle.pinVisibility).toBe('visible')
  await expect.poll(async () => (await qaEvidence(page)).mapStyle.heatmapVisibility).toBe('none')

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

  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await jumpTo(page, [35.05, 31.9], 7.1)
  const israelLabels = await renderedBasemapLabels(page)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-hebrew-israel-country-cities.png'), fullPage: true })

  const cityEvidence = []
  for (const city of [
    { expected: 'תל אביב', center: [34.78, 32.08] as [number, number] },
    { expected: 'ירושלים', center: [35.21, 31.77] as [number, number] },
    { expected: 'חיפה', center: [34.99, 32.79] as [number, number] },
    { expected: 'באר שבע', center: [34.79, 31.25] as [number, number] },
  ]) {
    await jumpTo(page, city.center, 9.2)
    cityEvidence.push(...await renderedBasemapLabels(page))
  }
  await jumpTo(page, [34.7735, 32.0748], 15.2)
  const streetLabels = await renderedBasemapLabels(page)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-hebrew-israel-street.png'), fullPage: true })
  const combinedLabels = JSON.stringify([...israelLabels, ...cityEvidence, ...streetLabels])
  for (const expected of ['ישראל', 'תל אביב', 'ירושלים', 'חיפה', 'באר שבע']) {
    expect(combinedLabels).toContain(expected)
  }
  expect(streetLabels.some((label) => (
    label.sourceLayer === 'transportation_name'
    && /[\u0590-\u05ff]/.test(JSON.stringify(label))
  ))).toBe(true)
  await writeFile(path.join(artifactDir, 'rtl-label-evidence.json'), JSON.stringify({
    pluginStatus: (await qaEvidence(page)).input.rtlPluginStatus,
    israelLabels,
    cityEvidence,
    streetLabels,
  }, null, 2))

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

test('proves top-layer close-zoom pins and visible heatmap density across supported cameras', async ({ browser }) => {
  const context = await createContext(browser, { width: 1440, height: 900 })
  const page = await context.newPage()
  const errors = collectErrors(page)
  await page.goto('/')
  await waitForGlobe(page)

  const pinsButton = page.getByRole('button', { name: 'Pins', exact: true })
  const heatmapButton = page.getByRole('button', { name: 'Heatmap', exact: true })
  const pinLayerIds = [
    'spendscape-cluster-glow',
    'spendscape-clusters',
    'spendscape-cluster-count',
    'spendscape-pin-glow',
    'spendscape-pin-shadow',
    'spendscape-selected-glow',
    'spendscape-selected-halo',
    'spendscape-place-pins',
    'spendscape-place-labels',
  ]

  const initialEvidence = await qaEvidence(page)
  assertLayerAndPaintContracts(initialEvidence)

  await jumpTo(page, [35.05, 31.9], 7)
  const regionalPinsCamera = (await qaEvidence(page)).camera
  await page.screenshot({ path: path.join(artifactDir, 'desktop-regional-pins.png'), fullPage: true })
  await heatmapButton.click()
  await expect.poll(async () => (await qaEvidence(page)).renderedHeatFeatures).toBeGreaterThan(0)
  const regionalHeat = await qaEvidence(page)
  expect(regionalHeat.camera).toEqual(regionalPinsCamera)
  expect(regionalHeat.mapStyle.heatmapVisibility).toBe('visible')
  for (const layerId of pinLayerIds) expect(regionalHeat.mapStyle.layerVisibility[layerId]).toBe('none')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-regional-heatmap.png'), fullPage: true })
  await pinsButton.click()

  await jumpTo(page, [34.78, 32.08], 10)
  const cityPinsCamera = (await qaEvidence(page)).camera
  await page.screenshot({ path: path.join(artifactDir, 'desktop-city-pins.png'), fullPage: true })
  await heatmapButton.click()
  await expect.poll(async () => (await qaEvidence(page)).renderedHeatFeatures).toBeGreaterThan(0)
  expect((await qaEvidence(page)).camera).toEqual(cityPinsCamera)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-city-heatmap.png'), fullPage: true })
  await pinsButton.click()

  await jumpTo(page, [34.844, 32.163], 13)
  expect(await renderedPlaceIdsAt(page, 'place_rimon_park')).toContain('place_rimon_park')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-zoom13-park-pin.png'), fullPage: true })

  await jumpTo(page, [151.2127, -33.8843], 13)
  expect(await renderedPlaceIdsAt(page, 'place_harbour_surry')).toContain('place_harbour_surry')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-zoom13-water-pin.png'), fullPage: true })

  await jumpTo(page, [34.7735, 32.0748], 15.2)
  await expect.poll(async () => (await qaEvidence(page)).renderedPlaceLabels).toBeGreaterThan(0)
  expect(await renderedPlaceIdsAt(page, 'place_shuk_bograshov')).toContain('place_shuk_bograshov')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-close-zoom-pin-unselected.png'), fullPage: true })

  await runAndWaitForCamera(page, 'fly-to-place', async () => {
    await page.getByRole('button', { name: 'Fly to latest' }).click()
  })
  let closeEvidence = await qaEvidence(page)
  expect(closeEvidence.selectedPlaceId).toBe('place_shuk_bograshov')
  expect(closeEvidence.renderedSelectionHalos).toBeGreaterThan(0)
  expect(await renderedPlaceIdsAt(page, 'place_shuk_bograshov')).toContain('place_shuk_bograshov')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-close-zoom-pin-selected.png'), fullPage: true })

  await heatmapButton.click()
  await expect.poll(async () => (await qaEvidence(page)).renderedHeatFeatures).toBeGreaterThan(0)
  closeEvidence = await qaEvidence(page)
  expect(closeEvidence.mapStyle.heatmapVisibility).toBe('visible')
  for (const layerId of pinLayerIds) expect(closeEvidence.mapStyle.layerVisibility[layerId]).toBe('none')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-close-zoom-heatmap.png'), fullPage: true })

  for (let index = 0; index < 3; index += 1) {
    await pinsButton.click()
    await expect.poll(async () => (await qaEvidence(page)).mapStyle.pinVisibility).toBe('visible')
    expect(await renderedPlaceIdsAt(page, 'place_shuk_bograshov')).toContain('place_shuk_bograshov')
    await heatmapButton.click()
    await expect.poll(async () => (await qaEvidence(page)).mapStyle.heatmapVisibility).toBe('visible')
  }
  await pinsButton.click()
  await expect.poll(async () => (await qaEvidence(page)).renderedSelectionHalos).toBeGreaterThan(0)
  assertLayerAndPaintContracts(await qaEvidence(page))
  await page.screenshot({ path: path.join(artifactDir, 'desktop-close-zoom-pins-restored.png'), fullPage: true })

  await jumpTo(page, [34.7735, 32.0748], 15.2, 48)
  expect(await renderedPlaceIdsAt(page, 'place_shuk_bograshov')).toContain('place_shuk_bograshov')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-close-zoom-pitched.png'), fullPage: true })

  await jumpTo(page, [34.7735, 32.0748], 16)
  expect(await renderedPlaceIdsAt(page, 'place_shuk_bograshov')).toContain('place_shuk_bograshov')
  await page.screenshot({ path: path.join(artifactDir, 'desktop-close-zoom-max.png'), fullPage: true })
  await heatmapButton.click()
  await expect.poll(async () => (await qaEvidence(page)).renderedHeatFeatures).toBeGreaterThan(0)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-close-zoom-max-heatmap.png'), fullPage: true })
  await pinsButton.click()
  expect(await renderedPlaceIdsAt(page, 'place_shuk_bograshov')).toContain('place_shuk_bograshov')

  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByTestId('place-panel')).toContainText('שוק אקספרס')
  await expect.poll(async () => (await qaEvidence(page)).renderedPlaceLabels).toBeGreaterThan(0)
  await page.screenshot({ path: path.join(artifactDir, 'desktop-close-zoom-hebrew.png'), fullPage: true })

  const finalEvidence = await qaEvidence(page)
  await writeFile(path.join(artifactDir, 'layer-order-after-close-zoom-fix.json'), JSON.stringify({
    measuredAt: new Date().toISOString(),
    viewport: '1440x900',
    layerOrder: finalEvidence.mapStyle.layerOrder,
    paint: {
      pinColor: finalEvidence.mapStyle.pinColor,
      pinOpacity: finalEvidence.mapStyle.pinOpacity,
      pinRadius: finalEvidence.mapStyle.pinRadius,
      pinStrokeColor: finalEvidence.mapStyle.pinStrokeColor,
      pinStrokeWidth: finalEvidence.mapStyle.pinStrokeWidth,
      heatmapWeight: finalEvidence.mapStyle.heatmapWeight,
      heatmapIntensity: finalEvidence.mapStyle.heatmapIntensity,
      heatmapRadius: finalEvidence.mapStyle.heatmapRadius,
      heatmapColor: finalEvidence.mapStyle.heatmapColor,
      heatmapOpacity: finalEvidence.mapStyle.heatmapOpacity,
    },
  }, null, 2))
  expect(errors).toEqual([])
  await context.close()
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

  const zoomBeforePinch = afterTouch.camera.zoom
  const pinchCenter = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.48 }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: pinchCenter.x - 28, y: pinchCenter.y },
      { x: pinchCenter.x + 28, y: pinchCenter.y },
    ],
  })
  for (const distance of [38, 50, 64, 78]) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: pinchCenter.x - distance, y: pinchCenter.y },
        { x: pinchCenter.x + distance, y: pinchCenter.y },
      ],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobilePage.waitForTimeout(500)
  expect((await qaEvidence(mobilePage)).camera.zoom).toBeGreaterThan(zoomBeforePinch + 0.15)

  await mobilePage.getByRole('button', { name: 'Fly to latest' }).last().click()
  await mobilePage.waitForTimeout(80)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width * 0.48, y: box.y + box.height * 0.44 }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: box.x + box.width * 0.63, y: box.y + box.height * 0.48 }],
  })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobilePage.waitForTimeout(450)
  const interruptedByTouch = await qaEvidence(mobilePage)
  expect(Math.abs(interruptedByTouch.camera.zoom - 15.2)).toBeGreaterThan(0.3)
  await mobilePage.waitForTimeout(900)
  expect(Math.abs((await qaEvidence(mobilePage)).camera.zoom - interruptedByTouch.camera.zoom)).toBeLessThan(0.05)
  await mobilePage.getByRole('button', { name: 'Close place details' }).click()

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
  expect(await renderedPlaceIdsAt(mobilePage, 'place_shuk_bograshov')).toContain('place_shuk_bograshov')
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-pin-selected.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: 'Close place details' }).click()
  await expect(mobilePage.getByTestId('place-panel')).toBeHidden()
  await expect.poll(async () => (await qaEvidence(mobilePage)).renderedSelectionHalos).toBe(0)
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-pin-dismissed.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: 'Globe tools' }).click()
  await mobilePage.getByRole('button', { name: 'Heatmap', exact: true }).click()
  await expect.poll(async () => (await qaEvidence(mobilePage)).renderedHeatFeatures).toBeGreaterThan(0)
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-close-zoom-heatmap.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: 'Pins', exact: true }).click()
  await mobilePage.getByRole('button', { name: 'Close globe tools' }).last().click()
  await runAndWaitForCamera(mobilePage, 'fly-to-place', async () => {
    await mobilePage.getByRole('button', { name: 'Fly to latest' }).last().click()
  })
  await expect.poll(async () => (await qaEvidence(mobilePage)).renderedSelectionHalos).toBeGreaterThan(0)
  expect(await renderedPlaceIdsAt(mobilePage, 'place_shuk_bograshov')).toContain('place_shuk_bograshov')
  await expect(mobilePage.getByTestId('place-panel')).toHaveCSS('opacity', '1')
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-close-zoom-pins-restored.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await expect(mobilePage.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect.poll(async () => (await qaEvidence(mobilePage)).locale).toBe('he')
  expect((await qaEvidence(mobilePage)).input.rtlPluginStatus).toBe('loaded')
  await expect(mobilePage.getByTestId('place-panel')).toContainText('שוק אקספרס')
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-hebrew-place-selected.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: 'סגירת פרטי מקום' }).click()
  await expect.poll(async () => (await qaEvidence(mobilePage)).renderedSelectionHalos).toBe(0)
  expect(JSON.stringify(await renderedBasemapLabels(mobilePage))).toMatch(/[\u0590-\u05ff]/)
  expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile-hebrew-liberty-street.png'), fullPage: true })
  await mobilePage.getByRole('button', { name: 'מעבר לאנגלית' }).click()

  await canvas.focus()
  await expect(canvas).toBeFocused()
  await canvas.press('ArrowRight')
  expect((await qaEvidence(mobilePage)).autoSpin).toBe(false)
  const zoomBeforeKeyboard = (await qaEvidence(mobilePage)).camera.zoom
  await canvas.press('+')
  await mobilePage.waitForTimeout(500)
  const zoomAfterKeyboardPlus = (await qaEvidence(mobilePage)).camera.zoom
  expect(zoomAfterKeyboardPlus).toBeGreaterThan(zoomBeforeKeyboard)
  await canvas.press('-')
  await mobilePage.waitForTimeout(500)
  expect((await qaEvidence(mobilePage)).camera.zoom).toBeLessThan(zoomAfterKeyboardPlus)

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
  await runAndWaitForCamera(smallPage, 'fly-to-place', async () => {
    await smallPage.getByRole('button', { name: 'Fly to latest' }).last().click()
  })
  expect(await renderedPlaceIdsAt(smallPage, 'place_shuk_bograshov')).toContain('place_shuk_bograshov')
  await smallPage.screenshot({ path: path.join(artifactDir, 'mobile-small-close-zoom-pin.png'), fullPage: true })
  await smallPage.getByRole('button', { name: 'Close place details' }).click()
  await expect.poll(async () => (await qaEvidence(smallPage)).renderedSelectionHalos).toBe(0)
  await smallPage.getByRole('button', { name: 'Globe tools' }).click()
  await smallPage.getByRole('button', { name: 'Heatmap', exact: true }).click()
  await expect.poll(async () => (await qaEvidence(smallPage)).renderedHeatFeatures).toBeGreaterThan(0)
  await smallPage.screenshot({ path: path.join(artifactDir, 'mobile-small-close-zoom-heatmap.png'), fullPage: true })
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
  await runAndWaitForCamera(motionPage, 'fly-to-place', async () => {
    await motionPage.getByRole('button', { name: 'Fly to latest' }).click()
  })
  expect((await qaEvidence(motionPage)).camera.zoom).toBeCloseTo(15.2, 1)
  expect((await qaEvidence(motionPage)).performance.lastCameraMs).toBeLessThan(250)
  await motionPage.screenshot({ path: path.join(artifactDir, 'desktop-reduced-motion.png'), fullPage: true })
  await motionContext.close()
})
