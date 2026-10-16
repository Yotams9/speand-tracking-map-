// Isolated synthetic ledger, real bundled public catalog. No provider calls.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const root = path.resolve(__dirname, '..'), ts = require(root + '/node_modules/typescript')
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f)
const { chromium, expect } = require(root + '/node_modules/@playwright/test')
const { createFixtureSpendscapeRepository } = require(root + '/src/data/spendscape-repository.ts')
const { blankReview, emptySessionLedger, saveReviewedPurchase } = require(root + '/src/features/capture/session-purchase-domain.ts')
const { emptyLocalPurchases } = require(root + '/src/features/local-purchases/local-purchase-store.ts')
const { resolvePurchaseLocation } = require(root + '/src/features/local-purchases/purchase-location.ts')
const { lookupInCatalog, catalogStoreSummaries } = require(root + '/src/data/price-catalog.ts')
const { catalogReceiptComparison } = require(root + '/src/features/nearby-prices/catalog-receipt-comparison.ts')
const base = process.env.CATALOG_QA_BASE, out = process.env.CATALOG_QA_OUT
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base || '') || !out) throw Error('isolated-loopback-and-output-required')
fs.mkdirSync(out, { recursive: true })
const catalog = JSON.parse(fs.readFileSync(root + '/data/catalog/tel-aviv.json', 'utf8'))
const product = lookupInCatalog(catalog, '05060639129102'), stores = catalogStoreSummaries(catalog)
const anchor = catalog.stores.find(s => s.id === product.prices.find(p => stores.find(s => s.id === p.store.id)?.location).store.id)
async function disk(p) {
  return p.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open('spendscape-local-purchases', 1); r.onerror = () => reject(Error('storage-open'))
    r.onsuccess = () => { const db = r.result, t = db.transaction('state'), q = t.objectStore('state').get('current'); t.oncomplete = () => { db.close(); resolve(q.result) } }
  }))
}
async function ready(p) { await expect(p.locator('main')).toHaveAttribute('data-local-state', 'ready') }
async function fixture(kind) {
  const data = await createFixtureSpendscapeRepository().loadSnapshot()
  let ledger = saveReviewedPurchase(emptySessionLedger(), 'fictional-catalog-qa', {
    ...blankReview(), source: 'receipt', channel: 'unknown', date: '2026-10-01T10:20', currency: 'ILS', payment: 'unknown', category: 'unknown', amount: kind === 'partial' ? '42' : '36',
    lines: [{ name: 'Fictional receipt row — Mango 500ml', quantity: '3', unit: 'item', price: '12' }, ...(kind === 'partial' ? [{ name: 'Fictional unmatched receipt row', quantity: '1', unit: 'item', price: '6' }] : [])],
    directoryIntent: { merchant: { name: 'Fictional catalog QA merchant', category: 'unknown', separate: false } },
  }, data, []).ledger
  if (kind !== 'unresolved') {
    const result = resolvePurchaseLocation(ledger, ledger.records[0].purchase.id, { kind: 'branch', branch: 'Fictional QA place at a public address point', address: 'Fictional fixture only', city: 'Fictional city', country: 'Israel', longitude: String(anchor.location.lon), latitude: String(anchor.location.lat), method: 'manual-coordinates', confirmed: true }, data)
    assert.equal(result.code, 'updated'); ledger = result.ledger
  }
  return { ...emptyLocalPurchases(), records: ledger.records, directory: ledger.directory, nextSequence: ledger.nextSequence }
}
async function open(p, state, he, width) {
  await p.goto(base); await ready(p)
  await p.evaluate(value => new Promise(resolve => { const r = indexedDB.open('spendscape-local-purchases', 1); r.onsuccess = () => { const db = r.result, t = db.transaction('state', 'readwrite'); t.objectStore('state').put(value, 'current'); t.oncomplete = () => { db.close(); resolve() } } }), state)
  await p.reload(); await ready(p)
  const detail = async () => {
    await p.locator(`nav[aria-label="${width < 761 ? 'Mobile primary' : 'Primary'}"]`).getByRole('button', { name: he ? 'רכישות' : 'Purchases', exact: true }).click()
    await p.getByTestId('purchase-' + state.records[0].purchase.id).click()
    await p.getByTestId('purchase-nearby-prices').click()
    await expect(p.getByTestId('catalog-historical-notice')).toBeVisible()
  }
  await detail(); return detail
}
async function match(p, itemId) {
  await p.getByTestId('catalog-query-' + itemId).fill('5060639129102')
  await p.getByTestId('catalog-search-' + itemId).click()
  await p.getByTestId('catalog-select-05060639129102').click()
  await expect(p.getByTestId('catalog-package-' + itemId)).toContainText('500')
  await expect(p.locator('[data-testid^="catalog-store-"]')).toHaveCount(0)
  await p.getByTestId('catalog-confirm-' + itemId).check()
}
;(async () => {
  let browser
  const results = []
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    for (const [width, he, kind] of [[360, false, 'complete'], [390, true, 'complete'], [430, false, 'partial'], [1280, true, 'complete'], [390, false, 'unresolved']]) {
      const context = await browser.newContext({ viewport: { width, height: width === 360 ? 740 : 900 }, reducedMotion: 'reduce' })
      await context.addInitScript(locale => localStorage.setItem('spendscape.locale.v1', locale), he ? 'he' : 'en')
      const p = await context.newPage(), errors = [], posts = []
      p.on('pageerror', e => errors.push(e.message))
      await p.route(/generativelanguage|vision\.googleapis|api\.geoapify|prices\.shufersal|pricesprodpublic/i, r => { errors.push('forbidden-provider'); return r.abort() })
      p.on('request', r => { if (r.url().endsWith('/api/catalog/search')) posts.push({ method: r.method(), body: r.postDataJSON() }) })
      const state = await fixture(kind), detail = await open(p, state, he, width), before = await disk(p), item = state.records[0].purchase.items[0]
      await match(p, item.id)
      assert.deepEqual(posts, [{ method: 'POST', body: { query: '5060639129102' } }])
      const selected = { [item.id]: { product, confirmed: true } }
      for (const radius of [5000, 10000]) {
        await p.getByTestId('catalog-radius').selectOption(String(radius))
        const expected = catalogReceiptComparison(state.records[0].purchase, state.directory.places, stores, selected, radius)
        await expect(p.locator('[data-testid^="catalog-store-"]')).toHaveCount(expected.stores.length)
        if (kind === 'unresolved') await expect(p.getByTestId('catalog-origin-required')).toBeVisible()
        for (const store of expected.stores.slice(0, 2)) {
          const card = p.getByTestId('catalog-store-' + store.store.id)
          await expect(card).toContainText(store.rows[0].publishedLocal)
          await expect(card).toContainText(store.matchedCount + '/' + state.records[0].purchase.items.length)
          const money = new Intl.NumberFormat(he ? 'he-IL' : 'en-GB', { style: 'currency', currency: 'ILS' }).format(store.totalMinor / 100)
          await expect(card).toContainText(money)
          await expect(p.getByTestId('catalog-difference-' + store.store.id)).toHaveCount(kind === 'partial' ? 0 : 1)
        }
      }
      const panel = p.getByTestId('nearby-prices-review')
      await panel.evaluate(el => { el.scrollTop = 0 }); await panel.screenshot({ path: path.join(out, `${width}-${he ? 'he' : 'en'}-${kind}-header.png`) })
      const cards = p.locator('[data-testid^="catalog-store-"]')
      if (await cards.count()) { await cards.first().scrollIntoViewIfNeeded(); await panel.screenshot({ path: path.join(out, `${width}-${he ? 'he' : 'en'}-${kind}-prices.png`) }) }
      assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
      assert.deepEqual(await disk(p), before)
      await p.getByTestId('catalog-query-' + item.id).fill('new unmatched query')
      await expect(cards).toHaveCount(0); await expect(p.getByTestId('catalog-confirm-' + item.id)).toHaveCount(0)
      await p.getByTestId('comparison-city-mode').click(); await expect(p.getByTestId('city-price-city')).toBeVisible()
      await p.getByTestId('city-price-city').selectOption('petah-tikva')
      await expect(panel).toContainText(he ? 'פגו' : 'expired')
      await p.keyboard.press('Escape'); await expect(panel).toHaveCount(0)
      await expect(p.getByTestId('purchase-nearby-prices')).toBeFocused()
      await p.getByTestId('purchase-nearby-prices').click(); await expect(p.getByTestId('catalog-confirm-' + item.id)).toHaveCount(0)
      await p.reload(); await ready(p); await detail(); assert.deepEqual(await disk(p), before)
      assert.deepEqual(errors, [])
      results.push({ width, locale: he ? 'he' : 'en', kind, passed: true, storedLedgerUnchanged: true })
      await context.close()
    }
    // Real local route contract, no external collection.
    const r = await fetch(base + '/api/catalog/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'מונסטר מנגו' }) })
    assert.equal(r.status, 200); assert((await r.json()).matches.some(p => p.gtin14 === '05060639129102'))
    for (const body of ['{}', JSON.stringify({ query: 'x'.repeat(1100) }), JSON.stringify({ query: 'valid', extra: true })]) {
      const bad = await fetch(base + '/api/catalog/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body }); assert.equal(bad.status, 400)
    }
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify({ status: 'passed', scenarios: results, localRouteChecks: 4, realProviderCalls: 0, realLedgerAccess: false }, null, 2))
    console.log(JSON.stringify({ status: 'passed', scenarios: results.length, localRouteChecks: 4, realProviderCalls: 0 }))
  } catch (error) { fs.writeFileSync(path.join(out, 'browser-failure.json'), JSON.stringify({ status: 'failed', message: error.stack }, null, 2)); console.error(error); process.exitCode = 1 }
  finally { await browser?.close() }
})()
