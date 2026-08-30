import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './qa',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: 'line',
  outputDir: 'artifacts/spendscape-globe-polish-1c1/playwright-results',
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    colorScheme: 'dark',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
