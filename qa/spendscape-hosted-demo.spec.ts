import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fictionalStructured, structuredEnvelope } from '../src/features/receipt-image/structured-image-contract'
import { captureResponse } from '../src/features/receipt-image/structured-capture-response'
const out = process.env.SPENDSCAPE_HOSTED_QA_OUT ?? 'artifacts/hosted-demo-qa'
const code = '1'.repeat(64) // Public synthetic local QA capability only.
async function login(page: import('@playwright/test').Page) {
  await page.goto('/'); await expect(page).toHaveURL(/\/demo-access$/)
  await page.getByLabel('Access code / קוד גישה').fill(code)
  await page.getByRole('button', { name: 'Open Spendscape / כניסה' }).click()
  await expect(page).toHaveURL('http://127.0.0.1:3206/')
}
test('unauthorized APIs fail without redirects or provider activation', async ({ request }) => {
  for (const path of ['/api/receipt-capture-session', '/api/address-search', '/api/catalog/05060639129102']) {
    const response = await request.get(path); expect(response.status()).toBe(401); expect(await response.json()).toEqual({ status: 'access-required' })
  }
})
for (const width of [360, 390, 430, 1280]) test(`private entry and logout at ${width}px`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: width > 500 ? 800 : 844 })
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Your private demonstration' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByLabel('Access code / קוד גישה').fill('3'.repeat(64)); await page.getByRole('button', { name: 'Open Spendscape / כניסה' }).click()
  await expect(page.locator('p[role="alert"]')).toHaveText(/invalid/)
  await page.getByLabel('Access code / קוד גישה').fill(code); await page.getByRole('button', { name: 'Open Spendscape / כניסה' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-spendscape-private-demo', 'true')
  const cookies = await context.cookies(); expect(cookies.find(c => c.name === 'spendscape-demo-test')?.httpOnly).toBe(true)
  await page.goto('/demo-access'); await mkdir(out, { recursive: true })
  await page.screenshot({ path: `${out}/entry-${width}.png` })
  await page.getByRole('button', { name: 'Close private session / סיום ההפעלה הפרטית' }).click()
  expect((await context.cookies()).some(c => c.name === 'spendscape-demo-test')).toBe(false)
  await page.goto('/'); await expect(page).toHaveURL(/\/demo-access$/)
})
test('authenticated receipt capability carries the cookie and remains disabled without activation', async ({ page }) => {
  await login(page)
  await page.getByRole('button', { name: /Add purchase/ }).click()
  const waiting = page.waitForResponse(r => r.url().endsWith('/api/receipt-capture-session'))
  await page.getByRole('button', { name: /Receipt photo/ }).click()
  const response = await waiting
  expect(response.status()).toBe(503)
  expect((await response.request().allHeaders()).cookie).toContain('spendscape-demo-test=')
  await expect(page.getByRole('heading', { name: 'Receipt photo' })).toBeVisible()
})
test('authenticated receipt flow accepts a mocked hosted capability without query opt-ins', async ({ page }) => {
  let posted = 0
  await page.route('**/api/receipt-capture-session', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { code: 'local-capture-ready', mode: 'native', session: { used: posted, maxRequests: 1, state: posted ? 'exhausted' : 'available' } } })
    posted++; expect((await route.request().allHeaders()).cookie).toContain('spendscape-demo-test=')
    return route.fulfill({ json: { code: 'direct-observations', observations: captureResponse(structuredEnvelope(fictionalStructured('one'))) } })
  })
  await login(page); await page.getByRole('button', { name: /Add purchase/ }).click(); await page.getByRole('button', { name: /Receipt photo/ }).click()
  await expect(page.getByTestId('receipt-image-read')).toBeVisible()
  await expect(page.locator('#capture-description')).toContainText('through this protected demonstration')
  expect(posted).toBe(0)
  const image = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d')!.fillText('FICTIONAL QA', 1, 20); return c.toDataURL('image/png').split(',')[1] })
  await page.getByTestId('receipt-upload-input').setInputFiles({ name: 'fictional-qa.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') })
  await expect(page.getByTestId('receipt-image-read')).toBeEnabled(); await page.getByTestId('receipt-image-read').click()
  await expect(page.getByTestId('receipt-observations')).toBeVisible(); expect(posted).toBe(1)
  // A recognized draft still needs explicit review/save; no automatic purchase.
  await expect(page.getByRole('button', { name: 'Save on this device' })).toBeVisible()
})
test('Hebrew mobile privacy exposes sign-out without changing saved data', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await login(page)
  await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await page.getByTestId('local-privacy').click()
  const dialog = page.getByRole('dialog'); await expect(dialog).toHaveAttribute('dir', 'rtl')
  await expect(dialog.getByRole('link', { name: 'ניהול הגישה הפרטית וסיום ההפעלה' })).toBeVisible()
  await expect(page.getByTestId('purchase-backup')).toBeVisible()
  await page.screenshot({ path: `${out}/privacy-he-390.png` })
})
