import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'spendscape-hosted-demo.spec.ts', workers: 1, timeout: 45000, reporter: 'line',
  outputDir: '../artifacts/hosted-demo-qa/results',
  use: { baseURL: 'http://127.0.0.1:3206', browserName: 'chromium', channel: 'chrome', headless: true, trace: 'off', screenshot: 'off', video: 'off' } })
