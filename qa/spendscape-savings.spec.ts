import { test, expect, type Page, type Browser } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { priceDateNote } from '../src/features/savings/savings-copy'

// Savings engine, end to end, as an ordinary fresh user: scan a real Tel Aviv
// catalog barcode → save it at a chain branch → open the purchase → the
// "where is it cheaper?" panel shows a branch, a ₪ saving and the price-date
// note. Hebrew and English, phone and desktop. Screenshots go to artifacts/.
const out = process.env.SPENDSCAPE_SAVINGS_OUT ?? 'artifacts/savings'
// Goldstar 6×330 ml: published at most Tel Aviv branches with a real price spread.
const GTIN = '7290008464741'
const ORIGIN_STORE = 'shufersal-1'

async function ready(p: Page) {
  await expect(p.locator('main')).toHaveAttribute('data-local-state', 'ready', { timeout: 60_000 })
}
async function useLocale(p: Page, locale: 'he' | 'en') {
  if (await p.evaluate(() => document.documentElement.lang) !== locale) await p.getByRole('button', { name: locale === 'he' ? 'Switch to Hebrew' : 'מעבר לאנגלית' }).click()
  await expect.poll(() => p.evaluate(() => document.documentElement.lang)).toBe(locale)
}
async function fresh(browser: Browser, width: number, height: number) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width, height }, locale: 'en-GB', colorScheme: 'dark', permissions: ['geolocation'], geolocation: { latitude: 32.0764, longitude: 34.76795 } })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(/generativelanguage|vision\.googleapis|groq|geoapify|nominatim/i, route => route.abort())
  return { context, page }
}

test.beforeAll(async () => { await mkdir(out, { recursive: true }) })

for (const [width, height] of [[390, 844], [1280, 900]] as const) {
  for (const locale of ['he', 'en'] as const) {
    const name = `${locale}-${width}`
    test(`savings panel ${name}`, async ({ browser }) => {
      test.setTimeout(180_000)
      const mobile = width < 761, he = locale === 'he'
      const shot = (p: Page, step: string) => p.screenshot({ path: join(out, `${name}-${step}.png`) })
      const { context, page } = await fresh(browser, width, height)
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
      const savingsRequests: string[] = []
      page.on('request', request => { if (request.url().includes('/api/savings')) savingsRequests.push(request.postData() ?? '') })

      await page.goto('/'); await ready(page)
      await useLocale(page, locale)

      // Expected numbers come from our own API, not hard-coded prices.
      const expected = await (await page.request.post('/api/savings', { data: { items: [{ gtin14: `0${GTIN}`, quantity: 1 }], origin: { lat: 32.081361, lon: 34.770485, storeId: ORIGIN_STORE } } })).json()
      expect(expected.outcome).toBe('saving')
      const amount = new Intl.NumberFormat(he ? 'he-IL' : 'en-GB', { style: 'currency', currency: 'ILS' }).format(expected.savingMinor / 100)

      // 1. Scan (typed code): published prices, cheapest badge, chosen branch and distance.
      await page.getByTestId('home-empty-add').click()
      await page.getByTestId('barcode-manual-open').click()
      await page.getByTestId('barcode-input').fill(GTIN); await page.getByTestId('barcode-submit').click()
      await expect(page.getByTestId('catalog-prices')).toBeVisible()
      await expect(page.getByTestId('catalog-price-cheapest').first()).toContainText(he ? 'הכי זול' : 'Cheapest')
      await page.getByTestId('barcode-chosen-branch').selectOption(ORIGIN_STORE)
      await expect(page.getByTestId('barcode-cheaper-by')).toContainText(he ? 'מהסניף שבחרת' : 'cheaper than your branch')
      await page.getByTestId('barcode-show-distance').click()
      await expect(page.getByTestId('catalog-prices').locator('li').first()).toContainText(he ? /מ׳|ק״מ/ : /\d (m|km)/)
      await page.getByTestId('catalog-prices').scrollIntoViewIfNeeded()
      await shot(page, '01-barcode')

      // 2. Save at the chain branch (published price fills in; all editable).
      await page.getByTestId('barcode-review-purchase').click()
      await page.getByTestId('review-channel').selectOption('physical')
      await page.getByTestId('review-placeId').selectOption(`catalog:${ORIGIN_STORE}`)
      await page.getByTestId('review-payment').selectOption('card')
      await page.getByTestId('capture-confirm').click()
      await expect(page.getByTestId('capture-success')).toBeVisible()
      await page.getByTestId('capture-done').click()
      const before = await page.evaluate(() => new Promise<string>(resolve => {
        const request = indexedDB.open('spendscape-local-purchases', 1)
        request.onsuccess = () => { const db = request.result, tx = db.transaction('state'), value = tx.objectStore('state').get('current'); tx.oncomplete = () => { db.close(); resolve(JSON.stringify(value.result)) } }
      }))

      // 3. Open the purchase: the savings panel.
      if (mobile) await page.getByRole('navigation', { name: 'Mobile primary' }).getByRole('button').nth(2).click()
      else await page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('button').nth(2).click()
      await page.locator('[data-testid^="purchase-session_purchase"]').first().click()
      const panel = page.getByTestId('savings-panel')
      await expect(panel).toHaveAttribute('data-outcome', 'saving')
      await expect(page.getByTestId('savings-amount')).toContainText(amount)
      await expect(page.getByTestId('savings-amount')).toContainText(he ? 'היית חוסך' : 'You’d save')
      await expect(page.getByTestId('savings-best-store')).toContainText(expected.best.store.chainName[locale])
      await expect(page.getByTestId('savings-basis')).toContainText(he ? 'מחיר המדף בסניף שבו קנית' : 'shelf price where you bought')
      // The date comes from the catalog's publication times in the API result, not a literal.
      expect(expected.published?.earliest).toMatch(/^\d{4}-\d{2}-\d{2} /)
      await expect(page.getByTestId('savings-price-date')).toContainText(priceDateNote(expected, locale))
      await expect(page.getByTestId('savings-price-date')).toContainText(he ? 'ללא מבצעים' : 'without promotions')
      await panel.scrollIntoViewIfNeeded()
      await shot(page, '02-savings-panel')

      // The request carried only barcode, quantity, paid amount and the saved place.
      const body = JSON.parse(savingsRequests.at(-1)!)
      expect(Object.keys(body).sort()).toEqual(['items', 'origin'])
      expect(body.origin).toEqual({ lat: 32.081361, lon: 34.770485, storeId: ORIGIN_STORE })

      // 4. Show the cheapest branch on the globe: camera only, nothing written.
      await page.getByTestId('savings-show-store').click()
      await page.waitForTimeout(800)
      await shot(page, '03-show-on-globe')
      const after = await page.evaluate(() => new Promise<string>(resolve => {
        const request = indexedDB.open('spendscape-local-purchases', 1)
        request.onsuccess = () => { const db = request.result, tx = db.transaction('state'), value = tx.objectStore('state').get('current'); tx.oncomplete = () => { db.close(); resolve(JSON.stringify(value.result)) } }
      }))
      expect(after).toBe(before)
      expect(errors).toEqual([])
      await context.close()
    })
  }
}
