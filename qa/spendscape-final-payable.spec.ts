import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { payableReceipt } from './final-payable-mocks'

const out = process.env.SPENDSCAPE_PAYABLE_QA_OUT
test.skip(!out, 'Requires a fresh isolated output directory')
async function ready(page: Page) {
  await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await page.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready)
}
async function graph(page: Page, count: number, addition = 0) {
  await expect.poll(() => page.evaluate(() => (window as any).__SPENDSCAPE_QA__)).toMatchObject({
    combinedPurchaseCount: count, canonicalPins: 12, mapInstanceCount: 1, mapConstructionCount: 1,
    visibleBaseTotalIls: 6777.38 + addition, analytics: { totalBaseAmountIls: 6777.38 + addition },
  })
}
async function draft(page: Page) {
  await page.getByTestId((page.viewportSize()?.width ?? 1280) < 761 ? 'capture-open-mobile' : 'capture-open-desktop').click()
  await page.waitForFunction(() => typeof (window as any).__SPENDSCAPE_RECEIPT_REVIEW_QA__ === 'function')
  await page.evaluate(raw => (window as any).__SPENDSCAPE_RECEIPT_REVIEW_QA__(raw), payableReceipt)
  await expect(page.getByTestId('receipt-observations')).toBeVisible()
}
async function context(page: Page) {
  await page.getByTestId('review-channel').selectOption('physical')
  await page.getByTestId('review-placeId').selectOption('place_shuk_bograshov')
  await page.getByTestId('review-payment').selectOption('cash')
  await page.getByTestId('review-category').selectOption('groceries')
  // Explicit UTC in this fictional control; no inferred timezone or century.
  await page.getByTestId('receipt-timezone').selectOption('UTC')
  await page.getByTestId('receipt-confirm-time').click()
}
async function stored(page: Page) {
  return page.evaluate(() => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open('spendscape-local-purchases', 1)
    request.onerror = () => reject(new Error('test-storage-open'))
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('state'), read = tx.objectStore('state').get('current')
      tx.oncomplete = () => { db.close(); resolve(read.result) }
    }
  }))
}
test.beforeAll(async () => { if (out) await mkdir(out, { recursive: true }) })

for (const [width, height, he] of [[360, 640, false], [360, 640, true], [390, 844, true], [430, 932, false], [1280, 844, false]] as const) {
  test(`printed payable editing, confirmation, save/reload and separate totals ${width} ${he ? 'he' : 'en'}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: 'reduce' })
    const forbidden: string[] = [], errors: string[] = [], logs: string[] = []
    page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method()) || /generativelanguage|vision.googleapis|groq|traineddata|tesseract/.test(request.url())) forbidden.push('forbidden') })
    page.on('pageerror', () => errors.push('pageerror')); page.on('console', message => logs.push(message.text()))
    await page.goto('/?receiptReviewQa=1'); await ready(page)
    if (he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
    await graph(page, 42); await draft(page); await graph(page, 42)
    await expect(page.getByTestId('review-amount')).toHaveValue('60.50')
    await expect(page.getByTestId('review-date')).toHaveValue('2013-09-30T11:57')
    await expect(page.getByTestId('receipt-total-notice')).toContainText('0.05')
    await expect(page.getByTestId('receipt-payable-summary')).toContainText('60.55')
    await page.getByTestId('review-amount').fill('60.55')
    await expect(page.getByTestId('receipt-total-notice')).toHaveCount(0)
    await page.getByTestId('review-amount').fill('60.50')
    await expect(page.getByTestId('receipt-total-notice')).toContainText('0.05')
    await context(page)
    // An item mismatch still blocks saving even though the basket notice does not.
    await page.getByTestId('review-printedAmount-0').fill('9.95')
    await page.getByTestId('capture-confirm').click()
    await expect(page.getByTestId('review-printedAmount-0')).toBeFocused()
    await expect(page.locator('#review-error-printedAmount-0')).toBeInViewport({ ratio: 1 })
    await graph(page, 42)
    await page.getByTestId('review-printedAmount-0').fill('10.00')
    await page.getByTestId('receipt-payable-summary').scrollIntoViewIfNeeded()
    await expect(page.getByTestId('receipt-total-notice')).toBeInViewport({ ratio: 1 })
    await expect(page.getByTestId('capture-confirm')).toBeInViewport({ ratio: 1 })
    await expect(page.getByTestId('receipt-total-notice')).toContainText(he ? 'אינו חוסם שמירה' : 'nonblocking review notice')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: join(out!, `review-${width}-${he ? 'he' : 'en'}.png`) })
    // Two submit events, one explicit confirmation, one durable purchase.
    await page.getByTestId('capture-review').evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit() })
    await expect(page.getByTestId('capture-success')).toBeVisible(); await graph(page, 43, 60.5)
    const disk = await stored(page), purchase = disk.records[0].purchase
    expect(disk.version).toBe(3); expect(disk.records).toHaveLength(1)
    expect(purchase.originalAmount).toBe(60.5)
    expect(purchase.items).toHaveLength(5)
    expect(purchase.items.reduce((n: number, i: any) => n + Math.round(i.lineTotal * 100), 0)).toBe(6055)
    expect(purchase.items.reduce((n: number, i: any) => n + i.quantity, 0)).toBe(7)
    expect(purchase.items.map((i: any) => [i.label.en, i.quantity, i.unitPrice, i.lineTotal])).toEqual(payableReceipt.lines.map(i => [i.name, Number(i.quantity), Number(i.unitPrice), Number(i.lineAmount)]))
    expect(purchase.timestamp).toBe('2013-09-30T11:57:00.000Z')
    expect(JSON.stringify(disk)).not.toMatch(/discountMinor|barcode|observations|printedAmount|Fictional street|vatRate/)
    await page.reload(); await ready(page); await graph(page, 43, 60.5)
    expect(await stored(page)).toEqual(disk)
    await expect(page.getByTestId('session-undo')).toHaveCount(0)
    await expect(page.getByTestId('nearby-demo-card')).toHaveCount(0)
    const nav = page.getByRole('navigation', { name: width < 761 ? 'Mobile primary' : 'Primary', exact: true })
    await nav.getByRole('button', { name: he ? 'רכישות' : 'Purchases', exact: true }).click()
    await page.getByTestId(`purchase-${purchase.id}`).click()
    await expect(page.getByTestId('receipt-payable-summary')).toContainText('60.55')
    await expect(page.getByTestId('receipt-payable-summary')).toContainText('60.50')
    await expect(page.getByTestId('receipt-total-notice')).toContainText('0.05')
    await expect(page.getByTestId('receipt-total-notice')).toContainText(he ? 'סיכומי ההוצאות' : 'Spending totals')
    await page.getByTestId('receipt-payable-summary').scrollIntoViewIfNeeded()
    await page.screenshot({ path: join(out!, `detail-${width}-${he ? 'he' : 'en'}.png`) })
    expect(forbidden).toEqual([]); expect(errors).toEqual([])
    expect(logs.join(' ')).not.toMatch(/Fictional payable|Fictional street|Cookies|60\.50|60\.55/)
    expect(await page.evaluate(() => JSON.stringify([history.state, location.href, ...Object.values(sessionStorage), ...Object.values(localStorage)]))).not.toMatch(/Fictional payable|Cookies|60\.50|60\.55|printedAmount|observations/)
  })
}

test('different receipt totals retain duplicate override, Undo and cancellation', async ({ page }) => {
  await page.goto('/?receiptReviewQa=1'); await ready(page); await draft(page); await context(page)
  await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('capture-success')).toBeVisible(); await graph(page, 43, 60.5)
  await page.getByTestId('capture-undo').click(); await graph(page, 42)
  expect((await stored(page)).records).toEqual([])
  // Undo consumed the operation; a fresh reviewed draft is needed.
  await page.evaluate(raw => (window as any).__SPENDSCAPE_RECEIPT_REVIEW_QA__(raw), payableReceipt)
  await context(page); await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('capture-success')).toBeVisible()
  await page.getByTestId('capture-done').click(); await draft(page); await context(page)
  await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('review-save-separate')).toBeVisible(); await graph(page, 43, 60.5)
  await page.getByTestId('review-save-separate').click(); await expect(page.getByTestId('capture-success')).toBeVisible(); await graph(page, 44, 121)
  await page.getByTestId('capture-undo').click(); await graph(page, 43, 60.5)
  await page.evaluate(raw => (window as any).__SPENDSCAPE_RECEIPT_REVIEW_QA__(raw), payableReceipt)
  await page.keyboard.press('Escape'); await expect(page.getByTestId('capture-layer')).toHaveCount(0)
  await draft(page); await page.keyboard.press('Escape'); await graph(page, 43, 60.5)
  expect((await stored(page)).records).toHaveLength(1)
})
