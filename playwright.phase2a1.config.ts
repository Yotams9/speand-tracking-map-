import { defineConfig } from '@playwright/test'

// Requires the explicitly started production server; never falls back to next dev.
export default defineConfig({
  testDir: './qa',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: 'artifacts/spendscape-phase-2a1/playwright-results',
  reporter: [['line'], ['json', { outputFile: 'artifacts/spendscape-phase-2a1/qa-report.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    colorScheme: 'dark',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
