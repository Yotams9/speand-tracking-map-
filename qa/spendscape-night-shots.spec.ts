import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

// Visual QA walk-through: every main screen at phone and desktop size, Hebrew
// and English, with and without demo data. Screenshots stay under artifacts/.
// Run against a server on 127.0.0.1:3000:
//   SHOT_TAG=after npx playwright test qa/spendscape-night-shots.spec.ts
const tag = process.env.SHOT_TAG ?? 'latest'
const out = `artifacts/night-run/${tag}`
const REAL_GTIN = '7290000195537'

test.beforeAll(async () => { await mkdir(out, { recursive: true }) })

type Qa = { ready: boolean; locale: string; combinedPurchaseCount: number }
const qa = (page: Page) => page.evaluate(() => (window as typeof window & { __SPENDSCAPE_QA__?: Qa }).__SPENDSCAPE_QA__)

async function open(page: Page, locale: 'en' | 'he', demo: boolean) {
  await page.addInitScript(([locale, demo]) => {
    try {
      localStorage.setItem('spendscape.locale.v1', locale as string)
      localStorage.setItem('spendscape.demo-data.v1', demo ? 'on' : 'off')
    } catch { /* storage blocked */ }
  }, [locale, demo] as const)
  await page.goto('/')
  await page.waitForFunction(() => (window as typeof window & { __SPENDSCAPE_QA__?: Qa }).__SPENDSCAPE_QA__?.ready, null, { timeout: 60_000 })
  // Older builds have no stored language preference: switch by the visible button.
  if ((await page.evaluate(() => document.documentElement.lang)) !== locale) {
    await page.getByRole('button', { name: locale === 'he' ? 'Switch to Hebrew' : '×ž×¢×‘×¨ ×œ×× ×’×œ×™×ª' }).click()
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(locale)
  await page.waitForTimeout(2500)
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${out}/${name}.png` })

async function navigate(page: Page, mobile: boolean, target: 'globe' | 'purchases' | 'stats') {
  if (mobile) {
    const index = { globe: 0, purchases: 2, stats: 3 }[target]
    await page.getByRole('navigation', { name: 'Mobile primary' }).getByRole('button').nth(index).click()
  } else {
    const index = { globe: 0, stats: 1, purchases: 2 }[target]
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button').nth(index).click()
  }
  await page.waitForTimeout(600)
}

for (const [width, height] of [[390, 844], [1440, 900]] as const) {
  for (const locale of ['he', 'en'] as const) {
    for (const demo of [false, true]) {
      const name = `${locale}-${width}-${demo ? 'demo' : 'empty'}`
      test(`screens ${name}`, async ({ page }) => {
        test.setTimeout(180_000)
        const mobile = width < 761
        await page.setViewportSize({ width, height })
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await open(page, locale, demo)
        await shot(page, `${name}-01-home`)

        await navigate(page, mobile, 'purchases')
        await shot(page, `${name}-02-purchases`)
        const firstPurchase = page.locator('[data-testid^="purchase-"][data-testid*="purchase_"]').first()
        if (await firstPurchase.count()) {
          await firstPurchase.click()
          await page.waitForTimeout(500)
          await shot(page, `${name}-03-purchase-detail`)
        }

        await navigate(page, mobile, 'stats')
        await shot(page, `${name}-04-stats`)
        await navigate(page, mobile, 'globe')

        if (demo) return
        await page.getByTestId(mobile ? 'capture-open-mobile' : 'capture-open-desktop').click()
        await page.waitForTimeout(800)
        await shot(page, `${name}-05-capture`)
        await page.getByTestId('barcode-manual-open').click()
        await page.getByTestId('barcode-input').fill(REAL_GTIN)
        await page.getByTestId('barcode-submit').click()
        await expect(page.getByTestId('catalog-prices')).toBeVisible({ timeout: 20_000 })
        await page.getByTestId('catalog-prices').scrollIntoViewIfNeeded()
        await shot(page, `${name}-06-scan-result`)
        await page.getByTestId('barcode-review-purchase').click()
        await page.getByTestId('review-channel').selectOption('physical')
        const chain = page.getByTestId('review-placeId').locator('optgroup option').first()
        await page.getByTestId('review-placeId').selectOption(await chain.getAttribute('value') ?? '')
        await page.waitForTimeout(400)
        await shot(page, `${name}-07-review`)
        expect(errors).toEqual([])
      })
    }
  }
}
