import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReceiptObservations } from '../src/features/capture/receipt-review-adapter'

const out = process.env.SPENDSCAPE_EDITOR_QA_OUT!
test.skip(!out, 'Requires a fresh isolated synthetic production app')
// Fictional values, not provider output or an extraction prompt. Independent
// product sum 60.45 and payable 60.50 exercise both directions of a difference.
const fixture = (): ReceiptObservations => ({ merchantName: 'חנות בדויה Cedar', address: 'רחוב דמיוני 8',
  date: '29/02/2024', time: '09:07', currency: 'ש״ח', finalAmount: '60.50',
  lines: [
    { name: 'לחם בדוי Bread', quantity: '1', unit: null, unitPrice: '10.00', lineAmount: '10.00' },
    { name: 'מוצר בדוי Cookies', quantity: '1', unit: null, unitPrice: '20.00', lineAmount: '20.00' },
    { name: 'חלב בדוי Milk', quantity: '2', unit: null, unitPrice: '7.50', lineAmount: '15.00' },
    { name: 'מעדן בדוי Yogurt', quantity: '1', unit: null, unitPrice: '8.45', lineAmount: '8.45' },
    { name: 'מוצר בדוי Dessert', quantity: '2', unit: null, unitPrice: '3.50', lineAmount: '7.00' },
  ] })
async function count(page: Page, n: number) {
  await expect.poll(() => page.evaluate(() => (window as any).__SPENDSCAPE_QA__)).toMatchObject({ combinedPurchaseCount: n, canonicalPins: 12, mapInstanceCount: 1, mapConstructionCount: 1 })
}
async function ready(page: Page) { await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready'); await page.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready) }
async function open(page: Page) {
  await page.getByTestId((page.viewportSize()?.width ?? 1280) < 761 ? 'capture-open-mobile' : 'capture-open-desktop').click()
  await page.getByTestId('capture-sources-open').click(); await page.getByTestId('capture-source-receipt-image').click()
}
async function image(page: Page) {
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 400
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 300, 400)
    ctx.fillStyle = '#111'; ctx.fillText('FICTIONAL OFFLINE QA', 20, 40)
    const value = c.toDataURL('image/png').split(',')[1]; c.width = c.height = 0; return value
  })
  await page.getByTestId('receipt-upload-input').setInputFiles({ name: 'fictional-editor.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByTestId('receipt-image-read')).toBeEnabled(); await page.getByTestId('receipt-image-read').click()
  await expect(page.getByTestId('capture-review')).toBeVisible()
}
async function context(page: Page) {
  await page.getByTestId('review-channel').selectOption('physical'); await page.getByTestId('review-placeId').selectOption('place_shuk_bograshov')
  await page.getByTestId('review-payment').selectOption('cash'); await page.getByTestId('review-category').selectOption('groceries')
  await page.getByTestId('receipt-timezone').selectOption('UTC'); await page.getByTestId('receipt-confirm-time').click()
}
async function stored(page: Page) {
  return page.evaluate(() => new Promise<any>(resolve => {
    const r = indexedDB.open('spendscape-local-purchases', 1)
    r.onsuccess = () => { const db = r.result, t = db.transaction('state'), q = t.objectStore('state').get('current'); t.oncomplete = () => { db.close(); resolve(q.result) } }
  }))
}
async function setup(page: Page, he: boolean, o: ReceiptObservations) {
  // A provider call is forbidden; intercept before the local candidate handler.
  await page.route('**/api/receipt-structured', async route => {
    if (route.request().method() === 'GET') await route.continue()
    else await route.fulfill({ json: { code: 'direct-observations', observations: o } })
  })
  await page.route(/https:\/\/.*(?:generativelanguage|vision\.googleapis|groq)/, route => { throw new Error('provider-forbidden:' + route.request().method()) })
  await page.goto('/?receiptStructuredLocal=1'); await ready(page); if (he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await open(page); await image(page); await count(page, 42)
}
test.beforeAll(async () => { await mkdir(out, { recursive: true }) })
for (const [width, height, he] of [[360, 640, false], [390, 844, true], [430, 932, true], [1280, 844, false]] as const) {
  test(`recognized formats, corrections, explicit save/reload, duplicate and Undo ${width} ${he ? 'he' : 'en'}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' }); const o = fixture()
    await setup(page, he, o)
    await expect(page.getByTestId('review-date')).toHaveValue('2024-02-29T09:07'); await expect(page.getByTestId('review-currency')).toHaveValue('ILS')
    await expect(page.getByTestId('receipt-timezone')).toHaveValue(''); await expect(page.getByTestId('receipt-observations')).toContainText('29/02/2024')
    await expect(page.getByTestId('receipt-total-notice')).toContainText('0.05'); await expect(page.getByTestId('receipt-payable-summary')).toContainText('60.45')
    await expect(page.getByTestId('receipt-payable-summary')).toContainText('60.50')
    await expect(page.getByTestId('receipt-address-review')).toHaveValue(o.address as string)
    await page.getByTestId('receipt-address-review').fill('Reviewed fictional address · כתובת מתוקנת בדויה')
    await expect(page.getByTestId('receipt-observations').locator(':scope > p').nth(1)).toContainText(o.address as string)
    await page.getByTestId('capture-confirm').click(); await count(page, 42)
    await expect(page.getByTestId('receipt-timezone')).toBeFocused(); await expect(page.locator('#receipt-time-error')).toBeInViewport({ ratio: 1 })
    await page.screenshot({ path: join(out, `timezone-error-${width}.png`) })
    await context(page); await page.getByTestId('capture-confirm').click(); await count(page, 42)
    // Actual validation still requires a unit to interpret quantity. The receipt
    // editor coalesces those dependent errors and focuses the missing unit.
    await expect(page.getByTestId('review-quantity-0')).toHaveAttribute('aria-invalid', 'false')
    await expect(page.getByTestId('review-unit-0')).toBeFocused(); await expect(page.locator('#review-error-unit-0')).toBeInViewport({ ratio: 1 })
    await page.screenshot({ path: join(out, `unit-error-${width}.png`) })
    for (let i = 0; i < 5; i++) await page.getByTestId(`review-unit-${i}`).selectOption('item')
    await page.getByTestId('review-printedAmount-0').fill('9.99'); await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('review-printedAmount-0')).toBeFocused(); await expect(page.locator('#review-error-printedAmount-0')).toBeInViewport({ ratio: 1 }); await count(page, 42)
    await page.getByTestId('review-printedAmount-0').fill('10.00')
    await page.getByTestId('receipt-payable-summary').scrollIntoViewIfNeeded(); await page.screenshot({ path: join(out, `totals-${width}.png`) })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('capture-success')).toBeVisible(); await count(page, 43)
    const d = await stored(page), p = d.records[0].purchase
    expect(p.originalAmount).toBe(60.50); expect(p.items.reduce((n: number, i: any) => n + Math.round(i.lineTotal * 100), 0)).toBe(6045)
    expect(p.items.reduce((n: number, i: any) => n + i.quantity, 0)).toBe(7); expect(p.items).toHaveLength(5)
    expect(p.timestamp).toBe('2024-02-29T09:07:00.000Z') // user explicitly chose UTC in mock
    expect(p.items.map((i: any) => [i.unitPrice, i.lineTotal])).toEqual(o.lines.map(l => [Number(l.unitPrice), Number(l.lineAmount)]))
    expect(JSON.stringify(d)).not.toMatch(/observations|Reviewed fictional address|fictional-editor|blob:|base64/)
    await page.getByTestId('capture-undo').click(); await count(page, 42); expect((await stored(page)).records).toEqual([])
    await page.getByTestId('capture-source-receipt-image').click(); await image(page); await context(page)
    for (let i = 0; i < 5; i++) await page.getByTestId(`review-unit-${i}`).selectOption('item')
    await page.getByTestId('capture-confirm').click(); await count(page, 43); const saved = await stored(page)
    await page.reload(); await ready(page); await count(page, 43); expect(await stored(page)).toEqual(saved)
    await open(page); await image(page); await context(page); for (let i = 0; i < 5; i++) await page.getByTestId(`review-unit-${i}`).selectOption('item')
    await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('review-save-separate')).toBeVisible(); await count(page, 43)
  })
}
for (const he of [false, true]) test(`invalid/missing facts remain editable with visible feedback ${he ? 'he' : 'en'}`, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  const o = fixture(); o.date = '31/02/2024'; o.time = null; o.currency = { candidates: ['ILS', 'USD'] }; o.merchantName = null
  await setup(page, he, o); await expect(page.getByTestId('review-date')).toHaveValue(''); await expect(page.getByTestId('review-currency')).toHaveValue('')
  await expect(page.getByTestId('receipt-observations')).toContainText('31/02/2024')
  await page.getByTestId('capture-confirm').click(); await count(page, 42)
  await expect(page.getByTestId('review-date')).toBeFocused(); await expect(page.locator('#receipt-time-error')).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: join(out, `invalid-date-360-${he ? 'he' : 'en'}.png`) })
  await page.getByTestId('review-date').fill('2024-02-29T09:07'); await page.getByTestId('review-currency').selectOption('ILS'); await context(page)
  for (let i = 0; i < 5; i++) await page.getByTestId(`review-unit-${i}`).selectOption('item')
  await page.getByTestId('capture-confirm').click(); await count(page, 43); await page.reload(); await ready(page); await count(page, 43)
})
