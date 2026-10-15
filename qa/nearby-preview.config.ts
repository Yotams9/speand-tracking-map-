import { defineConfig } from '@playwright/test'

const out = process.env.SPENDSCAPE_NEARBY_QA_OUT
if (!out) throw new Error('fresh-nearby-output-required')
export default defineConfig({
  testDir: '.', testMatch: 'spendscape-receipt-nearby.spec.ts', workers: 1, fullyParallel: false,
  timeout: 90000, expect: { timeout: 15000 }, reporter: 'line', outputDir: `${out}/browser-results`,
  use: { baseURL: 'http://127.0.0.1:3183', browserName: 'chromium', channel: 'chrome', headless: true, colorScheme: 'dark', locale: 'en-GB', trace: 'off', video: 'off', screenshot: 'off' },
})
