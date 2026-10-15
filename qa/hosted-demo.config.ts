import {resolve} from 'node:path'
import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'spendscape-hosted-demo.spec.ts', workers: 1, timeout: 45000, reporter: 'line',
  outputDir: process.env.SPENDSCAPE_HOSTED_QA_OUT ? resolve(process.env.SPENDSCAPE_HOSTED_QA_OUT,'results') : '../artifacts/hosted-demo-qa/results',
  use: { baseURL: 'http://127.0.0.1:3206', browserName: 'chromium', channel: 'chrome', headless: true, trace: 'off', screenshot: 'off', video: 'off' } })
