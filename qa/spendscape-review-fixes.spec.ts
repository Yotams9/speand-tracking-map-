import { test, expect, type Locator, type Page } from '@playwright/test'
import { oneReceipt } from './receipt-review-integration-mocks'

// Layout and review-form regressions fixed on fix/integration-review. QA-gate
// project (synthetic fixtures); geolocation is mocked, no provider is called.
async function ready(p: Page) { await expect(p.locator('main')).toHaveAttribute('data-local-state', 'ready'); await p.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready) }
async function capture(p: Page) { await p.getByTestId((p.viewportSize()?.width ?? 1280) < 761 ? 'capture-open-mobile' : 'capture-open-desktop').click() }
// Fully inside the viewport and not covered by another element (e.g. a sticky footer).
async function reachable(target: Locator) {
  await expect(target).toBeInViewport({ ratio: 1 })
  expect(await target.evaluate(e => { const r = e.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return top === e || e.contains(top) || (top instanceof HTMLLabelElement && top.contains(e)) })).toBe(true)
}
// A device location that answers only after `delay` ms, at the given point.
async function slowLocation(p: Page, lat: number, lon: number, delay: number) {
  await p.addInitScript(([lat, lon, delay]) => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok: PositionCallback) => setTimeout(() => ok({ coords: { latitude: lat, longitude: lon, accuracy: 10 } } as GeolocationPosition), delay) } })
  }, [lat, lon, delay] as const)
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(/generativelanguage|vision\.googleapis|groq|api\.geoapify|prices\.shufersal|pricesprodpublic/i, () => { throw new Error('provider-forbidden') })
})

test('location form at 360×420: fields, error, confirmation and Save stay reachable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/?receiptReviewQa=1'); await ready(page); await capture(page)
  await page.waitForFunction(() => typeof (window as any).__SPENDSCAPE_RECEIPT_REVIEW_QA__ === 'function')
  await page.evaluate(r => (window as any).__SPENDSCAPE_RECEIPT_REVIEW_QA__(r), oneReceipt); await expect(page.getByTestId('receipt-observations')).toBeVisible()
  await page.getByTestId('review-channel').selectOption('unknown'); await page.getByTestId('review-merchantCategory').selectOption('groceries')
  await page.getByTestId('review-payment').selectOption('cash'); await page.getByTestId('review-category').selectOption('groceries')
  if (await page.getByTestId('receipt-confirm-time').count()) await page.getByTestId('receipt-confirm-time').click()
  await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('capture-success')).toBeVisible()
  await page.getByTestId('capture-confirm-location').click(); await expect(page.getByTestId('location-form')).toBeVisible()
  await page.getByTestId('location-kind').selectOption('branch')
  for (const [k, v] of Object.entries({ branch: 'Fictional branch', city: 'Fictional city', country: 'Fictional country', address: 'Fictional street 12' })) await page.getByTestId(`location-${k}`).fill(v)
  await page.getByTestId('location-form').locator('details summary').click()
  await page.getByTestId('location-longitude').fill('181'); await page.getByTestId('location-latitude').fill('32.10')
  // A phone keyboard leaves 420 px.
  await page.setViewportSize({ width: 360, height: 420 })
  const form = page.getByTestId('location-form')
  expect(await form.evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight })).toBe(true)
  // Unconfirmed: focus moves to the checkbox, which is not under the sticky footer; Save is visible.
  await page.getByTestId('location-save').click()
  await expect(page.getByTestId('location-confirmed')).toBeFocused()
  await reachable(page.getByTestId('location-confirmed')); await reachable(page.getByTestId('location-save'))
  await reachable(form.getByRole('alert').first())
  // Confirmed but out of range: the longitude and its error are reachable too.
  await page.getByTestId('location-confirmed').check(); await page.getByTestId('location-save').click()
  await expect(page.getByTestId('location-longitude')).toBeFocused()
  await reachable(page.getByTestId('location-longitude')); await reachable(page.getByTestId('location-save'))
  // The top of the form can be scrolled back into view.
  await form.evaluate(e => { e.scrollTop = 0 })
  await reachable(form.getByRole('heading').first())
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('at 1280×720 the Ask status never covers the timeline replay button', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?syntheticQa=1'); await ready(page)
  await page.getByTestId('ask-open-desktop').click(); await page.getByTestId('ask-input').fill('open latest purchase'); await page.getByTestId('ask-run').click()
  await expect(page.getByTestId('ask-feedback')).toBeVisible()
  await page.keyboard.press('Escape'); await page.locator('nav[aria-label="Primary"]').getByRole('button', { name: 'Globe', exact: true }).click()
  await page.getByTestId('timeline-open').click()
  await reachable(page.getByTestId('replay-open'))
  await page.getByTestId('replay-open').click(); await expect(page.getByTestId('replay-scrub')).toBeVisible()
})

test('a late device location never replaces a store chosen meanwhile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await slowLocation(page, 32.0764, 34.76795, 2500)
  await page.goto('/'); await ready(page); await capture(page); await page.getByTestId('capture-camera-manual').click()
  await page.getByTestId('review-channel').selectOption('physical')
  await page.getByTestId('review-nearest').click(); await expect(page.getByTestId('review-nearest')).toBeDisabled()
  const branch = await page.getByTestId('review-placeId').locator('option[value^="catalog:"]:not([value="catalog:ramilevi-733"])').first().getAttribute('value')
  await page.getByTestId('review-placeId').selectOption(branch!)
  await expect(page.getByTestId('review-nearest')).toBeEnabled()
  await page.waitForTimeout(3500)
  // The person's own choice stands; no location suggestion and no confirmation box appeared.
  await expect(page.getByTestId('review-placeId')).toHaveValue(branch!)
  await expect(page.getByTestId('review-catalog-confirmed')).toHaveCount(0)
  await expect(page.getByTestId('review-nearest-status')).toHaveText('')
})

test('a late device location never replaces a store chosen in the online/unresolved store list', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await slowLocation(page, 32.0764, 34.76795, 2500)
  await page.goto('/'); await ready(page); await capture(page); await page.getByTestId('capture-camera-manual').click()
  await page.getByTestId('review-nearest').click()
  await page.getByTestId('review-merchantId').selectOption('merchant_unresolved')
  await expect(page.getByTestId('review-nearest')).toBeEnabled()
  await page.waitForTimeout(3500)
  await expect(page.getByTestId('review-channel')).toHaveValue('')
  await expect(page.getByTestId('review-merchantId')).toHaveValue('merchant_unresolved')
  await expect(page.getByTestId('review-catalog-confirmed')).toHaveCount(0)
})

test('a new store typed before a store choice comes back on "New store", to be confirmed again', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await slowLocation(page, 32.0764, 34.76795, 0)
  await page.goto('/'); await ready(page); await capture(page); await page.getByTestId('capture-camera-manual').click()
  await page.getByTestId('review-channel').selectOption('physical'); await page.getByTestId('review-placeId').selectOption('__new_store__')
  await page.getByTestId('review-merchantName').fill('Fictional corner shop'); await page.getByTestId('review-merchantCategory').selectOption('groceries')
  for (const [k, v] of Object.entries({ branch: 'Fictional branch', city: 'Fictional city', country: 'Fictional country', longitude: '34.75', latitude: '32.10' })) await page.getByTestId(`review-place-${k}`).fill(v)
  await page.getByTestId('review-place-confirmed').check()
  // "Find the store I'm in" suggests a chain branch and replaces the form.
  await page.getByTestId('review-nearest').click()
  await expect(page.getByTestId('review-placeId')).toHaveValue('catalog:ramilevi-733')
  await expect(page.getByTestId('review-merchantName')).toHaveCount(0)
  // Not that branch after all: the typed store returns, its place unconfirmed.
  await page.getByTestId('review-placeId').selectOption('__new_store__')
  await expect(page.getByTestId('review-merchantName')).toHaveValue('Fictional corner shop')
  await expect(page.getByTestId('review-place-branch')).toHaveValue('Fictional branch')
  await expect(page.getByTestId('review-place-longitude')).toHaveValue('34.75')
  await expect(page.getByTestId('review-place-confirmed')).not.toBeChecked()
})
