import { expect, test, type Browser, type Request } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.join(process.cwd(), 'artifacts', 'spendscape-slice-1d3', 'load-performance')
const label = process.env.SPENDSCAPE_PERF_LABEL ?? 'unlabelled'

interface LoadProbe {
  origin: number
  shell: number | null
  navigation: number | null
  mapContainer: number | null
  mapConstructed: number | null
  mapReady: number | null
  mapFailure: number | null
  longTasks: Array<{ start: number; duration: number }>
}

interface InitializationEvidence {
  attempt: number
  stage: 'idle' | 'resources' | 'constructing' | 'map-ready' | 'failed'
  styleFetchMs: number | null
  rtlPluginMs: number | null
  mapConstructedMs: number | null
  mapReadyMs: number | null
  failureStage: 'style' | 'rtl' | 'map-ready' | 'map' | null
  styleTimeoutMs: number
  rtlTimeoutMs: number
  mapReadyTimeoutMs: number
}

declare global {
  interface Window {
    __SPENDSCAPE_LOAD_PROBE__?: LoadProbe
  }
}

const configurations = [
  { name: 'desktop-1440x900', viewport: { width: 1440, height: 900 }, cpuRate: 1 },
  { name: 'mobile-390x844', viewport: { width: 390, height: 844 }, cpuRate: 1 },
  {
    name: 'mobile-390x844-slow4g-cpu4x',
    viewport: { width: 390, height: 844 },
    cpuRate: 4,
    network: { latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 },
  },
] as const

async function measureInitialLoad(
  browser: Browser,
  configuration: (typeof configurations)[number],
) {
  const context = await browser.newContext({
    viewport: configuration.viewport,
    colorScheme: 'dark',
    locale: 'en-GB',
  })
  const page = await context.newPage()
  const session = await context.newCDPSession(page)
  const consoleErrors: string[] = []
  const requestFailures: string[] = []
  const responseErrors: string[] = []
  const providerNetwork: Array<{ url: string; startMs: number; responseMs: number | null; endMs: number | null }> = []
  const providerRequests = new Map<Request, { url: string; startMs: number; responseMs: number | null; endMs: number | null }>()
  let loadEpoch = Date.now()

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`)
  })
  page.on('request', (request) => {
    const url = request.url()
    if (!url.includes('openfreemap') && !url.includes('mapbox-gl-rtl-text') && !url.includes('maplibre-gl-worker')) return
    const timing: (typeof providerNetwork)[number] = {
      url, startMs: Date.now() - loadEpoch, responseMs: null, endMs: null,
    }
    providerRequests.set(request, timing)
    providerNetwork.push(timing)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) responseErrors.push(`${response.status()} ${response.url()}`)
    const timing = providerRequests.get(response.request())
    if (timing) {
      timing.responseMs = Date.now() - loadEpoch
      void response.finished().then(() => { timing.endMs = Date.now() - loadEpoch }).catch(() => {})
    }
  })

  await page.addInitScript(() => {
    const probe: LoadProbe = {
      origin: performance.now(),
      shell: null,
      navigation: null,
      mapContainer: null,
      mapConstructed: null,
      mapReady: null,
      mapFailure: null,
      longTasks: [],
    }
    window.__SPENDSCAPE_LOAD_PROBE__ = probe

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          probe.longTasks.push({
            start: Math.round(entry.startTime * 10) / 10,
            duration: Math.round(entry.duration * 10) / 10,
          })
        }
      })
      observer.observe({ entryTypes: ['longtask'] })
    } catch {
      // Long Task API is not available in every browser channel.
    }

    const detect = () => {
      const elapsed = Math.round((performance.now() - probe.origin) * 10) / 10
      if (probe.shell === null && document.querySelector('main')) probe.shell = elapsed
      if (probe.navigation === null && document.querySelector('nav[aria-label="Mobile primary"], nav[aria-label="Primary"]')) {
        probe.navigation = elapsed
      }
      if (probe.mapContainer === null && document.querySelector('[data-testid="map-canvas"]')) {
        probe.mapContainer = elapsed
      }
      if (probe.mapConstructed === null && document.querySelector('.maplibregl-map')) {
        probe.mapConstructed = elapsed
      }
      if (probe.mapReady === null && document.querySelector('main[data-map-ready="true"]')) {
        probe.mapReady = elapsed
      }
      if (probe.mapFailure === null && document.querySelector('[data-testid="map-failure"]')) {
        probe.mapFailure = elapsed
      }
      if (probe.mapReady === null && probe.mapFailure === null) requestAnimationFrame(detect)
    }
    requestAnimationFrame(detect)
  })

  await session.send('Emulation.setCPUThrottlingRate', { rate: configuration.cpuRate })
  if ('network' in configuration) {
    await session.send('Network.enable')
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      connectionType: 'cellular4g',
      ...configuration.network,
    })
  }

  const startedAt = Date.now()
  loadEpoch = startedAt
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await expect(page.locator('main')).toBeVisible({ timeout: 30_000 })
  const primaryNavigation = configuration.viewport.width <= 760
    ? page.locator('nav[aria-label="Mobile primary"]')
    : page.locator('nav[aria-label="Primary"]')
  await expect(primaryNavigation).toBeVisible({ timeout: 30_000 })

  const outcome = await Promise.race([
    page.locator('main[data-map-ready="true"]').waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'ready' as const),
    page.getByTestId('map-failure').waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'failure' as const),
  ]).catch(() => 'timeout' as const)
  await page.waitForTimeout(700)

  const browserEvidence = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const resources = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      startTime: Math.round(entry.startTime * 10) / 10,
      duration: Math.round(entry.duration * 10) / 10,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      responseEnd: Math.round(entry.responseEnd * 10) / 10,
    }))
    const scripts = resources
      .filter((entry) => entry.initiatorType === 'script' || entry.name.includes('/_next/static/chunks/'))
      .sort((a, b) => b.encodedBodySize - a.encodedBodySize)
    const provider = resources.filter((entry) => (
      entry.name.includes('openfreemap')
      || entry.name.includes('mapbox-gl-rtl-text')
      || entry.name.includes('maplibre-gl-worker')
    ))
    const probe = structuredClone(window.__SPENDSCAPE_LOAD_PROBE__)
    return {
      probe,
      navigation: navigation ? {
        responseStart: Math.round(navigation.responseStart * 10) / 10,
        domContentLoaded: Math.round(navigation.domContentLoadedEventEnd * 10) / 10,
        loadEventEnd: Math.round(navigation.loadEventEnd * 10) / 10,
        transferSize: navigation.transferSize,
      } : null,
      javascript: {
        transferSize: scripts.reduce((sum, entry) => sum + entry.transferSize, 0),
        encodedBodySize: scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
        requestCount: scripts.length,
        largest: scripts.slice(0, 8),
      },
      provider,
      mapCount: document.querySelectorAll('.maplibregl-map').length,
      rtlStatus: (window as typeof window & { __SPENDSCAPE_QA__?: { input?: { rtlPluginStatus?: string } } })
        .__SPENDSCAPE_QA__?.input?.rtlPluginStatus ?? null,
    }
  })

  await context.close()
  return {
    label,
    configuration,
    outcome,
    wallClockMs: Date.now() - startedAt,
    ...browserEvidence,
    consoleErrors,
    requestFailures,
    responseErrors,
    providerNetwork,
  }
}

test.beforeAll(async () => {
  await mkdir(artifactDir, { recursive: true })
})

for (const configuration of configurations) {
  test(`${configuration.name} records initial-load evidence`, async ({ browser }) => {
    test.setTimeout(90_000)
    const evidence = await measureInitialLoad(browser, configuration)
    await writeFile(
      path.join(artifactDir, `${label}-${configuration.name}.json`),
      JSON.stringify(evidence, null, 2),
    )
    expect(evidence.probe?.shell).not.toBeNull()
    expect(evidence.probe?.navigation).not.toBeNull()
  })
}

test('baseline records an unresolved Liberty request without a product recovery state', async ({ browser }) => {
  test.skip(process.env.SPENDSCAPE_BASELINE_STALL !== '1', 'Baseline-only unbounded-loading reproduction')
  test.setTimeout(20_000)
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const page = await context.newPage()
  await page.route('https://tiles.openfreemap.org/styles/liberty', () => new Promise(() => {}))
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('nav[aria-label="Mobile primary"]')).toBeVisible()
  await page.waitForTimeout(8_000)
  const evidence = {
    observedForMs: 8_000,
    loadingVisible: await page.getByTestId('map-loading').isVisible(),
    failureVisible: await page.getByTestId('map-failure').isVisible(),
    navigationUsable: await page.locator('nav[aria-label="Mobile primary"]').isVisible(),
    mapCount: await page.locator('.maplibregl-map').count(),
  }
  await writeFile(
    path.join(artifactDir, 'baseline-production-stalled-liberty.json'),
    JSON.stringify(evidence, null, 2),
  )
  expect(evidence).toMatchObject({ loadingVisible: true, failureVisible: false, navigationUsable: true, mapCount: 0 })
  await context.close()
})

test('progressive shell keeps mobile navigation usable while the globe is still loading', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?loading=1', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('nav[aria-label="Mobile primary"]')).toBeVisible()
  await expect(page.getByTestId('map-loading')).toBeVisible()
  await page.locator('nav[aria-label="Mobile primary"]').getByRole('button', { name: 'Purchases' }).click()
  await expect(page.getByTestId('purchases-panel')).toBeVisible()
  await expect(page.getByTestId('map-loading')).toBeHidden()
  await page.screenshot({ path: path.join(artifactDir, 'progressive-shell-purchases-390x844.png'), fullPage: true })
  // The Next.js development indicator occupies this bottom-left hit target in dev only.
  // Force the transition here; production QA below exercises the unobstructed pointer target.
  await page.locator('nav[aria-label="Mobile primary"]').getByRole('button', { name: 'Globe' }).click({ force: true })
  await expect(page.getByTestId('map-loading')).toBeVisible()
  await expect(page.locator('main[data-map-ready="true"]')).toBeVisible({ timeout: 30_000 })
  expect(await page.locator('.maplibregl-map').count()).toBe(1)
  expect(errors).toEqual([])
  await context.close()
})

test('style timeout exposes recovery and Retry preserves a synthetic Capture addition', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?mapTimeout=style')
  await expect(page.getByTestId('map-failure')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('map-failure')).toContainText('timed out')
  await page.screenshot({ path: path.join(artifactDir, 'style-timeout-recovery-390x844.png'), fullPage: true })

  await page.getByTestId('capture-open-mobile').click()
  await expect(page.getByTestId('capture-scanner')).toBeVisible()
  await page.getByTestId('capture-scan').click()
  await expect(page.getByTestId('capture-review')).toBeVisible({ timeout: 5_000 })
  await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  await expect.poll(async () => page.evaluate(() => (
    window as typeof window & { __SPENDSCAPE_QA__?: { sessionPurchaseCount: number } }
  ).__SPENDSCAPE_QA__?.sessionPurchaseCount)).toBe(1)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('map-failure')).toBeVisible()
  await page.getByTestId('map-failure').getByRole('button', { name: 'Retry map' }).click()
  await expect(page.locator('main[data-map-ready="true"]')).toBeVisible({ timeout: 30_000 })
  const evidence = await page.evaluate(() => structuredClone((
    window as typeof window & {
      __SPENDSCAPE_QA__?: {
        sessionPurchaseCount: number
        mapInstanceCount: number
        mapConstructionCount: number
        initialization: InitializationEvidence
      }
    }
  ).__SPENDSCAPE_QA__))
  expect(evidence).toMatchObject({
    sessionPurchaseCount: 1,
    mapInstanceCount: 1,
    mapConstructionCount: 1,
    initialization: { attempt: 2, stage: 'map-ready' },
  })
  expect(await page.locator('.maplibregl-map').count()).toBe(1)
  await page.screenshot({ path: path.join(artifactDir, 'style-timeout-retry-success-390x844.png'), fullPage: true })
  expect(errors).toEqual([])
  await context.close()
})

test('map-readiness timeout cleans the incomplete map before a successful Retry', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 }, colorScheme: 'dark' })
  const page = await context.newPage()
  await page.goto('/?mapTimeout=ready')
  await expect(page.getByTestId('map-failure')).toBeVisible({ timeout: 8_000 })
  expect(await page.locator('.maplibregl-map').count()).toBe(0)
  const failed = await page.evaluate(() => structuredClone((
    window as typeof window & {
      __SPENDSCAPE_QA__?: {
        mapInstanceCount: number
        mapConstructionCount: number
        initialization: InitializationEvidence
      }
    }
  ).__SPENDSCAPE_QA__))
  expect(failed).toMatchObject({
    mapInstanceCount: 0,
    mapConstructionCount: 1,
    initialization: { failureStage: 'map-ready', stage: 'failed' },
  })
  await page.getByTestId('map-failure').getByRole('button', { name: 'Retry map' }).click()
  await expect(page.locator('main[data-map-ready="true"]')).toBeVisible({ timeout: 30_000 })
  const recovered = await page.evaluate(() => structuredClone((
    window as typeof window & {
      __SPENDSCAPE_QA__?: {
        mapInstanceCount: number
        mapConstructionCount: number
        initialization: InitializationEvidence
      }
    }
  ).__SPENDSCAPE_QA__))
  expect(recovered).toMatchObject({
    mapInstanceCount: 1,
    mapConstructionCount: 2,
    initialization: { attempt: 2, stage: 'map-ready' },
  })
  expect(await page.locator('.maplibregl-map').count()).toBe(1)
  await context.close()
})

test('Capture chunk loads on demand with a branded transition and keeps the globe mounted', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, colorScheme: 'dark' })
  const page = await context.newPage()
  let delayLaterChunks = false
  await page.route('**/_next/static/chunks/*.js', async (route) => {
    if (delayLaterChunks) await new Promise((resolve) => setTimeout(resolve, 650))
    await route.continue()
  })
  await page.goto('/')
  await expect(page.locator('main[data-map-ready="true"]')).toBeVisible({ timeout: 30_000 })
  const scriptsBefore = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.name.includes('/_next/static/chunks/') && entry.name.endsWith('.js')).length)
  delayLaterChunks = true
  await page.getByTestId('capture-open-mobile').click()
  await expect(page.getByTestId('capture-chunk-loading')).toBeVisible()
  await expect(page.getByTestId('capture-scanner')).toBeVisible({ timeout: 5_000 })
  const scriptsAfter = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry) => entry.name.includes('/_next/static/chunks/') && entry.name.endsWith('.js')).length)
  expect(scriptsAfter).toBeGreaterThan(scriptsBefore)
  expect(await page.locator('.maplibregl-map').count()).toBe(1)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('capture-scanner')).toBeHidden()
  await context.close()
})
