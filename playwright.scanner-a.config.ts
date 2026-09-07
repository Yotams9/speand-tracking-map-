import { defineConfig } from '@playwright/test'

// Only uses an explicitly started production server; never starts a dev server.
export default defineConfig({
  testDir: './qa',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  outputDir: 'artifacts/spendscape-scanner-a/playwright-results',
  reporter: [['line'], ['json', { outputFile: 'artifacts/spendscape-scanner-a/qa-report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    browserName: 'chromium', channel: 'chrome', headless: true,
    colorScheme: 'dark', locale: 'en-GB',
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
})
