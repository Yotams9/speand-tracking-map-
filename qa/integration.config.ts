import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

// Integration run of both branches' browser suites against one explicitly
// started production server (never next dev). Start it on a free loopback port
// with SPENDSCAPE_SYNTHETIC_QA=1 and pass that origin as SPENDSCAPE_IT_BASE. Start
// qa/qa-gate-proxy.mjs in front of it and pass the proxy origin as SPENDSCAPE_IT_QA_BASE.
// - qa-gate: Shon's suites and Scanner E use the loopback synthetic QA gate.
// - ordinary: a fresh user (Hebrew, demo off) as Yotam's suites expect.
// - ordinary-en: Shon's backup suite expects an ordinary user in English.
const base = process.env.SPENDSCAPE_IT_BASE
const qaBase = process.env.SPENDSCAPE_IT_QA_BASE
if (!base || !qaBase) throw new Error('SPENDSCAPE_IT_BASE (server) and SPENDSCAPE_IT_QA_BASE (qa-gate proxy) are required')
// Paths resolve from the repository root so results stay in the git-ignored /artifacts/.
const out = resolve(__dirname, '..', process.env.SPENDSCAPE_IT_OUT ?? 'artifacts/integration/playwright')
const common = { baseURL: base, browserName: 'chromium' as const, channel: 'chrome', headless: true, colorScheme: 'dark' as const, trace: 'off' as const, video: 'off' as const, screenshot: 'only-on-failure' as const }

export default defineConfig({
  testDir: '.', workers: 1, fullyParallel: false, timeout: 120_000, expect: { timeout: 15_000 },
  reporter: [['line'], ['json', { outputFile: `${out}/report.json` }]], outputDir: `${out}/results`,
  projects: [
    {
      name: 'qa-gate',
      testMatch: ['spendscape-receipt-review-integration.spec.ts', 'spendscape-address-search.spec.ts', 'spendscape-local-directory.spec.ts', 'spendscape-nearby-demo.spec.ts', 'spendscape-scanner-e.spec.ts', 'spendscape-review-fixes.spec.ts'],
      use: { ...common, baseURL: qaBase, locale: 'en-GB' },
    },
    { name: 'ordinary', testMatch: ['spendscape-first-run.spec.ts', 'spendscape-night-shots.spec.ts', 'spendscape-contrast.spec.ts', 'spendscape-legacy-migration.spec.ts'], use: { ...common, locale: 'en-GB' } },
    // The requested manual walk-through, scripted: both viewports, both languages.
    { name: 'walk', testMatch: ['spendscape-integration-walk.spec.ts'], use: { ...common, locale: 'en-GB' } },
    {
      name: 'ordinary-en', testMatch: ['spendscape-purchase-backup.spec.ts'],
      use: { ...common, locale: 'en-GB', storageState: { cookies: [], origins: [{ origin: base, localStorage: [{ name: 'spendscape.locale.v1', value: 'en' }] }] } },
    },
  ],
})
