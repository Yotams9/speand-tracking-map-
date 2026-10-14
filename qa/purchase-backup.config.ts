import { defineConfig } from '@playwright/test'
const output = process.env.SPENDSCAPE_BACKUP_QA_OUT
if (!output) throw Error('fresh-backup-output-required')
export default defineConfig({
  testDir: '.', testMatch: 'spendscape-purchase-backup.spec.ts', workers: 1,
  timeout: 60000, expect: { timeout: 12000 }, reporter: 'line', outputDir: output + '/results',
  use: { baseURL: 'http://127.0.0.1:3196', browserName: 'chromium', channel: 'chrome', headless: true, colorScheme: 'dark', trace: 'off', video: 'off', screenshot: 'off' },
})
