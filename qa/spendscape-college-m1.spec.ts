import { test, expect, type Page } from '@playwright/test'
import { createFixtureSpendscapeRepository } from '../src/data/spendscape-repository'
import { blankReview, reviewedRecord } from '../src/features/capture/session-purchase-domain'
import { emptyLocalPurchases } from '../src/features/local-purchases/local-purchase-store'
import type { ReceiptObservations } from '../src/features/capture/receipt-review-adapter'
const out = process.env.SPENDSCAPE_M1_QA_OUT!
const receipt = (): ReceiptObservations => ({ merchantName: 'Fictional QA Cedar / חנות בדיקה', address: 'Fictional street 8', date: '29/02/2024', time: '09:07', currency: 'ש״ח', finalAmount: '31.50', lines: [
  { name: 'מוצר בדיקה Bread', quantity: '1', unit: null, unitPrice: '4.00', lineAmount: '4.00' },
  { name: 'Fictional cereal', quantity: '1', unit: null, unitPrice: '7.00', lineAmount: '7.00' },
  { name: 'חלב בדיקה', quantity: '2', unit: null, unitPrice: '3.50', lineAmount: '7.00' },
  { name: 'Fictional beans', quantity: '1', unit: null, unitPrice: '8.45', lineAmount: '8.45' },
  { name: 'Fictional dessert', quantity: '2', unit: null, unitPrice: '2.50', lineAmount: '5.00' },
] })
async function ready(page: Page) { await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready'); await page.waitForFunction(() => (window as any).__SPENDSCAPE_QA__?.ready) }
async function counts(page: Page, purchases: number, pins: number) { await expect.poll(() => page.evaluate(() => (window as any).__SPENDSCAPE_QA__)).toMatchObject({ combinedPurchaseCount: purchases, canonicalPins: pins, mapInstanceCount: 1, mapConstructionCount: 1 }) }
async function disk(page: Page) { return page.evaluate(() => new Promise<any>((resolve, reject) => { const r = indexedDB.open('spendscape-local-purchases', 1); r.onerror = () => reject('open'); r.onsuccess = () => { const db = r.result, t = db.transaction('state'), q = t.objectStore('state').get('current'); t.oncomplete = () => { db.close(); resolve(q.result) } } })) }
async function put(page: Page, value: unknown) { await page.evaluate(value => new Promise<void>(resolve => { const r = indexedDB.open('spendscape-local-purchases', 1); r.onsuccess = () => { const db = r.result, t = db.transaction('state', 'readwrite'); t.objectStore('state').put(value, 'current'); t.oncomplete = () => { db.close(); resolve() } } }), value) }
function nav(page: Page) { return page.locator(`nav[aria-label="${(page.viewportSize()?.width ?? 1280) < 761 ? 'Mobile primary' : 'Primary'}"]`) }
async function capture(page: Page) { await page.getByTestId((page.viewportSize()?.width ?? 1280) < 761 ? 'capture-open-mobile' : 'capture-open-desktop').click() }
async function inject(page: Page) { await capture(page); await page.waitForFunction(() => typeof (window as any).__SPENDSCAPE_RECEIPT_REVIEW_QA__ === 'function'); await page.evaluate(raw => (window as any).__SPENDSCAPE_RECEIPT_REVIEW_QA__(raw), receipt()); await expect(page.getByTestId('capture-review')).toBeVisible() }
async function confirm(page: Page, merchant?: string) {
  // Receipt review pre-fills the observed store as a new-store form; an existing store is chosen after leaving it.
  if (merchant) { await page.getByRole('button', { name: /^(Use an existing store and place|חזרה לבחירת חנות ומקום קיימים)$/ }).click(); await page.getByTestId('review-merchantId').selectOption(merchant) }
  else await page.getByTestId('review-merchantCategory').selectOption('unknown')
  await page.getByTestId('review-payment').selectOption('unknown'); await page.getByTestId('review-category').selectOption('unknown'); await page.getByTestId('receipt-timezone').selectOption('UTC'); await page.getByTestId('receipt-confirm-time').click()
  for (let i = 0; i < 5; i++) await page.getByTestId(`review-unit-${i}`).selectOption('item')
}
test.beforeEach(async ({ page }) => {
  // Ordinary users now start in Hebrew; these flows start in English and switch explicitly.
  await page.addInitScript(() => { if (!localStorage.getItem('spendscape.locale.v1')) localStorage.setItem('spendscape.locale.v1', 'en') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(/generativelanguage|vision\.googleapis|groq|api\.geoapify|prices\.shufersal|pricesprodpublic/i, () => { throw new Error('provider-forbidden') })
})
for (const [width, he] of [[360, false], [390, true], [430, true], [1280, false]] as const) test(`fresh empty and ordinary unavailable flows ${width} ${he}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 360 ? 640 : 844 }); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('/?syntheticQa=0'); await ready(page); if (he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await counts(page, 0, 0); expect(await disk(page)).toBeUndefined()
  await expect(page.getByRole('button', { name: he ? 'טוס למקום האחרון' : 'Fly to latest', exact: true }).filter({ visible: true })).toBeDisabled()
  await expect(page.getByTestId('home-empty')).toContainText(he ? 'עוד אין רכישות' : 'No purchases yet'); await expect(page.getByTestId('map-empty')).toHaveCount(0)
  await expect(page.getByTestId('smart-inbox-open')).toHaveCount(0); await expect(page.getByTestId('ask-open-desktop')).toHaveCount(0)
  await page.screenshot({ path: `${out}/empty-globe-${width}-${he ? 'he' : 'en'}.png` })
  await nav(page).getByRole('button', { name: he ? 'רכישות' : 'Purchases', exact: true }).click(); await expect(page.getByTestId('purchases-empty')).toBeVisible()
  await page.screenshot({ path: `${out}/empty-purchases-${width}-${he ? 'he' : 'en'}.png` })
  await nav(page).getByRole('button', { name: he ? (width < 761 ? 'נתונים' : 'ניתוחים') : (width < 761 ? 'Stats' : 'Analytics'), exact: true }).click(); await expect(page.getByTestId('analytics-first-run')).toBeVisible(); await expect(page.getByTestId('analytics-count')).toHaveCount(0)
  await page.screenshot({ path: `${out}/empty-stats-${width}-${he ? 'he' : 'en'}.png` })
  await capture(page); await expect(page.getByTestId('barcode-demo')).toHaveCount(0)
  await page.getByTestId('barcode-manual-open').click(); await page.getByTestId('barcode-input').fill('2000000000015'); await page.getByTestId('barcode-submit').click()
  await expect(page.getByTestId('barcode-product-name')).toHaveValue(''); await expect(page.getByTestId('barcode-result')).toContainText(he ? 'המוצר לא נמצא במחירונים' : 'Not in the Tel Aviv price files')
  await page.getByTestId('barcode-reset').click(); await page.getByTestId('capture-sources-open').click(); await expect(page.getByTestId('capture-source-receipt')).toHaveCount(0); await expect(page.getByTestId('capture-source-product')).toHaveCount(0); await expect(page.getByTestId('capture-source-csv')).toHaveCount(0)
  await page.getByTestId('capture-source-receipt-image').click(); await expect(page.getByTestId('receipt-image-intake')).toContainText(he ? 'אינו פעיל' : 'not activated')
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 64, 64); return canvas.toDataURL('image/png').split(',')[1] })
  await page.getByTestId('receipt-upload-input').setInputFiles({ name: 'fictional-empty-qa.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await expect(page.getByTestId('receipt-image-read')).toBeEnabled(); await page.getByTestId('receipt-image-read').click(); await expect(page.getByTestId('receipt-image-status')).toContainText(he ? 'אינו זמין' : 'unavailable'); await expect(page.getByTestId('receipt-image-preview')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]); await counts(page, 0, 0)
})
for (const he of [false, true]) test(`receipt corrections save duplicate Undo reload with no fixture baseline ${he}`, async ({ page }) => {
  await page.setViewportSize({ width: he ? 390 : 360, height: 844 }); await page.goto('/?receiptReviewQa=1'); await ready(page); if (he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await counts(page, 0, 0); await inject(page); await expect(page.getByTestId('review-date')).toHaveValue('2024-02-29T09:07'); await expect(page.getByTestId('review-currency')).toHaveValue('ILS'); await confirm(page)
  await page.getByTestId('review-printedAmount-0').fill('3.99'); await page.getByTestId('capture-confirm').click(); await counts(page, 0, 0); await expect(page.getByTestId('review-printedAmount-0')).toHaveAttribute('aria-invalid', 'true')
  await page.getByTestId('review-printedAmount-0').fill('4.00'); await page.getByTestId('receipt-payable-summary').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${out}/receipt-review-${he ? 'he' : 'en'}.png` })
  await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('capture-success')).toBeVisible(); await counts(page, 1, 0)
  const saved = await disk(page), p = saved.records[0].purchase; expect(p.originalAmount).toBe(31.5); expect(p.items).toHaveLength(5); expect(p.items.reduce((sum: number, i: any) => sum + i.quantity, 0)).toBe(7); expect(p.items.reduce((sum: number, i: any) => sum + Math.round(i.lineTotal * 100), 0)).toBe(3145); expect(saved.directory.places).toEqual([])
  await page.getByTestId('capture-undo').click(); await counts(page, 0, 0); expect((await disk(page)).records).toEqual([])
  await page.keyboard.press('Escape'); await inject(page); await confirm(page); await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('capture-success')).toBeVisible(); const again = await disk(page)
  await page.reload(); await ready(page); await counts(page, 1, 0); expect(await disk(page)).toEqual(again)
  await nav(page).getByRole('button', { name: he ? 'נתונים' : 'Stats', exact: true }).click(); await expect(page.getByTestId('analytics-total')).toContainText('31.50'); await expect(page.getByTestId('analytics-count')).toHaveText('1')
  await nav(page).getByRole('button', { name: he ? 'רכישות' : 'Purchases', exact: true }).click(); await page.getByTestId(`purchase-${again.records[0].purchase.id}`).click(); await expect(page.getByTestId('receipt-payable-summary')).toContainText('31.45'); await expect(page.getByTestId('receipt-payable-summary')).toContainText('31.50')
  await page.screenshot({ path: `${out}/saved-detail-${he ? 'he' : 'en'}.png` }); await inject(page); await confirm(page, again.records[0].purchase.merchantId); await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('review-save-separate')).toBeVisible(); await counts(page, 1, 0)
  await page.keyboard.press('Escape'); expect(await disk(page)).toEqual(again)
})
for (const version of [1, 2, 3, 4]) test(`legacy v${version} hydration keeps records decisions and one referenced pin`, async ({ page }) => {
  await page.goto('/'); await ready(page); const history = await createFixtureSpendscapeRepository().loadSnapshot(), place = history.places[0]
  const r = reviewedRecord({ ...blankReview(), source: 'manual', merchantId: place.merchantId, placeId: place.id, channel: 'physical', date: '2024-02-29T09:07', currency: 'ILS', payment: 'cash', category: 'groceries', amount: '12.00', lines: [] }, 1, history)
  const value: any = { ...emptyLocalPurchases(), version, records: [r], nextSequence: 2, revision: 8, decisions: [{ caseId: history.smartInboxCases[0].id, status: 'deferred' }] }; if (version < 3) delete value.directory
  await put(page, value); await page.reload(); await ready(page); await counts(page, 1, 1); expect(await disk(page)).toEqual(value)
  await nav(page).getByRole('button', { name: 'Purchases', exact: true }).click(); await page.getByTestId(`purchase-${r.purchase.id}`).click(); await expect(page.getByTestId('purchase-detail')).toContainText(place.name.en)
  await page.getByRole('button', { name: 'View place', exact: true }).click(); await expect(page.getByTestId('place-panel')).toContainText(place.name.en); await page.reload(); await ready(page); await counts(page, 1, 1); expect(await disk(page)).toEqual(value)
})
test('explicit isolated fixture opt-in, stale simulation history cannot reopen ordinary actions', async ({ page }) => {
  await page.goto('/?syntheticQa=1'); await ready(page); await counts(page, 42, 12); await expect(page.getByTestId('smart-inbox-open')).toBeVisible()
  await page.goto('/'); await ready(page); await counts(page, 0, 0); await page.evaluate(() => { const state = { marker: 'spendscape-1d1', surface: 'globe', selectedPlaceId: null, selectedPurchaseId: null, askOpen: true, inboxCaseId: 'fake', captureStep: 'processing', captureDepth: 1 }; history.pushState(state, '', '#ask'); dispatchEvent(new PopStateEvent('popstate', { state })) })
  await expect(page.getByTestId('capture-sources')).toBeVisible(); await expect(page.getByTestId('capture-processing')).toHaveCount(0); await expect(page.getByTestId('ask-dialog')).toHaveCount(0); await counts(page, 0, 0)
})
for (const he of [false, true]) test(`ordinary manual entry and confirmed shared place ${he}`, async ({ page }) => {
  await page.setViewportSize({ width: he ? 390 : 360, height: 844 }); await page.goto('/'); await ready(page)
  if (he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await capture(page); await page.getByTestId('capture-camera-manual').click()
  await page.getByTestId('review-channel').selectOption('physical'); await page.getByTestId('review-new-merchant').click()
  await page.getByTestId('review-merchantName').fill('Fictional manual בדיקה'); await page.getByTestId('review-merchantCategory').selectOption('unknown')
  for (const [key, value] of Object.entries({ branch: 'Fictional branch', city: 'Fictional city', country: 'Fictional country', address: 'Fictional street', longitude: '34.75', latitude: '32.10' })) await page.getByTestId(`review-place-${key}`).fill(value)
  await page.getByTestId('review-place-confirmed').check(); await page.getByTestId('review-date').fill('2024-02-29T09:07'); await page.getByTestId('review-currency').selectOption('ILS'); await page.getByTestId('review-payment').selectOption('unknown'); await page.getByTestId('review-category').selectOption('unknown'); await page.getByTestId('review-amount').fill('25')
  await page.getByTestId('manual-review').click(); await counts(page, 0, 0); expect(await disk(page)).toBeUndefined()
  await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('capture-success')).toBeVisible(); await counts(page, 1, 1)
  const first = await disk(page), id = first.records[0].purchase.id
  await page.getByTestId('capture-view-purchase').click(); await expect(page.getByTestId('purchase-detail')).toContainText('Fictional manual')
  await page.getByTestId('purchase-resolve-location').click(); await page.getByTestId('location-kind').selectOption('branch'); await page.getByTestId('location-pick-map').click(); await expect(page.getByTestId('location-map-picker')).toBeVisible(); await page.getByTestId('location-map-east').click(); await page.getByTestId('location-map-use').click(); await page.getByTestId('location-cancel').click(); expect(await disk(page)).toEqual(first)
  await page.getByTestId('purchase-show-place').click(); await expect(page.getByTestId('place-panel')).toBeVisible(); await counts(page, 1, 1)
  await page.reload(); await ready(page); expect(await disk(page)).toEqual(first); await counts(page, 1, 1)
  await page.getByRole('button', { name: he ? 'טוס למקום האחרון' : 'Fly to latest', exact: true }).filter({ visible: true }).click(); await expect.poll(() => page.evaluate(() => (window as any).__SPENDSCAPE_QA__.selectedPlaceId)).toBe(first.directory.places[0].id)
  await capture(page); await page.getByTestId('capture-camera-manual').click(); await page.getByTestId('review-channel').selectOption('physical'); await page.getByTestId('review-placeId').selectOption(first.directory.places[0].id); await page.getByTestId('review-date').fill('2024-03-01T10:00'); await page.getByTestId('review-currency').selectOption('ILS'); await page.getByTestId('review-payment').selectOption('cash'); await page.getByTestId('review-category').selectOption('unknown'); await page.getByTestId('review-amount').fill('15'); await page.getByTestId('manual-review').click(); await page.getByTestId('capture-confirm').click(); await expect(page.getByTestId('capture-success')).toBeVisible(); await counts(page, 2, 1)
  const shared = await disk(page); expect(shared.directory.places).toHaveLength(1); expect(shared.records[0].purchase.id).toBe(id)
  await page.getByTestId('capture-undo').click(); await counts(page, 1, 1); expect((await disk(page)).records).toEqual(first.records)
  await page.reload(); await ready(page); await counts(page, 1, 1)
  await nav(page).getByRole('button', { name: he ? 'רכישות' : 'Purchases', exact: true }).click(); await page.getByTestId('history-search').fill('Fictional manual'); await expect(page.getByTestId(`purchase-${id}`)).toBeVisible(); await page.screenshot({ path: `${out}/manual-history-${he ? 'he' : 'en'}.png` })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
