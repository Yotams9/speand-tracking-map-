import { test, expect, type Page } from '@playwright/test'
import { canonicalSpendscapeData } from '../src/data/spendscape-fixtures'
import type { Merchant, Place } from '../src/data/spendscape-globe'
import { blankReview, reviewedRecord, type PurchaseReviewInput } from '../src/features/capture/session-purchase-domain'

// The earlier build's localStorage ledger (version 1): one purchase at a Tel Aviv
// chain branch, which needs the published store list, and one online purchase.
const LEGACY = 'spendscape.device-purchases.v1', MARKER = 'spendscape.device-purchases.v1.migration'
const merchants: Merchant[] = [
  { id: 'chain_ramilevi', name: { en: 'Rami Levy', he: 'רמי לוי' }, category: 'groceries' },
  { id: 'device_merchant_02', name: { en: 'Fictional web shop', he: 'Fictional web shop' }, category: 'retail' },
]
const places: Place[] = [{ id: 'store_ramilevi_733', merchantId: 'chain_ramilevi', name: { en: 'Rami Levy', he: 'רמי לוי' }, branch: { en: 'Ben Yehuda 23', he: 'Ben Yehuda 23' }, city: { en: 'Tel Aviv-Yafo', he: 'תל אביב-יפו' }, country: { en: 'Israel', he: 'ישראל' }, coordinates: [34.76795, 32.0764], category: 'groceries' }]
const oldContext = { merchants: [...canonicalSpendscapeData.merchants, ...merchants], places: [...canonicalSpendscapeData.places, ...places] }
const base = (): PurchaseReviewInput => ({ ...blankReview(), date: '2026-10-02T09:15', currency: 'ILS', payment: 'cash', category: 'groceries' })
const ledger = JSON.stringify({ version: 1, nextSequence: 3, merchants, places, records: [
  reviewedRecord({ ...base(), channel: 'physical', merchantId: 'chain_ramilevi', placeId: 'store_ramilevi_733', amount: '16.40', lines: [{ name: 'Fictional cola', quantity: '2', unit: 'item', price: '8.20' }] }, 1, oldContext),
  reviewedRecord({ ...base(), channel: 'online', merchantId: 'device_merchant_02', category: 'retail', amount: '9.99' }, 2, oldContext),
] })

async function seed(page: Page) {
  await page.addInitScript(([key, value]) => { localStorage.setItem(key, value); localStorage.setItem('spendscape.locale.v1', 'en') }, [LEGACY, ledger] as const)
}
const storesDown = (page: Page) => page.route('**/api/catalog/stores', route => route.fulfill({ status: 503, body: 'unavailable' }))
const stored = (page: Page) => page.evaluate(() => new Promise<any>((resolve, reject) => { const r = indexedDB.open('spendscape-local-purchases', 1); r.onerror = () => reject('open'); r.onsuccess = () => { const db = r.result, t = db.transaction('state'), q = t.objectStore('state').get('current'); t.oncomplete = () => { db.close(); resolve(q.result) } } }))
const local = (page: Page, key: string) => page.evaluate(k => localStorage.getItem(k), key)

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(/generativelanguage|vision\.googleapis|groq|api\.geoapify|prices\.shufersal|pricesprodpublic/i, () => { throw new Error('provider-forbidden') })
})

test('store list unavailable: the store stays empty and blocked until "Try again" imports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seed(page); await storesDown(page)
  await page.goto('/')
  const pending = page.getByTestId('legacy-migration-pending')
  await expect(pending).toContainText('2 purchases saved earlier on this device are waiting')
  await expect(page.locator('main')).toHaveAttribute('data-local-state', 'loading')
  expect(await stored(page)).toBeUndefined(); expect(await local(page, MARKER)).toBeNull()
  // Still down: nothing changes.
  await page.getByTestId('legacy-migration-retry').click()
  await expect(page.getByTestId('legacy-migration-retry')).toBeEnabled(); await expect(pending).toBeVisible()
  expect(await stored(page)).toBeUndefined()
  // The list is back: one import into the still-empty store.
  await page.unroute('**/api/catalog/stores')
  await page.getByTestId('legacy-migration-retry').click()
  await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await expect(pending).toHaveCount(0)
  await expect(page.getByTestId('legacy-migration-notice')).toContainText('2 purchases saved earlier on this device were moved')
  const data = await stored(page)
  expect(data.records.map((r: any) => r.purchase.id)).toEqual(['session_purchase_manual_01', 'session_purchase_manual_02'])
  expect(data.directory.places).toMatchObject([{ locationMethod: 'catalog-store', catalogStore: { storeId: 'ramilevi-733' } }])
  expect(JSON.parse((await local(page, MARKER))!)).toMatchObject({ status: 'imported', purchases: 2 })
  expect(await local(page, LEGACY)).toBe(ledger)
})

test('store list unavailable: "Continue without importing" is recorded and reported until dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await seed(page); await storesDown(page)
  await page.goto('/')
  await page.getByTestId('legacy-migration-continue').click()
  await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await expect(page.getByTestId('legacy-migration-pending')).toHaveCount(0)
  await expect(page.getByTestId('legacy-migration-notice')).toContainText('2 old purchases were not moved')
  expect(await stored(page)).toBeUndefined()
  expect(JSON.parse((await local(page, MARKER))!)).toMatchObject({ status: 'skipped-by-user', legacyPurchases: 2 })
  // Later loads never import, even once the list is back, and keep reporting until dismissed.
  await page.unroute('**/api/catalog/stores'); await page.reload()
  await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await expect(page.getByTestId('legacy-migration-notice')).toContainText('2 old purchases were not moved')
  await page.getByTestId('legacy-migration-notice').getByRole('button', { name: 'Got it' }).click()
  await page.reload(); await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await expect(page.getByTestId('legacy-migration-notice')).toHaveCount(0)
  expect(await stored(page)).toBeUndefined()
  expect(await local(page, LEGACY)).toBe(ledger)
})
