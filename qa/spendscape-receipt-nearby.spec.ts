import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createFixtureSpendscapeRepository } from '../src/data/spendscape-repository'
import { blankReview, emptySessionLedger, saveReviewedPurchase } from '../src/features/capture/session-purchase-domain'
import { emptyLocalPurchases } from '../src/features/local-purchases/local-purchase-store'
import { fictionalPurchase, fictionalSnapshot } from './nearby-preview-fixtures'

const out = process.env.SPENDSCAPE_NEARBY_QA_OUT!
let fixture: ReturnType<typeof emptyLocalPurchases>
let origin: [number, number]
const id = 'session_purchase_receipt_01'
async function ready(page: Page) { await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready'); await expect(page.locator('main')).toHaveAttribute('data-map-ready', 'true') }
async function stored(page: Page) {
  return page.evaluate(() => new Promise<any>((resolve, reject) => {
    const r = indexedDB.open('spendscape-local-purchases', 1); r.onerror = () => reject('open')
    r.onsuccess = () => { const db = r.result, t = db.transaction('state'), q = t.objectStore('state').get('current'); t.oncomplete = () => { db.close(); resolve(q.result) } }
  }))
}
async function detail(page: Page, he = false) {
  const nav = (page.viewportSize()?.width ?? 1280) < 761 ? 'Mobile primary' : 'Primary'
  await page.locator(`nav[aria-label="${nav}"]`).getByRole('button', { name: he ? 'רכישות' : 'Purchases', exact: true }).click()
  await page.getByTestId(`purchase-${id}`).click()
}
async function setup(page: Page, qa = true, he = false, unresolved = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(/generativelanguage|vision\.googleapis|groq|geoapify|prices\.shufersal|pricesprodpublic/i, () => { throw Error('provider-forbidden') })
  await page.goto(qa ? '/?nearbyPricesQa=1' : '/'); await ready(page)
  const value = structuredClone(fixture)
  if (unresolved) { value.records[0].purchase.channel = 'unknown'; value.records[0].purchase.resolution = 'unresolved'; value.records[0].purchase.placeId = null }
  await page.evaluate(value => new Promise<void>(resolve => {
    const r = indexedDB.open('spendscape-local-purchases', 1); r.onsuccess = () => { const db = r.result, t = db.transaction('state', 'readwrite'); t.objectStore('state').put(value, 'current'); t.oncomplete = () => { db.close(); resolve() } }
  }), value)
  await page.reload(); await ready(page)
  if (he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
  await detail(page, he); await page.getByTestId('purchase-nearby-prices').click()
  await expect(page.getByTestId('nearby-prices-review')).toBeVisible()
}
async function inject(page: Page, mutate?: (s: ReturnType<typeof fictionalSnapshot>) => void) {
  const s = fictionalSnapshot(origin, new Date().toISOString()); mutate?.(s)
  return page.evaluate(s => (window as any).__SPENDSCAPE_NEARBY_QA__(s), s)
}
async function confirm(page: Page, n: number) {
  const item = fixture.records[0].purchase.items[n]
  await page.getByTestId(`nearby-match-${item.id}`).selectOption(`fictional-product-${n}`)
  await page.getByTestId(`nearby-confirm-${item.id}`).check()
}
test.beforeAll(async () => {
  await mkdir(out, { recursive: true })
  const data = await createFixtureSpendscapeRepository().loadSnapshot(), place = data.places[0], p = fictionalPurchase()
  origin = place.coordinates
  const saved = saveReviewedPurchase(emptySessionLedger(), 'fictional-nearby-qa', { ...blankReview(), source: 'receipt', channel: 'physical', merchantId: place.merchantId, placeId: place.id, date: '2013-09-30T11:57', currency: 'ILS', payment: 'unknown', category: 'unknown', amount: '31.50', lines: p.items.map(i => ({ name: i.label.en, originalLabel: i.label, quantity: String(i.quantity), unit: i.unit, price: String(i.unitPrice) })) }, data, data.purchases)
  if (saved.result.code !== 'saved') throw Error('synthetic-save-fixture-failed')
  fixture = { ...emptyLocalPurchases(), records: saved.ledger.records, directory: saved.ledger.directory, nextSequence: saved.ledger.nextSequence }
})

for (const [width, he] of [[360, false], [390, true], [430, true], [1280, false]] as const) test(`explicit matching, partial prices, close/reopen and reload ${width} ${he ? 'he' : 'en'}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 360 ? 640 : 844 })
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await setup(page, true, he); const before = await stored(page)
  await expect(page.getByTestId('nearby-qa-label')).toBeVisible(); expect(await inject(page)).toBe(true)
  const panel = page.getByTestId('nearby-prices-review'); await expect(panel).toContainText(he ? '5 ק״מ' : '5 km')
  await expect(panel).toContainText('2013-09-30'); await expect(panel).toContainText(he ? 'אין כאן השוואת חיסכון' : 'not a savings comparison')
  await panel.evaluate(node => { node.scrollTop = 0 }); await panel.screenshot({ path: join(out, `header-${width}-${he ? 'he' : 'en'}.png`) })
  await confirm(page, 0); await expect(page.getByTestId('nearby-subtotal-fictional-store-0')).toContainText(he ? 'סכום חלקי' : 'Partial subtotal')
  for (let i = 1; i < 5; i++) await confirm(page, i)
  await expect(page.getByTestId('nearby-subtotal-fictional-store-0')).toContainText(he ? 'סך סל לדוגמה' : 'Example basket total')
  await expect(page.getByTestId('nearby-store-fictional-store-1')).toContainText(he ? '2 מתוך 5' : '2 of 5')
  await expect(page.getByTestId('nearby-subtotal-fictional-store-1')).toContainText(he ? 'לא מחיר הסל המלא' : 'not the whole basket')
  await panel.screenshot({ path: join(out, `preview-${width}-${he ? 'he' : 'en'}.png`) })
  await panel.evaluate(node => { node.scrollTop = node.scrollHeight }); await panel.screenshot({ path: join(out, `summary-${width}-${he ? 'he' : 'en'}.png`) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await stored(page)).toEqual(before)
  expect(await page.evaluate(() => (window as any).__SPENDSCAPE_QA__)).toMatchObject({ combinedPurchaseCount: 43, canonicalPins: 12, mapInstanceCount: 1, mapConstructionCount: 1 })
  await page.keyboard.press('Escape'); await expect(panel).toHaveCount(0); await expect(page.getByTestId('purchase-nearby-prices')).toBeFocused()
  expect(await page.evaluate(() => typeof (window as any).__SPENDSCAPE_NEARBY_QA__)).toBe('undefined')
  await page.getByTestId('purchase-nearby-prices').click(); await expect(panel).toContainText(he ? 'אינם זמינים' : 'unavailable'); await expect(panel.locator('select')).toHaveCount(0)
  await page.reload(); await ready(page); await detail(page, he); await page.getByTestId('purchase-nearby-prices').click(); await expect(panel.locator('select')).toHaveCount(0)
  expect(await stored(page)).toEqual(before); const p = before.records[0].purchase
  expect(p.items).toHaveLength(5); expect(p.items.reduce((s: number, i: any) => s + i.quantity, 0)).toBe(7); expect(p.items.reduce((s: number, i: any) => s + Math.round(i.lineTotal * 100), 0)).toBe(3145); expect(p.originalAmount).toBe(31.5)
  expect(errors).toEqual([])
})
test('ordinary pages expose no fictional source; unresolved location stays unpinned', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); await setup(page, false, false, true)
  await expect(page.getByTestId('nearby-prices-review')).toContainText('Confirm a purchase location')
  await expect(page.getByTestId('nearby-qa-label')).toHaveCount(0); expect(await page.evaluate(() => typeof (window as any).__SPENDSCAPE_NEARBY_QA__)).toBe('undefined')
  await page.getByTestId('nearby-prices-review').screenshot({ path: join(out, 'unresolved-ordinary.png') })
  expect(await page.evaluate(() => (window as any).__SPENDSCAPE_QA__.canonicalPins)).toBe(12)
})
test('missing facts, malformed/native injections, currency, stale prices and no nearby branch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await setup(page)
  const panel = page.getByTestId('nearby-prices-review'), first = fixture.records[0].purchase.items[0].id
  expect(await inject(page, s => { s.products[0].package = null })).toBe(true)
  await page.getByTestId(`nearby-match-${first}`).selectOption('fictional-product-0'); await expect(page.getByTestId(`nearby-package-${first}`)).toContainText('Package size unknown'); await expect(page.getByTestId(`nearby-confirm-${first}`)).toHaveCount(0)
  expect(await inject(page, s => { s.classification = 'qualified' })).toBe(false)
  expect(await page.evaluate(() => (window as any).__SPENDSCAPE_NEARBY_QA__({ token: 'synthetic-secret' }))).toBe(false)
  expect(await inject(page, s => { s.source.currency = null })).toBe(true); await confirm(page, 0); await expect(page.getByTestId('nearby-store-fictional-store-0')).toContainText('Price currency not verified')
  expect(await inject(page, s => { s.source.publishedAt = '2020-01-01T00:00:00.000Z' })).toBe(true); await confirm(page, 0); await expect(page.getByTestId('nearby-store-fictional-store-0')).toContainText('Price is out of date')
  expect(await inject(page, s => { s.stores.forEach(store => { store.coordinates = [0, 0] }) })).toBe(true); await expect(panel).toContainText('No qualified stores')
  expect(JSON.stringify(await stored(page))).not.toMatch(/fictional-product|fictional-source|matches|snapshot|synthetic-secret/)
})
