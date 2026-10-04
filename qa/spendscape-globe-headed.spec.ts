import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { arch, platform, release } from 'node:os'
import path from 'node:path'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-globe-fidelity-correction', 'headed')

interface QaEvidence {
  ready: boolean
  autoSpin: boolean
  mode: 'pins' | 'heatmap'
  selectedPlaceId: string | null
  sourceDatasetFeatures: number
  sourceUpdates: number
  renderedClusters: number
  camera: { center: [number, number]; zoom: number }
  performance: { lastCameraAction: string | null; lastCameraMs: number | null }
  input: {
    scrollZoomEnabled: boolean
    cooperativeGesturesEnabled: boolean
    rtlPluginStatus: string
    wheelEvents: number
    smallDeltaWheelEvents: number
  }
}

interface QaActions {
  firstRenderedPoint: (layerId: 'cluster' | 'pin') => [number, number] | null
}

interface FrameProbeResult {
  name: string
  durationMs: number
  samples: number
  medianFrameMs: number
  p95FrameMs: number
  maxFrameMs: number
  over16_7msPercent: number
  over33_3msPercent: number
  medianFpsEquivalent: number | null
}

async function waitForGlobe(page: Page) {
  await page.waitForFunction(() => (
    window as typeof window & { __SPENDSCAPE_QA__?: QaEvidence }
  ).__SPENDSCAPE_QA__?.ready === true, undefined, { timeout: 20_000 })
  await page.waitForTimeout(450)
}

async function qa(page: Page): Promise<QaEvidence> {
  return page.evaluate(() => structuredClone((
    window as typeof window & { __SPENDSCAPE_QA__: QaEvidence }
  ).__SPENDSCAPE_QA__))
}

async function firstPoint(page: Page, layerId: 'cluster' | 'pin') {
  return page.evaluate((requestedLayer) => (
    window as typeof window & { __SPENDSCAPE_QA_ACTIONS__?: QaActions }
  ).__SPENDSCAPE_QA_ACTIONS__?.firstRenderedPoint(requestedLayer) ?? null, layerId)
}

async function startFrameProbe(page: Page, name: string) {
  await page.evaluate((probeName) => {
    type Probe = { name: string; startedAt: number; last: number; samples: number[]; frame: number }
    const host = window as typeof window & { __SPENDSCAPE_FRAME_PROBE__?: Probe }
    const startedAt = performance.now()
    const probe: Probe = { name: probeName, startedAt, last: startedAt, samples: [], frame: 0 }
    const tick = (timestamp: number) => {
      const elapsed = timestamp - probe.last
      if (elapsed > 0 && elapsed < 250) probe.samples.push(elapsed)
      probe.last = timestamp
      probe.frame = requestAnimationFrame(tick)
    }
    probe.frame = requestAnimationFrame(tick)
    host.__SPENDSCAPE_FRAME_PROBE__ = probe
  }, name)
}

async function stopFrameProbe(page: Page): Promise<FrameProbeResult> {
  return page.evaluate(() => {
    type Probe = { name: string; startedAt: number; last: number; samples: number[]; frame: number }
    const host = window as typeof window & { __SPENDSCAPE_FRAME_PROBE__?: Probe }
    const probe = host.__SPENDSCAPE_FRAME_PROBE__
    if (!probe) throw new Error('Frame probe was not started')
    cancelAnimationFrame(probe.frame)
    const ordered = [...probe.samples].sort((a, b) => a - b)
    const at = (percentile: number) => ordered[
      Math.min(ordered.length - 1, Math.floor(Math.max(0, ordered.length - 1) * percentile))
    ] ?? 0
    const round = (value: number) => Math.round(value * 10) / 10
    const percent = (threshold: number) => ordered.length === 0
      ? 0
      : round((ordered.filter((value) => value > threshold).length / ordered.length) * 100)
    const median = at(0.5)
    delete host.__SPENDSCAPE_FRAME_PROBE__
    return {
      name: probe.name,
      durationMs: round(performance.now() - probe.startedAt),
      samples: ordered.length,
      medianFrameMs: round(median),
      p95FrameMs: round(at(0.95)),
      maxFrameMs: round(ordered.at(-1) ?? 0),
      over16_7msPercent: percent(16.7),
      over33_3msPercent: percent(33.3),
      medianFpsEquivalent: median > 0 ? round(1000 / median) : null,
    }
  })
}

async function measure(
  page: Page,
  name: string,
  action: () => Promise<void>,
  settleMs = 500,
) {
  await startFrameProbe(page, name)
  await action()
  await page.waitForTimeout(settleMs)
  return stopFrameProbe(page)
}

async function waitForCameraAction(page: Page, expected: string, previous: number | null) {
  await page.waitForFunction(([action, previousDuration]) => {
    const evidence = (
      window as typeof window & { __SPENDSCAPE_QA__?: QaEvidence }
    ).__SPENDSCAPE_QA__
    return evidence?.performance.lastCameraAction === action
      && evidence.performance.lastCameraMs !== previousDuration
  }, [expected, previous], { timeout: 12_000 })
}

async function clickCameraAction(page: Page, buttonName: string, actionName: string) {
  const before = await qa(page)
  await page.getByRole('button', { name: buttonName }).click()
  await waitForCameraAction(page, actionName, before.performance.lastCameraMs)
}

async function saveVideo(context: BrowserContext, page: Page, filename: string) {
  const video = page.video()
  await page.close()
  await context.close()
  if (!video) throw new Error(`No headed recording for ${filename}`)
  await video.saveAs(path.join(artifactDir, filename))
  await video.delete()
}

test.beforeAll(async () => {
  await mkdir(artifactDir, { recursive: true })
})

test('collects headed Chrome interaction frame diagnostics and recordings', async ({ browser }) => {
  expect(process.env.SPENDSCAPE_HEADED).toBe('1')
  const configurations: Array<{
    name: string
    viewport: { width: number; height: number; deviceScaleFactor: number }
    interactions: FrameProbeResult[]
  }> = []

  const desktopViewport = { width: 1440, height: 900 }
  const desktopContext = await browser.newContext({
    viewport: desktopViewport,
    colorScheme: 'dark',
    locale: 'en-GB',
    recordVideo: { dir: artifactDir, size: desktopViewport },
  })
  const desktop = await desktopContext.newPage()
  await desktop.goto('/')
  await waitForGlobe(desktop)
  await desktop.getByTestId('map-canvas').click({ position: { x: 720, y: 450 }, force: true })
  const canvas = await desktop.getByTestId('map-canvas').boundingBox()
  if (!canvas) throw new Error('No headed desktop canvas bounds')
  const desktopInteractions: FrameProbeResult[] = []

  desktopInteractions.push(await measure(desktop, 'pointer-drag', async () => {
    await desktop.mouse.move(canvas.x + 700, canvas.y + 430)
    await desktop.mouse.down()
    await desktop.mouse.move(canvas.x + 840, canvas.y + 475, { steps: 14 })
    await desktop.mouse.up()
  }, 350))

  desktopInteractions.push(await measure(desktop, 'wheel-zoom', async () => {
    await desktop.mouse.move(canvas.x + 720, canvas.y + 450)
    await desktop.mouse.wheel(0, -540)
  }, 700))

  const zoomBeforeTrackpadSequence = (await qa(desktop)).camera.zoom
  const smallDeltaEventsBefore = (await qa(desktop)).input.smallDeltaWheelEvents
  desktopInteractions.push(await measure(desktop, 'small-delta-trackpad-sequence', async () => {
    await desktop.mouse.move(canvas.x + 860, canvas.y + 430)
    for (let index = 0; index < 24; index += 1) {
      await desktop.mouse.wheel(0, -1)
      await desktop.waitForTimeout(8)
    }
  }, 500))
  expect((await qa(desktop)).camera.zoom).toBeGreaterThan(zoomBeforeTrackpadSequence + 0.05)
  expect((await qa(desktop)).input.smallDeltaWheelEvents - smallDeltaEventsBefore).toBe(24)

  await clickCameraAction(desktop, 'Reset globe', 'reset-globe')
  const clusterPoint = await firstPoint(desktop, 'cluster')
  if (!clusterPoint) throw new Error('No cluster point for headed measurement')
  desktopInteractions.push(await measure(desktop, 'cluster-expansion', async () => {
    const previous = (await qa(desktop)).performance.lastCameraMs
    await desktop.mouse.click(clusterPoint[0], clusterPoint[1])
    await waitForCameraAction(desktop, 'cluster-expansion', previous)
  }, 250))

  await clickCameraAction(desktop, 'Reset globe', 'reset-globe')
  desktopInteractions.push(await measure(desktop, 'fly-to', async () => {
    const previous = (await qa(desktop)).performance.lastCameraMs
    await desktop.getByRole('button', { name: 'Fly to latest' }).click()
    await waitForCameraAction(desktop, 'fly-to-place', previous)
  }, 250))

  await desktop.getByRole('button', { name: 'Close place details' }).click()
  const pinPoint: [number, number] = [
    canvas.x + canvas.width / 2,
    canvas.y + canvas.height / 2,
  ]
  desktopInteractions.push(await measure(desktop, 'pin-selection', async () => {
    await desktop.mouse.click(pinPoint[0], pinPoint[1])
    await expect.poll(async () => (await qa(desktop)).selectedPlaceId).not.toBeNull()
  }, 350))
  await desktop.getByRole('button', { name: 'Close place details' }).click()

  desktopInteractions.push(await measure(desktop, 'fit-bounds', async () => {
    const previous = (await qa(desktop)).performance.lastCameraMs
    await desktop.getByRole('button', { name: 'Fit purchases' }).click()
    await waitForCameraAction(desktop, 'fit-bounds', previous)
  }, 250))

  desktopInteractions.push(await measure(desktop, 'heatmap-switch', async () => {
    await desktop.getByRole('button', { name: 'Heatmap', exact: true }).click()
    await expect.poll(async () => (await qa(desktop)).mode).toBe('heatmap')
  }, 650))
  await desktop.getByRole('button', { name: 'Pins', exact: true }).click()

  const sourceUpdatesBefore = (await qa(desktop)).sourceUpdates
  desktopInteractions.push(await measure(desktop, 'source-update-filter', async () => {
    await desktop.getByRole('searchbox', { name: 'Search places or cities' }).fill('Tel Aviv')
    await expect.poll(async () => (await qa(desktop)).sourceDatasetFeatures).toBe(2)
    await expect.poll(async () => (await qa(desktop)).sourceUpdates).toBeGreaterThan(sourceUpdatesBefore)
  }, 600))
  await desktop.getByRole('searchbox', { name: 'Search places or cities' }).fill('')
  await expect.poll(async () => (await qa(desktop)).sourceDatasetFeatures).toBe(12)

  await clickCameraAction(desktop, 'Reset globe', 'reset-globe')
  desktopInteractions.push(await measure(desktop, 'active-fly-interruption', async () => {
    await desktop.getByRole('button', { name: 'Fly to latest' }).click()
    await desktop.waitForTimeout(80)
    await desktop.mouse.move(canvas.x + 720, canvas.y + 450)
    await desktop.mouse.down()
    await desktop.mouse.move(canvas.x + 820, canvas.y + 480, { steps: 10 })
    await desktop.mouse.up()
  }, 500))
  const interruptedCamera = (await qa(desktop)).camera
  expect(Math.abs(interruptedCamera.zoom - 15.2)).toBeGreaterThan(0.3)
  await desktop.waitForTimeout(900)
  const settledAfterInterruption = (await qa(desktop)).camera
  expect(Math.abs(settledAfterInterruption.zoom - 15.2)).toBeGreaterThan(0.3)
  await desktop.waitForTimeout(600)
  const stableAfterInterruption = (await qa(desktop)).camera
  expect(Math.abs(stableAfterInterruption.zoom - settledAfterInterruption.zoom)).toBeLessThan(0.05)
  expect(Math.abs(stableAfterInterruption.center[0] - settledAfterInterruption.center[0])).toBeLessThan(0.1)

  configurations.push({
    name: 'headed-desktop',
    viewport: { ...desktopViewport, deviceScaleFactor: 1 },
    interactions: desktopInteractions,
  })
  await saveVideo(desktopContext, desktop, 'headed-desktop-interactions.webm')

  const mobileViewport = { width: 390, height: 844 }
  const mobileContext = await browser.newContext({
    viewport: mobileViewport,
    colorScheme: 'dark',
    locale: 'en-GB',
    hasTouch: true,
    recordVideo: { dir: artifactDir, size: mobileViewport },
  })
  const mobile = await mobileContext.newPage()
  await mobile.goto('/')
  await waitForGlobe(mobile)
  const mobileInteractions: FrameProbeResult[] = []
  const mobileCanvas = await mobile.getByTestId('map-canvas').boundingBox()
  if (!mobileCanvas) throw new Error('No headed mobile canvas bounds')
  const cdp = await mobileContext.newCDPSession(mobile)

  mobileInteractions.push(await measure(mobile, 'touch-drag', async () => {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: mobileCanvas.x + 190, y: mobileCanvas.y + 390 }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: mobileCanvas.x + 260, y: mobileCanvas.y + 420 }],
    })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }, 500))

  const mobileZoomBeforePinch = (await qa(mobile)).camera.zoom
  mobileInteractions.push(await measure(mobile, 'touch-pinch-zoom', async () => {
    const x = mobileCanvas.x + 195
    const y = mobileCanvas.y + 385
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: x - 28, y }, { x: x + 28, y }],
    })
    for (const distance of [40, 54, 70, 84]) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x - distance, y }, { x: x + distance, y }],
      })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }, 500))
  expect((await qa(mobile)).camera.zoom).toBeGreaterThan(mobileZoomBeforePinch + 0.15)

  mobileInteractions.push(await measure(mobile, 'mobile-fly-to', async () => {
    const previous = (await qa(mobile)).performance.lastCameraMs
    await mobile.getByRole('button', { name: 'Fly to latest' }).last().click()
    await waitForCameraAction(mobile, 'fly-to-place', previous)
  }, 250))
  await mobile.getByRole('button', { name: 'Close place details' }).click()

  await mobile.getByRole('button', { name: 'Globe tools' }).click()
  mobileInteractions.push(await measure(mobile, 'mobile-heatmap-switch', async () => {
    await mobile.getByRole('button', { name: 'Heatmap', exact: true }).click()
    await expect.poll(async () => (await qa(mobile)).mode).toBe('heatmap')
  }, 600))
  await mobile.getByRole('button', { name: 'Pins', exact: true }).click()
  await mobile.getByRole('button', { name: 'Close globe tools' }).last().click()

  const mobileUpdatesBefore = (await qa(mobile)).sourceUpdates
  mobileInteractions.push(await measure(mobile, 'mobile-source-update', async () => {
    await mobile.getByRole('searchbox', { name: 'Search places or cities' }).fill('Tel Aviv')
    await expect.poll(async () => (await qa(mobile)).sourceDatasetFeatures).toBe(2)
    await expect.poll(async () => (await qa(mobile)).sourceUpdates).toBeGreaterThan(mobileUpdatesBefore)
  }, 600))

  configurations.push({
    name: 'headed-mobile-viewport-emulation',
    viewport: { ...mobileViewport, deviceScaleFactor: 1 },
    interactions: mobileInteractions,
  })
  await saveVideo(mobileContext, mobile, 'headed-mobile-interactions.webm')

  await writeFile(path.join(artifactDir, 'headed-performance.json'), JSON.stringify({
    measuredAt: new Date().toISOString(),
    headed: true,
    browser: `Google Chrome ${browser.version()}`,
    host: { platform: platform(), release: release(), architecture: arch() },
    configurations,
    interpretation: 'requestAnimationFrame diagnostics from headed local Chrome. These measurements are browser/viewport evidence, not proof of real-device sustained 60fps.',
    hardwareQualification: 'The small-delta sequence is trusted Chromium wheel input, not a physical MacBook trackpad event. Final hardware sign-off remains manual.',
  }, null, 2))

  await writeFile(path.join(artifactDir, 'video-capture-capability.json'), JSON.stringify({
    recorder: 'Playwright built-in WebM video capture',
    headedCapture: true,
    requestedFramesPerSecond: 60,
    configuredFramesPerSecond: null,
    supportedVideoOptions: ['dir', 'size'],
    conclusion: 'The available Playwright recording API does not expose a frame-rate setting, so the headed recordings are provided without a 60fps claim. Interaction frame timing is measured independently with requestAnimationFrame.',
  }, null, 2))
})
