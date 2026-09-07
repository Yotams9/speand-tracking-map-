import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const artifacts = path.join(process.cwd(), 'artifacts/spendscape-scanner-a')
type Mode = 'success' | 'pending' | 'denied' | 'missing' | 'busy' | 'unsupported' | 'insecure' | 'play-failed'
interface CameraMock {
  calls: MediaStreamConstraints[]
  tracks: MediaStreamTrack[]
  mode: Mode
  resolve: () => void
}
type QaWindow = typeof window & {
  __cameraMock: CameraMock
  __SPENDSCAPE_QA__: {
    ready: boolean; combinedPurchaseCount: number; visiblePinFeatures: number
    canonicalPins: number; onlineExcluded: number; unresolvedExcluded: number
    mapInstanceCount: number; mapConstructionCount: number; sessionPurchaseCount: number
    analytics: { totalBaseAmountIls: number }
  }
}

// Synthetic pixels only. This suite never requests a physical camera or microphone.
async function mockCamera(page: Page, mode: Mode = 'success') {
  await page.addInitScript((initialMode) => {
    const camera: CameraMock = { calls: [], tracks: [], mode: initialMode, resolve: () => {} }
    ;(window as QaWindow).__cameraMock = camera
    const makeStream = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 640; canvas.height = 480
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#18394b'; ctx.fillRect(0, 0, 640, 480)
      ctx.fillStyle = '#b9eaff'; ctx.font = '22px sans-serif'
      ctx.fillText('LOCAL TEST PREVIEW', 190, 240)
      const stream = canvas.captureStream(1)
      camera.tracks.push(...stream.getTracks())
      return stream
    }
    if (initialMode === 'insecure') Object.defineProperty(window, 'isSecureContext', { value: false })
    if (initialMode === 'play-failed') HTMLMediaElement.prototype.play = () => Promise.reject(new Error('test playback failure'))
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: initialMode === 'unsupported' ? undefined : {
      getUserMedia: (constraints: MediaStreamConstraints) => {
        camera.calls.push(constraints)
        if (camera.mode === 'pending') return new Promise<MediaStream>((resolve) => {
          camera.resolve = () => resolve(makeStream())
        })
        const errors = { denied: 'NotAllowedError', missing: 'NotFoundError', busy: 'NotReadableError' }
        if (camera.mode in errors) return Promise.reject(new DOMException('test camera error', errors[camera.mode as keyof typeof errors]))
        return Promise.resolve(makeStream())
      },
    } })
  }, mode)
}

async function openCapture(page: Page, mobile = false, hebrew = false) {
  await page.goto('/')
  await page.waitForFunction(() => (window as QaWindow).__SPENDSCAPE_QA__?.ready, undefined, { timeout: 30_000 })
  if (hebrew) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await page.getByTestId(mobile ? 'capture-open-mobile' : 'capture-open-desktop').click()
  await expect(page.getByTestId('capture-scanner')).toHaveAttribute('data-camera-state', 'idle')
}

const media = (page: Page) => page.evaluate(() => ({
  calls: (window as QaWindow).__cameraMock.calls,
  tracks: (window as QaWindow).__cameraMock.tracks.map((track) => track.readyState),
}))

async function assertBaseline(page: Page) {
  expect(await page.evaluate(() => (window as QaWindow).__SPENDSCAPE_QA__)).toMatchObject({
    combinedPurchaseCount: 42, visiblePinFeatures: 12, canonicalPins: 12,
    onlineExcluded: 2, unresolvedExcluded: 1, sessionPurchaseCount: 0,
    mapInstanceCount: 1, mapConstructionCount: 1, analytics: { totalBaseAmountIls: 6777.38 },
  })
}

test.beforeAll(async () => { await mkdir(artifacts, { recursive: true }) })

for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1440, height: 900 }]) {
  test(`camera preview, explicit start/stop, responsive layout and unchanged data at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const hebrew = viewport.width === 430
    const errors: string[] = []
    const writes: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()) })
    await mockCamera(page)
    await openCapture(page, viewport.width < 760, hebrew)
    expect((await media(page)).calls).toHaveLength(0)
    const map = await page.getByTestId('map-canvas').elementHandle()
    await page.screenshot({ path: path.join(artifacts, `idle-${viewport.width}.png`) })
    await page.getByTestId('capture-camera-toggle').click()
    await expect(page.getByTestId('capture-scanner')).toHaveAttribute('data-camera-state', 'live')
    expect((await media(page)).calls).toEqual([{ audio: false, video: { facingMode: { ideal: 'environment' } } }])
    expect(await page.getByTestId('capture-camera-video').evaluate((video: HTMLVideoElement) => ({
      width: video.videoWidth, height: video.videoHeight, muted: video.muted, inline: video.playsInline,
      fit: getComputedStyle(video).objectFit,
    }))).toEqual({ width: 640, height: 480, muted: true, inline: true, fit: 'contain' })
    await page.screenshot({ path: path.join(artifacts, `live-${viewport.width}.png`) })
    await expect(page.getByTestId('capture-camera-toggle')).toBeInViewport({ ratio: 1 })
    await expect(page.getByTestId('capture-camera-manual')).toBeInViewport({ ratio: 1 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (hebrew) await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    if (viewport.width === 390) {
      await page.setViewportSize({ width: 844, height: 390 })
      await page.screenshot({ path: path.join(artifacts, 'landscape-844x390.png') })
      await expect(page.getByTestId('capture-camera-toggle')).toBeInViewport({ ratio: 1 })
      await expect(page.getByTestId('capture-camera-manual')).toBeInViewport({ ratio: 1 })
      expect((await media(page)).calls).toHaveLength(1)
      await expect(page.getByTestId('capture-scanner')).toHaveAttribute('data-camera-state', 'live')
      await page.setViewportSize(viewport)
    }
    await page.getByTestId('capture-camera-toggle').click()
    await expect(page.getByTestId('capture-scanner')).toHaveAttribute('data-camera-state', 'stopped')
    expect((await media(page)).tracks).toEqual(['ended'])
    expect(await page.getByTestId('capture-camera-video').evaluate((video: HTMLVideoElement) => video.srcObject === null)).toBe(true)
    await assertBaseline(page)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('capture-dialog')).toBeHidden()
    await expect(page.getByTestId(viewport.width < 760 ? 'capture-open-mobile' : 'capture-open-desktop')).toBeFocused()
    expect(await map!.evaluate((node) => node.isConnected)).toBe(true)
    expect(errors).toEqual([])
    expect(writes).toEqual([])
  })
}

for (const mode of ['denied', 'missing', 'busy', 'unsupported', 'insecure', 'play-failed'] as const) {
  test(`${mode} is recoverable with manual entry and does not mutate purchases`, async ({ page }) => {
    await mockCamera(page, mode)
    await openCapture(page)
    await page.getByTestId('capture-camera-toggle').click()
    await expect(page.getByTestId('capture-scanner')).toHaveAttribute('data-camera-state', mode === 'play-failed' ? 'preview-failed' : mode)
    await expect(page.getByTestId('capture-camera-status')).toContainText(/manual/i)
    await page.screenshot({ path: path.join(artifacts, `${mode}-desktop.png`) })
    const current = await media(page)
    expect(current.calls).toHaveLength(['unsupported', 'insecure'].includes(mode) ? 0 : 1)
    expect(current.tracks.every((state) => state === 'ended')).toBe(true)
    await page.getByTestId('capture-camera-manual').click()
    await expect(page.getByTestId('capture-manual')).toBeVisible()
    await assertBaseline(page)
  })
}

for (const close of ['cancel', 'escape', 'back', 'sources', 'manual', 'demo', 'background', 'pagehide'] as const) {
  test(`a late grant after ${close} stops without attaching or adding a purchase`, async ({ page }) => {
    await mockCamera(page, 'pending')
    await openCapture(page)
    await page.getByTestId('capture-camera-toggle').click()
    await expect(page.getByTestId('capture-scanner')).toHaveAttribute('data-camera-state', 'requesting')
    if (close === 'cancel') await page.getByTestId('capture-camera-toggle').click()
    if (close === 'escape') await page.keyboard.press('Escape')
    if (close === 'back') await page.goBack()
    if (close === 'sources') await page.getByTestId('capture-sources-open').click()
    if (close === 'manual') await page.getByTestId('capture-camera-manual').click()
    if (close === 'demo') await page.getByTestId('capture-scan').click()
    if (close === 'background') await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    if (close === 'pagehide') await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    await page.evaluate(() => (window as QaWindow).__cameraMock.resolve())
    await expect.poll(async () => (await media(page)).tracks).toEqual(['ended'])
    expect(await page.locator('video').evaluateAll((videos) => videos.every((video) => video.srcObject === null))).toBe(true)
    await assertBaseline(page)
  })
}

test('live background, pagehide, interruption and close clean up; returning never auto-restarts', async ({ page }) => {
  await mockCamera(page)
  await openCapture(page)
  for (const event of ['background', 'pagehide', 'mute', 'ended', 'close']) {
    await page.getByTestId('capture-camera-toggle').click()
    await expect(page.getByTestId('capture-scanner')).toHaveAttribute('data-camera-state', 'live')
    await page.evaluate((event) => {
      if (event === 'background') {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
        document.dispatchEvent(new Event('visibilitychange'))
      } else if (event === 'pagehide') window.dispatchEvent(new Event('pagehide'))
      else if (event !== 'close') (window as QaWindow).__cameraMock.tracks.at(-1)!.dispatchEvent(new Event(event))
    }, event)
    if (event === 'close') await page.getByTestId('capture-dialog').getByRole('button', { name: 'Close Capture' }).click()
    await expect.poll(async () => (await media(page)).tracks.every((state) => state === 'ended')).toBe(true)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('pageshow'))
    })
    if (event !== 'close') await expect(page.getByTestId('capture-scanner')).not.toHaveAttribute('data-camera-state', 'live')
  }
  expect((await media(page)).calls).toHaveLength(5)
  await assertBaseline(page)
})

test('keyboard trap includes camera and fallback controls in Hebrew', async ({ page }) => {
  await mockCamera(page, 'denied')
  await openCapture(page, false, true)
  const close = page.getByTestId('capture-dialog').getByRole('button', { name: 'סגירת Capture' })
  await expect(close).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('capture-camera-toggle')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('capture-camera-status')).toContainText('ההרשאה למצלמה נדחתה')
  await page.keyboard.press('Shift+Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByTestId('capture-sources-open')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
})
