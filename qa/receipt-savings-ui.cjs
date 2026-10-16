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
const { lookupInCatalog } = require(root + '/src/data/price-catalog.ts')
const { computeSavings } = require(root + '/src/features/savings/savings-engine.ts')
const { receiptPriceBasket } = require(root + '/src/features/savings/receipt-price-match.ts')
const { validateBarcode } = require(root + '/src/features/capture/barcode-domain.ts')
const base = process.env.RECEIPT_SAVINGS_QA_BASE, out = process.env.RECEIPT_SAVINGS_QA_OUT
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base || '') || !out) throw Error('isolated-loopback-and-output-required')
fs.mkdirSync(out, { recursive: true })
const catalog = JSON.parse(fs.readFileSync(root + '/data/catalog/tel-aviv.json', 'utf8'))
const product = lookupInCatalog(catalog, '05060639129102')
const anchor = catalog.stores.find(s => s.id === product.prices.find(p => catalog.stores.find(s => s.id === p.store.id)?.location).store.id)
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
    ...blankReview(), source: kind === 'barcode' ? 'barcode' : 'receipt', ...(kind === 'barcode' ? { identification: { identity: validateBarcode('5060639129102', 'EAN13').identity, method: 'manual', syntheticCatalog: false } } : {}), channel: 'unknown', date: '2026-10-01T10:20', currency: 'ILS', payment: 'unknown', category: 'unknown', amount: kind === 'partial' ? '42' : '36',
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
    if (state.records[0].source === 'receipt') { await p.getByTestId('purchase-nearby-prices').click(); await expect(p.getByTestId('receipt-prices-review')).toBeVisible() }
  }
  await detail(); return detail
}
async function match(p, itemId, code = '5060639129102') {
  await p.getByTestId('receipt-price-query-' + itemId).fill(code)
  await p.getByTestId('receipt-price-search-' + itemId).click()
  await p.getByTestId('receipt-price-select-05060639129102').click()
  await expect(p.getByTestId('receipt-price-result-' + itemId)).toBeVisible()
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
      await expect(p.getByTestId('catalog-receipt-comparison')).toHaveCount(0)
      await expect(p.getByTestId('comparison-catalog-mode')).toHaveCount(0)
      await match(p, item.id)
      assert.deepEqual(posts, [{ method: 'POST', body: { query: '5060639129102' } }])
      const row = p.getByTestId('receipt-price-row-' + item.id), panel = p.getByTestId('nearby-prices-review')
      for (const radius of [5000, 10000]) {
        await p.getByTestId('receipt-prices-radius').selectOption(String(radius))
        if (kind === 'unresolved') { await expect(p.getByTestId('receipt-prices-origin-required')).toBeVisible(); await expect(row.getByTestId('savings-panel')).toHaveCount(0); continue }
        const candidate = { gtin14: product.gtin14, name: product.name, quantity: product.quantity, manufacturer: product.manufacturer, weighted: product.weighted }
        const basket = receiptPriceBasket(state.records[0].purchase, item.id, candidate, state.directory.places)
        const expected = computeSavings(catalog, basket.items, basket.origin, radius)
        const card = row.getByTestId('savings-panel')
        await expect(card).toHaveAttribute('data-outcome', expected.outcome)
        const money = new Intl.NumberFormat(he ? 'he-IL' : 'en-GB', { style: 'currency', currency: 'ILS' }).format(expected.best.totalMinor / 100)
        await expect(card).toContainText(money)
        await expect(card.getByTestId('savings-price-date')).toContainText('4.10.2026')
        await expect(card.getByTestId('savings-best-store')).toContainText(expected.best.store.name)
        await expect(card).toContainText(he ? 'לא מחיר עדכני' : 'Not a current price')
      }
      await panel.evaluate(el => { el.scrollTop = 0 }); await panel.screenshot({ path: path.join(out, `${width}-${he ? 'he' : 'en'}-${kind}-header.png`) })
      await row.getByTestId('receipt-price-result-' + item.id).scrollIntoViewIfNeeded()
      await panel.screenshot({ path: path.join(out, `${width}-${he ? 'he' : 'en'}-${kind}-prices.png`) })
      if (kind !== 'unresolved') {
        const card = row.getByTestId('savings-panel'), heading = card.getByTestId('savings-best-store')
        await expect(heading).toBeInViewport()
        if (width === 390 && he) {
          const font = await card.getByTestId('savings-amount').evaluate(el => parseFloat(getComputedStyle(el).fontSize))
          assert(font >= 20)
        }
      }
      if (kind === 'partial') {
        const milkId = state.records[0].purchase.items[1].id
        await p.getByTestId('receipt-price-query-' + milkId).fill('חלב')
        await p.getByTestId('receipt-price-search-' + milkId).click()
        await expect(p.getByTestId('receipt-price-select-07290000474076')).toBeVisible()
        const milkRow = p.getByTestId('receipt-price-row-' + milkId)
        assert.equal(await milkRow.locator('[data-testid^="receipt-price-select-"]').count(), 15)
        await p.getByTestId('receipt-price-more-' + milkId).click()
        await expect(milkRow.locator('[data-testid^="receipt-price-select-"]')).toHaveCount(30)
        await p.getByTestId('receipt-price-select-07290000474076').click()
        await expect(milkRow.getByTestId('savings-best-store')).toBeVisible()
        assert.equal(await p.locator('[id]').evaluateAll(nodes => nodes.map(n => n.id).filter(id => id.startsWith('_r_')).length), await p.locator('[id]').evaluateAll(nodes => new Set(nodes.map(n => n.id).filter(id => id.startsWith('_r_'))).size))
        await milkRow.getByTestId('savings-panel').screenshot({ path: path.join(out, 'milk-immediate-result.png') })
      }
      assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
      assert.deepEqual(await disk(p), before)
      if (kind !== 'unresolved') {
        await expect(p.locator('main')).toHaveAttribute('data-map-ready', 'true', { timeout: 30000 })
        const pins = await p.locator('main').getAttribute('data-pin-count')
        await row.getByTestId('savings-show-store').click()
        await expect(panel).toHaveCount(0)
        await expect(p.getByTestId('purchase-detail')).toBeVisible()
        await p.getByTestId('purchase-nearby-prices').click()
        await match(p, item.id)
        assert.equal(await p.locator('main').getAttribute('data-pin-count'), pins)
        await expect(p.locator('.maplibregl-canvas')).toHaveCount(1)
      }
      await p.getByTestId('receipt-price-change-' + item.id).click()
      await expect(row.getByTestId('savings-panel')).toHaveCount(0)
      await expect(p.getByTestId('receipt-price-query-' + item.id)).toBeVisible()
      await p.getByTestId('comparison-city-mode').click(); await expect(p.getByTestId('city-price-city')).toBeVisible()
      await p.getByTestId('city-price-city').selectOption('petah-tikva'); await expect(panel).toContainText(he ? 'פגו' : 'expired')
      await p.keyboard.press('Escape'); await expect(panel).toHaveCount(0)
      await expect(p.getByTestId('purchase-nearby-prices')).toBeFocused()
      await p.getByTestId('purchase-nearby-prices').click(); await expect(p.getByTestId('receipt-price-result-' + item.id)).toHaveCount(0)
      await p.reload(); await ready(p); await detail(); assert.deepEqual(await disk(p), before)
      assert.deepEqual(errors, [])
      results.push({ width, locale: he ? 'he' : 'en', kind, passed: true, storedLedgerUnchanged: true })
      await context.close()
    }
    // Candidate-style automatic card for a native barcode purchase.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }), p = await context.newPage()
    await p.route(/generativelanguage|api\.geoapify/i, r => r.abort())
    await context.addInitScript(() => localStorage.setItem('spendscape.locale.v1', 'en'))
    const state = await fixture('barcode'); await open(p, state, false, 390)
    await expect(p.getByTestId('savings-best-store')).toBeVisible()
    const before = await disk(p); await p.reload(); await ready(p)
    assert.deepEqual(await disk(p), before); await context.close(); results.push({ kind: 'automatic-barcode-card', passed: true })
    // Real local route contract, no external collection.
    const r = await fetch(base + '/api/catalog/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'מונסטר מנגו' }) })
    assert.equal(r.status, 200); assert((await r.json()).matches.some(p => p.gtin14 === '05060639129102'))
    for (const body of ['{}', JSON.stringify({ query: 'x'.repeat(1100) }), JSON.stringify({ query: 'valid', extra: true }), JSON.stringify({ query: 'חלב', offset: -1 })]) {
      const bad = await fetch(base + '/api/catalog/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body }); assert.equal(bad.status, 400)
    }
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify({ status: 'passed', scenarios: results, localRouteChecks: 5, realProviderCalls: 0, realLedgerAccess: false }, null, 2))
    console.log(JSON.stringify({ status: 'passed', scenarios: results.length, localRouteChecks: 5, realProviderCalls: 0 }))
  } catch (error) { fs.writeFileSync(path.join(out, 'browser-failure.json'), JSON.stringify({ status: 'failed', message: error.stack }, null, 2)); console.error(error); process.exitCode = 1 }
  finally { await browser?.close() }
})()
