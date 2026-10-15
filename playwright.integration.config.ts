import { defineConfig } from '@playwright/test'
const out=process.env.SPENDSCAPE_INTEGRATION_OUT ?? 'artifacts/integration-20261015/browser-final'
export default defineConfig({
  testDir:'./qa', testMatch:['spendscape-main-integration.spec.ts','spendscape-receipt-location-ux.spec.ts','spendscape-purchase-backup.spec.ts','spendscape-purchase-time.spec.ts'], fullyParallel:false, workers:1,
  timeout:90000, expect:{timeout:15000}, reporter:[['line'],['json',{outputFile:out+'/results.json'}]],outputDir:out+'/results',
  use:{baseURL:'http://127.0.0.1:3196',browserName:'chromium',channel:'chrome',headless:true,viewport:{width:390,height:844},colorScheme:'dark',trace:'off',screenshot:'only-on-failure'},
})
