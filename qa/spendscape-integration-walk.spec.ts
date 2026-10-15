import { test, expect, type Page, type Browser } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { oneReceipt } from './receipt-review-integration-mocks'

// Integration walk-through of the merged app as an ordinary user, at phone and
// desktop size, in Hebrew and English: empty start → demo toggle → Tel Aviv
// barcode prices → chain-branch autofill → save → reload (IndexedDB) → pin →
// Stats → backup → restore into a fresh profile → mocked receipt review →
// city comparison → address-to-pin with a mocked search. Screenshots only go
// to artifacts/ (git-ignored). No provider is reachable: provider hosts are
// blocked and the address search is answered by a route mock.
const out = process.env.SPENDSCAPE_WALK_OUT ?? 'artifacts/integration/walk'
const GTIN = '7290000072753'
type Qa = { ready: boolean; combinedPurchaseCount: number; sessionPurchaseCount: number; canonicalPins: number }
const qa = (p: Page) => p.evaluate(() => (window as unknown as { __SPENDSCAPE_QA__: Qa }).__SPENDSCAPE_QA__)
async function ready(p: Page) {
  await expect(p.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await p.waitForFunction(() => (window as unknown as { __SPENDSCAPE_QA__?: Qa }).__SPENDSCAPE_QA__?.ready, null, { timeout: 60_000 })
}
async function stored(p: Page) {
  return p.evaluate(() => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open('spendscape-local-purchases', 1)
    request.onerror = () => reject(Error('open'))
    request.onsuccess = () => { const db = request.result, tx = db.transaction('state'), value = tx.objectStore('state').get('current'); tx.oncomplete = () => { db.close(); resolve(value.result) } }
  }))
}
async function useLocale(p: Page, locale: 'he' | 'en') {
  if (await p.evaluate(() => document.documentElement.lang) !== locale) await p.getByRole('button', { name: locale === 'he' ? 'Switch to Hebrew' : 'מעבר לאנגלית' }).click()
  await expect.poll(() => p.evaluate(() => document.documentElement.lang)).toBe(locale)
}
async function navigate(p: Page, mobile: boolean, target: 'globe' | 'purchases' | 'stats') {
  if (mobile) await p.getByRole('navigation', { name: 'Mobile primary' }).getByRole('button').nth({ globe: 0, purchases: 2, stats: 3 }[target]).click()
  else await p.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('button').nth({ globe: 0, stats: 1, purchases: 2 }[target]).click()
}
async function fresh(browser: Browser, width: number, height: number) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width, height }, locale: 'en-GB', colorScheme: 'dark', acceptDownloads: true, permissions: ['geolocation'], geolocation: { latitude: 32.0764, longitude: 34.76795 } })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(/generativelanguage|vision\.googleapis|groq|geoapify|nominatim/i, route => route.abort())
  return { context, page }
}

test.beforeAll(async () => { await mkdir(out, { recursive: true }) })

for (const [width, height] of [[390, 844], [1280, 900]] as const) {
  for (const locale of ['he', 'en'] as const) {
    const name = `${locale}-${width}`
    test(`integration walk ${name}`, async ({ browser }) => {
      test.setTimeout(300_000)
      const mobile = width < 761, he = locale === 'he'
      const shot = (p: Page, step: string) => p.screenshot({ path: join(out, `${name}-${step}.png`) })
      const { context, page } = await fresh(browser, width, height)
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))

      // 1. Fresh user: empty, Hebrew first.
      await page.goto('/'); await ready(page)
      await expect(page.locator('html')).toHaveAttribute('lang', 'he')
      await useLocale(page, locale)
      expect(await qa(page)).toMatchObject({ combinedPurchaseCount: 0, canonicalPins: 0 })
      await expect(page.getByTestId('home-empty')).toBeVisible()
      await shot(page, '01-empty')

      // 2. Demo toggle: view only, nothing written.
      await page.getByTestId('demo-toggle').click()
      await expect.poll(async () => (await qa(page)).combinedPurchaseCount).toBe(42)
      await shot(page, '02-demo-on')
      await navigate(page, mobile, 'purchases')
      await expect(page.getByTestId('purchases-panel')).toContainText(he ? 'נתוני דמו פעילים' : 'Demo data on')
      await shot(page, '02b-demo-purchases')
      await navigate(page, mobile, 'globe')
      await page.getByTestId('demo-toggle').click()
      await expect.poll(async () => (await qa(page)).combinedPurchaseCount).toBe(0)
      const afterDemo = await stored(page)
      expect(afterDemo === undefined || afterDemo.records.length === 0).toBe(true)
      await shot(page, '03-demo-off')

      // 3. Barcode with Tel Aviv published prices and the cheapest badge.
      const published = await (await page.request.get(`/api/catalog/0${GTIN}`)).json() as { prices: { store: { id: string; address: string; name: string }; price: number }[] }
      const cheapest = published.prices[0]
      await page.getByTestId('home-empty-add').click()
      await page.getByTestId('barcode-manual-open').click()
      await page.getByTestId('barcode-input').fill(GTIN); await page.getByTestId('barcode-submit').click()
      await expect(page.getByTestId('catalog-prices')).toBeVisible()
      await expect(page.getByTestId('catalog-price-cheapest').first()).toContainText(he ? 'הכי זול' : 'Cheapest')
      await page.getByTestId('catalog-prices').scrollIntoViewIfNeeded()
      await shot(page, '04-barcode-prices')

      // 4. Physical place → a chain branch → price, quantity, total and date fill (all editable).
      await page.getByTestId('barcode-review-purchase').click()
      await expect(page.getByTestId('review-channel').locator('option[value="physical"]')).toHaveText(he ? 'מקום פיזי' : 'Physical place')
      await page.getByTestId('review-channel').selectOption('physical')
      await page.getByTestId('review-placeId').selectOption(`catalog:${cheapest.store.id}`)
      await expect(page.getByTestId('review-price-0')).toHaveValue(cheapest.price.toFixed(2))
      await expect(page.getByTestId('review-quantity-0')).toHaveValue('1')
      await expect(page.getByTestId('review-amount')).toHaveValue(cheapest.price.toFixed(2))
      await expect(page.getByTestId('review-date')).not.toHaveValue('')
      await expect(page.getByTestId('review-price-filled')).toBeVisible()
      await page.getByTestId('review-payment').selectOption('card')
      await shot(page, '05-review-filled')
      await page.getByTestId('capture-confirm').click()
      await expect(page.getByTestId('capture-success')).toBeVisible()
      await shot(page, '06-saved')
      await page.getByTestId('capture-done').click()

      // 5. Reload: still there (IndexedDB), one pin at the confirmed chain branch.
      await page.reload(); await ready(page)
      expect(await qa(page)).toMatchObject({ sessionPurchaseCount: 1, combinedPurchaseCount: 1 })
      await expect.poll(async () => (await qa(page)).canonicalPins).toBe(1)
      const saved = await stored(page)
      expect(saved.records).toHaveLength(1)
      expect(saved.directory.places).toMatchObject([{ locationMethod: 'catalog-store', catalogStore: { storeId: cheapest.store.id } }])
      expect(Math.round(saved.records[0].purchase.originalAmount * 100)).toBe(Math.round(cheapest.price * 100))
      await shot(page, '07-reloaded-globe')
      await navigate(page, mobile, 'purchases')
      await page.locator('[data-testid^="purchase-session_purchase"]').first().click()
      await expect(page.getByTestId('purchase-detail-amount')).toBeVisible()
      await shot(page, '08-purchase-detail')
      await page.getByTestId('purchase-show-place').click()
      await expect(page.getByTestId('place-panel')).toBeVisible()
      await expect(page.getByTestId('place-catalog-provenance')).toBeVisible()
      await shot(page, '09-pin-place')

      // 6. Stats: "this month" counts the saved purchase.
      await navigate(page, mobile, 'stats')
      await expect(page.getByTestId('analytics-month-summary')).toHaveAttribute('data-source-purchases', '1')
      await shot(page, '10-stats-month')
      await navigate(page, mobile, 'globe')

      // 7. Backup export.
      await page.getByTestId('local-privacy').click()
      await expect(page.getByTestId('purchase-backup')).toBeVisible()
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-export').click()])
      const file = join(out, `${name}-backup.json`)
      await download.saveAs(file)
      await shot(page, '11-backup-panel')

      // 8. Restore into a fresh browser profile.
      const second = await fresh(browser, width, height)
      await second.page.goto('/'); await ready(second.page); await useLocale(second.page, locale)
      await second.page.getByTestId('local-privacy').click()
      await second.page.getByTestId('backup-file').setInputFiles(file)
      await expect(second.page.getByTestId('backup-count-purchases')).toHaveText('1')
      await expect(second.page.getByTestId('backup-count-places')).toHaveText('1')
      await second.page.getByTestId('backup-confirm').check()
      await second.page.getByTestId('backup-restore').click()
      await expect(second.page.getByTestId('backup-success')).toBeVisible()
      await shot(second.page, '12-restored-panel')
      await second.page.reload(); await ready(second.page)
      expect(await qa(second.page)).toMatchObject({ sessionPurchaseCount: 1 })
      await expect.poll(async () => (await qa(second.page)).canonicalPins).toBe(1)
      expect((await stored(second.page)).directory).toEqual(saved.directory)
      expect((await stored(second.page)).records).toEqual(saved.records)
      await shot(second.page, '13-restored-globe')
      await second.context.close()

      // 9. Receipt review with QA-injected (mocked) observations; explicit save, unresolved place.
      await page.goto('/?receiptReviewQa=1'); await ready(page)
      await page.getByTestId(mobile ? 'capture-open-mobile' : 'capture-open-desktop').click()
      await page.waitForFunction(() => typeof (window as unknown as { __SPENDSCAPE_RECEIPT_REVIEW_QA__?: unknown }).__SPENDSCAPE_RECEIPT_REVIEW_QA__ === 'function')
      await page.evaluate(raw => (window as unknown as { __SPENDSCAPE_RECEIPT_REVIEW_QA__: (raw: unknown) => void }).__SPENDSCAPE_RECEIPT_REVIEW_QA__(raw), oneReceipt)
      await expect(page.getByTestId('receipt-observations')).toBeVisible()
      await shot(page, '14-receipt-review')
      await page.getByTestId('review-channel').selectOption('unknown')
      // Receipt review proposes the observed store name; its category is an explicit choice.
      await expect(page.getByTestId('review-merchantName')).toHaveValue(oneReceipt.merchantName as string)
      await page.getByTestId('review-merchantCategory').selectOption('groceries')
      await page.getByTestId('review-payment').selectOption('cash')
      await page.getByTestId('review-category').selectOption('groceries')
      await page.getByTestId('receipt-timezone').selectOption('Asia/Jerusalem')
      await page.getByTestId('receipt-confirm-time').click()
      await page.getByTestId('capture-confirm').click()
      await expect(page.getByTestId('capture-success')).toBeVisible()
      await shot(page, '15-receipt-saved')
      await page.getByTestId('capture-done').click()
      expect(await qa(page)).toMatchObject({ sessionPurchaseCount: 2 })

      // 10. City price comparison for the saved receipt.
      await navigate(page, mobile, 'purchases')
      await page.getByTestId('purchase-session_purchase_receipt_02').click()
      await page.getByTestId('purchase-nearby-prices').click()
      await expect(page.getByTestId('nearby-prices-review')).toBeVisible()
      await shot(page, '16-city-comparison')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('purchase-detail')).toBeVisible()

      // 11. Address-to-pin with a mocked search: proposal only, explicit confirmation.
      let posts = 0
      await page.route('**/api/address-search', route => {
        if (route.request().method() === 'GET') return route.fulfill({ json: { status: 'available' } })
        posts++
        return route.fulfill({ json: { status: 'results', candidates: [{ address: 'Fictional street 12', city: 'Fictional city', country: 'Fictional country', longitude: 34.7900000049488, latitude: 32.07000000672003, provenance: { provider: 'geoapify', precision: 'building', match: 'full', pointAdjusted: false } }] } })
      })
      await page.getByTestId('purchase-resolve-location').click()
      await expect(page.getByTestId('location-form')).toBeVisible()
      await page.getByTestId('location-kind').selectOption('branch')
      for (const [key, value] of Object.entries({ branch: 'Fictional branch', address: 'Fictional street', city: 'Fictional city', country: 'Fictional country' })) await page.getByTestId(`location-${key}`).fill(value)
      await page.getByTestId('address-search-consent').check()
      await page.getByTestId('address-search-submit').click()
      await expect(page.getByTestId('address-candidate-0')).toBeVisible()
      expect(posts).toBe(1)
      await shot(page, '17-address-candidates')
      await page.getByTestId('address-candidate-0').click()
      await page.getByRole('button', { name: he ? 'חזרה ללא בחירת נקודה' : 'Back without choosing a point', exact: true }).click()
      await page.getByTestId('location-confirmed').check()
      await page.getByTestId('location-save').click()
      await expect(page.getByTestId('location-form')).toHaveCount(0)
      await expect.poll(async () => (await qa(page)).canonicalPins).toBe(2)
      await shot(page, '18-address-pinned')
      expect(errors).toEqual([])
      await context.close()
    })
  }
}
