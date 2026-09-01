import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './qa',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: 'line',
  outputDir: 'artifacts/spendscape-slice-1d1/playwright-results',
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
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
