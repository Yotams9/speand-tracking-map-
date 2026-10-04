import { defineConfig } from '@playwright/test'

// Requires a separately started local production server. Never falls back to dev.
export default defineConfig({
  testDir: './qa', fullyParallel: false, workers: 1, timeout: 90_000,
  expect: { timeout: 12_000 },
  outputDir: 'artifacts/spendscape-scanner-b/playwright-results',
  reporter: [['line'], ['json', { outputFile: 'artifacts/spendscape-scanner-b/qa-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:3000', browserName: 'chromium', channel: 'chrome', headless: true,
    colorScheme: 'dark', locale: 'en-GB', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
})
