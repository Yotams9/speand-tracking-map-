import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// Deliberately requires an already-started production server; never falls back to next dev.
export default defineConfig(base, {
  webServer: undefined,
  outputDir: 'artifacts/spendscape-slice-1d6/playwright-results',
  reporter: [['line'], ['json', { outputFile: 'artifacts/spendscape-slice-1d6/qa-report.json' }]],
  use: { ...base.use, baseURL: 'http://127.0.0.1:3000' },
})
