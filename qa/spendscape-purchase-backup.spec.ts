import { test, expect, type Page } from '@playwright/test'
import { readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { backupFixtureContext as context, fictionalBackupLedger } from './purchase-backup-fixtures'
import { exportPurchaseBackup, BACKUP_MAX_BYTES } from '../src/features/local-purchases/purchase-backup'
import { emptyLocalPurchases } from '../src/features/local-purchases/local-purchase-store'

const out = process.env.SPENDSCAPE_BACKUP_QA_OUT!
let text = ''
const fixture = fictionalBackupLedger()
async function disk(page: Page) {
  return page.evaluate(() => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open('spendscape-local-purchases', 1)
    request.onerror = () => reject(Error('fictional-open-failed'))
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction('state'), value = transaction.objectStore('state').get('current')
      transaction.oncomplete = () => { db.close(); resolve(value.result) }
    }
  }))
}
async function seed(page: Page, value: unknown) {
  await page.evaluate(value => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('spendscape-local-purchases', 1)
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction('state', 'readwrite')
      transaction.objectStore('state').put(value, 'current')
      transaction.oncomplete = () => { db.close(); resolve() }
      transaction.onabort = () => { db.close(); reject(Error('fictional-seed-failed')) }
    }
  }), value)
}
async function start(page: Page, he = false, width = 390) {
  await page.setViewportSize({ width, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route(/geoapify|generativelanguage|vision\.googleapis|groq|prices\.shufersal|pricesprodpublic/i, () => { throw Error('external-provider-forbidden') })
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  if (he) await page.getByRole('button', { name: 'Switch to Hebrew' }).click()
}
async function open(page: Page) { await page.getByTestId('local-privacy').click(); await expect(page.getByTestId('purchase-backup')).toBeVisible() }
async function inspect(page: Page, value = text) {
  await page.getByTestId('backup-file').setInputFiles({ name: 'fictional-backup.json', mimeType: 'application/json', buffer: Buffer.from(value) })
}
async function confirm(page: Page) {
  await page.getByTestId('backup-confirm').check()
  await page.getByTestId('backup-restore').click()
  await expect(page.getByTestId('backup-success')).toBeVisible()
}
test.beforeAll(async () => { await mkdir(out, { recursive: true }); text = await exportPurchaseBackup(fixture, context) })

for (const [he, width] of [[false, 360], [true, 390], [false, 430], [false, 1280]] as const) {
  test(`explicit export / preview / restore / reload and shared pin ${width} ${he}`, async ({ page, browser }) => {
    await start(page, he, width); await seed(page, fixture); await page.reload()
    await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
    await open(page)
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId('backup-export').click()
    const download = await downloadPromise, path = await download.path()
    expect(path).not.toBeNull()
    const actual = await readFile(path!, 'utf8')
    expect(JSON.parse(actual).data).toEqual(fixture)
    expect(JSON.parse(actual).references).toEqual({ merchants: [], places: [] })
    expect(await disk(page)).toEqual(fixture)
    await expect(page.getByTestId('backup-nonempty')).toBeVisible()

    const fresh = await browser.newContext({ viewport: { width, height: 844 }, baseURL: 'http://127.0.0.1:3196', acceptDownloads: true })
    const target = await fresh.newPage()
    await start(target, he, width); await open(target); await inspect(target, actual)
    await expect(target.getByTestId('backup-preview')).toBeVisible()
    await expect(target.getByTestId('backup-count-purchases')).toHaveText('4')
    await expect(target.getByTestId('backup-count-places')).toHaveText('1')
    expect(await disk(target)).toBeUndefined()
    await expect(target.getByTestId('backup-restore')).toBeDisabled()
    await target.getByTestId('backup-confirm').check()
    await target.getByTestId('backup-preview').scrollIntoViewIfNeeded()
    expect(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await target.screenshot({ path: join(out, `backup-preview-${width}-${he ? 'he' : 'en'}.png`) })
    await target.getByTestId('backup-restore').click()
    await expect(target.getByTestId('backup-success')).toBeVisible()
    const expected = { ...fixture, revision: 1 }
    expect(await disk(target)).toEqual(expected)
    await target.getByRole('dialog').getByRole('button', { name: he ? 'סגירה' : 'Close', exact: true }).click()
    await expect(target.locator('main')).toHaveAttribute('data-pin-count', '1')
    expect(await target.locator('canvas.maplibregl-canvas').count()).toBe(1)
    const nav = width < 761 ? 'Mobile primary' : 'Primary'
    await target.locator(`nav[aria-label="${nav}"]`).getByRole('button', { name: he ? 'רכישות' : 'Purchases', exact: true }).click()
    expect(await target.locator('[data-testid^="purchase-session_purchase_"]').count()).toBe(4)
    await target.reload(); await expect(target.locator('main')).toHaveAttribute('data-local-state', 'ready')
    expect(await disk(target)).toEqual(expected)
    await expect(target.locator('main')).toHaveAttribute('data-pin-count', '1')
    await open(target); await inspect(target, actual)
    await expect(target.getByTestId('backup-preview')).toBeVisible()
    await expect(target.getByTestId('backup-restore')).toBeDisabled()
    await expect(target.getByTestId('backup-confirm')).toBeDisabled()
    expect(await disk(target)).toEqual(expected)
    await fresh.close()
  })
}
test('invalid, unsupported, corrupt and oversized files never write or display their content', async ({ page }) => {
  await start(page); await open(page)
  for (const [value, pattern] of [['{synthetic-secret', /valid, complete/], [JSON.stringify({ format: 'other', version: 99 }), /Unsupported/], [text.replace('Fictional package', 'fictional-secret-changed'), /Integrity check/], [' '.repeat(BACKUP_MAX_BYTES + 1), /8 MiB/]] as const) {
    await inspect(page, value); await expect(page.getByTestId('backup-error')).toContainText(pattern)
    await expect(page.getByTestId('backup-preview')).toHaveCount(0)
    expect(await disk(page)).toBeUndefined()
    await expect(page.getByRole('dialog')).not.toContainText('synthetic-secret')
  }
})
test('cancel / close clears preview; no automatic restore or hydration write', async ({ page }) => {
  await start(page); await open(page); await inspect(page)
  await expect(page.getByTestId('backup-preview')).toBeVisible()
  await page.getByTestId('backup-cancel').click(); await expect(page.getByTestId('backup-preview')).toHaveCount(0)
  expect(await disk(page)).toBeUndefined()
  await inspect(page); await expect(page.getByTestId('backup-preview')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await open(page); await expect(page.getByTestId('backup-preview')).toHaveCount(0)
  await page.reload(); await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  expect(await disk(page)).toBeUndefined()
})
test('transaction interruption rolls back fully and never reports a saved restore', async ({ page }) => {
  await start(page); await open(page); await inspect(page)
  await expect(page.getByTestId('backup-preview')).toBeVisible()
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) { const result = put.apply(this, args); this.transaction.abort(); return result }
  })
  await page.getByTestId('backup-confirm').check(); await page.getByTestId('backup-restore').click()
  await expect(page.getByTestId('backup-error')).toContainText('did not complete')
  await expect(page.getByTestId('backup-success')).toHaveCount(0)
  expect(await disk(page)).toBeUndefined()
  await page.reload(); await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  expect(await disk(page)).toBeUndefined(); await expect(page.locator('main')).toHaveAttribute('data-pin-count', '0')
})
test('destination filled after preview is rejected inside the transaction without overwrite', async ({ page }) => {
  await start(page); await open(page); await inspect(page)
  await expect(page.getByTestId('backup-preview')).toBeVisible()
  const competing = { ...fixture, revision: 1 }
  await seed(page, competing)
  await page.getByTestId('backup-confirm').check(); await page.getByTestId('backup-restore').click()
  await expect(page.getByTestId('backup-error')).toContainText('destination is not empty')
  expect(await disk(page)).toEqual(competing); await expect(page.getByTestId('backup-success')).toHaveCount(0)
})
test('empty changed revision conflicts; empty tombstone preserves monotonic sequence', async ({ page }) => {
  await start(page); await open(page); await inspect(page)
  await expect(page.getByTestId('backup-preview')).toBeVisible()
  const tombstone = { ...emptyLocalPurchases(), revision: 40, nextSequence: 100 }
  await seed(page, tombstone)
  await page.getByTestId('backup-confirm').check(); await page.getByTestId('backup-restore').click()
  await expect(page.getByTestId('backup-error')).toContainText('changed in another tab'); expect(await disk(page)).toEqual(tombstone)
  await page.reload(); await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await open(page); await inspect(page); await expect(page.getByTestId('backup-preview')).toBeVisible(); await confirm(page)
  expect(await disk(page)).toEqual({ ...fixture, revision: 41, nextSequence: 100 })
})
test('revision overflow cannot wrap and overwrite a destination tombstone', async ({ page }) => {
  await start(page)
  const tombstone = { ...emptyLocalPurchases(), revision: Number.MAX_SAFE_INTEGER }
  await seed(page, tombstone); await page.reload()
  await expect(page.locator('main')).toHaveAttribute('data-local-state', 'ready')
  await open(page); await inspect(page); await expect(page.getByTestId('backup-preview')).toBeVisible()
  await page.getByTestId('backup-confirm').check(); await page.getByTestId('backup-restore').click()
  await expect(page.getByTestId('backup-error')).toContainText('did not complete')
  expect(await disk(page)).toEqual(tombstone)
})
