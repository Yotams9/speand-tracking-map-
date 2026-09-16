import { defineConfig } from '@playwright/test'

// Production server is started explicitly. All QA input is synthetic.
export default defineConfig({
  testDir: './qa', fullyParallel: false, workers: 1, timeout: 90_000,
  expect: { timeout: 12_000 },
  outputDir: 'artifacts/spendscape-scanner-e/playwright-results',
  reporter: [['line'], ['json', { outputFile: 'artifacts/spendscape-scanner-e/qa-report.json' }]],
  use: { baseURL: 'http://127.0.0.1:3000', browserName: 'chromium', channel: 'chrome', headless: true,
    colorScheme: 'dark', locale: 'en-GB', trace: 'off', screenshot: 'off' },
})
