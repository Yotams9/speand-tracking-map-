import { test, expect, type Page } from '@playwright/test'

// A first visit: no stored preferences at all.
test.use({ storageState: { cookies: [], origins: [] } })

type Qa = { ready: boolean; combinedPurchaseCount: number; pendingInboxCount: number; canonicalPins: number }
const qa = (page: Page) => page.evaluate(() => (window as typeof window & { __SPENDSCAPE_QA__: Qa }).__SPENDSCAPE_QA__)
const ready = (page: Page) => page.waitForFunction(() => (window as typeof window & { __SPENDSCAPE_QA__?: Qa }).__SPENDSCAPE_QA__?.ready)

for (const [width, height] of [[390, 844], [1440, 900]] as const) {
  test(`first visit is Hebrew with demo data hidden, and the demo choice is remembered ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/'); await ready(page)
    await expect(page.locator('html')).toHaveAttribute('lang', 'he')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    expect(await qa(page)).toMatchObject({ combinedPurchaseCount: 0, pendingInboxCount: 0, canonicalPins: 0 })
    await expect(page.getByTestId('home-empty')).toContainText('עוד אין רכישות')
    await expect(page.getByTestId('smart-inbox-open')).toHaveCount(0)
    await expect(page.getByTestId('map-empty')).toHaveCount(0)

    await page.getByTestId('home-demo-load').click()
    await expect.poll(async () => (await qa(page)).combinedPurchaseCount).toBe(42)
    await expect(page.getByTestId('home-empty')).toHaveCount(0)
    await expect(page.getByTestId('demo-toggle')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('demo-toggle')).toHaveText('הסתר נתוני דמו')

    await page.reload(); await ready(page)
    expect((await qa(page)).combinedPurchaseCount).toBe(42)
    await page.getByTestId('demo-toggle').click()
    await expect.poll(async () => (await qa(page)).combinedPurchaseCount).toBe(0)
    await page.reload(); await ready(page)
    expect((await qa(page)).combinedPurchaseCount).toBe(0)

    // English stays one tap away and is remembered too.
    await page.getByRole('button', { name: 'מעבר לאנגלית' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.reload(); await ready(page)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByTestId('home-empty')).toContainText('No purchases yet')
    expect(errors).toEqual([])
  })
}

test('the purchase form offers real chain stores but not fictional demo stores while demo data is off', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/'); await ready(page)
  await page.getByTestId('home-empty-add').click()
  await page.getByTestId('capture-camera-manual').click()
  await page.getByTestId('review-channel').selectOption('physical')
  const options = page.getByTestId('review-placeId').locator('option')
  await expect(page.getByTestId('review-placeId').locator('optgroup option').first()).toBeAttached()
  const values = await options.evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value))
  expect(values.some((value) => value.startsWith('catalog:'))).toBe(true)
  expect(values).not.toContain('place_shuk_bograshov')
  // Picking a chain store with no date fills "now"; it stays editable.
  await page.getByTestId('review-placeId').selectOption(values.find((value) => value.startsWith('catalog:'))!)
  await expect(page.getByTestId('review-date')).not.toHaveValue('')
  const filled = await page.getByTestId('review-date').inputValue()
  expect(Math.abs(new Date(filled).getTime() - Date.now())).toBeLessThan(5 * 60_000)
  await page.getByTestId('review-date').fill('2026-10-01T09:30')
  await expect(page.getByTestId('review-date')).toHaveValue('2026-10-01T09:30')
})

test('a saved purchase appears in the deterministic this-month summary', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('spendscape.locale.v1', 'en'))
  await page.goto('/'); await ready(page)
  await page.getByTestId('home-empty-add').click()
  await page.getByTestId('capture-camera-manual').click()
  await page.getByTestId('review-channel').selectOption('physical')
  const chain = page.getByTestId('review-placeId').locator('optgroup option').first()
  await expect(chain).toBeAttached()
  const label = (await chain.textContent())!.split(' · ')[0]
  await page.getByTestId('review-placeId').selectOption(await chain.getAttribute('value') ?? '')
  await page.getByTestId('review-currency').selectOption('ILS')
  await page.getByTestId('review-payment').selectOption('card')
  await page.getByTestId('review-amount').fill('12.30')
  await page.getByTestId('manual-review').click()
  await page.getByTestId('capture-confirm').click()
  await expect(page.getByTestId('capture-success')).toBeVisible()
  await page.getByTestId('capture-done').click()
  await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('button').nth(1).click()
  await expect(page.getByTestId('analytics-month-total')).toHaveText('₪12.30')
  await expect(page.getByTestId('analytics-month-store')).toContainText(label)
  await expect(page.getByTestId('analytics-month-category')).toContainText('Groceries')
  await expect(page.getByTestId('analytics-month-summary')).toHaveAttribute('data-source-purchases', '1')
})
