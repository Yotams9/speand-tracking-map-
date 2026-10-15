import { test } from '@playwright/test'
import './spendscape-local-directory.spec'
import './spendscape-receipt-unknown-context.spec'
import './spendscape-receipt-nearby.spec'
import './spendscape-purchase-location.spec'

// Opt in only the loopback page. Never send a QA header to external map assets.
test.beforeEach(async ({ page }) => {
  await page.route(url => url.origin === 'http://127.0.0.1:3191', async route => {
    if (route.request().resourceType() === 'document') {
      await route.continue({ headers: { ...route.request().headers(), 'x-spendscape-synthetic-qa': '1' } })
    } else await route.continue()
  })
})
