import { defineConfig } from '@playwright/test'
const out = process.env.SPENDSCAPE_M1_QA_OUT
if (!out) throw new Error('fresh-milestone-output-required')
export default defineConfig({
  testDir: '.', workers: 1, fullyParallel: false, timeout: 90000, expect: { timeout: 15000 },
  reporter: 'line', outputDir: `${out}/browser-results`,
  use: { baseURL: 'http://127.0.0.1:3191', browserName: 'chromium', channel: 'chrome', headless: true, colorScheme: 'dark', trace: 'off', video: 'off', screenshot: 'off' },
  projects: [
    { name: 'ordinary-user', testMatch: 'spendscape-college-m1.spec.ts' },
    { name: 'isolated-fixture-regressions', testMatch: 'college-m1-fixture-regressions.spec.ts' },
  ],
})
