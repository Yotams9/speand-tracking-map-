import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

// Savings engine walk against an explicitly started production server
// (next start on a free loopback port); pass its origin as SPENDSCAPE_SAVINGS_BASE.
const base = process.env.SPENDSCAPE_SAVINGS_BASE
if (!base) throw new Error('SPENDSCAPE_SAVINGS_BASE is required (e.g. http://127.0.0.1:3217)')
const out = resolve(__dirname, '..', 'artifacts/savings/playwright')

export default defineConfig({
  testDir: '.', testMatch: ['spendscape-savings.spec.ts'], workers: 1, fullyParallel: false, timeout: 180_000, expect: { timeout: 15_000 },
  reporter: [['line']], outputDir: `${out}/results`,
  use: { baseURL: base, browserName: 'chromium', channel: 'chrome', headless: true, colorScheme: 'dark', locale: 'en-GB', trace: 'off', video: 'off', screenshot: 'only-on-failure' },
})
